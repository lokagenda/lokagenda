'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Coupon } from '@/types/database'

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

// ── Admin CRUD ──────────────────────────────────────────────

export async function listCoupons(): Promise<Coupon[]> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

interface CreateCouponData {
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  duration_months: number
  valid_until?: string | null
  max_uses?: number | null
}

export async function createCoupon(data: CreateCouponData): Promise<{ success: true } | { error: string }> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const code = (data.code || '').trim().toUpperCase()
    if (!code) return { error: 'Codigo obrigatorio' }
    if (!data.discount_value || data.discount_value <= 0) return { error: 'Valor do desconto invalido' }
    if (data.discount_type === 'percentage' && data.discount_value > 100) {
      return { error: 'Percentual nao pode ser maior que 100' }
    }

    const { error } = await admin.from('coupons').insert({
      code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      duration_months: data.duration_months || 1,
      valid_until: data.valid_until || null,
      max_uses: data.max_uses ?? null,
    })

    if (error) {
      if (error.code === '23505') return { error: 'Ja existe um cupom com esse codigo' }
      return { error: error.message }
    }

    revalidatePath('/admin/cupons')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar cupom' }
  }
}

interface UpdateCouponData {
  code?: string
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  duration_months?: number
  valid_until?: string | null
  max_uses?: number | null
}

export async function updateCoupon(id: string, data: UpdateCouponData): Promise<{ success: true } | { error: string }> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const payload: UpdateCouponData & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    }

    // Validar valor do desconto (mesma regra do create)
    if (data.discount_value !== undefined) {
      if (data.discount_value <= 0) return { error: 'O valor do desconto deve ser maior que zero' }
      const tipo = data.discount_type
      if (tipo === 'percentage' && data.discount_value > 100) {
        return { error: 'Desconto percentual não pode passar de 100%' }
      }
    }

    if (data.code !== undefined) payload.code = data.code.trim().toUpperCase()
    if (data.discount_type !== undefined) payload.discount_type = data.discount_type
    if (data.discount_value !== undefined) payload.discount_value = data.discount_value
    if (data.duration_months !== undefined) payload.duration_months = data.duration_months
    if (data.valid_until !== undefined) payload.valid_until = data.valid_until || null
    if (data.max_uses !== undefined) payload.max_uses = data.max_uses ?? null

    const { error } = await admin.from('coupons').update(payload).eq('id', id)

    if (error) {
      if (error.code === '23505') return { error: 'Ja existe um cupom com esse codigo' }
      return { error: error.message }
    }

    revalidatePath('/admin/cupons')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao atualizar cupom' }
  }
}

export async function deleteCoupon(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const { error } = await admin.from('coupons').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/admin/cupons')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao excluir cupom' }
  }
}

export async function toggleCoupon(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const { data: coupon, error: fetchError } = await admin
      .from('coupons')
      .select('active')
      .eq('id', id)
      .single()

    if (fetchError || !coupon) return { error: 'Cupom nao encontrado' }

    const { error } = await admin
      .from('coupons')
      .update({ active: !coupon.active, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/cupons')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao alterar cupom' }
  }
}

// ── Public validation ───────────────────────────────────────

export interface ValidateCouponResult {
  valid: boolean
  error?: string
  discountValue?: number
  discountType?: string
  finalPrice?: number
  durationMonths?: number
}

export async function validateCoupon(code: string, planPrice: number): Promise<ValidateCouponResult> {
  const normalized = (code || '').trim().toUpperCase()
  if (!normalized) return { valid: false, error: 'Informe um codigo de cupom' }

  // coupons tem RLS habilitado sem policies de usuario, entao a leitura precisa
  // do admin client (server-side only).
  const admin = createAdminClient()

  const { data: coupon, error } = await admin
    .from('coupons')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()

  if (error) return { valid: false, error: 'Erro ao validar cupom' }
  if (!coupon) return { valid: false, error: 'Cupom nao encontrado' }
  if (!coupon.active) return { valid: false, error: 'Cupom inativo' }

  // Validade
  if (coupon.valid_until) {
    const validUntil = new Date(coupon.valid_until)
    if (validUntil.getTime() < Date.now()) {
      return { valid: false, error: 'Cupom expirado' }
    }
  }

  // Limite de usos
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: 'Cupom esgotou o limite de usos' }
  }

  // Calcular preco final (clamp em 0 nos dois casos por seguranca)
  let finalPrice: number
  if (coupon.discount_type === 'percentage') {
    finalPrice = planPrice * (1 - coupon.discount_value / 100)
  } else {
    finalPrice = planPrice - coupon.discount_value
  }
  finalPrice = Math.max(0, Math.round(finalPrice * 100) / 100)

  return {
    valid: true,
    discountValue: coupon.discount_value,
    discountType: coupon.discount_type,
    finalPrice,
    durationMonths: coupon.duration_months,
  }
}
