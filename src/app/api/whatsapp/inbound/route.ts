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

/**
 * Heurística pra mensagens "automáticas" do WhatsApp Business (boas-vindas com
 * menu numérico, "agradecemos seu contato, retornaremos em breve", "fora do
 * expediente"). Score por sinal — ≥2 sinais = silêncio. Reduz a chance de a IA
 * cair em "menus de atendimento" do lead e poluir histórico/tokens.
 */
function looksLikeAutoReply(text: string): boolean {
  let score = 0

  // (1) Instruções numéricas explícitas ("digite 1", "aperte 2", "escolha uma opção").
  if (/(?:digite|aperte|tecle|escolha|selecione|responda\s+com)\s+(?:o\s+n[úu]mero\s+)?\d/i.test(text)) {
    score++
  }

  // (2) ≥2 emojis numerados (1️⃣ 2️⃣ ...).
  const numEmojis = text.match(/[1-9]️?⃣|🔟/g)
  if (numEmojis && numEmojis.length >= 2) score++

  // (3) ≥2 linhas começando com lista numerada ("1) ...", "2. ...", "3 - ...").
  const numberedLines = text.match(/^\s*\d+\s*[\)\.\-:]\s+\S/gm)
  if (numberedLines && numberedLines.length >= 2) score++

  // (4) Palavras-chave clássicas de auto-resposta.
  if (
    /seja\s+bem[-\s]?vind|agradec(?:emos|imento).*contato|fora\s+do\s+(?:hor[áa]rio|expediente)|respondido(?:\s+em\s+breve)?|atendente\s+(?:entrar[áa]\s+em\s+contato|ir[áa]\s+lhe\s+responder)|menu\s+(?:de\s+)?atendimento|sua\s+mensagem\s+(?:foi\s+recebida|ser[áa]\s+respondida)/i.test(
      text,
    )
  ) {
    score++
  }

  // (5) "Boas-vindas elaboradas": texto longo (≥200 chars), múltiplas linhas, ≥2 emojis.
  if (text.length >= 200 && text.split(/\r?\n/).length >= 3) {
    const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) || []).length
    if (emojiCount >= 2) score++
  }

  return score >= 2
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
    // Marca takeover global pra esse phone — IA fica em silêncio por 12h.
    //
    // IMPORTANTE: a Z-API também dispara fromMe=true pras mensagens que o
    // NOSSO sistema mandou via sendWhatsAppMessage. Sem filtro, a IA marcaria
    // a si mesma como takeover (calar a si mesma sempre que responde). Filtra
    // olhando whatsapp_message_log: se acabamos de mandar (< 10s) algo pra esse
    // mesmo phone, NÃO conta como takeover humano.
    if (payload.fromMe === true) {
      console.log('[inbound/fromMe] entrou phone=' + phone)
      try {
        const { data: recentSelf } = await admin
          .from('whatsapp_message_log')
          .select('id, created_at')
          .eq('phone', phone)
          .gte('created_at', new Date(Date.now() - 10000).toISOString())
          .limit(1)
          .maybeSingle()
        if (recentSelf) {
          console.log('[inbound/fromMe] cortado por self_send phone=' + phone + ' last_log_id=' + recentSelf.id + ' created_at=' + recentSelf.created_at)
          return NextResponse.json({ received: true, skipped: 'self_send' })
        }

        const nowIso = new Date().toISOString()
        const { error: upErr } = await admin
          .from('manual_takeovers')
          .upsert({ phone, takeover_at: nowIso, updated_at: nowIso }, { onConflict: 'phone' })
        if (upErr) {
          console.error('[inbound/fromMe] upsert manual_takeovers FALHOU phone=' + phone, upErr)
        } else {
          console.log('[inbound/fromMe] takeover gravado phone=' + phone + ' at=' + nowIso)
        }
      } catch (err) {
        console.error('[inbound/fromMe] exception phone=' + phone, err)
      }
      return NextResponse.json({ received: true })
    }

    const incomingText = extractText(payload)
    if (!incomingText) {
      // Sem texto (ex.: mídia, status): ignorar.
      return NextResponse.json({ received: true })
    }

    // Auto-resposta do WhatsApp Business ("Seja bem-vindo, digite 1 pra X"):
    // a IA não deve responder — ela ficaria preso na árvore de menu do lead e
    // pareceria que dois bots conversam entre si.
    if (looksLikeAutoReply(incomingText)) {
      return NextResponse.json({ received: true, skipped: 'auto_reply' })
    }

    // Manual takeover global: se o assinante (Léo) respondeu manualmente esse
    // telefone nas últimas 12h, a IA cala. Funciona pra QUALQUER phone — esteja
    // ele em campaign_contacts, em conversa de cliente final, ou desconhecido.
    const { data: takeover } = await admin
      .from('manual_takeovers')
      .select('takeover_at')
      .eq('phone', phone)
      .maybeSingle()
    if (takeover?.takeover_at) {
      const elapsedMs = Date.now() - new Date(takeover.takeover_at).getTime()
      if (elapsedMs >= 0 && elapsedMs < 12 * 60 * 60 * 1000) {
        return NextResponse.json({ received: true, skipped: 'manual_takeover' })
      }
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
      .select('id, company_id, status')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (contact) {
      companyId = contact.company_id
      contactId = contact.id

      // Contato fora do funil ativo: já foi qualificado, convertido ou perdido.
      // A IA não deve mais responder — humano cuida (ou já desistiu). Inclui o
      // caso clássico da esposa cadastrada por importação antiga (status='lost')
      // e do lead que já vendeu ('qualified'/'converted').
      if (contact.status === 'qualified' || contact.status === 'converted' || contact.status === 'lost') {
        await admin
          .from('campaign_contacts')
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', contact.id)
        return NextResponse.json({ received: true, skipped: `status_${contact.status}` })
      }

      // Takeover já foi checado no topo do handler (tabela manual_takeovers).
      // Aqui só atualizamos status pra "contacted" + last_message_at.
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
    //    (takeover já foi checado no topo via manual_takeovers — cobre tanto o
    //    path com contact_id quanto sem.)
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
