'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthenticatedProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Não autorizado')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    throw new Error('Perfil ou empresa não encontrados')
  }

  return { supabase, userId: user.id, companyId: profile.company_id }
}

/**
 * Cria uma assinatura trial de 7 dias para a empresa.
 */
export async function createTrialSubscription(companyId: string, planId: string) {
  const { supabase } = await getAuthenticatedProfile()

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 7)

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      company_id: companyId,
      plan_id: planId,
      status: 'trial',
      billing_cycle: 'monthly',
      current_price: 0,
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEndsAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { error: `Erro ao criar assinatura trial: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/assinatura')
  return { data }
}

/**
 * Atualiza o status de uma assinatura.
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'
) {
  const { supabase } = await getAuthenticatedProfile()

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (error) {
    return { error: `Erro ao atualizar assinatura: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/assinatura')
  return { success: true }
}

/**
 * Cancela uma assinatura.
 */
export async function cancelSubscription(subscriptionId: string) {
  const { supabase } = await getAuthenticatedProfile()

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (error) {
    return { error: `Erro ao cancelar assinatura: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/assinatura')
  return { success: true }
}

/**
 * Busca a assinatura atual da empresa do usuário logado, com dados do plano.
 */
export async function getSubscription() {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return { data: null }
  }

  return { data }
}

/**
 * Busca todos os planos ativos.
 */
export async function getPlans() {
  const { supabase } = await getAuthenticatedProfile()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [] }
}
