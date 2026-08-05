import { createAdminClient } from '@/lib/supabase/admin'

// Polling da UazAPI. O webhook deles desliga sozinho (bug do fornecedor) e hoje
// esta OFF nas DUAS instancias — entao este cron e o UNICO caminho de inbound.
//
// Itera TODAS as configs uazapi ativas, cada uma com SEU token e SEU cursor, e
// encaminha pro nosso /api/whatsapp/inbound carimbando o `purpose` da config que
// leu a mensagem (autenticado com CRON_SECRET). Antes lia uma config arbitraria
// (.limit(1) sem ORDER BY) e gravava o cursor com .eq('active', true), o que
// carimbava as duas linhas: o cursor da instancia nao lida avancava sem que as
// mensagens dela fossem processadas — perda permanente de inbound.

const POLL_LIMIT = 40
const HTTP_TIMEOUT_MS = 8000
const FORWARD_TIMEOUT_MS = 20000
const BUDGET_MS = 45_000 // maxDuration do cron e 60s
const MAX_FORWARDS_PER_RUN = 20
const STALE_MS = 30 * 60_000 // msg mais velha que isso nao bloqueia a fila

interface UazapiMessage {
  chatid?: string
  sender?: string
  sender_pn?: string
  sender_lid?: string
  senderName?: string
  fromMe?: boolean
  isGroup?: boolean
  text?: string
  messageType?: string
  messageTimestamp?: number
  messageid?: string
  wasSentByApi?: boolean
}

interface PollCfg {
  id: string
  purpose: 'marketing' | 'transactional'
  provider: string
  api_url: string | null
  api_key: string | null
  uazapi_last_poll_ts: number | null
}

interface PurposeStats {
  fetched: number
  newMsgs: number
  forwardedOk: number
  errors: number
  lastTs: number
}

export interface UazapiPollStats {
  fetched: number
  newMsgs: number
  forwardedOk: number
  errors: number
  newLastTs: number
  byPurpose: Record<string, PurposeStats>
}

type Admin = ReturnType<typeof createAdminClient>

function inboundUrl(): string {
  const appBase =
    process.env.WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    'https://www.lokagenda.com.br'
  return `${appBase.replace(/\/$/, '')}/api/whatsapp/inbound`
}

/**
 * O chip novo (marketing) entrega 1:1 com `chatid` no formato "<lid>@lid" e SEM
 * `sender_pn` — medido: 38 de 40 conversas. Um LID e so digitos, entao passaria
 * pela validacao do inbound e viraria telefone fantasma de 16 digitos.
 * POST /chat/find {wa_chatlid} devolve o telefone real.
 *
 * Cacheia SO sucesso: cachear falha transitoria descartaria o lead pelo resto
 * da vida do lambda.
 */
