'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Atualiza o nome do usuário logado (campo `full_name` em profiles + metadata).
 * Usado pelo botão "Editar perfil" do dropdown do header.
 */
export async function updateMyProfileName(fullName: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Não autorizado' }

  const trimmed = fullName.trim()
  if (!trimmed) return { error: 'Informe o nome.' }
  if (trimmed.length > 80) return { error: 'Nome muito longo (máx. 80 caracteres).' }

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ full_name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (pErr) return { error: pErr.message }

  // Mantém o metadata em sincronia (alguns lugares usam user_metadata.full_name).
  await supabase.auth.updateUser({ data: { full_name: trimmed } }).catch(() => {})

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

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
 * Salva CPF ou CNPJ da empresa. Chamada pelo modal de assinatura Asaas quando
 * o cliente clica Assinar sem ter document cadastrado (Asaas exige cpfCnpj no
 * customer). Aceita 11 digitos (CPF) ou 14 (CNPJ), salva sem formatacao.
 */
export async function updateCompanyDocument(document: string): Promise<{ success: true } | { error: string }> {
  const clean = document.replace(/\D/g, '')
  if (clean.length !== 11 && clean.length !== 14) {
    return { error: 'CPF (11 digitos) ou CNPJ (14 digitos) invalido' }
  }
  const { supabase, companyId } = await getAuthenticatedProfile().catch(() => ({ supabase: null, companyId: null }))
  if (!supabase || !companyId) return { error: 'Nao autorizado' }
  const { error } = await supabase
    .from('companies')
    .update({ document: clean, updated_at: new Date().toISOString() })
    .eq('id', companyId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/assinatura')
  return { success: true }
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
  const catalogEnabled = formData.get('catalog_enabled') === 'true'
  const catalogShowPrices = formData.get('catalog_show_prices') !== 'false'
  const aiAgentEnabled = formData.get('ai_agent_enabled') === 'true'
  const aiAgentPrompt = formData.get('ai_agent_prompt') as string | null
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

    // Admin client pra upload — bypassa RLS (auth ja validada em
    // getAuthenticatedProfile). Ver src/actions/contracts.ts uploadContractPdf
    // pra contexto do bug de refresh de sessao que motivou esta mudanca.
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
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
    } = admin.storage.from('logos').getPublicUrl(fileName)

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
    catalog_enabled: catalogEnabled,
    catalog_show_prices: catalogShowPrices,
    ai_agent_enabled: aiAgentEnabled,
    ai_agent_prompt: aiAgentPrompt?.trim() || null,
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
  revalidatePath('/catalogo', 'layout')
  return { success: true }
}

export async function saveCompanySignature(signatureDataUrl: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  if (!signatureDataUrl) {
    return { error: 'Assinatura e obrigatoria.' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      signature_url: signatureDataUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)

  if (error) {
    return { error: `Erro ao salvar assinatura: ${error.message}` }
  }

  revalidatePath('/dashboard/contratos')
  return { success: true }
}

export async function getCompanySignature() {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data, error } = await supabase
    .from('companies')
    .select('signature_url')
    .eq('id', companyId)
    .single()

  if (error) {
    return { error: `Erro ao buscar assinatura: ${error.message}` }
  }

  return { signatureUrl: data?.signature_url || null }
}
