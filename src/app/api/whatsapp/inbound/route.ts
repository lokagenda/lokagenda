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

    // Ignora grupos/status/newsletters de saída — só faria barulho.
    if (payload.isGroup || payload.isStatusReply || payload.isNewsletter) {
      return NextResponse.json({ received: true })
    }

    const rawPhone = payload.phone
    if (!rawPhone) return NextResponse.json({ received: true })
    const phone = normalizePhone(rawPhone)
    const admin = createAdminClient()

    // Mensagem do PRÓPRIO assinante (Léo respondendo manualmente pelo WhatsApp).
    // Marca manual_takeover_at no contato — enquanto < 12h, a IA fica em silêncio
    // pra não falar por cima do atendimento humano. NÃO responde nada.
    if (payload.fromMe === true) {
      try {
        await admin
          .from('campaign_contacts')
          .update({ manual_takeover_at: new Date().toISOString() })
          .eq('phone', phone)
      } catch (err) {
        console.error('[inbound] falha ao marcar manual_takeover_at', err)
      }
      return NextResponse.json({ received: true })
    }

    const incomingText = extractText(payload)
    if (!incomingText) {
      // Sem texto (ex.: mídia, status): ignorar.
      return NextResponse.json({ received: true })
    }

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
    let contactId: string | null = null

    const { data: contact } = await admin
      .from('campaign_contacts')
      .select('id, company_id, manual_takeover_at')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (contact) {
      companyId = contact.company_id
      contactId = contact.id

      // Manual takeover: se o assinante mandou mensagem manual pra esse contato nas
      // últimas 12h, a IA fica em silêncio. Atende caso o Léo já tenha entrado na
      // conversa — evita "duas vozes" respondendo o lead ao mesmo tempo.
      const takeoverAt = (contact as { manual_takeover_at: string | null }).manual_takeover_at
      if (takeoverAt) {
        const elapsedMs = Date.now() - new Date(takeoverAt).getTime()
        if (elapsedMs >= 0 && elapsedMs < 12 * 60 * 60 * 1000) {
          // Só atualiza last_message_at pra UI ficar correta; não chama IA.
          await admin
            .from('campaign_contacts')
            .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', contact.id)
          return NextResponse.json({ received: true, skipped: 'manual_takeover' })
        }
      }

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

    // 2b. Se o contato veio de uma campanha, usar o script dela (modo venda do sistema).
    let campaignPrompt: string | null = null
    if (contactId) {
      const { data: queueItem } = await admin
        .from('campaign_queue')
        .select('campaign_id')
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (queueItem?.campaign_id) {
        const { data: campaign } = await admin
          .from('campaigns')
          .select('ai_enabled, ai_prompt')
          .eq('id', queueItem.campaign_id)
          .maybeSingle()

        // Só responde automaticamente se a campanha tiver IA habilitada.
        if (campaign && !campaign.ai_enabled) {
          return NextResponse.json({ received: true })
        }
        campaignPrompt = campaign?.ai_prompt ?? null
      }
    }

    // 3. Gerar resposta da IA e enviar de volta (se houver).
    const aiResult = await generateAiReply(companyId, phone, incomingText, { campaignPrompt })

    if (aiResult) {
      // A IA pode ter reclassificado o lead (modo campanha: qualified/converted/lost).
      // Grava direto pelo admin client — o webhook não tem sessão de usuário, então
      // NÃO dá pra usar updateContactStatus (que exige auth/getCompanyId).
      if (aiResult.status && contactId) {
        await admin
          .from('campaign_contacts')
          .update({ status: aiResult.status, updated_at: new Date().toISOString() })
          .eq('id', contactId)
      }

      if (aiResult.reply) {
        await sendWhatsAppMessage(phone, aiResult.reply, { companyId })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // Sempre retornar 200 para evitar retentativas em loop da Z-API.
    console.error('[WhatsApp Inbound] Erro:', error)
    return NextResponse.json({ received: true })
  }
}
