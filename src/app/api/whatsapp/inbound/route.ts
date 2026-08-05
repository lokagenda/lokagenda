import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/whatsapp-api/sender'
import { processWithDebounce } from '@/lib/ai/debounce'
import { transcribeAudio, isTranscribeConfigured } from '@/lib/ai/transcribe'
import { UazapiClient } from '@/lib/whatsapp-api/providers/uazapi'

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
  // Carimbado pelo nosso poller (uazapi-poll.ts), autenticado via CRON_SECRET.
  // Nao existe no webhook direto da UazAPI.
  purpose?: string
  data?: {
    chatid?: string
    chatid_lid?: string // LID original, quando o poller resolveu chatid -> phone
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
  // Media (audio) — populado apenas quando payload eh audio/ptt do UazAPI.
  messageType: string | null
  messageId: string | null
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
    // Quem identifica a CONVERSA e o chatid — MAS ele nem sempre vem em phone
    // real: o chip de marketing entrega "<lid>@lid" em 38 de 40 conversas 1:1.
    // O poller resolve o LID antes de encaminhar; aqui fica a guarda de ultima
    // linha, porque um LID e so digitos e passaria por /^\d+$/, virando telefone
    // fantasma de 16 digitos depois do normalizePhone.
    //
    // `sender_pn`/`sender` so entram quando NAO e fromMe: em mensagem fromMe o
    // sender e o LID do proprio aparelho do Leo, e aceita-lo gravaria o takeover
    // manual no numero dele em vez do numero do cliente.
    const pick = (v: unknown) => (typeof v === 'string' ? v : '')
    const chatid = pick(d.chatid)
    const senderRaw = pick(d.sender)
    const isFromMe = d.fromMe === true
    const candidatos = [
      chatid.endsWith('@s.whatsapp.net') ? chatid : '',
      isFromMe ? '' : pick(d.sender_pn),
      isFromMe ? '' : senderRaw.endsWith('@s.whatsapp.net') ? senderRaw : '',
    ]
    // /^\d{12,13}$/ = 55 + DDD + 8/9 digitos. LID tem 14+ e e rejeitado.
    const phoneStr =
      candidatos
        .map((v) => v.split('@')[0].replace(/\D/g, ''))
        .find((v) => /^\d{12,13}$/.test(v)) ?? ''
    if (!phoneStr) {
      console.error('[inbound] telefone nao resolvivel — descartando', {
        chatid,
        sender: senderRaw,
        isFromMe,
        messageid: d.messageid,
      })
    }
    const phone = phoneStr || null
    return {
      phone,
      fromMe: d.fromMe === true,
      text: typeof d.text === 'string' && d.text.trim() !== '' ? d.text.trim() : null,
      isGroup: d.isGroup === true,
      isStatusReply: false,
      isNewsletter: false,
      wasSentByApi: d.wasSentByApi === true,
      source: 'uazapi',
      messageType: typeof d.messageType === 'string' ? d.messageType : null,
      messageId: typeof d.messageid === 'string' ? d.messageid : null,
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
      messageType: null,
      messageId: null,
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

    // Purpose = por qual instancia UazAPI o inbound chegou. A Nick responde pela
    // MESMA instancia (via pending_inbound.purpose -> debounce -> sender).
    //
    // Resolvido AQUI NO TOPO porque o download de audio, mais abaixo, precisa do
    // token da instancia certa.
    //
    // Fonte primaria: campo `purpose` do envelope, carimbado pelo nosso poller e
    // autenticado por CRON_SECRET. A versao anterior resolvia por
    // .eq('instance_id', rawInstance).maybeSingle() — mas as DUAS linhas de
    // whatsapp_config tem instance_id='lokagenda' (as duas instancias UazAPI se
    // chamam assim), entao casavam 2 linhas, o PostgREST devolvia erro no campo
    // `error` (nao desestruturado), cfg vinha null e o purpose ficava travado em
    // 'transactional' pra sempre.
    let inboundPurpose: 'marketing' | 'transactional' = 'transactional'
    {
      const cronSecret = process.env.CRON_SECRET
      const authOk =
        !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`
      const envPurpose = (raw as { purpose?: string } | null)?.purpose

      if (authOk && (envPurpose === 'marketing' || envPurpose === 'transactional')) {
        inboundPurpose = envPurpose
      } else {
        // Fallback (webhook direto da UazAPI, sem auth): resolve SO se houver
        // exatamente 1 match. Nunca .limit(1) aqui — trocaria um erro
        // deterministico por um sorteio entre as instancias.
        const rawInstance =
          (norm.source === 'uazapi' && (raw as { instance?: string })?.instance) || null
        if (rawInstance) {
          const { data: rows, error: cfgErr } = await admin
            .from('whatsapp_config')
            .select('purpose')
            .eq('id', rawInstance)
            .eq('active', true)
          if (cfgErr) {
            console.error('[inbound] lookup de purpose falhou', cfgErr)
          } else if (rows && rows.length === 1 && rows[0].purpose) {
            inboundPurpose = rows[0].purpose
          } else {
            console.error(
              `[inbound] instancia ambigua rawInstance=${rawInstance} n=${rows?.length ?? 0} — usando transactional`,
            )
          }
        } else if (envPurpose && !authOk) {
          console.error('[inbound] envelope trouxe purpose sem Authorization valido — ignorado')
        }
      }
    }

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
    // Semantica: pausado se QUALQUER linha ativa estiver pausada. Com 2 linhas,
    // .limit(1) sem ORDER BY viraria sorteio caso elas divergissem.
    const { data: cfg } = await admin
      .from('whatsapp_config')
      .select('ai_globally_paused_at')
      .eq('active', true)
      .not('ai_globally_paused_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (cfg?.ai_globally_paused_at) {
      return NextResponse.json({ received: true, skipped: 'globally_paused' })
    }

    let incomingText = norm.text

    // Suporte a áudio (voice note): UazAPI entrega messageType='audio'/'ptt'
    // sem texto. Baixamos o binário e transcrevemos via Groq Whisper — texto
    // resultante entra no fluxo normal. Feature ativa apenas quando
    // GROQ_API_KEY está setada e provider é uazapi.
    if (
      !incomingText &&
      norm.source === 'uazapi' &&
      norm.messageId &&
      norm.messageType &&
      /audio|ptt|voice/i.test(norm.messageType) &&
      isTranscribeConfigured()
    ) {
      try {
        // Token TEM que ser o da instancia que recebeu o audio: o messageId nao
        // existe na outra, e downloadMedia falharia 100% das vezes em silencio
        // (o catch abaixo so loga, o fluxo cai no `if (!incomingText)` e devolve
        // 200 sem resposta nenhuma).
        const { data: waCfg } = await admin
          .from('whatsapp_config')
          .select('provider, api_url, api_key, instance_id, phone_number_id, active')
          .eq('active', true)
          .eq('provider', 'uazapi')
          .eq('purpose', inboundPurpose)
          .limit(1)
          .maybeSingle()
        if (!waCfg?.api_key) {
          console.error(`[inbound/audio] sem config uazapi para purpose=${inboundPurpose}`)
        }
        if (waCfg?.api_url && waCfg?.api_key) {
          const uaz = new UazapiClient({
            provider: 'uazapi',
            api_url: waCfg.api_url,
            api_key: waCfg.api_key,
            instance_id: waCfg.instance_id ?? null,
            phone_number_id: waCfg.phone_number_id ?? null,
          })
          const media = await uaz.downloadMedia(norm.messageId)
          const stt = await transcribeAudio(media.buffer, media.mimeType, media.filename)
          if (stt.ok) {
            incomingText = stt.text
            console.log('[inbound/audio] transcrito phone=' + phone + ' chars=' + stt.text.length)
          } else {
            console.warn('[inbound/audio] falha transcricao phone=' + phone + ' err=' + stt.error)
            // Nao trava o fluxo — segue sem texto e cai no gate abaixo.
          }
        }
      } catch (err) {
        console.error('[inbound/audio] excecao phone=' + phone, err)
      }
    }

    if (!incomingText) {
      // Sem texto (ex.: mídia sem transcrição, status): ignorar.
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

      // last_inbound_at = "cliente respondeu agora" (autoritativo pra
      // follow-up 2d/5d, ao contrario de last_message_at que soma inbound
      // e outbound).
      const nowIsoInbound = new Date().toISOString()

      // Gate 1 — Léo pausou a IA pra esse contato manualmente (botão "Pausar IA"
      // ou via comando inline "Nick, eu respondo").
      if (pausedActive) {
        console.log('[inbound/contact] CUT_BY_PAUSE phone=' + phone)
        await admin
          .from('campaign_contacts')
          .update({
            last_message_at: nowIsoInbound,
            last_inbound_at: nowIsoInbound,
            updated_at: nowIsoInbound,
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
            last_message_at: nowIsoInbound,
            last_inbound_at: nowIsoInbound,
            updated_at: nowIsoInbound,
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
          last_message_at: nowIsoInbound,
          last_inbound_at: nowIsoInbound,
          updated_at: nowIsoInbound,
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

    // 3. DEBOUNCE: em vez de chamar IA imediato, salva em pending_inbound
    // e agenda processWithDebounce(phone) via after() pra 8s depois.
    // Cliente que dispara 3 msgs em rajada -> processa 1 vez so, abracando todas.
    //
    // upsert por message_id: o poller retenta forwards que falharam e execucoes
    // do cron (*/1min) podem se sobrepor. Sem idempotencia a Nick responde duas
    // vezes. message_id null (caminho Z-API) nunca conflita — NULL nao conflita
    // com NULL em Postgres.
    const { data: inserted, error: insErr } = await admin
      .from('pending_inbound')
      .upsert(
        {
          phone,
          text: incomingText,
          company_id: companyId,
          contact_id: contactId,
          campaign_prompt: campaignPrompt,
          purpose: inboundPurpose,
          message_id: norm.messageId,
        },
        { onConflict: 'message_id', ignoreDuplicates: true },
      )
      .select('id')

    if (insErr) {
      // fail-open: em duvida, perder lead e pior que duplicar.
      console.error('[inbound] upsert pending_inbound falhou', insErr)
    } else if (!inserted || inserted.length === 0) {
      console.log('[inbound] duplicata ignorada messageid=' + norm.messageId)
      return NextResponse.json({ received: true, skipped: 'duplicate' })
    }

    after(async () => {
      try {
        await processWithDebounce(phone)
      } catch (err) {
        console.error('[inbound/debounce] erro phone=' + phone, err)
      }
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    // Sempre retornar 200 para evitar retentativas em loop da Z-API.
    console.error('[WhatsApp Inbound] Erro:', error)
    return NextResponse.json({ received: true })
  }
}
