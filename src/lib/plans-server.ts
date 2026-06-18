import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSubscriptionActive } from '@/lib/plans'
import type { Subscription } from '@/types/database'
import type { SubscriptionWithPlan } from '@/lib/plans'

/**
 * Garante que status='active' com current_period_end < now() vire 'expired'.
 * Sem isso, o SubscriptionGate nao bloqueia o cliente com plano vencido
 * (continuava usando o sistema como se nada tivesse vencido).
 *
 * Retorna o subscription possivelmente com status atualizado.
 * Usa admin client pra contornar RLS (write).
 */
export async function ensureSubscriptionStatusFresh(sub: Subscription): Promise<Subscription> {
  // Trial e outros estados nao precisam de flip
  if (sub.status !== 'active') return sub
  if (!sub.current_period_end) return sub
  if (new Date(sub.current_period_end) > new Date()) return sub

  // Plano pago vencido: flipa pra 'expired'
  try {
    const admin = createAdminClient()
    await admin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sub.id)
      .eq('status', 'active') // idempotente: so flipa se ainda esta active
    return { ...sub, status: 'expired' }
  } catch (err) {
    console.error('[plans-server] flip status expired falhou sub_id=' + sub.id, err)
    return sub
  }
}

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
