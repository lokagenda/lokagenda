import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createAsaasCheckout,
  createAsaasCustomer,
  isAsaasConfigured,
  toAsaasCycle,
  asaasCheckoutUrl,
} from '@/lib/asaas'
import { getPlanPrice, getCycleLabel } from '@/lib/plans'
import { validateCoupon } from '@/actions/coupons'
import type { BillingCycle } from '@/lib/plans'
import type { Plan } from '@/types/database'

/**
 * Substituto do /api/mercadopago/create-preference. Mesma signature de request
 * ({ planId, billingCycle, companyId, couponCode }) e mesmo shape de resposta
 * ({ init_point } | { free: true, redirect } | { requiresDocument: true }).
 *
 * Fluxo:
 *   1. Auth user
 *   2. Busca plano + aplica cupom
 *   3. Cupom 100% -> ativa gratis, retorna free:true
 *   4. Se companies.document ausente -> retorna requiresDocument:true (UI abre modal)
 *   5. Reusa asaas_customer_id de subscription anterior OU cria customer novo
 *   6. Cria checkout hosted com chargeTypes RECURRENT
 *   7. Grava customer_id + checkout_id na subscription
 *   8. Retorna { init_point: checkoutUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const body = await request.json()
    const { planId, billingCycle, companyId, couponCode } = body as {
      planId: string
      billingCycle: BillingCycle
      companyId: string
      couponCode?: string
    }

    if (!planId || !billingCycle || !companyId) {
      return NextResponse.json(
        { error: 'Parametros obrigatorios: planId, billingCycle, companyId' },
        { status: 400 },
      )
    }

    if (!isAsaasConfigured()) {
      return NextResponse.json(
        { error: 'Integracao com Asaas nao configurada' },
        { status: 503 },
      )
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano nao encontrado' }, { status: 404 })
    }

    const typedPlan = plan as Plan
    const basePrice = getPlanPrice(typedPlan, billingCycle)
    const cycleLabel = getCycleLabel(billingCycle)

    let price = basePrice
    let appliedCouponCode: string | null = null
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, basePrice)
      if (couponResult.valid && typeof couponResult.finalPrice === 'number') {
        price = couponResult.finalPrice
        appliedCouponCode = couponCode.trim().toUpperCase()
      }
    }

    const admin = createAdminClient()

    if (price <= 0) {
      const now = new Date()
      const periodEnd = new Date(now)
      if (billingCycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
      else if (billingCycle === 'semiannual') periodEnd.setMonth(periodEnd.getMonth() + 6)
      else if (billingCycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1)

      const { data: existing } = await admin
        .from('subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const subData = {
        plan_id: planId,
        status: 'active' as const,
        billing_cycle: billingCycle,
        current_price: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        coupon_code: appliedCouponCode,
        discount_applied: basePrice,
        updated_at: now.toISOString(),
      }

      if (existing) {
        await admin.from('subscriptions').update(subData).eq('id', existing.id)
      } else {
        await admin.from('subscriptions').insert({ company_id: companyId, ...subData })
      }

      if (appliedCouponCode) {
        const { data: coupon } = await admin
          .from('coupons')
          .select('id, used_count')
          .eq('code', appliedCouponCode)
          .maybeSingle()
        if (coupon) {
          await admin
            .from('coupons')
            .update({ used_count: (coupon.used_count || 0) + 1, updated_at: now.toISOString() })
            .eq('id', coupon.id)
        }
      }

      return NextResponse.json({ free: true, redirect: '/dashboard/assinatura?status=success' })
    }

    const { data: company } = await admin
      .from('companies')
      .select('name, document, email, phone')
      .eq('id', companyId)
      .single()

    if (!company) return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 })

    if (!company.document || company.document.replace(/\D/g, '').length < 11) {
      return NextResponse.json({ requiresDocument: true })
    }

    const customerEmail = company.email || user.email
    if (!customerEmail) {
      return NextResponse.json({ error: 'Email nao encontrado para cadastro no Asaas' }, { status: 400 })
    }

    const { data: lastSub } = await admin
      .from('subscriptions')
      .select('id, asaas_customer_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = lastSub?.asaas_customer_id ?? null

    if (!customerId) {
      const customerResult = await createAsaasCustomer({
        name: company.name,
        cpfCnpj: company.document,
        email: customerEmail,
        phone: company.phone ?? undefined,
        externalReference: companyId,
      })
      if ('asaasError' in customerResult) {
        console.error('[Asaas] createCustomer erro:', customerResult.asaasError)
        return NextResponse.json({ error: `Erro Asaas (customer): ${customerResult.asaasError}` }, { status: 502 })
      }
      customerId = customerResult.id
    }

    const host = request.headers.get('host') || 'www.lokagenda.com.br'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

    const maxInstallments =
      billingCycle === 'annual' ? 12 : billingCycle === 'semiannual' ? 6 : 1

    const externalRef = JSON.stringify({ companyId, planId, billingCycle, couponCode: appliedCouponCode })

    const checkoutResult = await createAsaasCheckout({
      customerId,
      value: price,
      planTitle: `${typedPlan.name} - ${cycleLabel}`,
      planDescription: typedPlan.description || `Plano ${typedPlan.name}`,
      cycle: toAsaasCycle(billingCycle),
      maxInstallments,
      externalReference: externalRef,
      successUrl: `${appUrl}/dashboard/assinatura?status=success`,
      cancelUrl: `${appUrl}/dashboard/assinatura?status=failure`,
      expiredUrl: `${appUrl}/dashboard/assinatura?status=pending`,
    })

    if ('asaasError' in checkoutResult) {
      console.error('[Asaas] createCheckout erro:', checkoutResult.asaasError)
      return NextResponse.json({ error: `Erro Asaas (checkout): ${checkoutResult.asaasError}` }, { status: 502 })
    }

    const now = new Date()
    if (lastSub?.id) {
      await admin
        .from('subscriptions')
        .update({
          asaas_customer_id: customerId,
          asaas_checkout_id: checkoutResult.id,
          updated_at: now.toISOString(),
        })
        .eq('id', lastSub.id)
    } else {
      await admin.from('subscriptions').insert({
        company_id: companyId,
        plan_id: planId,
        status: 'trial',
        billing_cycle: billingCycle,
        current_price: price,
        coupon_code: appliedCouponCode,
        asaas_customer_id: customerId,
        asaas_checkout_id: checkoutResult.id,
        updated_at: now.toISOString(),
      })
    }

    return NextResponse.json({
      init_point: asaasCheckoutUrl(checkoutResult),
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[Asaas] Erro ao criar checkout:', errMsg, error)
    return NextResponse.json(
      { error: 'Erro interno ao criar checkout de pagamento. Tente novamente.' },
      { status: 500 },
    )
  }
}
