import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'

// Plano Pro: este cron roda com frequência (a cada poucos minutos). Damos uma
// janela maior à função pra acomodar os delays anti-ban entre os envios.
export const maxDuration = 300

// Anti-ban tuning -----------------------------------------------------------
// Os disparos são DISTRIBUÍDOS ao longo da janela diária da campanha (ex.: 8h-20h),
// não em rajada. A cada execução o robô calcula quantos "deveriam" já ter saído
// até agora e manda só a diferença, respeitando o limite diário.
const MAX_PER_RUN = 12 // teto global por execução (todas as campanhas)
const MAX_PER_CAMPAIGN_PER_RUN = 4 // teto por campanha por execução (catch-up suave)
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000 // Brasília = UTC-3

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // "Agora" no fuso de Brasília + início do dia BRT (em instante UTC) para
  // contar o que já foi enviado hoje e calcular a posição dentro da janela.
  const nowMs = Date.now()
  const brt = new Date(nowMs - BRT_OFFSET_MS)
  const brtMinutes = brt.getUTCHours() * 60 + brt.getUTCMinutes()
  const startOfDayStr = new Date(
    Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 0, 0, 0) + BRT_OFFSET_MS
  ).toISOString()

  let processed = 0
  let sent = 0
  let failed = 0

  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, company_id, message_template, daily_limit, sent_count, send_window_start, send_window_end')
    .eq('status', 'running')

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0 })
  }

  for (const campaign of campaigns) {
    if (processed >= MAX_PER_RUN) break

    const dailyLimit = campaign.daily_limit || 50
    const winStart = campaign.send_window_start ?? 8
    const winEnd = campaign.send_window_end ?? 20

    // Fora da janela de horário (BRT) → não envia agora.
    const startMin = winStart * 60
    const endMin = winEnd * 60
    if (brtMinutes < startMin || brtMinutes >= endMin) continue

    // Quantos já saíram hoje (dia BRT)?
    const { count: sentTodayCount } = await admin
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')
      .gte('sent_at', startOfDayStr)

    const sentToday = sentTodayCount || 0
    const remainingDailyBudget = dailyLimit - sentToday
    if (remainingDailyBudget <= 0) continue

    // Quantos "deveriam" já ter saído até este minuto da janela.
    const windowMinutes = Math.max(1, endMin - startMin)
    const minutesIntoWindow = Math.min(windowMinutes, brtMinutes - startMin)
    const targetByNow = Math.min(
      dailyLimit,
      Math.floor((minutesIntoWindow / windowMinutes) * dailyLimit) + 1
    )

    let toSend = Math.min(
      targetByNow - sentToday,
      remainingDailyBudget,
      MAX_PER_CAMPAIGN_PER_RUN,
      MAX_PER_RUN - processed
    )
    if (toSend <= 0) continue // ainda não está na hora do próximo

    const { data: queueItems } = await admin
      .from('campaign_queue')
      .select('id, contact_id, phone')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(toSend)

    if (!queueItems || queueItems.length === 0) {
      await admin.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id)
      continue
    }

    for (const item of queueItems) {
      if (processed >= MAX_PER_RUN) break

      let contactName = ''
      if (item.contact_id) {
        const { data: contact } = await admin
          .from('campaign_contacts')
          .select('name')
          .eq('id', item.contact_id)
          .single()
        contactName = contact?.name || ''
      }

      const message = campaign.message_template.replaceAll('{{nome}}', contactName)

      let ok = false
      let errorMessage: string | null = null
      try {
        ok = await sendWhatsAppMessage(item.phone, message, { companyId: campaign.company_id })
        if (!ok) errorMessage = 'Falha no envio pelo provedor WhatsApp'
      } catch (err: unknown) {
        ok = false
        errorMessage = err instanceof Error ? err.message : 'Erro inesperado no envio'
      }

      const nowIso = new Date().toISOString()

      if (ok) {
        await admin
          .from('campaign_queue')
          .update({ status: 'sent', sent_at: nowIso, error_message: null })
          .eq('id', item.id)

        if (item.contact_id) {
          await admin
            .from('campaign_contacts')
            .update({ status: 'contacted', last_message_at: nowIso })
            .eq('id', item.contact_id)
        }

        await admin
          .from('campaigns')
          .update({ sent_count: (campaign.sent_count || 0) + 1, last_sent_at: nowIso })
          .eq('id', campaign.id)
        campaign.sent_count = (campaign.sent_count || 0) + 1

        sent++
      } else {
        await admin
          .from('campaign_queue')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', item.id)
        failed++
      }

      processed++

      // Anti-ban: pequeno intervalo aleatório entre os envios desta execução.
      if (processed < MAX_PER_RUN) await sleep(randomDelay())
    }

    // Sem pendentes → conclui a campanha.
    const { count: stillPending } = await admin
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')

    if ((stillPending || 0) === 0) {
      await admin.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id)
    }
  }

  return NextResponse.json({ processed, sent, failed })
}
