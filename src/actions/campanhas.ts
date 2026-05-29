'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CampaignContact, Campaign } from '@/types/database'

// ---------------------------------------------------------------------------
// Auth helper (same pattern as src/actions/rentals.ts)
// ---------------------------------------------------------------------------
async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('Perfil não encontrado')
  // Marketing/disparo em massa usa o Z-API global (numero do dono da plataforma):
  // somente super_admin pode usar.
  if (profile.role !== 'super_admin') throw new Error('Acesso restrito ao administrador')
  return { userId: user.id, companyId: profile.company_id }
}

// Normalize a phone to digits only, prefixing the Brazilian country code (55).
function normalizePhoneDigits(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

type ContactStatus = CampaignContact['status']
type CampaignStatus = Campaign['status']

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
export async function listContacts(filter?: { status?: ContactStatus; search?: string }) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  let query = supabase
    .from('campaign_contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filter?.status) {
    query = query.eq('status', filter.status)
  }

  if (filter?.search && filter.search.trim() !== '') {
    const search = `%${filter.search.trim()}%`
    query = query.or(`name.ilike.${search},phone.ilike.${search},tags.ilike.${search}`)
  }

  const { data, error } = await query
  if (error) return { error: error.message, contacts: [] as CampaignContact[] }
  return { contacts: (data || []) as CampaignContact[] }
}

export async function createContact(data: {
  name?: string | null
  phone: string
  tags?: string | null
  source?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const phone = normalizePhoneDigits(data.phone)
  if (!phone) return { error: 'Telefone inválido' }

  // Dedupe by phone within the company
  const { data: existing } = await supabase
    .from('campaign_contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('phone', phone)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'Já existe um contato com este telefone' }
  }

  const { data: contact, error } = await supabase
    .from('campaign_contacts')
    .insert({
      company_id: companyId,
      name: data.name?.trim() || null,
      phone,
      tags: data.tags?.trim() || null,
      source: data.source?.trim() || 'manual',
      notes: data.notes?.trim() || null,
      status: 'lead',
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { contact: contact as CampaignContact }
}

export async function updateContact(
  id: string,
  data: { name?: string | null; phone?: string; tags?: string | null; notes?: string | null }
) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name?.trim() || null
  if (data.tags !== undefined) update.tags = data.tags?.trim() || null
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null
  if (data.phone !== undefined) {
    const phone = normalizePhoneDigits(data.phone)
    if (!phone) return { error: 'Telefone inválido' }
    update.phone = phone
  }

  const { error } = await supabase
    .from('campaign_contacts')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('campaign_contacts')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

export async function deleteContacts(ids: string[]) {
  if (!ids?.length) return { success: true, deleted: 0 }
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  // Apaga em lotes: muitos IDs num único .in() estouram o limite de tamanho da
  // URL do PostgREST (gera 400 Bad Request). 150 por vez mantém a URL curta.
  const CHUNK = 150
  let deleted = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('campaign_contacts')
      .delete()
      .eq('company_id', companyId)
      .in('id', slice)

    if (error) return { error: error.message, deleted }
    deleted += slice.length
  }

  revalidatePath('/dashboard/marketing')
  return { success: true, deleted }
}

export async function updateContactStatus(id: string, status: ContactStatus) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('campaign_contacts')
    .update({ status })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

export async function importContactsCSV(rows: { name?: string; phone: string; tags?: string }[]) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'Nenhum contato para importar', imported: 0, skipped: 0 }
  }

  // Normalize + dedupe within the incoming batch
  const seen = new Set<string>()
  const normalized = rows
    .map((r) => ({
      name: r.name?.trim() || null,
      phone: normalizePhoneDigits(r.phone),
      tags: r.tags?.trim() || null,
    }))
    .filter((r) => {
      if (!r.phone) return false
      if (seen.has(r.phone)) return false
      seen.add(r.phone)
      return true
    })

  if (normalized.length === 0) {
    return { error: 'Nenhum telefone válido encontrado', imported: 0, skipped: rows.length }
  }

  // Dedupe against contacts already in the company
  const phones = normalized.map((r) => r.phone)
  const { data: existing } = await supabase
    .from('campaign_contacts')
    .select('phone')
    .eq('company_id', companyId)
    .in('phone', phones)

  const existingSet = new Set((existing || []).map((e) => e.phone))
  const toInsert = normalized
    .filter((r) => !existingSet.has(r.phone))
    .map((r) => ({
      company_id: companyId,
      name: r.name,
      phone: r.phone,
      tags: r.tags,
      source: 'csv',
      status: 'lead' as const,
    }))

  const skipped = rows.length - toInsert.length

  if (toInsert.length === 0) {
    return { imported: 0, skipped }
  }

  const { error } = await supabase.from('campaign_contacts').insert(toInsert)
  if (error) return { error: error.message, imported: 0, skipped }

  revalidatePath('/dashboard/marketing')
  return { imported: toInsert.length, skipped }
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export async function listCampaigns() {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, campaigns: [] as Campaign[] }
  return { campaigns: (data || []) as Campaign[] }
}

