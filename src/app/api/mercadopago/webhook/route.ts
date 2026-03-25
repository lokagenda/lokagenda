import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig } from '@/lib/mercadopago'
import { Payment as MercadoPagoPayment } from 'mercadopago'
import crypto from 'crypto'

/**
 * Valida a assinatura do webhook do Mercado Pago.
 */
function validateWebhookSignature(request: NextRequest, body: string): boolean {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Se não configurou o secret, aceitar (modo dev)
    console.warn('[MercadoPago Webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado, pulando validação.')
    return true
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  if (!xSignature || !xRequestId) return false

  // Extrair ts e v1 do header x-signature
  const parts = xSignature.split(',')
  const tsValue = parts.find((p) => p.trim().startsWith('ts='))?.split('=')[1]
  const v1Value = parts.find((p) => p.trim().startsWith('v1='))?.split('=')[1]

  if (!tsValue || !v1Value) return false

  // Extrair data.id da query string
  const url = new URL(request.url)
  const dataId = url.searchParams.get('data.id') || ''

  // Gerar manifest
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${tsValue};`

  // Criar HMAC
  const hmac = crypto.createHmac('sha256', webhookSecret)
  hmac.update(manifest)
  const generatedHash = hmac.digest('hex')

  return generatedHash === v1Value
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text()

    // Validar assinatura
    if (!validateWebhookSignature(request, bodyText)) {
      console.error('[MercadoPago Webhook] Assinatura inválida')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    const body = JSON.parse(bodyText)

    // Verificar se é notificação de pagamento
    if (body.type !== 'payment' && body.action !== 'payment.created' && body.action !== 'payment.updated') {
      // Outros tipos de notificação: apenas confirmar recebimento
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'ID de pagamento não encontrado' }, { status: 400 })
    }

    // Buscar detalhes do pagamento no Mercado Pago
    const config = getMercadoPagoConfig()
    if (!config) {
      console.error('[MercadoPago Webhook] Integração não configurada')
      return NextResponse.json({ error: 'Integração não configurada' }, { status: 503 })
    }

    const paymentClient = new MercadoPagoPayment(config)
    const payment = await paymentClient.get({ id: paymentId })

    if (!payment || !payment.external_reference) {
      console.error('[MercadoPago Webhook] Pagamento sem referência externa')
      return NextResponse.json({ received: true })
    }

    // Parse da referência externa
    let externalRef: { companyId: string; planId: string; billingCycle: string }
    try {
      externalRef = JSON.parse(payment.external_reference)
    } catch {
      console.error('[MercadoPago Webhook] Referência externa inválida:', payment.external_reference)
      return NextResponse.json({ received: true })
    }

    const { companyId, planId, billingCycle } = externalRef
    const admin = createAdminClient()

    if (payment.status === 'approved') {
      // Calcular período com base no billing_cycle
      const now = new Date()
      const periodEnd = new Date(now)

      switch (billingCycle) {
        case 'monthly':
          periodEnd.setMonth(periodEnd.getMonth() + 1)
          break
        case 'semiannual':
          periodEnd.setMonth(periodEnd.getMonth() + 6)
          break
        case 'annual':
          periodEnd.setFullYear(periodEnd.getFullYear() + 1)
          break
      }

      // Verificar se já existe assinatura para a empresa
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        // Atualizar assinatura existente
        await admin
          .from('subscriptions')
          .update({
            plan_id: planId,
            status: 'active',
            billing_cycle: billingCycle as 'monthly' | 'semiannual' | 'annual',
            current_price: payment.transaction_amount || 0,
            mercadopago_payer_id: payment.payer?.id?.toString() || null,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id)
      } else {
        // Criar nova assinatura
        await admin.from('subscriptions').insert({
          company_id: companyId,
          plan_id: planId,
          status: 'active',
          billing_cycle: billingCycle as 'monthly' | 'semiannual' | 'annual',
          current_price: payment.transaction_amount || 0,
          mercadopago_payer_id: payment.payer?.id?.toString() || null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
      }

      console.log(`[MercadoPago Webhook] Pagamento aprovado para empresa ${companyId}, plano ${planId}`)
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      // Atualizar para past_due
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        await admin
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      }

      console.log(`[MercadoPago Webhook] Pagamento rejeitado para empresa ${companyId}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[MercadoPago Webhook] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
