'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

// ── Products for Company ──────────────────────────────────

export async function listProductsForCompany(companyId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createProductForCompany(companyId: string, formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const price = parseFloat(formData.get('price') as string) || 0
  const stock = parseInt(formData.get('stock') as string, 10) || 0
  const rawStatus = (formData.get('status') as string) || 'active'
  const statusMap: Record<string, 'active' | 'inactive' | 'maintenance'> = {
    ativo: 'active', inativo: 'inactive', manutencao: 'maintenance',
    active: 'active', inactive: 'inactive', maintenance: 'maintenance',
  }
  const status = statusMap[rawStatus] || 'active'
  const imageFile = formData.get('image') as File | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do produto e obrigatorio' }
  }

  let imageUrl: string | null = null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from('products')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { error: 'Erro ao enviar imagem: ' + uploadError.message }
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('products').getPublicUrl(fileName)

    imageUrl = publicUrl
  }

  const { error } = await admin.from('products').insert({
    company_id: companyId,
    name: name.trim(),
    description: description?.trim() || null,
    price,
    stock,
    status,
    image_url: imageUrl,
  })

  if (error) {
    return { error: 'Erro ao criar produto: ' + error.message }
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}

export async function updateProductForCompany(companyId: string, productId: string, formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('products')
    .select('id, company_id, image_url')
    .eq('id', productId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Produto nao encontrado' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const price = parseFloat(formData.get('price') as string) || 0
  const stock = parseInt(formData.get('stock') as string, 10) || 0
  const rawStatus = (formData.get('status') as string) || 'active'
  const statusMap: Record<string, 'active' | 'inactive' | 'maintenance'> = {
    ativo: 'active', inativo: 'inactive', manutencao: 'maintenance',
    active: 'active', inactive: 'inactive', maintenance: 'maintenance',
  }
  const status = statusMap[rawStatus] || 'active'
  const imageFile = formData.get('image') as File | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do produto e obrigatorio' }
  }

  let imageUrl: string | null = existing.image_url

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from('products')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { error: 'Erro ao enviar imagem: ' + uploadError.message }
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('products').getPublicUrl(fileName)

    // Remove old image
    if (existing.image_url) {
      try {
        const url = new URL(existing.image_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/products/')
        if (pathParts[1]) await admin.storage.from('products').remove([pathParts[1]])
      } catch { /* ignore */ }
    }

    imageUrl = publicUrl
  }

  const { error } = await admin
    .from('products')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      price,
      stock,
      status,
      image_url: imageUrl,
    })
    .eq('id', productId)
    .eq('company_id', companyId)

  if (error) {
    return { error: 'Erro ao atualizar produto: ' + error.message }
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}

export async function deleteProductForCompany(companyId: string, productId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('products')
    .select('id, company_id, image_url')
    .eq('id', productId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Produto nao encontrado' }
  }

  // Delete image from storage if it exists
  if (existing.image_url) {
    try {
      const url = new URL(existing.image_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/products/')
      if (pathParts[1]) {
        await admin.storage.from('products').remove([pathParts[1]])
      }
    } catch { /* ignore */ }
  }

  const { error } = await admin
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('company_id', companyId)

  if (error) {
    return { error: 'Erro ao excluir produto: ' + error.message }
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}

// ── Contract Templates for Company ────────────────────────

export async function listTemplatesForCompany(companyId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('contract_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createTemplateForCompany(
  companyId: string,
  name: string,
  content: string,
  isDefault: boolean
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!name || name.trim() === '') {
    return { error: 'Nome do modelo e obrigatorio.' }
  }

  if (!content || content.trim() === '') {
    return { error: 'Conteudo do modelo e obrigatorio.' }
  }

  const { data: newTemplate, error } = await admin.from('contract_templates').insert({
    company_id: companyId,
    name: name.trim(),
    content: content,
    is_default: isDefault,
  }).select('id').single()

  if (error) {
    return { error: `Erro ao criar modelo: ${error.message}` }
  }

  // Unset other defaults only after successful insert
  if (isDefault && newTemplate) {
    await admin
      .from('contract_templates')
      .update({ is_default: false })
      .eq('company_id', companyId)
      .eq('is_default', true)
      .neq('id', newTemplate.id)
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}

export async function updateTemplateForCompany(
  templateId: string,
  name: string,
  content: string,
  isDefault: boolean,
  companyId: string
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!name || name.trim() === '') {
    return { error: 'Nome do modelo e obrigatorio.' }
  }

  if (!content || content.trim() === '') {
    return { error: 'Conteudo do modelo e obrigatorio.' }
  }

  // Verify belongs to company
  const { data: existing, error: fetchError } = await admin
    .from('contract_templates')
    .select('id')
    .eq('id', templateId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Modelo nao encontrado.' }
  }

  const { error } = await admin
    .from('contract_templates')
    .update({
      name: name.trim(),
      content: content,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao atualizar modelo: ${error.message}` }
  }

  // Unset other defaults only after successful update
  if (isDefault) {
    await admin
      .from('contract_templates')
      .update({ is_default: false })
      .eq('company_id', companyId)
      .eq('is_default', true)
      .neq('id', templateId)
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}

export async function deleteTemplateForCompany(templateId: string, companyId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('contract_templates')
    .delete()
    .eq('id', templateId)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao excluir modelo: ${error.message}` }
  }

  revalidatePath('/admin/empresas')
  return { success: true }
}