// Garante janela de horário coerente (0-23, início < fim). Default 8h-20h.
function sanitizeWindow(start?: number, end?: number): { start: number; end: number } {
  let s = Number.isFinite(start) ? Math.min(23, Math.max(0, Math.round(start as number))) : 8
  let e = Number.isFinite(end) ? Math.min(23, Math.max(1, Math.round(end as number))) : 20
  if (e <= s) {
    s = 8
    e = 20
  }
  return { start: s, end: e }
}

export async function createCampaign(data: {
  name: string
  message_template: string
  ai_enabled?: boolean
  ai_prompt?: string | null
  daily_limit?: number
  send_window_start?: number
  send_window_end?: number
}) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!data.name?.trim()) return { error: 'Nome da campanha é obrigatório' }
  if (!data.message_template?.trim()) return { error: 'Mensagem é obrigatória' }

  const dailyLimit =
    data.daily_limit && data.daily_limit > 0 ? Math.min(data.daily_limit, 1000) : 50
  const win = sanitizeWindow(data.send_window_start, data.send_window_end)

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      company_id: companyId,
      name: data.name.trim(),
      message_template: data.message_template.trim(),
      ai_enabled: data.ai_enabled ?? false,
      ai_prompt: data.ai_prompt?.trim() || null,
      daily_limit: dailyLimit,
      send_window_start: win.start,
      send_window_end: win.end,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { campaign: campaign as Campaign }
}

export async function updateCampaign(
  id: string,
  data: {
    name?: string
    message_template?: string
    ai_enabled?: boolean
    ai_prompt?: string | null
    daily_limit?: number
    send_window_start?: number
    send_window_end?: number
  }
) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const update: Record<string, unknown> = {}
  if (data.name !== undefined) {
    if (!data.name.trim()) return { error: 'Nome da campanha é obrigatório' }
    update.name = data.name.trim()
  }
  if (data.message_template !== undefined) {
    if (!data.message_template.trim()) return { error: 'Mensagem é obrigatória' }
    update.message_template = data.message_template.trim()
  }
  if (data.ai_enabled !== undefined) update.ai_enabled = data.ai_enabled
  if (data.ai_prompt !== undefined) update.ai_prompt = data.ai_prompt?.trim() || null
  if (data.daily_limit !== undefined) {
    update.daily_limit = data.daily_limit > 0 ? Math.min(data.daily_limit, 1000) : 50
  }
  if (data.send_window_start !== undefined || data.send_window_end !== undefined) {
    const win = sanitizeWindow(data.send_window_start, data.send_window_end)
    update.send_window_start = win.start
    update.send_window_end = win.end
  }

  const { error } = await supabase
    .from('campaigns')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

/**
 * Duplica uma campanha como rascunho (copia mensagem, prompt da IA, limite e
 * janela de horário). Não copia contatos/fila — assim o usuário reaproveita o
 * prompt e só troca os contatos (ex.: novo lote com outra tag) a cada dia.
 */
