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

export async function createBanner(formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const bannerType = ((formData.get('type') as string) || 'banner') as 'banner' | 'popup'

  // Check max 5 per type per company
  const { count } = await supabase
    .from('banners')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('type', bannerType)

  if (count !== null && count >= 5) {
    throw new Error(`Limite máximo de 5 ${bannerType === 'popup' ? 'pop-ups' : 'banners'} por empresa atingido`)
  }

  const linkUrl = formData.get('link_url') as string
  const position = parseInt(formData.get('position') as string, 10) || 0
  const active = formData.get('active') === 'true'
  const imageFile = formData.get('image') as File | null

  if (!imageFile || imageFile.size === 0) {
    throw new Error('Imagem é obrigatória')
  }

  const fileExt = imageFile.name.split('.').pop()
  const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('banners')
    .upload(fileName, imageFile, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error('Erro ao enviar imagem: ' + uploadError.message)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('banners').getPublicUrl(fileName)

  const { error } = await supabase.from('banners').insert({
    company_id: companyId,
    image_url: publicUrl,
    link_url: linkUrl || null,
    position,
    active,
    is_global: false,
    type: bannerType as 'banner' | 'popup',
  })

  if (error) {
    throw new Error('Erro ao criar banner: ' + error.message)
  }

  revalidatePath('/dashboard/banners')
}

export async function updateBanner(id: string, formData: FormData) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data: existing, error: fetchError } = await supabase
    .from('banners')
    .select('id, company_id, image_url')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Banner não encontrado')
  }

  const linkUrl = formData.get('link_url') as string
  const position = parseInt(formData.get('position') as string, 10) || 0
  const active = formData.get('active') === 'true'
  const imageFile = formData.get('image') as File | null

  let imageUrl: string | null = existing.image_url

  if (imageFile && imageFile.size > 0) {
    // Upload new image
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${companyId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error('Erro ao enviar imagem: ' + uploadError.message)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('banners').getPublicUrl(fileName)

    // Remove old image
    if (existing.image_url) {
      try {
        const url = new URL(existing.image_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/banners/')
        if (pathParts[1]) {
          await supabase.storage.from('banners').remove([pathParts[1]])
        }
      } catch {
        // Ignore storage deletion errors
      }
    }

    imageUrl = publicUrl
  }

  const bannerType = (formData.get('type') as string) || 'banner'

  const { error } = await supabase
    .from('banners')
    .update({
      image_url: imageUrl,
      link_url: linkUrl || null,
      position,
      active,
      type: bannerType as 'banner' | 'popup',
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao atualizar banner: ' + error.message)
  }

  revalidatePath('/dashboard/banners')
}

export async function deleteBanner(id: string) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { data: existing, error: fetchError } = await supabase
    .from('banners')
    .select('id, company_id, image_url')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    throw new Error('Banner não encontrado')
  }

  // Delete image from storage
  if (existing.image_url) {
    try {
      const url = new URL(existing.image_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/banners/')
      if (pathParts[1]) {
        await supabase.storage.from('banners').remove([pathParts[1]])
      }
    } catch {
      // Ignore storage deletion errors
    }
  }

  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao excluir banner: ' + error.message)
  }

  revalidatePath('/dashboard/banners')
}

export async function toggleBanner(id: string, active: boolean) {
  const { supabase, companyId } = await getAuthenticatedProfile()

  const { error } = await supabase
    .from('banners')
    .update({ active })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    throw new Error('Erro ao atualizar status do banner: ' + error.message)
  }

  revalidatePath('/dashboard/banners')
}
