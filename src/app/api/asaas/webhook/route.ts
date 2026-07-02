import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook do Asaas. Substitui /api/mercadopago/webhook.
 *
 * Auth: header `asaas-access-token` deve bater com ASAAS_WEBHOOK_TOKEN
 * (comparacao simples de string, NAO eh HMAC).
 *
 * Idempotencia: guarda event.id em webhook_events_asaas com PK unique.
 * Asaas manda at-least-once, entao msg duplicada retorna 200 imediato.
 *
 * Eventos processados:
 *   - PAYMENT_RECEIVED / PAYMENT_CONFIRMED: ativa/renova subscription, dispara WhatsApp
 *   - PAYMENT_OVERDUE: past_due (cartao falhou na recorrencia)
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
    value?: number
    netValue?: number
    status?: string
    externalReference?: string | null
    payerEmail?: string
    dueDate?: string
  }
}

type ExternalRef = {
  companyId: string
  planId: string
  billingCycle: 'monthly' | 'semiannual' | 'annual'
  couponCode?: string | null
}

function addCycle(d: Date, cycle: 'monthly' | 'semiannual' | 'annual'): Date {
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

    // Idempotencia. Asaas garante at-least-once, entao o mesmo event.id pode
    // chegar 2x. PK bloqueia reprocessamento.
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

    if (!payment.externalReference) {
      console.warn('[Asaas Webhook] Sem externalReference:', body.event, payment.id)
      return NextResponse.json({ received: true })
    }

    let externalRef: ExternalRef
    try {
      externalRef = JSON.parse(payment.externalReference)
    } catch {
      console.error('[Asaas Webhook] externalReference invalido:', payment.externalReference)
      return NextResponse.json({ received: true })
    }

    const { companyId, planId, billingCycle, couponCode } = externalRef
    if (!companyId || !planId || !billingCycle) {
      console.error('[Asaas Webhook] externalReference incompleto:', externalRef)
      return NextResponse.json({ received: true })
    }

    const now = new Date()

    // PAYMENT_CONFIRMED: cartao aprovado, ainda nao caiu na conta.
    // PAYMENT_RECEIVED: dinheiro caiu. Ambos ativam.
    if (body.event === 'PAYMENT_CONFIRMED' || body.event === 'PAYMENT_RECEIVED') {
      const paidAmount = payment.value || 0
      const normalizedCoupon = couponCode ? couponCode.trim().toUpperCase() : null

      let discountApplied: number | null = null
      if (normalizedCoupon) {
        const { data: plan } = await admin
          .from('plans')
          .select('price_monthly, price_semiannual, price_annual')
          .eq('id', planId)
          .single()
        if (plan) {
          let originalPrice = plan.price_monthly
          if (billingCycle === 'semiannual') originalPrice = plan.price_semiannual ?? plan.price_monthly * 6
          else if (billingCycle === 'annual') originalPrice = plan.price_annual ?? plan.price_monthly * 12
          const diff = Math.round((originalPrice - paidAmount) * 100) / 100
          if (diff > 0) discountApplied = diff
        }
      }

      const { data: existing } = await admin
        .from('subscriptions')
        .select('id, status, current_period_end')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Pagamento antecipado: se ja esta active E o periodo ainda nao acabou,
      // estende (nao substitui). Senao, zera pra now.
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
        current_price: paidAmount,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        coupon_code: normalizedCoupon,
        discount_applied: discountApplied,
        asaas_customer_id: payment.customer ?? undefined,
        asaas_subscription_id: payment.subscription ?? undefined,
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

      console.log(`[Asaas Webhook] ${body.event} -> subscription ativa empresa=${companyId} plano=${planId}`)

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
    // Sempre 200 pra evitar retry loop mesmo em bug nosso.
    return NextResponse.json({ received: true, error: 'internal' })
  }
}
