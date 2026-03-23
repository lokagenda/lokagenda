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

export async function createProduct(formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

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
    throw new Error('Nome do produto é obrigatório')
  }

  let imageUrl: string | null = null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error('Erro ao enviar imagem: ' + uploadError.message)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('products').getPublicUrl(fileName)

    imageUrl = publicUrl
  }

  const { error } = await supabase.from('products').insert({
    company_id: companyId,
    name: name.trim(),
    description: description?.trim() || null,
    price,
    stock,
    status,
    image_url: imageUrl,
  })

  if (error) {
    throw new Error('Erro ao criar produto: ' + error.message)
  }

  revalidatePath('/dashboard/produtos')
  redirect('/dashboard/produtos')
}

export async function updateProduct(id: string, formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Verify the product belongs to the user's company
  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id, company_id, image_url')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Produto não encontrado')
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
    throw new Error('Nome do produto é obrigatório')
  }

  let imageUrl: string | null = existing.image_url

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error('Erro ao enviar imagem: ' + uploadError.message)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('products').getPublicUrl(fileName)

    imageUrl = publicUrl
  }

  const { error } = await supabase
    .from('products')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      price,
      stock,
      status,
      image_url: imageUrl,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao atualizar produto: ' + error.message)
  }

  revalidatePath('/dashboard/produtos')
  redirect('/dashboard/produtos')
}

export async function deleteProduct(id: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Verify the product belongs to the user's company
  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id, company_id, image_url')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Produto não encontrado')
  }

  // Delete image from storage if it exists
  if (existing.image_url) {
    try {
      const url = new URL(existing.image_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/products/')
      if (pathParts[1]) {
        await supabase.storage.from('products').remove([pathParts[1]])
      }
    } catch {
      // Ignore storage deletion errors
    }
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao excluir produto: ' + error.message)
  }

  revalidatePath('/dashboard/produtos')
  redirect('/dashboard/produtos')
}
