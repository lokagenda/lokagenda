import { createAdminClient } from '@/lib/supabase/admin'

// Polling reverso da Z-API: a flag `notifySentByMe` documentada não está
// entregando webhooks pro nosso /api/whatsapp/inbound nessa conta. Em vez de
// esperar o push, puxamos o histórico recente de cada chat ativo e detectamos
// mensagens com `fromMe=true` que NÃO foram disparadas pelo sistema. Cada
// mensagem dessas vira uma linha em `manual_takeovers` — IA fica em silêncio
// pelo próximo turno do lead.

// Endpoint Z-API: GET {base}/chat-messages/{phone}?page=1&pageSize=N
// Doc: https://developer.z-api.io/en/chats/get-message-chats
// Resposta é array de objetos com pelo menos: fromMe (bool), momment (ms),
// messageId (string), text/content (string opcional).

const POLL_WINDOW_MIN = 15 // lookback dos phones ativos
const PAGE_SIZE = 20
const MAX_PHONES_PER_RUN = 30
const ZAPI_TIMEOUT_MS = 5000

type ZApiCtx = { base: string; headers: Record<string, string> }

async function resolveZApiContext(): Promise<ZApiCtx | null> {
  const admin = createAdminClient()
  const { data: cfg } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (!cfg || cfg.provider !== 'z_api') return null
  if (!cfg.api_url || !cfg.api_key || !cfg.instance_id) return null
  let apiUrl: URL
  try {
    apiUrl = new URL(cfg.api_url)
  } catch {
    return null
  }
  // SSRF: confina a *.z-api.io https
  if (!/(^|\.)z-api\.io$/.test(apiUrl.hostname) || apiUrl.protocol !== 'https:') return null
  const base = `${apiUrl.origin}/instances/${cfg.instance_id}/token/${cfg.api_key}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.phone_number_id) headers['Client-Token'] = cfg.phone_number_id
  return { base, headers }
}

interface ZApiChatMessage {
  fromMe?: boolean
  momment?: number // timestamp em ms (typo intencional da Z-API)
  moment?: number // fallback caso renomearem
  messageId?: string
  text?: { message?: string } | string
  message?: string
  content?: string
}

function extractText(m: ZApiChatMessage): string {
  if (typeof m.text === 'string') return m.text
  if (m.text && typeof m.text === 'object' && typeof m.text.message === 'string') return m.text.message
  if (typeof m.message === 'string') return m.message
  if (typeof m.content === 'string') return m.content
  return ''
}

function getMoment(m: ZApiChatMessage): number {
  if (typeof m.momment === 'number') return m.momment
  if (typeof m.moment === 'number') return m.moment
  return 0
}

export interface PollStats {
  phonesProcessed: number
  takeoversUpserted: number
  errors: number
}

/**
 * Roda uma rodada de polling. Lista phones ativos (inbound recente), busca
 * histórico via Z-API, marca takeovers humanos. Idempotente — se a mensagem
 * fromMe já foi processada, upsert no manual_takeovers só atualiza
 * updated_at (chave por phone).
 */
export async function pollZApiTakeovers(): Promise<PollStats> {
  const stats: PollStats = { phonesProcessed: 0, takeoversUpserted: 0, errors: 0 }
  const zapi = await resolveZApiContext()
  if (!zapi) {
    console.warn('[zapi-poll] config ausente ou inválida — pulando')
    return stats
  }

  const admin = createAdminClient()

  // Lista phones ativos (inbound do user nos últimos N min). Não vamos
  // pollear o mundo todo — só quem está em conversa ativa.
  const cutoff = new Date(Date.now() - POLL_WINDOW_MIN * 60 * 1000).toISOString()
  const { data: recent, error: recentErr } = await admin
    .from('ai_conversations')
    .select('contact_phone, created_at')
    .gte('created_at', cutoff)
    .eq('role', 'user')
    .order('created_at', { ascending: false })

  if (recentErr) {
    console.error('[zapi-poll] erro listando phones ativos', recentErr)
    return stats
  }

  // Dedup + cap
  const seen = new Set<string>()
  const phones: string[] = []
  for (const row of recent ?? []) {
    if (!row.contact_phone || seen.has(row.contact_phone)) continue
    seen.add(row.contact_phone)
    phones.push(row.contact_phone)
    if (phones.length >= MAX_PHONES_PER_RUN) break
  }

  // Mapa phone → último takeover conhecido (pra evitar repetir trabalho)
  const { data: existing } = await admin
    .from('manual_takeovers')
    .select('phone, takeover_at')
    .in('phone', phones.length > 0 ? phones : ['__none__'])

  const lastTakeoverByPhone = new Map<string, number>()
  for (const row of existing ?? []) {
    lastTakeoverByPhone.set(row.phone, new Date(row.takeover_at).getTime())
  }

  for (const phone of phones) {
    stats.phonesProcessed++
    try {
      const url = `${zapi.base}/chat-messages/${encodeURIComponent(phone)}?page=1&pageSize=${PAGE_SIZE}`
      const res = await fetch(url, {
        method: 'GET',
        headers: zapi.headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(ZAPI_TIMEOUT_MS),
      })
      if (!res.ok) {
        console.warn('[zapi-poll] HTTP', res.status, 'phone', phone)
        stats.errors++
        continue
      }
      const body = (await res.json().catch(() => null)) as ZApiChatMessage[] | { messages?: ZApiChatMessage[] } | null
      const msgs: ZApiChatMessage[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.messages)
          ? body.messages
          : []

      // Mensagens fromMe MAIS recentes que o último takeover registrado pra esse phone
      const lastTakeover = lastTakeoverByPhone.get(phone) ?? 0
      const cutoffMs = Math.max(lastTakeover, Date.now() - POLL_WINDOW_MIN * 60 * 1000)
      const candidates = msgs.filter((m) => m.fromMe === true && getMoment(m) > cutoffMs)
      if (candidates.length === 0) continue

      // Anti self-send: descarta mensagens que o NOSSO sistema enviou (estão em whatsapp_message_log).
      // Comparação por (phone, timestamp ±5s, prefixo do texto). Conservador.
      const candidateTimes = candidates.map((m) => getMoment(m))
      const minT = Math.min(...candidateTimes) - 5000
      const maxT = Math.max(...candidateTimes) + 5000
      const { data: sysLogs } = await admin
        .from('whatsapp_message_log')
        .select('created_at, message')
        .eq('phone', phone)
        .gte('created_at', new Date(minT).toISOString())
        .lte('created_at', new Date(maxT).toISOString())

      const sysSet = (sysLogs ?? []).map((l) => ({
        t: new Date(l.created_at).getTime(),
        msg: (l.message ?? '').slice(0, 40),
      }))

      const humanMsgs = candidates.filter((m) => {
        const t = getMoment(m)
        const text = extractText(m).slice(0, 40)
        return !sysSet.some((s) => Math.abs(s.t - t) <= 5000 && s.msg === text)
      })

      if (humanMsgs.length === 0) continue

      // Pega o mais recente como takeover_at (manual_takeovers é por-phone)
      const newestMoment = Math.max(...humanMsgs.map((m) => getMoment(m)))
      const takeoverAtIso = new Date(newestMoment).toISOString()
      const { error: upErr } = await admin
        .from('manual_takeovers')
        .upsert(
          { phone, takeover_at: takeoverAtIso, updated_at: new Date().toISOString() },
          { onConflict: 'phone' },
        )
      if (upErr) {
        console.error('[zapi-poll] upsert manual_takeovers FALHOU phone', phone, upErr)
        stats.errors++
      } else {
        stats.takeoversUpserted++
        console.log('[zapi-poll] takeover phone=' + phone + ' at=' + takeoverAtIso + ' n_human_msgs=' + humanMsgs.length)
      }
    } catch (err) {
      console.error('[zapi-poll] exception phone', phone, err)
      stats.errors++
    }
  }

  console.log('[zapi-poll] done', stats)
  return stats
}
