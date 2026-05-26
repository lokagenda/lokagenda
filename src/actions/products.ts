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
  const trackStock = formData.get('track_stock') === 'on'
  const costPriceRaw = formData.get('cost_price') as string | null
  const costPrice = costPriceRaw && costPriceRaw.trim() !== '' ? parseFloat(costPriceRaw) : null
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
    track_stock: trackStock,
    cost_price: costPrice,
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
  const trackStock = formData.get('track_stock') === 'on'
  const costPriceRaw = formData.get('cost_price') as string | null
  const costPrice = costPriceRaw && costPriceRaw.trim() !== '' ? parseFloat(costPriceRaw) : null
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
      track_stock: trackStock,
      cost_price: costPrice,
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

export type ProductHistoryRental = {
  rentalId: string
  customerName: string
  eventDate: string
  status: 'confirmed' | 'delivered' | 'returned' | 'cancelled'
  quantity: number
  subtotal: number
}

export type ProductHistory = {
  pastRentals: ProductHistoryRental[]
  futureRentals: ProductHistoryRental[]
  totalEarned: number
  timesRented: number
  costPrice: number | null
  roi: { multiplier: number; profit: number } | null
}

export async function getProductHistory(productId: string): Promise<ProductHistory> {
  const { supabase, companyId } = await getAuthenticatedProfile()

  // Confirma que o produto pertence à empresa e pega o preço de custo
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, cost_price')
    .eq('id', productId)
    .eq('company_id', companyId)
    .single()

  if (productError || !product) {
    throw new Error('Produto não encontrado')
  }

  // Busca os itens de locação deste produto, já com os dados da locação.
  // O join filtra pela empresa e descarta locações canceladas.
  const { data: items, error: itemsError } = await supabase
    .from('rental_items')
    .select(
      'quantity, subtotal, rentals!inner(id, customer_name, event_date, status, company_id)'
    )
    .eq('product_id', productId)
    .eq('rentals.company_id', companyId)
    .neq('rentals.status', 'cancelled')

  if (itemsError) {
    throw new Error('Erro ao buscar histórico: ' + itemsError.message)
  }

  // Data de hoje em YYYY-MM-DD (comparação lexicográfica funciona nesse formato)
  const today = new Date().toISOString().slice(0, 10)

  const pastRentals: ProductHistoryRental[] = []
  const futureRentals: ProductHistoryRental[] = []
  let totalEarned = 0

  type RentalRel = {
    id: string
    customer_name: string
    event_date: string
    status: 'confirmed' | 'delivered' | 'returned' | 'cancelled'
    company_id: string
  }

  for (const item of items ?? []) {
    // Supabase pode retornar a relação como objeto ou array (1:1 → objeto aqui)
    const rentalRel = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
    const rental = rentalRel as RentalRel | null
    if (!rental) continue

    const subtotal = Number(item.subtotal) || 0
    totalEarned += subtotal

    const eventDate = String(rental.event_date).slice(0, 10)

    const entry: ProductHistoryRental = {
      rentalId: rental.id,
      customerName: rental.customer_name,
      eventDate,
      status: rental.status,
      quantity: Number(item.quantity) || 0,
      subtotal,
    }

    if (eventDate < today) {
      pastRentals.push(entry)
    } else {
      futureRentals.push(entry)
    }
  }

  // Passadas: mais recentes primeiro. Futuras: mais próximas primeiro.
  pastRentals.sort((a, b) => (a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : 0))
  futureRentals.sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0))

  const timesRented = pastRentals.length + futureRentals.length

  const costPrice = product.cost_price != null ? Number(product.cost_price) : null

  let roi: { multiplier: number; profit: number } | null = null
  if (costPrice != null && costPrice > 0) {
    roi = {
      multiplier: totalEarned / costPrice,
      profit: totalEarned - costPrice,
    }
  }

  return {
    pastRentals,
    futureRentals,
    totalEarned,
    timesRented,
    costPrice,
    roi,
  }
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
