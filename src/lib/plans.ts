import type { Plan, Subscription } from '@/types/database'

export type BillingCycle = 'monthly' | 'semiannual' | 'annual'

export type SubscriptionWithPlan = Subscription & {
  plans: Plan
}

/**
 * Verifica se a assinatura está ativa (trial válido ou assinatura ativa não expirada).
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  const now = new Date()

  if (subscription.status === 'trial') {
    if (!subscription.trial_ends_at) return false
    return new Date(subscription.trial_ends_at) > now
  }

  if (subscription.status === 'active') {
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end) > now
    }
    return true
  }

  return false
}

/**
 * Formata o preço do plano para o ciclo de cobrança selecionado.
 */
export function formatPlanPrice(plan: Plan, cycle: BillingCycle): string {
  const price = getPlanPrice(plan, cycle)
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Retorna o preço numérico do plano para o ciclo especificado.
 */
export function getPlanPrice(plan: Plan, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return plan.price_monthly
    case 'semiannual':
      return plan.price_semiannual ?? plan.price_monthly * 6
    case 'annual':
      return plan.price_annual ?? plan.price_monthly * 12
    default:
      return plan.price_monthly
  }
}

/**
 * Retorna o label do ciclo em português.
 */
export function getCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly':
      return 'Mensal'
    case 'semiannual':
      return 'Semestral'
    case 'annual':
      return 'Anual'
    default:
      return 'Mensal'
  }
}

/**
 * Calcula os dias restantes do trial.
 */
export function getTrialDaysRemaining(subscription: Subscription): number {
  if (!subscription.trial_ends_at) return 0
  const now = new Date()
  const trialEnd = new Date(subscription.trial_ends_at)
  const diff = trialEnd.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
