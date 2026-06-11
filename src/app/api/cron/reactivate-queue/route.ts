import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTemplateMessage } from '@/lib/whatsapp-api/sender'

// Processa a fila de reativação (`reactivation_queue`). Mantém o intervalo
// anti-ban de 8-20s entre envios MAS LIMITA quantos saem por execução pra não
// estourar o `maxDuration`. A cada rodada do cron, mais um lote é drenado.
export const maxDuration = 300

const MAX_PER_RUN = 12 // 12 envios * ~14s = ~168s, dentro de maxDuration
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const randomDelay = () => Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pega os mais antigos pendentes — ordem de inserção.
  const { data: pending } = await admin
    .from('reactivation_queue')
    .select('id, company_id, phone, company_name, template_slug, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0 })
  }

  let sent = 0
  let failed = 0
  let processed = 0

  for (const item of pending) {
    let ok = false
    let errMsg: string | null = null
    try {
      ok = await sendTemplateMessage(
        item.template_slug,
        item.phone,
        { nome: item.company_name || '', cupom: 'VOLTAR50' },
        item.company_id
      )
      if (!ok) errMsg = 'Falha no envio pelo provedor WhatsApp'
    } catch (err) {
      ok = false
      errMsg = err instanceof Error ? err.message : 'Erro inesperado'
    }

    const nowIso = new Date().toISOString()
    await admin
      .from('reactivation_queue')
      .update(
        ok
          ? { status: 'sent', sent_at: nowIso, attempts: item.attempts + 1, last_error: null }
          : { status: 'failed', attempts: item.attempts + 1, last_error: errMsg }
      )
      .eq('id', item.id)

    if (ok) sent++
    else failed++
    processed++

    // Intervalo anti-ban entre cada envio. Só pula o sleep no último pra encerrar
    // o run logo.
    if (processed < pending.length) await sleep(randomDelay())
  }

  return NextResponse.json({ processed, sent, failed })
}
