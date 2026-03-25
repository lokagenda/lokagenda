import { createClient } from '@/lib/supabase/server'
import { isSubscriptionActive } from '@/lib/plans'
import type { SubscriptionWithPlan } from '@/lib/plans'

/**
 * Busca a assinatura ativa (ou trial) da empresa com dados do plano.
 * SERVER ONLY - usa cookies()
 */
export async function getActivePlan(companyId: string): Promise<SubscriptionWithPlan | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('company_id', companyId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return data as unknown as SubscriptionWithPlan
}

/**
 * Verifica se a empresa pode criar mais produtos com base no plano.
 * SERVER ONLY
 */
export async function canCreateProduct(companyId: string): Promise<boolean> {
  const subscription = await getActivePlan(companyId)
  if (!subscription) return true // sem plano = sem limite (fase de implantação)
  if (!isSubscriptionActive(subscription)) return false
  if (subscription.plans.max_products === -1) return true // ilimitado

  const supabase = await createClient()
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const currentCount = count ?? 0
  return currentCount < subscription.plans.max_products
}

/**
 * Verifica se a empresa pode criar mais locações no mês com base no plano.
 * SERVER ONLY
 */
export async function canCreateRental(companyId: string): Promise<boolean> {
  const subscription = await getActivePlan(companyId)
  if (!subscription) return true // sem plano = sem limite
  if (!isSubscriptionActive(subscription)) return false
  if (subscription.plans.max_rentals_month === -1) return true // ilimitado

  const supabase = await createClient()

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { count } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', firstDayOfMonth)
    .lte('created_at', lastDayOfMonth)

  const currentCount = count ?? 0
  return currentCount < subscription.plans.max_rentals_month
}
