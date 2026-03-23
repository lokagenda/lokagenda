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
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao atualizar cliente: ' + error.message)
  }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
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
