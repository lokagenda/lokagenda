import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const tables = [
    'companies',
    'profiles',
    'products',
    'customers',
    'quotes',
    'quote_items',
    'rentals',
    'rental_items',
    'contract_templates',
  ] as const

  const backup: Record<string, unknown[]> = {}

  for (const table of tables) {
    const { data } = await admin.from(table).select('*')
    backup[table] = data || []
  }

  const date = new Date().toISOString().split('T')[0]
  const fileName = `backup_${date}.json`
  const content = JSON.stringify(
    { created_at: new Date().toISOString(), data: backup },
    null,
    2
  )

  // Upload to storage
  await admin.storage.from('backups').upload(fileName, content, {
    contentType: 'application/json',
    upsert: true,
  })

  // Clean old backups (> 30 days)
  const { data: files } = await admin.storage.from('backups').list()
  if (files) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const oldFiles = files.filter((f) => {
      const match = f.name.match(/backup_(\d{4}-\d{2}-\d{2})/)
      if (!match) return false
      return new Date(match[1]) < thirtyDaysAgo
    })

    if (oldFiles.length > 0) {
      await admin.storage.from('backups').remove(oldFiles.map((f) => f.name))
    }
  }

  return NextResponse.json({ success: true, file: fileName })
}
