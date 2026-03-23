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

export async function updateCompany(formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const name = formData.get('name') as string
  const document = formData.get('document') as string | null
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const address = formData.get('address') as string | null
  const city = formData.get('city') as string | null
  const state = formData.get('state') as string | null
  const zipCode = formData.get('zip_code') as string | null
  const logoFile = formData.get('logo') as File | null

  if (!name || name.trim() === '') {
    return { error: 'Nome da empresa é obrigatório.' }
  }

  let logoUrl: string | undefined

  // Handle logo upload
  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > 2 * 1024 * 1024) {
      return { error: 'O logo deve ter no máximo 2MB.' }
    }

    const fileExt = logoFile.name.split('.').pop()
    const fileName = `${companyId}/logo.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, logoFile, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      return { error: `Erro ao enviar logo: ${uploadError.message}` }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('logos').getPublicUrl(fileName)

    logoUrl = publicUrl
  }

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    document: document?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    address: address?.trim() || null,
    city: city?.trim() || null,
    state: state?.trim() || null,
    zip_code: zipCode?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (logoUrl !== undefined) {
    updateData.logo_url = logoUrl
  }

  const { error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', companyId)

  if (error) {
    return { error: `Erro ao atualizar empresa: ${error.message}` }
  }

  revalidatePath('/dashboard/empresa')
  return { success: true }
}