export async function duplicateCampaign(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data: orig, error: fetchErr } = await supabase
    .from('campaigns')
    .select('name, message_template, ai_enabled, ai_prompt, daily_limit, send_window_start, send_window_end')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchErr || !orig) return { error: 'Campanha não encontrada' }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      company_id: companyId,
      name: `${orig.name} (cópia)`,
      message_template: orig.message_template,
      ai_enabled: orig.ai_enabled,
      ai_prompt: orig.ai_prompt,
      daily_limit: orig.daily_limit,
      send_window_start: orig.send_window_start,
      send_window_end: orig.send_window_end,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { campaign: campaign as Campaign }
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  // Remove queue items first (no cascade guaranteed at app level)
  await supabase
    .from('campaign_queue')
    .delete()
    .eq('campaign_id', id)
    .eq('company_id', companyId)

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

export async function startCampaign(
  campaignId: string,
  contactFilter?: { status?: ContactStatus; tags?: string }
) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  // Make sure the campaign belongs to the company
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('company_id', companyId)
    .single()

  if (!campaign) return { error: 'Campanha não encontrada' }

  // Build the target contact list
  let contactsQuery = supabase
    .from('campaign_contacts')
    .select('id, phone')
    .eq('company_id', companyId)

  if (contactFilter?.status) {
    contactsQuery = contactsQuery.eq('status', contactFilter.status)
  }
  if (contactFilter?.tags && contactFilter.tags.trim() !== '') {
    contactsQuery = contactsQuery.ilike('tags', `%${contactFilter.tags.trim()}%`)
  }

  const { data: contacts, error: contactsError } = await contactsQuery
  if (contactsError) return { error: contactsError.message }
  if (!contacts || contacts.length === 0) {
    return { error: 'Nenhum contato encontrado para esta campanha' }
  }

  // Avoid re-queuing contacts already in the queue for this campaign
  const { data: existingQueue } = await supabase
    .from('campaign_queue')
    .select('contact_id')
    .eq('campaign_id', campaignId)
    .eq('company_id', companyId)

  const alreadyQueued = new Set((existingQueue || []).map((q) => q.contact_id))

  const queueRows = contacts
    .filter((c) => !alreadyQueued.has(c.id))
    .map((c) => ({
      campaign_id: campaignId,
      company_id: companyId,
      contact_id: c.id,
      phone: c.phone,
      status: 'pending' as const,
    }))

  if (queueRows.length > 0) {
    const { error: insertError } = await supabase.from('campaign_queue').insert(queueRows)
    if (insertError) return { error: insertError.message }
  }

  // total_targets reflects the full pending queue size for this campaign
  const { count: totalTargets } = await supabase
    .from('campaign_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('company_id', companyId)

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'running', total_targets: totalTargets || queueRows.length })
    .eq('id', campaignId)
    .eq('company_id', companyId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/marketing')
  return { success: true, queued: queueRows.length }
}

export async function pauseCampaign(id: string) {
  return setCampaignStatus(id, 'paused')
}

export async function resumeCampaign(id: string) {
  return setCampaignStatus(id, 'running')
}

async function setCampaignStatus(id: string, status: CampaignStatus) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('campaigns')
    .update({ status })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/marketing')
  return { success: true }
}

export async function getCampaignStats(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const baseQueue = () =>
    supabase
      .from('campaign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .eq('company_id', companyId)

  const [{ count: sent }, { count: pending }, { count: failed }] = await Promise.all([
    baseQueue().eq('status', 'sent'),
    baseQueue().eq('status', 'pending'),
    baseQueue().eq('status', 'failed'),
  ])

  // Replies = contacts that progressed beyond "lead" (contacted/qualified/converted)
  const { data: queuedContacts } = await supabase
    .from('campaign_queue')
    .select('contact_id')
    .eq('campaign_id', id)
    .eq('company_id', companyId)
    .not('contact_id', 'is', null)

  const contactIds = Array.from(
    new Set((queuedContacts || []).map((q) => q.contact_id).filter(Boolean))
  ) as string[]

  let replies = 0
  if (contactIds.length > 0) {
    const { count } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('id', contactIds)
      .in('status', ['contacted', 'qualified', 'converted'])
    replies = count || 0
  }

  return {
    sent: sent || 0,
    pending: pending || 0,
    failed: failed || 0,
    replies,
  }
}
