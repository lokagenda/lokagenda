'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'
import { revalidatePath } from 'next/cache'
import type { WhatsAppProvider } from '@/lib/whatsapp-api/types'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Nao autorizado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Acesso negado')
  return user
}

// ── WhatsApp Config ───────────────────────────────────────

export async function getWhatsAppConfig() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('active', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data || null
}

export async function saveWhatsAppConfig(configData: {
  provider: WhatsAppProvider
  api_url: string | null
  api_key: string | null
  instance_id: string | null
  phone_number_id: string | null
}) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  // Check if config already exists
  const { data: existing } = await admin
    .from('whatsapp_config')
    .select('id')
    .eq('active', true)
    .limit(1)
    .single()

  if (existing) {
    const { error } = await admin
      .from('whatsapp_config')
      .update({
        ...configData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('whatsapp_config')
      .insert({
        ...configData,
        active: true,
      })

    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/whatsapp')
}

export async function testWhatsAppConnection(phone: string) {
  await requireSuperAdmin()

  const success = await sendWhatsAppMessage(
    phone,
    'Teste de conexão LokAgenda ✅'
  )

  return { success }
}

// ── Templates ─────────────────────────────────────────────

export async function listWhatsAppTemplates() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_templates')
    .select('*')
    .order('slug', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateWhatsAppTemplate(
  id: string,
  templateData: { name?: string; content?: string; active?: boolean }
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('whatsapp_templates')
    .update({
      ...templateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/whatsapp')
}

// ── Message Logs ──────────────────────────────────────────

export async function listWhatsAppLogs(
  page: number = 1,
  filters?: { status?: string; dateFrom?: string; dateTo?: string }
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const perPage = 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = admin
    .from('whatsapp_message_log')
    .select('*, companies:company_id(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as 'pending' | 'sent' | 'failed' | 'delivered')
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00Z`)
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59Z`)
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    logs: data || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
    currentPage: page,
  }
}
