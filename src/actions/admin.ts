'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/database'

type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

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

// ── Companies ──────────────────────────────────────────────

export async function listCompanies(search?: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('companies')
    .select(`
      *,
      profiles!profiles_company_id_fkey(id, full_name, role),
      subscriptions(id, status, plan_id, current_price, billing_cycle, plans(name))
    `)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function getCompanyDetails(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('companies')
    .select(`
      *,
      profiles!profiles_company_id_fkey(id, full_name, role, created_at),
      subscriptions(*, plans(name)),
      products(count),
      customers(count),
      rentals(count)
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function toggleCompanyStatus(companyId: string, suspend: boolean) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (suspend) {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .in('status', ['trial', 'active'])

    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'active', cancelled_at: null })
      .eq('company_id', companyId)
      .eq('status', 'cancelled')

    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/empresas')
}

// ── Plans ──────────────────────────────────────────────────

export async function listPlans() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('plans')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function updatePlan(id: string, data: {
  name?: string
  price_monthly?: number
  price_semiannual?: number
  price_annual?: number
  max_products?: number
  max_rentals_month?: number
  max_users?: number
  features?: Json
  active?: boolean
}) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('plans')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/planos')
}

export async function togglePlanActive(id: string, active: boolean) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('plans')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/planos')
}

// ── Subscriptions ──────────────────────────────────────────

export async function listSubscriptions(statusFilter?: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('subscriptions')
    .select(`
      *,
      companies(name),
      plans(name)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter as SubscriptionStatus)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function updateSubscription(id: string, data: {
  status?: SubscriptionStatus
  trial_ends_at?: string
  current_period_end?: string
}) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('subscriptions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/assinaturas')
}

// ── Users ──────────────────────────────────────────────────

export async function listUsers(search?: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select(`
      *,
      companies(name)
    `)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('full_name', `%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Fetch emails from auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const emailMap = new Map<string, string>()
  if (authUsers?.users) {
    for (const u of authUsers.users) {
      emailMap.set(u.id, u.email || '')
    }
  }

  return (data || []).map(p => ({
    ...p,
    email: emailMap.get(p.id) || '',
  }))
}

export async function updateUserRole(id: string, role: 'owner' | 'admin' | 'operator' | 'super_admin') {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/usuarios')
}

// ── Global Banners ─────────────────────────────────────────

export async function listGlobalBanners() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('banners')
    .select('*')
    .eq('is_global', true)
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createGlobalBanner(formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const linkUrl = formData.get('link_url') as string
  const position = parseInt(formData.get('position') as string, 10) || 0
  const active = formData.get('active') === 'true'
  const bannerType = ((formData.get('type') as string) || 'banner') as 'banner' | 'popup'
  const imageFile = formData.get('image') as File | null

  if (!imageFile || imageFile.size === 0) {
    throw new Error('Imagem e obrigatoria')
  }

  const fileExt = imageFile.name.split('.').pop()
  const fileName = `global/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await admin.storage
    .from('banners')
    .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

  if (uploadError) throw new Error('Erro ao enviar imagem: ' + uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('banners').getPublicUrl(fileName)

  const { error } = await admin.from('banners').insert({
    company_id: null,
    image_url: publicUrl,
    link_url: linkUrl || null,
    position,
    active,
    is_global: true,
    type: bannerType,
  })

  if (error) throw new Error('Erro ao criar banner: ' + error.message)
  revalidatePath('/admin/banners')
}

export async function updateGlobalBanner(id: string, formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('banners')
    .select('*')
    .eq('id', id)
    .eq('is_global', true)
    .single()

  if (fetchError || !existing) throw new Error('Banner nao encontrado')

  const linkUrl = formData.get('link_url') as string
  const position = parseInt(formData.get('position') as string, 10) || 0
  const active = formData.get('active') === 'true'
  const bannerType = ((formData.get('type') as string) || 'banner') as 'banner' | 'popup'
  const imageFile = formData.get('image') as File | null

  let imageUrl = existing.image_url

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `global/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from('banners')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

    if (uploadError) throw new Error('Erro ao enviar imagem: ' + uploadError.message)

    const { data: { publicUrl } } = admin.storage.from('banners').getPublicUrl(fileName)

    // Remove old
    if (existing.image_url) {
      try {
        const url = new URL(existing.image_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/banners/')
        if (pathParts[1]) await admin.storage.from('banners').remove([pathParts[1]])
      } catch { /* ignore */ }
    }

    imageUrl = publicUrl
  }

  const { error } = await admin
    .from('banners')
    .update({
      image_url: imageUrl,
      link_url: linkUrl || null,
      position,
      active,
      type: bannerType,
    })
    .eq('id', id)

  if (error) throw new Error('Erro ao atualizar banner: ' + error.message)
  revalidatePath('/admin/banners')
}

export async function deleteGlobalBanner(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('banners')
    .select('image_url')
    .eq('id', id)
    .eq('is_global', true)
    .single()

  if (existing?.image_url) {
    try {
      const url = new URL(existing.image_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/banners/')
      if (pathParts[1]) await admin.storage.from('banners').remove([pathParts[1]])
    } catch { /* ignore */ }
  }

  const { error } = await admin
    .from('banners')
    .delete()
    .eq('id', id)
    .eq('is_global', true)

  if (error) throw new Error('Erro ao excluir banner: ' + error.message)
  revalidatePath('/admin/banners')
}

export async function toggleGlobalBanner(id: string, active: boolean) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('banners')
    .update({ active })
    .eq('id', id)
    .eq('is_global', true)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/banners')
}

// ── Dashboard Stats ────────────────────────────────────────

export async function getAdminStats() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const [companies, activeSubscriptions, allActiveSubscriptions, profiles, recentCompanies] =
    await Promise.all([
      admin.from('companies').select('*', { count: 'exact', head: true }),
      admin.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['trial', 'active']),
      admin.from('subscriptions').select('current_price').eq('status', 'active'),
      admin.from('profiles').select('*', { count: 'exact', head: true }),
      admin.from('companies').select('id, name, created_at').order('created_at', { ascending: false }).limit(10),
    ])

  const monthlyRevenue = (allActiveSubscriptions.data || []).reduce(
    (sum, s) => sum + (s.current_price || 0),
    0
  )

  return {
    totalCompanies: companies.count || 0,
    activeSubscriptions: activeSubscriptions.count || 0,
    monthlyRevenue,
    totalUsers: profiles.count || 0,
    recentCompanies: recentCompanies.data || [],
  }
}
