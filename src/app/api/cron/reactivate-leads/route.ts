import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'
import { generateReengagementMessage } from '@/lib/ai/agent'

/**
 * Robô de follow-up multi-touch (2d → 5d → esquece).
 *
 * Stage 0 → 1: lead com `last_message_at` >= 2 dias E sem resposta do cliente
 *   depois disso (last_inbound_at < last_message_at). Envia toque 1 (tom leve).
 * Stage 1 → 2: `last_follow_up_at` >= 3 dias (total ~5d desde silêncio) E
 *   cliente NÃO respondeu depois do toque 1. Envia toque 2 (despedida elegante).
 * Stage 2: final. Nunca mais mexe.
 *
 * Guardas anti-spam:
 *   - status IN ('contacted', 'qualified') apenas
 *   - manual_takeover_at IS NULL (humano assumiu → cala)
 *   - ai_paused_until vencido/null
 *   - last_message_at <= 30 dias (não ressuscita zumbi)
 *   - guard update com WHERE follow_up_stage=<expected> pra idempotência
 *
 * Anti-ban: MAX_PER_RUN=8 (4 stage-1 + 4 stage-2), janela BRT 9-19h, delay
 * aleatório 8-20s entre envios.
 */
export const maxDuration = 300

const MAX_PER_STAGE_PER_RUN = 4 // 4 stage-1 + 4 stage-2 = 8 total (respeita anti-ban)
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
const WINDOW_START_HOUR = 9
const WINDOW_END_HOUR = 19

const STAGE_1_SILENCE_DAYS = 2 // envia toque 1 apos 2d sem resposta
const STAGE_2_AFTER_STAGE_1_DAYS = 3 // envia toque 2 apos +3d desde toque 1 (~5d total)
const MAX_LEAD_AGE_DAYS = 30 // teto: nao ressuscita lead frio velho demais

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))
}

