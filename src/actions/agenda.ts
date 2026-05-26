'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil não encontrado')
  return { userId: user.id, companyId: profile.company_id }
}

export async function listBlockedPeriods() {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data } = await supabase
    .from('blocked_periods')
    .select('*')
    .eq('company_id', companyId)
    .order('start_date', { ascending: true })

  return data || []
}

interface CreateBlockedPeriodInput {
  start_date: string
  end_date: string
  reason?: string | null
}

export async function createBlockedPeriod(data: CreateBlockedPeriodInput) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!data.start_date || !data.end_date) {
    return { error: 'Informe a data inicial e final.' }
  }

  if (data.end_date < data.start_date) {
    return { error: 'A data final deve ser igual ou posterior à data inicial.' }
  }

  const { error } = await supabase.from('blocked_periods').insert({
    company_id: companyId,
    start_date: data.start_date,
    end_date: data.end_date,
    reason: data.reason?.trim() || null,
  })

  if (error) {
    return { error: `Erro ao bloquear período: ${error.message}` }
  }

  revalidatePath('/dashboard/agenda')
  return { success: true }
}

export async function deleteBlockedPeriod(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('blocked_periods')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao remover período: ${error.message}` }
  }

  revalidatePath('/dashboard/agenda')
  return { success: true }
}

// Helper: returns true if the given date (yyyy-MM-dd) falls within any blocked period
export async function isDateBlocked(date: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data } = await supabase
    .from('blocked_periods')
    .select('id')
    .eq('company_id', companyId)
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1)

  return (data?.length || 0) > 0
}
