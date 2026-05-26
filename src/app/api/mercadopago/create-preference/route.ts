import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPreferenceClient } from '@/lib/mercadopago'
import { getPlanPrice, getCycleLabel } from '@/lib/plans'
import { validateCoupon } from '@/actions/coupons'
import type { BillingCycle } from '@/lib/plans'
import type { Plan } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, billingCycle, companyId, couponCode } = body as {
      planId: string
      billingCycle: BillingCycle
      companyId: string
      couponCode?: string
    }

    if (!planId || !billingCycle || !companyId) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: planId, billingCycle, companyId' },
        { status: 400 }
      )
    }

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const preferenceClient = getPreferenceClient()
    if (!preferenceClient) {
      return NextResponse.json(
        { error: 'Integração com Mercado Pago não configurada' },
        { status: 503 }
      )
    }

    const typedPlan = plan as Plan
    const basePrice = getPlanPrice(typedPlan, billingCycle)
    const cycleLabel = getCycleLabel(billingCycle)

    // Aplicar cupom de desconto (validacao server-side)
    let price = basePrice
    let appliedCouponCode: string | null = null
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, basePrice)
      if (couponResult.valid && typeof couponResult.finalPrice === 'number') {
        price = couponResult.finalPrice
        appliedCouponCode = couponCode.trim().toUpperCase()
      }
      // Cupom invalido: ignora silenciosamente e cobra o preco normal.
    }

    // Cupom de 100% (ou que zera o valor): MercadoPago rejeita unit_price <= 0.
    // Ativamos a assinatura gratuitamente de forma direta e retornamos { free: true }.
    if (price <= 0) {
      const admin = createAdminClient()
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

      // Incrementar uso do cupom
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

    const host = request.headers.get('host') || 'lokagenda-one.vercel.app'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: planId,
            title: `${typedPlan.name} - ${cycleLabel}`,
            description: typedPlan.description || `Plano ${typedPlan.name}`,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          },
        ],
        external_reference: JSON.stringify({
          companyId,
          planId,
          billingCycle,
          couponCode: appliedCouponCode,
        }),
        back_urls: {
          success: `${appUrl}/dashboard/assinatura?status=success`,
          failure: `${appUrl}/dashboard/assinatura?status=failure`,
          pending: `${appUrl}/dashboard/assinatura?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mercadopago/webhook`,
      },
    })

    return NextResponse.json({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[MercadoPago] Erro ao criar preferência:', errMsg, error)
    return NextResponse.json(
      { error: 'Erro interno ao criar preferência de pagamento. Tente novamente.' },
      { status: 500 }
    )
  }
}
