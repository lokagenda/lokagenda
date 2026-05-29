import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'
import { generateReengagementMessage } from '@/lib/ai/agent'

// Robô de reativação 24h: cutuca UMA vez, de forma automática, os leads de
// campanha que receberam a 1ª mensagem e ficaram em silêncio por mais de 24h.
// Roda de hora em hora (plano Pro), mas só age na janela diurna (anti-ban) e dá
// no máximo uma tentativa por lead (marca `reactivated_at`).
export const maxDuration = 300

const MAX_PER_RUN = 8 // teto global de reativações por execução (anti-ban)
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000 // Brasília = UTC-3
const QUIET_HOURS = 24 // silêncio mínimo antes de cutucar
const MAX_AGE_HOURS = 24 * 7 // não cutuca leads frios há mais de 7 dias
const WINDOW_START_HOUR = 9 // só reengaja entre 9h e 19h (BRT)
const WINDOW_END_HOUR = 19

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

  // Janela diurna (BRT): fora dela, não cutuca ninguém.
  const nowMs = Date.now()
  const brt = new Date(nowMs - BRT_OFFSET_MS)
  const brtHour = brt.getUTCHours()
  if (brtHour < WINDOW_START_HOUR || brtHour >= WINDOW_END_HOUR) {
    return NextResponse.json({ skipped: 'fora da janela', processed: 0, sent: 0 })
  }

  const cutoffQuiet = new Date(nowMs - QUIET_HOURS * 60 * 60 * 1000).toISOString()
  const cutoffMaxAge = new Date(nowMs - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

  // Candidatos: leads de campanha ainda "contatados" (não qualificados/perdidos/
  // convertidos), nunca reativados, frios entre 24h e 7 dias.
  const { data: candidates } = await admin
    .from('campaign_contacts')
    .select('id, company_id, phone')
    .eq('status', 'contacted')
    .is('reactivated_at', null)
    .not('last_message_at', 'is', null)
    .lte('last_message_at', cutoffQuiet)
    .gte('last_message_at', cutoffMaxAge)
    .order('last_message_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0, failed: 0 })
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let failed = 0
  const nowIso = new Date().toISOString()

  for (const lead of candidates) {
    // Cada lead recebe no máximo UMA tentativa: marcamos reactivated_at já no
    // início do processamento para nunca recutucar (mesmo se algo falhar).
    await admin
      .from('campaign_contacts')
      .update({ reactivated_at: nowIso })
      .eq('id', lead.id)

    processed++

    // Descobrir a campanha do lead (mais recente) e checar se tem IA + prompt.
    const { data: queueItem } = await admin
      .from('campaign_queue')
      .select('campaign_id')
      .eq('contact_id', lead.id)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (!queueItem?.campaign_id) {
      skipped++
      continue
    }

    const { data: campaign } = await admin
      .from('campaigns')
      .select('ai_enabled, ai_prompt')
      .eq('id', queueItem.campaign_id)
      .maybeSingle()

    if (!campaign?.ai_enabled || !campaign.ai_prompt?.trim()) {
      skipped++
      continue
    }

    const message = await generateReengagementMessage(lead.company_id, lead.phone, campaign.ai_prompt)
    if (!message) {
      // IA decidiu não insistir (ou erro) — já marcamos reactivated_at acima.
      skipped++
      continue
    }

    let ok = false
    try {
      ok = await sendWhatsAppMessage(lead.phone, message, { companyId: lead.company_id })
    } catch (err) {
      console.error('[Reativacao 24h] Falha no envio:', err)
      ok = false
    }

    if (ok) {
      await admin
        .from('campaign_contacts')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', lead.id)
      sent++
      // Anti-ban: intervalo aleatório só entre envios reais.
      if (processed < candidates.length) await sleep(randomDelay())
    } else {
      failed++
    }
  }

  return NextResponse.json({ processed, sent, skipped, failed })
}
