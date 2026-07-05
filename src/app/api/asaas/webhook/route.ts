import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook do Asaas. Substitui /api/mercadopago/webhook.
 *
 * Auth: header `asaas-access-token` == ASAAS_WEBHOOK_TOKEN (comparacao literal).
 * Idempotencia global: event_id em webhook_events_asaas (PK unique).
 *
 * Contexto de parcelamento (05/jul incident):
 * Quando cliente paga em 12x via chargeTypes ["DETACHED","INSTALLMENT"]:
 *   - Asaas cria 12 payments com value=39.99 cada (parcelas)
 *   - Todos com externalReference NULL (Asaas nao propaga do checkout pros payments)
 *   - Todos com checkoutSession = nosso asaas_checkout_id
 *   - Todos com installment = id do installment plan (mesmo pros 12)
 *   - Dispara 12 PAYMENT_CONFIRMED em rajada (6s)
 *
 * Solucoes:
 *   1. Se externalReference null -> fallback: resolve companyId/planId/billingCycle
 *      via lookup de subscription onde asaas_checkout_id = payment.checkoutSession
 *   2. Idempotencia por installment: se sub ja tem asaas_installment_id igual ao
 *      payment.installment, ignora (evita estender 12 vezes o periodo)
 *
 * Eventos processados:
 *   - PAYMENT_RECEIVED / PAYMENT_CONFIRMED: ativa/renova sub, dispara WhatsApp
 *   - PAYMENT_OVERDUE: past_due
 *   - PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_REQUESTED: cancelled
 */

type AsaasPaymentPayload = {
  id?: string
  event?: string
  dateCreated?: string
  payment?: {
    id?: string
    customer?: string
    subscription?: string
    checkoutSession?: string
    installment?: string
    value?: number
    netValue?: number
    status?: string
    externalReference?: string | null
    payerEmail?: string
    dueDate?: string
  }
}

type BillingCycle = 'monthly' | 'semiannual' | 'annual'

type ResolvedRef = {
  companyId: string
  planId: string
  billingCycle: BillingCycle
  couponCode?: string | null
  subscriptionId?: string
}

function addCycle(d: Date, cycle: BillingCycle): Date {
  const r = new Date(d)
  switch (cycle) {
    case 'monthly':
      r.setMonth(r.getMonth() + 1)
      break
    case 'semiannual':
      r.setMonth(r.getMonth() + 6)
      break
    case 'annual':
      r.setFullYear(r.getFullYear() + 1)
      break
  }
  return r
}

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Resolve companyId/planId/billingCycle. Ordem:
 *   1. Tenta externalReference (payments avulsos vem com ele)
 *   2. Fallback: busca subscription por asaas_checkout_id (parcelamento nao propaga externalRef)
 */
