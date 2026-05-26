import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'

// Anti-ban tuning -----------------------------------------------------------
// Cap how many messages a single cron run will send across all campaigns.
// Vercel cron functions have a limited execution window, and we add a random
// delay between sends, so keep this small and rely on frequent runs.
const MAX_PER_RUN = 6
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))
}

export async function GET(request: NextRequest) {
  // Verify authorization (same safe pattern as the other crons)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Day boundaries (UTC) used for the per-day limit accounting.
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfDayStr = startOfDay.toISOString()

  let processed = 0
  let sent = 0
  let failed = 0

  // Fetch all running campaigns
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, company_id, message_template, daily_limit, sent_count')
    .eq('status', 'running')

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0 })
  }

  for (const campaign of campaigns) {
    if (processed >= MAX_PER_RUN) break

    // How many were already sent today for this campaign?
    const { count: sentToday } = await admin
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')
      .gte('sent_at', startOfDayStr)

    const remainingDailyBudget = campaign.daily_limit - (sentToday || 0)
    if (remainingDailyBudget <= 0) {
      continue
    }

    // How many pending items remain at all?
    const { count: pendingCount } = await admin
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')

    if ((pendingCount || 0) === 0) {
      // Nothing left to send -> mark completed
      await admin
        .from('campaigns')
        .update({ status: 'completed' })
        .eq('id', campaign.id)
      continue
    }

    // Batch size for this campaign = min(daily budget, remaining run budget)
    const runBudget = MAX_PER_RUN - processed
    const batchSize = Math.min(remainingDailyBudget, runBudget)
    if (batchSize <= 0) break

    const { data: queueItems } = await admin
      .from('campaign_queue')
      .select('id, contact_id, phone')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (!queueItems || queueItems.length === 0) {
      await admin
        .from('campaigns')
        .update({ status: 'completed' })
        .eq('id', campaign.id)
      continue
    }

    for (const item of queueItems) {
      if (processed >= MAX_PER_RUN) break

      // Resolve contact name for the {{nome}} placeholder
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
        ok = await sendWhatsAppMessage(item.phone, message, {
          companyId: campaign.company_id,
        })
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

        // Update contact status to "contacted" + last_message_at
        if (item.contact_id) {
          await admin
            .from('campaign_contacts')
            .update({ status: 'contacted', last_message_at: nowIso })
            .eq('id', item.contact_id)
        }

        // Increment sent_count + last_sent_at on the campaign
        await admin
          .from('campaigns')
          .update({
            sent_count: (campaign.sent_count || 0) + 1,
            last_sent_at: nowIso,
          })
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

      // Anti-ban: randomized delay between sends (skip after the last one)
      if (processed < MAX_PER_RUN) {
        await sleep(randomDelay())
      }
    }

    // After processing this campaign's batch, if no pending remain, complete it
    const { count: stillPending } = await admin
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')

    if ((stillPending || 0) === 0) {
      await admin
        .from('campaigns')
        .update({ status: 'completed' })
        .eq('id', campaign.id)
    }
  }

  return NextResponse.json({ processed, sent, failed })
}
