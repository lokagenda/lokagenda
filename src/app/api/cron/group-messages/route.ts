import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Roda com frequência no Pro; janela maior pra processar a fila com folga.
export const maxDuration = 300

// Anti-ban: o loop abaixo fazia ate 50 POSTs back-to-back SEM nenhuma pausa —
// exatamente o padrao de rajada que derrubou o numero em 10/jul e 23/jul.
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const randomDelay = () => Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))

/**
 * Processa mensagens agendadas pra grupos. Suporta tanto Z-API quanto UazAPI.
 * Detecta o provider em whatsapp_config e roteia pro endpoint correto.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: due } = await admin
    .from('group_scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (!due || due.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  // Envio em grupo e divulgacao -> chip de MARKETING. Sem o filtro de purpose
  // isso pegava uma das duas instancias ativas de forma arbitraria.
  // .maybeSingle() (nao .single()) porque .single() estoura se nao houver
  // linha de marketing ativa.
  const { data: config } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .eq('purpose', 'marketing')
    .limit(1)
    .maybeSingle()

  const provider = config?.provider
  const ready = !!(
    config &&
    config.api_url &&
    config.api_key &&
    (provider === 'z_api' ? !!config.instance_id : provider === 'uazapi')
  )

  let sent = 0
  let failed = 0

  for (const msg of due) {
    if (!ready) {
      await admin
        .from('group_scheduled_messages')
        .update({ status: 'failed', error: 'WhatsApp não configurado (provider z_api ou uazapi com credenciais)' })
        .eq('id', msg.id)
      failed++
      continue
    }

    const apiUrl = config!.api_url!.replace(/\/$/, '')

    try {
      let ok = true
      let errText: string | null = null

      // group_id no banco vem como "120363322422182462-group" ou "553599391360-1521882527".
      // UazAPI quer "120363322422182462@g.us". Z-API aceita o original.
      const groupIdForUaz = msg.group_id.endsWith('-group')
        ? msg.group_id.replace(/-group$/, '') + '@g.us'
        : msg.group_id.includes('@')
          ? msg.group_id
          : msg.group_id + '@g.us'

      if (provider === 'z_api') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (config!.phone_number_id) headers['Client-Token'] = config!.phone_number_id
        const base = `${apiUrl}/instances/${config!.instance_id}/token/${config!.api_key}`

        if (msg.media_url) {
          const endpoint = msg.media_type === 'video' ? 'send-video' : 'send-image'
          const body =
            msg.media_type === 'video'
              ? { phone: msg.group_id, video: msg.media_url, caption: msg.content || '' }
              : { phone: msg.group_id, image: msg.media_url, caption: msg.content || '' }
          const res = await fetch(`${base}/${endpoint}`, {
            method: 'POST', headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) {
            ok = false
            const d = await res.json().catch(() => null)
            errText = d?.error || d?.message || `HTTP ${res.status}`
          }
        } else if (msg.content) {
          const res = await fetch(`${base}/send-text`, {
            method: 'POST', headers,
            body: JSON.stringify({ phone: msg.group_id, message: msg.content }),
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) {
            ok = false
            const d = await res.json().catch(() => null)
            errText = d?.error || d?.message || `HTTP ${res.status}`
          }
        }
      } else if (provider === 'uazapi') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', token: config!.api_key! }

        if (msg.media_url) {
          // UazAPI /send/media aceita {number, type, file, text}
          const res = await fetch(`${apiUrl}/send/media`, {
            method: 'POST', headers,
            body: JSON.stringify({
              number: groupIdForUaz,
              type: msg.media_type === 'video' ? 'video' : 'image',
              file: msg.media_url,
              text: msg.content || '',
            }),
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) {
            ok = false
            const d = await res.json().catch(() => null)
            errText = d?.error || d?.message || `HTTP ${res.status}`
          }
        } else if (msg.content) {
          const res = await fetch(`${apiUrl}/send/text`, {
            method: 'POST', headers,
            body: JSON.stringify({ number: groupIdForUaz, text: msg.content }),
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) {
            ok = false
            const d = await res.json().catch(() => null)
            errText = d?.error || d?.message || `HTTP ${res.status}`
          }
        }
      }

      const recurrence = (msg.recurrence as string) || 'once'
      if (ok && (recurrence === 'daily' || recurrence === 'weekly')) {
        // Recorrente: reprograma a próxima ocorrência e mantém pendente.
        const next = new Date(msg.scheduled_at)
        next.setUTCDate(next.getUTCDate() + (recurrence === 'weekly' ? 7 : 1))
        await admin
          .from('group_scheduled_messages')
          .update({
            status: 'pending',
            scheduled_at: next.toISOString(),
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', msg.id)
      } else {
        await admin
          .from('group_scheduled_messages')
          .update({
            status: ok ? 'sent' : 'failed',
            sent_at: ok ? new Date().toISOString() : null,
            error: errText,
          })
          .eq('id', msg.id)
      }

      if (ok) {
        sent++
        await admin.from('whatsapp_message_log').insert({
          company_id: msg.company_id,
          phone: msg.group_id,
          message: msg.content || `[${msg.media_type || 'mídia'}]`,
          status: 'sent',
        })
      } else {
        failed++
      }
    } catch (err) {
      await admin
        .from('group_scheduled_messages')
        .update({ status: 'failed', error: err instanceof Error ? err.message : 'erro' })
        .eq('id', msg.id)
      failed++
    }

    // Anti-ban: intervalo entre envios. Pula no ultimo pra encerrar o run logo.
    if (msg !== due[due.length - 1]) await sleep(randomDelay())
  }

  return NextResponse.json({ success: true, sent, failed })
}
