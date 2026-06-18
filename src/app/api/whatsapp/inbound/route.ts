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
}

interface UazapiInboundPayload {
  event?: string // 'message' | 'connection' | ...
  instance?: string
  data?: {
    chatid?: string
    sender?: string
    sender_pn?: string // phone resolvido se sender veio como @lid
    sender_lid?: string
    fromMe?: boolean
    isGroup?: boolean
    text?: string // UazAPI já entrega o texto pronto
    messageType?: string
    messageTimestamp?: number
    messageid?: string
    wasSentByApi?: boolean // disparada pela própria API (filtramos via webhook config)
  }
}

interface NormalizedInbound {
  phone: string | null
  fromMe: boolean
  text: string | null
  isGroup: boolean
  isStatusReply: boolean
  isNewsletter: boolean
  wasSentByApi: boolean
  source: 'z_api' | 'uazapi' | 'unknown'
}

/**
 * Detecta o formato do payload pelo SHAPE (não pelo provider configurado no
 * banco). Tolerante a ambos os providers rodando em paralelo durante migração.
 */
function normalizeInbound(raw: unknown): NormalizedInbound | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>

  // UazAPI: envelope {event, instance, data: {...}}
  if (p.event && p.data && typeof p.data === 'object') {
    const u = raw as UazapiInboundPayload
    const d = u.data || {}
    // Quem identifica a CONVERSA é chatid (sempre o "outro lado", em phone real).
    // Sender pode vir como `@lid` (LID anonimizado em multi-device) — inutil pra
    // dedup. Fallback ordem: chatid > sender_pn > sender.
    const rawId = d.chatid || d.sender_pn || d.sender || ''
    const phoneStr = typeof rawId === 'string' ? rawId.split('@')[0] : ''
    const phone = phoneStr && /^\d+$/.test(phoneStr) ? phoneStr : null
    return {
      phone,
      fromMe: d.fromMe === true,
      text: typeof d.text === 'string' && d.text.trim() !== '' ? d.text.trim() : null,
      isGroup: d.isGroup === true,
      isStatusReply: false,
      isNewsletter: false,
      wasSentByApi: d.wasSentByApi === true,
      source: 'uazapi',
    }
  }

  // Z-API legacy: campos top-level
  if (typeof p.phone === 'string' || typeof p.fromMe === 'boolean') {
    const z = raw as ZApiInboundPayload
    const txt = z.text?.message ?? z.message
    return {
      phone: typeof z.phone === 'string' ? z.phone : null,
      fromMe: z.fromMe === true,
      text: typeof txt === 'string' && txt.trim() !== '' ? txt.trim() : null,
      isGroup: z.isGroup === true,
      isStatusReply: z.isStatusReply === true,
      isNewsletter: z.isNewsletter === true,
      wasSentByApi: false,
      source: 'z_api',
    }
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
    const raw = await request.json().catch(() => null)
    const norm = normalizeInbound(raw)

    if (!norm) {
      // Payload inválido/desconhecido.
      console.warn('[inbound] payload desconhecido', typeof raw === 'object' ? Object.keys(raw || {}) : raw)
      return NextResponse.json({ received: true })
    }

    // UazAPI: se a mensagem foi disparada pela própria API (nosso sistema),
    // ignora — configuramos webhook com excludeMessages:['wasSentByApi'] mas
    // defesa em profundidade não custa.
    if (norm.wasSentByApi) {
      return NextResponse.json({ received: true, skipped: 'was_sent_by_api' })
    }

    if (norm.isGroup || norm.isStatusReply || norm.isNewsletter) {
      return NextResponse.json({ received: true })
    }

    if (!norm.phone) return NextResponse.json({ received: true })
    const phone = normalizePhone(norm.phone)
    const admin = createAdminClient()

    // Mensagem do próprio assinante (Léo respondendo manualmente pelo celular):
    // marca takeover global. Filtro anti-self-send olha whatsapp_message_log
    // pra não marcar takeover quando foi a IA que acabou de enviar.
    if (norm.fromMe === true) {
      console.log('[inbound/fromMe] entrou phone=' + phone + ' text="' + (norm.text ?? '').slice(0, 40) + '"')
      try {
        // Anti-self-send reforcado: janela 30s + comparacao por texto. Permite
        // remover dependencia do filtro wasSentByApi do webhook UazAPI (que
        // estava cortando ate mensagens manuais do celular do Leo).
        const incTextNorm = (norm.text ?? '').trim().slice(0, 60).toLowerCase()
        const { data: recentSelf } = await admin
          .from('whatsapp_message_log')
          .select('id, created_at, message')
          .eq('phone', phone)
          .gte('created_at', new Date(Date.now() - 30000).toISOString())
          .order('created_at', { ascending: false })
          .limit(5)
        const matchedSelf = (recentSelf ?? []).find((row) => {
          const logTextNorm = (row.message ?? '').trim().slice(0, 60).toLowerCase()
          return logTextNorm && logTextNorm === incTextNorm
        })
        if (matchedSelf) {
          console.log('[inbound/fromMe] cortado por self_send phone=' + phone + ' last_log_id=' + matchedSelf.id)
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

    // Gate global "modo silencioso" (panic button do admin). Quando ativo,
    // a IA não responde NADA — Léo cuida 100% manual. Independente da Z-API.
    const { data: cfg } = await admin
      .from('whatsapp_config')
      .select('ai_globally_paused_at')
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (cfg?.ai_globally_paused_at) {
      return NextResponse.json({ received: true, skipped: 'globally_paused' })
    }

    const incomingText = norm.text
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

    // Anti-loop por ECO REAL: só corta se a mensagem do lead for IDÊNTICA aos
    // primeiros 60 chars da última resposta da IA nos 30s anteriores (caso de
    // Z-API espelhar nossa própria mensagem de volta). Antes era "qualquer
    // assistant recente" — engolia respostas legítimas do lead (caso 16/jun
    // Locador-20 "Inflavel eu nao tenho" 30s após IA = ficou no vácuo).
    const { data: lastAssist } = await admin
      .from('ai_conversations')
      .select('content')
      .eq('contact_phone', phone)
      .eq('role', 'assistant')
      .gte('created_at', new Date(Date.now() - 30000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastAssist?.content) {
      const incNorm = incomingText.trim().slice(0, 60).toLowerCase()
      const lastNorm = lastAssist.content.trim().slice(0, 60).toLowerCase()
      if (incNorm && incNorm === lastNorm) {
        console.log('[inbound/anti-loop] eco real cortado phone=' + phone)
        return NextResponse.json({ received: true, skipped: 'echo' })
      }
    }

    // 1. Tentar resolver a empresa via campaign_contact existente para esse telefone
    //    (telefone já normalizado; comparamos apenas pelo valor normalizado).
    let companyId: string | null = null
    let contactId: string | null = null

    const { data: contact } = await admin
      .from('campaign_contacts')
      .select('id, company_id, status, ai_paused_until')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (contact) {
      companyId = contact.company_id
      contactId = contact.id

      const pausedUntilMs = contact.ai_paused_until ? new Date(contact.ai_paused_until).getTime() : 0
      const nowMs = Date.now()
      const pausedActive = pausedUntilMs > nowMs
      console.log('[inbound/contact] phone=' + phone + ' status=' + contact.status + ' ai_paused_until=' + (contact.ai_paused_until ?? 'null') + ' pausedActive=' + pausedActive + ' diffMs=' + (pausedUntilMs - nowMs))

      // Gate 1 — Léo pausou a IA pra esse contato manualmente (botão "Pausar IA"
      // ou via comando inline "Nick, eu respondo").
      if (pausedActive) {
        console.log('[inbound/contact] CUT_BY_PAUSE phone=' + phone)
        await admin
          .from('campaign_contacts')
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', contact.id)
        return NextResponse.json({ received: true, skipped: 'contact_paused' })
      }

      // Gate 2 — Contato fora do funil ativo: converted ou lost. Qualified
      // CONTINUA recebendo IA (perfil certo, ainda em dialogo). So pausa
      // automatico quando a IA classificar como converted ou lost de fato.
      if (contact.status === 'converted' || contact.status === 'lost') {
        console.log('[inbound/contact] CUT_BY_STATUS phone=' + phone + ' status=' + contact.status)
        await admin
          .from('campaign_contacts')
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', contact.id)
        return NextResponse.json({ received: true, skipped: `status_${contact.status}` })
      }

      // Gate aberto — IA vai responder. Marca status='contacted'.
      console.log('[inbound/contact] GATES_OPEN phone=' + phone + ' (IA vai responder)')
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
      //
      // Quando IA classifica como lost/converted/qualified, ADICIONALMENTE seta
      // ai_paused_until = +30 dias. Defesa em profundidade: se algo mais tarde
      // mudar o status de volta pra 'contacted' (race condition, edição manual,
      // bug futuro), o ai_paused_until permanece e a IA segue silenciada.
      if (aiResult.status && contactId) {
        // Qualified deixou de ser off-funnel: cliente "perfil certo + aberto"
        // ainda merece despedida educada da IA. So pausa em converted ou lost.
        const offFunnel =
          aiResult.status === 'lost' ||
          aiResult.status === 'converted'
        const update: {
          status: 'lead' | 'contacted' | 'qualified' | 'converted' | 'lost'
          updated_at: string
          ai_paused_until?: string
        } = {
          status: aiResult.status,
          updated_at: new Date().toISOString(),
        }
        if (offFunnel) {
          update.ai_paused_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          console.log('[inbound/classify] phone=' + phone + ' status=' + aiResult.status + ' ai_paused_until=+30d')
        }
        await admin.from('campaign_contacts').update(update).eq('id', contactId)
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
