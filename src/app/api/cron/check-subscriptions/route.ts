import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Cron diario: marca como 'expired' toda subscription com status='active'
// cujo current_period_end ja passou. Backup pro flip em tempo real do
// layout.tsx (ensureSubscriptionStatusFresh) - garante consistencia mesmo
// pra clientes que nao acessam o sistema.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const { data: expired, error } = await admin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('status', 'active')
      .lt('current_period_end', nowIso)
      .select('id, company_id, current_period_end')

    if (error) {
      console.error('[cron/check-subscriptions]', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const count = expired?.length ?? 0
    console.log('[cron/check-subscriptions] flipped to expired:', count)
    return NextResponse.json({ ok: true, expired: count, ids: expired?.map((s) => s.id) ?? [] })
  } catch (err) {
    console.error('[cron/check-subscriptions] exception', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