type Candidate = {
  id: string
  company_id: string
  phone: string
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Janela diurna BRT — fora dela, silêncio total.
  const nowMs = Date.now()
  const brt = new Date(nowMs - BRT_OFFSET_MS)
  const brtHour = brt.getUTCHours()
  if (brtHour < WINDOW_START_HOUR || brtHour >= WINDOW_END_HOUR) {
    return NextResponse.json({ skipped: 'fora da janela', sent_stage_1: 0, sent_stage_2: 0 })
  }

  const nowIso = new Date().toISOString()
  const stage1SilentCutoff = new Date(nowMs - STAGE_1_SILENCE_DAYS * 86400_000).toISOString()
  const stage2SinceLastCutoff = new Date(nowMs - STAGE_2_AFTER_STAGE_1_DAYS * 86400_000).toISOString()
  const maxAgeCutoff = new Date(nowMs - MAX_LEAD_AGE_DAYS * 86400_000).toISOString()

  // Candidatos stage 0 → 1: silêncio de 2 dias e cliente não respondeu no meio.
  // A condicao "cliente nao respondeu depois da ultima Nick" eh checada por
  // last_inbound_at < last_message_at (last_message_at sobe no outbound tambem).
  const { data: stage0 } = await admin
    .from('campaign_contacts')
    .select('id, company_id, phone, last_message_at, last_inbound_at')
    .eq('follow_up_stage', 0)
    .in('status', ['contacted', 'qualified'])
    .is('manual_takeover_at', null)
    .not('last_message_at', 'is', null)
    .lte('last_message_at', stage1SilentCutoff)
    .gte('last_message_at', maxAgeCutoff)
    .order('last_message_at', { ascending: true })
    .limit(MAX_PER_STAGE_PER_RUN * 3) // over-fetch — muitos vao ser filtrados por last_inbound_at ou ai_paused_until

  // Candidatos stage 1 → 2: ~3 dias desde toque 1 sem resposta.
  const { data: stage1 } = await admin
    .from('campaign_contacts')
    .select('id, company_id, phone, last_follow_up_at, last_inbound_at')
    .eq('follow_up_stage', 1)
    .in('status', ['contacted', 'qualified'])
    .is('manual_takeover_at', null)
    .not('last_follow_up_at', 'is', null)
    .lte('last_follow_up_at', stage2SinceLastCutoff)
    .order('last_follow_up_at', { ascending: true })
    .limit(MAX_PER_STAGE_PER_RUN * 3)

  // Filtro pos-query: cliente respondeu depois -> nao cutuca (protege quando
  // last_message_at foi setado por outro processo mas cliente respondeu junto).
  // Tambem filtra ai_paused_until (query builder chato pra timestamp condicional).
  const isEligible = (row: {
    last_message_at?: string | null
    last_follow_up_at?: string | null
    last_inbound_at?: string | null
  }): boolean => {
    if (!row.last_inbound_at) return true
    const inboundMs = new Date(row.last_inbound_at).getTime()
    const refMs = new Date(row.last_follow_up_at ?? row.last_message_at ?? 0).getTime()
    // Cliente respondeu DEPOIS do ultimo contato da nossa parte -> nao cutuca.
    return inboundMs <= refMs
  }

  const stage0Filtered: Candidate[] = (stage0 || [])
    .filter(isEligible)
    .slice(0, MAX_PER_STAGE_PER_RUN)
  const stage1Filtered: Candidate[] = (stage1 || [])
    .filter(isEligible)
    .slice(0, MAX_PER_STAGE_PER_RUN)

  // ai_paused_until check: rodada extra pra buscar current do banco (evita race).
  const allIds = [...stage0Filtered.map((r) => r.id), ...stage1Filtered.map((r) => r.id)]
  const pausedIds = new Set<string>()
  if (allIds.length > 0) {
    const { data: pausedRows } = await admin
      .from('campaign_contacts')
      .select('id, ai_paused_until')
      .in('id', allIds)
      .gt('ai_paused_until', nowIso)
    for (const row of pausedRows || []) pausedIds.add(row.id)
  }

  let sentStage1 = 0
  let sentStage2 = 0
  let skippedByGuard = 0
  let skippedByAi = 0
  let failed = 0

  const processLead = async (lead: Candidate, expectedStage: 0 | 1) => {
    if (pausedIds.has(lead.id)) {
      skippedByGuard++
      return
    }

    // Guard update: promove stage COM WHERE stage=expected. Se outro processo
    // ja promoveu, updateCount=0 e a gente pula (idempotencia forte).
    const newStage = (expectedStage + 1) as 1 | 2
    const { data: promoted, error: promoteErr } = await admin
      .from('campaign_contacts')
      .update({ follow_up_stage: newStage, last_follow_up_at: nowIso, updated_at: nowIso })
      .eq('id', lead.id)
      .eq('follow_up_stage', expectedStage)
      .select('id')
    if (promoteErr || !promoted || promoted.length === 0) {
      skippedByGuard++
      return
    }

    // Descobre a campanha ativa desse lead pra usar o script (ai_prompt).
    const { data: queueItem } = await admin
      .from('campaign_queue')
      .select('campaign_id')
      .eq('contact_id', lead.id)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (!queueItem?.campaign_id) {
      skippedByAi++
      return
    }

    const { data: campaign } = await admin
      .from('campaigns')
      .select('ai_enabled, ai_prompt')
      .eq('id', queueItem.campaign_id)
      .maybeSingle()

    if (!campaign?.ai_enabled || !campaign.ai_prompt?.trim()) {
      skippedByAi++
      return
    }

    const message = await generateReengagementMessage(
      lead.company_id,
      lead.phone,
      campaign.ai_prompt,
      { stage: newStage },
    )
    if (!message) {
      // IA decidiu PULAR ou deu erro — stage ja foi promovido no guard update,
      // entao nao recutuca. Comportamento correto pra evitar loop de retry.
      skippedByAi++
      return
    }

    let ok = false
    try {
      ok = await sendWhatsAppMessage(lead.phone, message, { companyId: lead.company_id, purpose: 'marketing' })
    } catch (err) {
      console.error('[Follow-up] Falha envio:', err)
      ok = false
    }

    if (ok) {
      await admin
        .from('campaign_contacts')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', lead.id)
      if (newStage === 1) sentStage1++
      else sentStage2++
      await sleep(randomDelay())
    } else {
      failed++
    }
  }

  // Processa stage 0 primeiro (mais urgente), depois stage 1.
  for (const lead of stage0Filtered) {
    await processLead(lead, 0)
  }
  for (const lead of stage1Filtered) {
    await processLead(lead, 1)
  }

  return NextResponse.json({
    sent_stage_1: sentStage1,
    sent_stage_2: sentStage2,
    skipped_guard: skippedByGuard,
    skipped_ai: skippedByAi,
    failed,
    candidates_stage_0: stage0Filtered.length,
    candidates_stage_1: stage1Filtered.length,
  })
}
