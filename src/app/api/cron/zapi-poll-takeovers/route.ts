import { NextRequest, NextResponse } from 'next/server'
import { pollZApiTakeovers } from '@/lib/whatsapp-api/z-api-poll'

// Cron a cada 2min — puxa histórico Z-API dos chats ativos e marca takeovers
// manuais (Léo respondendo do celular). Substitui a flag `notifySentByMe` que
// a Z-API documenta mas não entrega pra essa conta.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await pollZApiTakeovers()
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    console.error('[cron/zapi-poll-takeovers] erro', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
