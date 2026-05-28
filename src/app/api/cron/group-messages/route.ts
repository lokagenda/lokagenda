import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Processa as mensagens agendadas para grupos de WhatsApp cujo horário já chegou.
 * Usa a Z-API global. No plano Hobby da Vercel o cron roda 1x/dia, então o envio
 * acontece na próxima execução após o horário agendado (aproximação por janela).
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
    .limit(50)

  if (!due || due.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  const { data: config } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  const ready =
    config && config.provider === 'z_api' && config.api_url && config.api_key && config.instance_id

  let sent = 0
  let failed = 0

  for (const msg of due) {
    if (!ready) {
      await admin
        .from('group_scheduled_messages')
        .update({ status: 'failed', error: 'Z-API não configurada' })
        .eq('id', msg.id)
      failed++
      continue
    }

    const apiUrl = config!.api_url!.replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config!.phone_number_id) headers['Client-Token'] = config!.phone_number_id

    const base = `${apiUrl}/instances/${config!.instance_id}/token/${config!.api_key}`

    try {
      let ok = true
      let errText: string | null = null

      if (msg.media_url) {
        const endpoint = msg.media_type === 'video' ? 'send-video' : 'send-image'
        const body =
          msg.media_type === 'video'
            ? { phone: msg.group_id, video: msg.media_url, caption: msg.content || '' }
            : { phone: msg.group_id, image: msg.media_url, caption: msg.content || '' }
        const res = await fetch(`${base}/${endpoint}`, {
          method: 'POST',
          headers,
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
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: msg.group_id, message: msg.content }),
          signal: AbortSignal.timeout(20000),
        })
        if (!res.ok) {
          ok = false
          const d = await res.json().catch(() => null)
          errText = d?.error || d?.message || `HTTP ${res.status}`
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
  }

  return NextResponse.json({ success: true, sent, failed })
}
