import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPreferenceClient } from '@/lib/mercadopago'
import { getPlanPrice, getCycleLabel } from '@/lib/plans'
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
    const { planId, billingCycle, companyId } = body as {
      planId: string
      billingCycle: BillingCycle
      companyId: string
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
    const price = getPlanPrice(typedPlan, billingCycle)
    const cycleLabel = getCycleLabel(billingCycle)

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
