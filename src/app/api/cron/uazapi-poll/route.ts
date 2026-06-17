import { NextRequest, NextResponse } from 'next/server'
import { pollUazapi } from '@/lib/whatsapp-api/uazapi-poll'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await pollUazapi()
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    console.error('[cron/uazapi-poll]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
