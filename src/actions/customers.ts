'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function createCustomer(formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const document = formData.get('document') as string | null
  const address = formData.get('address') as string | null
  const eventType = formData.get('event_type') as string | null
  const birthday = formData.get('birthday') as string | null

  if (!name || name.trim() === '') {
    throw new Error('Nome é obrigatório')
  }

  const { error } = await supabase.from('customers').insert({
    company_id: companyId,
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    document: document?.trim() || null,
    address: address?.trim() || null,
    event_type: eventType?.trim() || null,
    birthday: birthday?.trim() || null,
  })

  if (error) {
    throw new Error('Erro ao criar cliente: ' + error.message)
  }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
}

export async function updateCustomer(id: string, formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const document = formData.get('document') as string | null
  const address = formData.get('address') as string | null
  const eventType = formData.get('event_type') as string | null
  const birthday = formData.get('birthday') as string | null

  if (!name || name.trim() === '') {
    throw new Error('Nome é obrigatório')
  }

  const { error } = await supabase
    .from('customers')
    .update({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      document: document?.trim() || null,
      address: address?.trim() || null,
      event_type: eventType?.trim() || null,
      birthday: birthday?.trim() || null,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao atualizar cliente: ' + error.message)
  }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
}

export interface CustomerHistoryItem {
  id: string
  event_date: string
  total: number
  status: string
}

export interface CustomerHistory {
  rentals: CustomerHistoryItem[]
  quotes: CustomerHistoryItem[]
}

/**
 * Histórico de orçamentos e locações de um cliente. Casa por customer_id e, como
 * fallback (registros antigos sem vínculo), pelo telefone exato — usando .eq()
 * parametrizado para não quebrar com telefones formatados.
 */
export async function getCustomerHistory(customerId: string): Promise<CustomerHistory> {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data: customer } = await supabase
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .single()

  async function fetchFrom(table: 'rentals' | 'quotes'): Promise<CustomerHistoryItem[]> {
    const byId = await supabase
      .from(table)
      .select('id, event_date, total, status')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)

    const rows: CustomerHistoryItem[] = (byId.data as CustomerHistoryItem[]) || []
    const seen = new Set(rows.map((r) => r.id))

    if (customer?.phone) {
      const byPhone = await supabase
        .from(table)
        .select('id, event_date, total, status')
        .eq('company_id', companyId)
        .eq('customer_phone', customer.phone)

      for (const r of (byPhone.data as CustomerHistoryItem[]) || []) {
        if (!seen.has(r.id)) {
          rows.push(r)
          seen.add(r.id)
        }
      }
    }

    rows.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
    return rows
  }

  const [rentals, quotes] = await Promise.all([fetchFrom('rentals'), fetchFrom('quotes')])
  return { rentals, quotes }
}

export async function deleteCustomer(id: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao excluir cliente: ' + error.message)
  }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
}