async function resolveRef(
  admin: AdminClient,
  payment: NonNullable<AsaasPaymentPayload['payment']>,
): Promise<ResolvedRef | null> {
  if (payment.externalReference) {
    try {
      const parsed = JSON.parse(payment.externalReference) as ResolvedRef
      if (parsed.companyId && parsed.planId && parsed.billingCycle) {
        return parsed
      }
    } catch {
      // segue pro fallback
    }
  }

  if (payment.checkoutSession) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, company_id, plan_id, billing_cycle, coupon_code')
      .eq('asaas_checkout_id', payment.checkoutSession)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sub && sub.company_id && sub.plan_id && sub.billing_cycle) {
      return {
        companyId: sub.company_id,
        planId: sub.plan_id,
        billingCycle: sub.billing_cycle as BillingCycle,
        couponCode: sub.coupon_code,
        subscriptionId: sub.id,
      }
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (!expectedToken) {
      console.warn('[Asaas Webhook] ASAAS_WEBHOOK_TOKEN nao configurado — aceitando request (dev)')
    } else {
      const receivedToken = request.headers.get('asaas-access-token')
      if (receivedToken !== expectedToken) {
        console.error('[Asaas Webhook] Token invalido')
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }

    const body = (await request.json()) as AsaasPaymentPayload

    if (!body?.event) {
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    // Idempotencia global: event.id PK bloqueia reprocessamento.
    if (body.id) {
      const { error: dedupErr } = await admin
        .from('webhook_events_asaas')
        .insert({ event_id: body.id, event_type: body.event })
      if (dedupErr && dedupErr.code === '23505') {
        return NextResponse.json({ received: true, deduped: true })
      }
    }

    const payment = body.payment
    if (!payment) {
      return NextResponse.json({ received: true })
    }

    const ref = await resolveRef(admin, payment)
    if (!ref) {
      console.warn(
        `[Asaas Webhook] Nao consegui resolver ref pra event=${body.event} pay=${payment.id} checkout=${payment.checkoutSession} externalRef=${payment.externalReference}`,
      )
      return NextResponse.json({ received: true, skipped: 'no_ref' })
    }

    const { companyId, planId, billingCycle, couponCode } = ref
    const now = new Date()

    if (body.event === 'PAYMENT_CONFIRMED' || body.event === 'PAYMENT_RECEIVED') {
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id, status, current_period_end, asaas_installment_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Idempotencia por installment: 12 parcelas do mesmo installment plan
      // disparam 12 eventos PAYMENT_CONFIRMED. So a primeira deve ativar.
      if (
        payment.installment &&
        existing?.asaas_installment_id &&
        existing.asaas_installment_id === payment.installment &&
        existing.status === 'active'
      ) {
        return NextResponse.json({ received: true, skipped: 'installment_already_processed' })
      }

      // Preco correto: pega do plano por billing_cycle. NAO usa payment.value
      // porque em parcelamento vem so o valor da parcela (39.99), nao o total.
      const { data: plan } = await admin
        .from('plans')
        .select('price_monthly, price_semiannual, price_annual')
        .eq('id', planId)
        .single()

      let planPrice = 0
      if (plan) {
        if (billingCycle === 'monthly') planPrice = plan.price_monthly
        else if (billingCycle === 'semiannual') planPrice = plan.price_semiannual ?? plan.price_monthly * 6
        else if (billingCycle === 'annual') planPrice = plan.price_annual ?? plan.price_monthly * 12
      }

      const normalizedCoupon = couponCode ? couponCode.trim().toUpperCase() : null
      let discountApplied: number | null = null
      // Se pagou via parcelamento, o total real do installment plan = value_parcela * qtd_parcelas.
      // No caso do checkout de assinatura, o valor cobrado eh igual ao planPrice, entao discount=0.
      // Se houver cupom, o preco final ja estava correto no create-checkout — nao recalculo aqui.

      // Pagamento antecipado: se ja esta active E periodo nao acabou, estende.
      let periodStart: Date
      let periodEnd: Date
      if (
        existing &&
        existing.status === 'active' &&
        existing.current_period_end &&
        new Date(existing.current_period_end).getTime() > now.getTime()
      ) {
        periodStart = new Date(existing.current_period_end)
        periodEnd = addCycle(periodStart, billingCycle)
      } else {
        periodStart = now
        periodEnd = addCycle(now, billingCycle)
      }

      const subUpdate = {
        plan_id: planId,
        status: 'active' as const,
        billing_cycle: billingCycle,
        current_price: planPrice,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        coupon_code: normalizedCoupon,
        discount_applied: discountApplied,
        asaas_customer_id: payment.customer ?? undefined,
        asaas_subscription_id: payment.subscription ?? undefined,
        asaas_installment_id: payment.installment ?? undefined,
        updated_at: now.toISOString(),
      }

      if (existing) {
        await admin.from('subscriptions').update(subUpdate).eq('id', existing.id)
      } else {
        await admin.from('subscriptions').insert({ company_id: companyId, ...subUpdate })
      }

      if (normalizedCoupon) {
        const { data: coupon } = await admin
          .from('coupons')
          .select('id, used_count')
          .eq('code', normalizedCoupon)
          .maybeSingle()
        if (coupon) {
          await admin
            .from('coupons')
            .update({ used_count: (coupon.used_count || 0) + 1, updated_at: now.toISOString() })
            .eq('id', coupon.id)
        }
      }

      console.log(`[Asaas Webhook] ${body.event} -> subscription ativa empresa=${companyId} plano=${planId} ciclo=${billingCycle}`)

      // WhatsApp plan_activated (fire-and-forget)
      import('@/lib/whatsapp-api/sender').then(async ({ sendTemplateMessage }) => {
        const { data: company } = await admin
          .from('companies')
          .select('name, phone')
          .eq('id', companyId)
          .single()
        if (company?.phone) {
          const dataValidade = periodEnd.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
          sendTemplateMessage(
            'plan_activated',
            company.phone,
            { nome_empresa: company.name, data_validade: dataValidade },
            companyId,
          ).catch(() => {})
        }
      }).catch(() => {})
    } else if (body.event === 'PAYMENT_OVERDUE') {
      // Cuidado: nao marcar past_due se a sub esta com installment_id igual ao
      // deste payment (todas as 12 parcelas ja foram processadas juntas — se
      // vier PAYMENT_OVERDUE de uma delas por delay, nao invalida a sub).
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id, asaas_installment_id, status')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) {
        if (
          payment.installment &&
          existing.asaas_installment_id === payment.installment &&
          existing.status === 'active'
        ) {
          return NextResponse.json({ received: true, skipped: 'overdue_of_active_installment' })
        }
        await admin
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: now.toISOString() })
          .eq('id', existing.id)
      }
      console.log(`[Asaas Webhook] PAYMENT_OVERDUE empresa=${companyId}`)
    } else if (body.event === 'PAYMENT_REFUNDED' || body.event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) {
        await admin
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: now.toISOString() })
          .eq('id', existing.id)
      }
      console.log(`[Asaas Webhook] ${body.event} -> cancelled empresa=${companyId}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error)
    return NextResponse.json({ received: true, error: 'internal' })
  }
}
