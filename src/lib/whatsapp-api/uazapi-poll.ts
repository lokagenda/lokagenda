import { createAdminClient } from '@/lib/supabase/admin'

// Polling backup pra UazAPI: o webhook deles tem bug (desativa sozinho). Esse
// cron puxa /message/find a cada 1min, processa msgs novas via POST no nosso
// proprio /api/whatsapp/inbound (com payload formato UazAPI). Aproveita toda a
// logica de gates/IA que ja existe la, sem duplicar.
//
// Doc: POST {base}/message/find com body {limit, sort:"-messageTimestamp"}
// retorna array {messages: [...]}. Cada msg tem chatid, sender, fromMe,
// text, messageTimestamp (ms), messageid, wasSentByApi.

const POLL_LIMIT = 30
const HTTP_TIMEOUT_MS = 8000

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

export interface UazapiPollStats {
  fetched: number
  newMsgs: number
  forwardedOk: number
  errors: number
  newLastTs: number
}

export async function pollUazapi(): Promise<UazapiPollStats> {
  const stats: UazapiPollStats = { fetched: 0, newMsgs: 0, forwardedOk: 0, errors: 0, newLastTs: 0 }
  const admin = createAdminClient()

  // Le config ativa
  const { data: cfg } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, uazapi_last_poll_ts')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (!cfg || cfg.provider !== 'uazapi') {
    console.log('[uazapi-poll] config nao eh uazapi, pulando')
    return stats
  }
  if (!cfg.api_url || !cfg.api_key) {
    console.warn('[uazapi-poll] api_url ou api_key ausente')
    return stats
  }

  // SSRF: confina a uazapi.com ou subdominio *.uazapi.com (exato, nao endsWith
  // ingenuo que permitiria 'evil-uazapi.com')
  let baseUrl: URL
  try {
    baseUrl = new URL(cfg.api_url)
  } catch {
    console.warn('[uazapi-poll] api_url invalida')
    return stats
  }
  const host = baseUrl.hostname.toLowerCase().replace(/\.$/, '')
  if (baseUrl.protocol !== 'https:' || !(host === 'uazapi.com' || host.endsWith('.uazapi.com'))) {
    console.warn('[uazapi-poll] api_url nao eh https://uazapi.com ou subdominio')
    return stats
  }

  const lastTs = Number(cfg.uazapi_last_poll_ts ?? 0)
  stats.newLastTs = lastTs

  // Fetch ultimas N mensagens
  try {
    const res = await fetch(`${baseUrl.origin}/message/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: cfg.api_key },
      body: JSON.stringify({ limit: POLL_LIMIT, sort: '-messageTimestamp' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error('[uazapi-poll] HTTP', res.status)
      stats.errors++
      return stats
    }
    const body = (await res.json().catch(() => null)) as { messages?: UazapiMessage[] } | null
    const messages = Array.isArray(body?.messages) ? body.messages : []
    stats.fetched = messages.length

    // Bootstrap: primeira execucao sem lastTs salvo - NAO reprocessa todo o
    // historico. So pega da mensagem mais recente em diante.
    if (lastTs === 0 && messages.length > 0) {
      const maxTs = Math.max(...messages.map((m) => m.messageTimestamp ?? 0))
      await admin
        .from('whatsapp_config')
        .update({ uazapi_last_poll_ts: maxTs, updated_at: new Date().toISOString() })
        .eq('active', true)
      stats.newLastTs = maxTs
      console.log('[uazapi-poll] bootstrap last_ts=' + maxTs + ' (sem reprocessar historico)')
      return stats
    }

    // Filtra msgs com timestamp > lastTs (so as novas) e ORDENA ASCENDENTE
    const newMsgs = messages
      .filter((m) => (m.messageTimestamp ?? 0) > lastTs)
      .sort((a, b) => (a.messageTimestamp ?? 0) - (b.messageTimestamp ?? 0))
    stats.newMsgs = newMsgs.length

    if (newMsgs.length === 0) {
      console.log('[uazapi-poll] sem novas msgs (last_ts=' + lastTs + ')')
      return stats
    }

    // Resolve URL do nosso proprio inbound
    const appBase =
      process.env.WEBHOOK_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
      'https://www.lokagenda.com.br'
    const inboundUrl = `${appBase.replace(/\/$/, '')}/api/whatsapp/inbound`

    // Pra cada msg nova: POST pro proprio /api/whatsapp/inbound com payload UazAPI
    let processedMaxTs = lastTs
    for (const m of newMsgs) {
      if (m.isGroup === true) continue // ignora grupos
      try {
        const payload = {
          event: 'messages',
          instance: 'lokagenda',
          data: {
            chatid: m.chatid,
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
        const ir = await fetch(inboundUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        })
        if (ir.ok) {
          stats.forwardedOk++
        } else {
          stats.errors++
          console.warn('[uazapi-poll] forward HTTP', ir.status, 'msgid=' + m.messageid)
        }
      } catch (err) {
        stats.errors++
        console.error('[uazapi-poll] forward exception msgid=' + m.messageid, err)
      }
      const ts = m.messageTimestamp ?? 0
      if (ts > processedMaxTs) processedMaxTs = ts
    }

    // Atualiza last_ts
    if (processedMaxTs > lastTs) {
      await admin
        .from('whatsapp_config')
        .update({ uazapi_last_poll_ts: processedMaxTs, updated_at: new Date().toISOString() })
        .eq('active', true)
      stats.newLastTs = processedMaxTs
    }

    console.log('[uazapi-poll] done', stats)
    return stats
  } catch (err) {
    console.error('[uazapi-poll] exception', err)
    stats.errors++
    return stats
  }
}