async function resolveLid(
  cfg: PollCfg,
  lid: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const hit = cache.get(lid)
  if (hit) return hit
  try {
    const r = await fetch(`${new URL(cfg.api_url!).origin}/chat/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: cfg.api_key! },
      body: JSON.stringify({ limit: 1, wa_chatlid: lid }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const j = (await r.json().catch(() => null)) as { chats?: unknown[] } | unknown[] | null
    const chats = Array.isArray(j) ? j : (j?.chats ?? [])
    const phone = String((chats[0] as { phone?: string } | undefined)?.phone ?? '').replace(/\D/g, '')
    if (!phone) {
      console.warn(`[uazapi-poll/${cfg.purpose}] LID nao resolvido lid=${lid}`)
      return null
    }
    cache.set(lid, phone)
    return phone
  } catch (err) {
    console.warn(`[uazapi-poll/${cfg.purpose}] /chat/find falhou lid=${lid}`, err)
    return null
  }
}

async function pollOneInstance(admin: Admin, cfg: PollCfg, t0: number): Promise<PurposeStats> {
  const tag = `[uazapi-poll/${cfg.purpose}]`
  const st: PurposeStats = {
    fetched: 0,
    newMsgs: 0,
    forwardedOk: 0,
    errors: 0,
    lastTs: Number(cfg.uazapi_last_poll_ts ?? 0),
  }

  if (cfg.provider !== 'uazapi' || !cfg.api_url || !cfg.api_key) {
    console.warn(`${tag} config incompleta, pulando`)
    return st
  }

  // SSRF: confina a uazapi.com ou subdominio exato (nao endsWith ingenuo, que
  // deixaria passar 'evil-uazapi.com').
  let baseUrl: URL
  try {
    baseUrl = new URL(cfg.api_url)
  } catch {
    console.warn(`${tag} api_url invalida`)
    return st
  }
  const host = baseUrl.hostname.toLowerCase().replace(/\.$/, '')
  if (baseUrl.protocol !== 'https:' || !(host === 'uazapi.com' || host.endsWith('.uazapi.com'))) {
    console.warn(`${tag} api_url nao eh https://uazapi.com ou subdominio`)
    return st
  }

  const lastTs = Number(cfg.uazapi_last_poll_ts ?? 0)

  // isGroup:false no SERVIDOR (testado, funciona): a caixa de marketing e ~95%
  // grupo e sem esse filtro os slots eram gastos com msg que seria descartada,
  // empurrando a 1:1 do lead pra fora da janela.
  const res = await fetch(`${baseUrl.origin}/message/find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: cfg.api_key },
    body: JSON.stringify({ limit: POLL_LIMIT, sort: '-messageTimestamp', isGroup: false }),
    cache: 'no-store',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  if (!res.ok) {
    console.error(`${tag} HTTP ${res.status}`)
    st.errors++
    return st
  }
  const body = (await res.json().catch(() => null)) as { messages?: UazapiMessage[] } | null
  const messages = Array.isArray(body?.messages) ? body.messages : []
  st.fetched = messages.length

  // Bootstrap: nao reprocessa historico. Clampa em "agora" porque com o filtro
  // de grupo a 1:1 mais recente pode ser de dias atras.
  if (lastTs === 0) {
    const maxTs = messages.length
      ? Math.min(Math.max(...messages.map((m) => m.messageTimestamp ?? 0)), Date.now())
      : Date.now()
    const { error } = await admin
      .from('whatsapp_config')
      .update({ uazapi_last_poll_ts: maxTs, updated_at: new Date().toISOString() })
      .eq('id', cfg.id)
    if (error) console.error(`${tag} bootstrap update falhou`, error)
    st.lastTs = maxTs
    console.log(`${tag} bootstrap last_ts=${maxTs}`)
    return st
  }

  const newMsgs = messages
    .filter((m) => (m.messageTimestamp ?? 0) > lastTs)
    .sort((a, b) => (a.messageTimestamp ?? 0) - (b.messageTimestamp ?? 0))
  st.newMsgs = newMsgs.length
  if (newMsgs.length === 0) return st

  // Resolve os LIDs unicos UMA vez, em paralelo, antes do laco de forward.
  const lidCache = new Map<string, string>()
  const lids = [
    ...new Set(newMsgs.map((m) => String(m.chatid ?? '')).filter((c) => c.endsWith('@lid'))),
  ]
  await Promise.all(lids.map((l) => resolveLid(cfg, l, lidCache)))

  const url = inboundUrl()
  const secret = process.env.CRON_SECRET
  if (!secret) console.error(`${tag} CRON_SECRET ausente — o inbound nao vai confiar no purpose`)

  let confirmedTs = lastTs
  let forwards = 0

  for (const m of newMsgs) {
    const ts = m.messageTimestamp ?? 0
    if (Date.now() - t0 > BUDGET_MS || forwards >= MAX_FORWARDS_PER_RUN) {
      console.warn(`${tag} budget/limite atingido, parando em ts=${confirmedTs}`)
      break
    }

    // Defesa em profundidade: o filtro server-side pode regredir numa
    // atualizacao da UazAPI. Grupo avanca o cursor, senao ele congela.
    if (m.isGroup === true) {
      confirmedTs = Math.max(confirmedTs, ts)
      continue
    }

    let chatOut = String(m.chatid ?? '')
    if (chatOut.endsWith('@lid')) {
      const p = lidCache.get(chatOut)
      if (!p) {
        console.error(`${tag} LID sem telefone, DESCARTANDO msgid=${m.messageid} lid=${chatOut}`)
        confirmedTs = Math.max(confirmedTs, ts)
        continue
      }
      chatOut = `${p}@s.whatsapp.net`
    }

    const payload = {
      event: 'messages',
      instance: cfg.id, // id da config, nao mais o literal 'lokagenda' (ambiguo)
      purpose: cfg.purpose, // <- discriminador real
      data: {
        chatid: chatOut,
        chatid_lid: chatOut !== m.chatid ? m.chatid : undefined,
        sender: m.sender,
        sender_pn: m.sender_pn,
        senderName: m.senderName,
        fromMe: m.fromMe === true,
        isGroup: false,
        text: m.text,
        messageType: m.messageType,
        messageTimestamp: m.messageTimestamp,
        messageid: m.messageid,
        wasSentByApi: m.wasSentByApi === true,
      },
    }

    let ok = false
    try {
      const ir = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      })
      ok = ir.ok
      if (!ok) console.warn(`${tag} forward HTTP ${ir.status} msgid=${m.messageid}`)
    } catch (err) {
      console.error(`${tag} forward exception msgid=${m.messageid}`, err)
    }
    forwards++

    if (ok) {
      st.forwardedOk++
      confirmedTs = Math.max(confirmedTs, ts)
      continue
    }

    st.errors++

    // O AbortSignal aborta o CLIENTE, nao o servidor: boa parte dos "erros" e
    // request que o /inbound concluiu. Confere no banco antes de retentar.
    if (m.messageid) {
      const { data: landed } = await admin
        .from('pending_inbound')
        .select('id')
        .eq('message_id', m.messageid)
        .limit(1)
        .maybeSingle()
      if (landed) {
        confirmedTs = Math.max(confirmedTs, ts)
        continue
      }
    }

    if (Date.now() - ts > STALE_MS) {
      console.error(`${tag} DESISTINDO de msgid=${m.messageid} (mais de 30min de falha)`)
      confirmedTs = Math.max(confirmedTs, ts)
      continue
    }

    // Watermark contiguo: nao avanca por cima do erro, retenta no proximo ciclo.
    console.warn(`${tag} cursor PARA em ${confirmedTs}, retenta em 1min`)
    break
  }

  if (confirmedTs > lastTs) {
    const { error } = await admin
      .from('whatsapp_config')
      .update({ uazapi_last_poll_ts: confirmedTs, updated_at: new Date().toISOString() })
      .eq('id', cfg.id) // <<< era .eq('active', true) — carimbava as DUAS linhas
    if (error) console.error(`${tag} update de cursor FALHOU`, error)
    else st.lastTs = confirmedTs
  }

  console.log(`${tag} done`, st)
  return st
}

export async function pollUazapi(): Promise<UazapiPollStats> {
  const admin = createAdminClient()
  const t0 = Date.now()
  const stats: UazapiPollStats = {
    fetched: 0,
    newMsgs: 0,
    forwardedOk: 0,
    errors: 0,
    newLastTs: 0,
    byPurpose: {},
  }

  // Ordem por cursor mais antigo = round-robin justo: nunca starva sempre a
  // mesma instancia quando o budget estoura. Desempate: transactional primeiro
  // (numero do cliente pagante).
  const { data: cfgs, error } = await admin
    .from('whatsapp_config')
    .select('id, purpose, provider, api_url, api_key, uazapi_last_poll_ts')
    .eq('active', true)
    .eq('provider', 'uazapi')
    .order('uazapi_last_poll_ts', { ascending: true })
    .order('purpose', { ascending: false })

  if (error) {
    console.error('[uazapi-poll] erro lendo configs', error)
    return stats
  }
  if (!cfgs || cfgs.length === 0) {
    console.log('[uazapi-poll] nenhuma config uazapi ativa')
    return stats
  }

  for (const cfg of cfgs as PollCfg[]) {
    if (Date.now() - t0 > BUDGET_MS) {
      console.warn(`[uazapi-poll] budget estourado, instancia adiada purpose=${cfg.purpose}`)
      break
    }
    try {
      const st = await pollOneInstance(admin, cfg, t0)
      stats.byPurpose[cfg.purpose] = st
      stats.fetched += st.fetched
      stats.newMsgs += st.newMsgs
      stats.forwardedOk += st.forwardedOk
      stats.errors += st.errors
      stats.newLastTs = Math.max(stats.newLastTs, st.lastTs)
    } catch (err) {
      // Uma instancia fora do ar NAO pode derrubar a outra.
      console.error(`[uazapi-poll/${cfg.purpose}] exception`, err)
      stats.errors++
    }
  }

  return stats
}
