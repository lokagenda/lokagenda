import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron diário consolidado (plano Hobby do Vercel permite poucos crons, só diários).
 * Dispara internamente os handlers de notificações, WhatsApp (lifecycle) e campanhas,
 * todos protegidos pelo mesmo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Base URL para chamadas internas (mesma origem do request)
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host')
  const base = `${proto}://${host}`

  const endpoints = ['/api/cron/notifications', '/api/cron/whatsapp', '/api/cron/campaigns']
  const results: Record<string, unknown> = {}

  for (const path of endpoints) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      results[path] = await res.json().catch(() => ({ status: res.status }))
    } catch (err) {
      results[path] = { error: err instanceof Error ? err.message : 'erro' }
    }
  }

  return NextResponse.json({ success: true, results })
}
