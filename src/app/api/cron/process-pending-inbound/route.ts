import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processNow } from '@/lib/ai/debounce'

// Cleanup: pega pending_inbound antigas (>= 5min) que ficaram pra tras quando
// after() do Vercel falhou (restart, timeout). Garante que NENHUMA mensagem fica
// pra sempre no buffer sem resposta.
export const maxDuration = 60

const STALE_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoffIso = new Date(Date.now() - STALE_MS).toISOString()

  // Lista phones distintos com pendings antigas
  const { data: stale } = await admin
    .from('pending_inbound')
    .select('phone')
    .is('processed_at', null)
    .lt('created_at', cutoffIso)
    .limit(50)

  if (!stale || stale.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const phones = Array.from(new Set(stale.map((s) => s.phone)))
  let processed = 0
  let errors = 0

  for (const phone of phones) {
    try {
      await processNow(phone)
      processed++
    } catch (err) {
      errors++
      console.error('[cron/process-pending-inbound] phone=' + phone, err)
    }
  }

  return NextResponse.json({ ok: true, processed, errors, total_phones: phones.length })
}
