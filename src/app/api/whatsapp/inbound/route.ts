import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAiReply } from '@/lib/ai/agent'
import { sendWhatsAppMessage, normalizePhone } from '@/lib/whatsapp-api/sender'

/**
 * Webhook de entrada da Z-API ("on-message-received").
 *
 * A Z-API envia mensagens recebidas para este endpoint. O payload típico contém
 * campos como `phone`, `text.message` (ou `message`) e `fromMe`.
 *
 * ⚠️ LIMITAÇÃO DE MULTI-TENANCY:
 * A configuração da Z-API (`whatsapp_config`) é GLOBAL — existe uma única instância
 * de WhatsApp para a plataforma (o número do dono, Léo). Por isso não é possível
 * rotear de forma confiável uma mensagem recebida para a empresa "correta" só pelo
 * número de destino.
 *
 * Estratégia de resolução da empresa (MVP):
 *  1. Se já existe um `campaign_contact` com esse telefone, usamos a empresa dona
 *     desse contato (assumindo que ela foi quem iniciou o contato via campanha).
 *  2. Caso contrário, usamos a PRIMEIRA empresa com `ai_agent_enabled = true` como
 *     respondente padrão.
 *
 * Sempre retornamos 200 (mesmo em erro interno) para evitar tempestade de retentativas
 * da Z-API. Erros são apenas logados.
 */

interface ZApiInboundPayload {
  phone?: string
  fromMe?: boolean
  text?: { message?: string }
  message?: string
  isGroup?: boolean
  isStatusReply?: boolean
  isNewsletter?: boolean
  // Outros campos da Z-API são ignorados.
}

function extractText(payload: ZApiInboundPayload): string | null {
  const text = payload.text?.message ?? payload.message
  if (typeof text === 'string' && text.trim() !== '') {
    return text.trim()
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as ZApiInboundPayload | null

    if (!payload) {
      // Payload inválido: nada a fazer, mas confirmamos recebimento.
      return NextResponse.json({ received: true })
    }

    // Ignorar: mensagens nossas, grupos, status e newsletters (evita responder em grupo
    // e evita loops de IA-com-IA).
    if (payload.fromMe === true || payload.isGroup || payload.isStatusReply || payload.isNewsletter) {
      return NextResponse.json({ received: true })
    }

    const rawPhone = payload.phone
    const incomingText = extractText(payload)

    if (!rawPhone || !incomingText) {
      // Sem telefone ou sem texto (ex.: mídia, status): ignorar.
      return NextResponse.json({ received: true })
    }

    const phone = normalizePhone(rawPhone)
    const admin = createAdminClient()

    // Anti-loop: se a IA já respondeu este contato nos últimos 8 segundos, ignora
    // (evita conversas IA-com-IA e respostas duplicadas em rajada).
    const { data: recentReply } = await admin
      .from('ai_conversations')
      .select('id')
      .eq('contact_phone', phone)
      .eq('role', 'assistant')
      .gte('created_at', new Date(Date.now() - 8000).toISOString())
      .limit(1)
      .maybeSingle()

    if (recentReply) {
      return NextResponse.json({ received: true })
    }

    // 1. Tentar resolver a empresa via campaign_contact existente para esse telefone
    //    (telefone já normalizado; comparamos apenas pelo valor normalizado).
    let companyId: string | null = null

    const { data: contact } = await admin
      .from('campaign_contacts')
      .select('id, company_id')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (contact) {
      companyId = contact.company_id

      // Atualizar status do lead para "contacted" e marcar última mensagem.
      await admin
        .from('campaign_contacts')
        .update({
          status: 'contacted',
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)
    }

    // 2. Fallback: primeira empresa com agente de IA habilitado.
    if (!companyId) {
      const { data: enabledCompany } = await admin
        .from('companies')
        .select('id')
        .eq('ai_agent_enabled', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      companyId = enabledCompany?.id ?? null
    }

    if (!companyId) {
      // Nenhuma empresa habilitada para responder.
      return NextResponse.json({ received: true })
    }

    // 3. Gerar resposta da IA e enviar de volta (se houver).
    const reply = await generateAiReply(companyId, phone, incomingText)

    if (reply) {
      await sendWhatsAppMessage(phone, reply, { companyId })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // Sempre retornar 200 para evitar retentativas em loop da Z-API.
    console.error('[WhatsApp Inbound] Erro:', error)
    return NextResponse.json({ received: true })
  }
}
