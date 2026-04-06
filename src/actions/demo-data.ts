'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/database'

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

// ── Demo Products ─────────────────────────────────────────

export async function listDemoProducts() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('demo_products')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createDemoProduct(formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const price = parseFloat(formData.get('price') as string) || 0
  const stock = parseInt(formData.get('stock') as string, 10) || 0
  const imageFile = formData.get('image') as File | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do produto e obrigatorio' }
  }

  let imageUrl: string | null = null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `demo/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from('products')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

    if (uploadError) return { error: 'Erro ao enviar imagem: ' + uploadError.message }

    const { data: { publicUrl } } = admin.storage.from('products').getPublicUrl(fileName)
    imageUrl = publicUrl
  }

  const { error } = await admin.from('demo_products').insert({
    name: name.trim(),
    description: description?.trim() || null,
    price,
    stock,
    image_url: imageUrl,
  })

  if (error) return { error: 'Erro ao criar produto demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function updateDemoProduct(id: string, formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const price = parseFloat(formData.get('price') as string) || 0
  const stock = parseInt(formData.get('stock') as string, 10) || 0
  const imageFile = formData.get('image') as File | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do produto e obrigatorio' }
  }

  const { data: existing } = await admin
    .from('demo_products')
    .select('image_url')
    .eq('id', id)
    .single()

  let imageUrl = existing?.image_url || null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `demo/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await admin.storage
      .from('products')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

    if (uploadError) return { error: 'Erro ao enviar imagem: ' + uploadError.message }

    const { data: { publicUrl } } = admin.storage.from('products').getPublicUrl(fileName)

    // Remove old image
    if (existing?.image_url) {
      try {
        const url = new URL(existing.image_url)
        const pathParts = url.pathname.split('/storage/v1/object/public/products/')
        if (pathParts[1]) await admin.storage.from('products').remove([pathParts[1]])
      } catch { /* ignore */ }
    }

    imageUrl = publicUrl
  }

  const { error } = await admin
    .from('demo_products')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      price,
      stock,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'Erro ao atualizar produto demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function deleteDemoProduct(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('demo_products')
    .select('image_url')
    .eq('id', id)
    .single()

  if (existing?.image_url) {
    try {
      const url = new URL(existing.image_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/products/')
      if (pathParts[1]) await admin.storage.from('products').remove([pathParts[1]])
    } catch { /* ignore */ }
  }

  const { error } = await admin
    .from('demo_products')
    .delete()
    .eq('id', id)

  if (error) return { error: 'Erro ao excluir produto demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

// ── Demo Customers ────────────────────────────────────────

export async function listDemoCustomers() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('demo_customers')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createDemoCustomer(formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const document = formData.get('document') as string | null
  const address = formData.get('address') as string | null
  const city = formData.get('city') as string | null
  const state = formData.get('state') as string | null
  const zip_code = formData.get('zip_code') as string | null
  const notes = formData.get('notes') as string | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin.from('demo_customers').insert({
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    document: document?.trim() || null,
    address: address?.trim() || null,
    city: city?.trim() || null,
    state: state?.trim() || null,
    zip_code: zip_code?.trim() || null,
    notes: notes?.trim() || null,
  })

  if (error) return { error: 'Erro ao criar cliente demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function updateDemoCustomer(id: string, formData: FormData) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const document = formData.get('document') as string | null
  const address = formData.get('address') as string | null
  const city = formData.get('city') as string | null
  const state = formData.get('state') as string | null
  const zip_code = formData.get('zip_code') as string | null
  const notes = formData.get('notes') as string | null

  if (!name || name.trim() === '') {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin
    .from('demo_customers')
    .update({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      document: document?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      zip_code: zip_code?.trim() || null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'Erro ao atualizar cliente demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function deleteDemoCustomer(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('demo_customers')
    .delete()
    .eq('id', id)

  if (error) return { error: 'Erro ao excluir cliente demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

// ── Demo Quotes ───────────────────────────────────────────

interface DemoQuoteItem {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface DemoQuoteInput {
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  event_date_offset: number
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  freight?: number
  items: DemoQuoteItem[]
}

export async function listDemoQuotes() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('demo_quotes')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createDemoQuote(data: DemoQuoteInput) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!data.customer_name?.trim()) {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin.from('demo_quotes').insert({
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone || null,
    customer_email: data.customer_email || null,
    event_date_offset: data.event_date_offset,
    event_address: data.event_address || null,
    event_city: data.event_city || null,
    event_state: data.event_state || null,
    delivery_time: data.delivery_time || null,
    pickup_time: data.pickup_time || null,
    notes: data.notes || null,
    discount: data.discount || 0,
    freight: data.freight || 0,
    items: data.items as unknown as Json,
  })

  if (error) return { error: 'Erro ao criar orcamento demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function updateDemoQuote(id: string, data: DemoQuoteInput) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!data.customer_name?.trim()) {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin
    .from('demo_quotes')
    .update({
      customer_name: data.customer_name.trim(),
      customer_phone: data.customer_phone || null,
      customer_email: data.customer_email || null,
      event_date_offset: data.event_date_offset,
      event_address: data.event_address || null,
      event_city: data.event_city || null,
      event_state: data.event_state || null,
      delivery_time: data.delivery_time || null,
      pickup_time: data.pickup_time || null,
      notes: data.notes || null,
      discount: data.discount || 0,
      freight: data.freight || 0,
      items: data.items as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'Erro ao atualizar orcamento demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function deleteDemoQuote(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('demo_quotes')
    .delete()
    .eq('id', id)

  if (error) return { error: 'Erro ao excluir orcamento demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

// ── Demo Rentals ──────────────────────────────────────────

interface DemoRentalInput {
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_document?: string | null
  event_date_offset: number
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  freight?: number
  status: 'confirmed' | 'delivered' | 'returned'
  items: DemoQuoteItem[]
}

export async function listDemoRentals() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('demo_rentals')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createDemoRental(data: DemoRentalInput) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!data.customer_name?.trim()) {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin.from('demo_rentals').insert({
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone || null,
    customer_email: data.customer_email || null,
    customer_document: data.customer_document || null,
    event_date_offset: data.event_date_offset,
    event_address: data.event_address || null,
    event_city: data.event_city || null,
    event_state: data.event_state || null,
    delivery_time: data.delivery_time || null,
    pickup_time: data.pickup_time || null,
    notes: data.notes || null,
    discount: data.discount || 0,
    freight: data.freight || 0,
    status: data.status,
    items: data.items as unknown as Json,
  })

  if (error) return { error: 'Erro ao criar locacao demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function updateDemoRental(id: string, data: DemoRentalInput) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  if (!data.customer_name?.trim()) {
    return { error: 'Nome do cliente e obrigatorio' }
  }

  const { error } = await admin
    .from('demo_rentals')
    .update({
      customer_name: data.customer_name.trim(),
      customer_phone: data.customer_phone || null,
      customer_email: data.customer_email || null,
      customer_document: data.customer_document || null,
      event_date_offset: data.event_date_offset,
      event_address: data.event_address || null,
      event_city: data.event_city || null,
      event_state: data.event_state || null,
      delivery_time: data.delivery_time || null,
      pickup_time: data.pickup_time || null,
      notes: data.notes || null,
      discount: data.discount || 0,
      freight: data.freight || 0,
      status: data.status,
      items: data.items as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'Erro ao atualizar locacao demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

export async function deleteDemoRental(id: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('demo_rentals')
    .delete()
    .eq('id', id)

  if (error) return { error: 'Erro ao excluir locacao demo: ' + error.message }
  revalidatePath('/admin/demo-dados')
  return { success: true }
}

// ── Push Functions ────────────────────────────────────────

async function pushDemoDataInternal(companyId: string, ownerId: string) {
  const admin = createAdminClient()

  // Fetch all active demo data
  const [
    { data: demoProducts },
    { data: demoCustomers },
    { data: demoQuotes },
    { data: demoRentals },
  ] = await Promise.all([
    admin.from('demo_products').select('*').eq('active', true).order('position'),
    admin.from('demo_customers').select('*').eq('active', true).order('position'),
    admin.from('demo_quotes').select('*').eq('active', true).order('position'),
    admin.from('demo_rentals').select('*').eq('active', true).order('position'),
  ])

  // 1. Insert demo products
  if (demoProducts && demoProducts.length > 0) {
    const { error } = await admin.from('products').insert(
      demoProducts.map((p) => ({
        company_id: companyId,
        name: p.name,
        description: p.description,
        image_url: p.image_url,
        price: p.price,
        stock: p.stock,
        status: 'active' as const,
      }))
    )
    if (error) return { error: 'Erro ao copiar produtos: ' + error.message }
  }

  // 2. Insert demo customers
  if (demoCustomers && demoCustomers.length > 0) {
    const { error } = await admin.from('customers').insert(
      demoCustomers.map((c) => ({
        company_id: companyId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        document: c.document,
        address: c.address,
        city: c.city,
        state: c.state,
        zip_code: c.zip_code,
        notes: c.notes,
      }))
    )
    if (error) return { error: 'Erro ao copiar clientes: ' + error.message }
  }

  // 3. Insert demo quotes
  if (demoQuotes && demoQuotes.length > 0) {
    for (const dq of demoQuotes) {
      const eventDate = new Date()
      eventDate.setDate(eventDate.getDate() + (dq.event_date_offset || 0))
      const eventDateStr = eventDate.toISOString().split('T')[0]

      const items = (dq.items as unknown as DemoQuoteItem[]) || []
      const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
      const discount = dq.discount || 0
      const freight = dq.freight || 0
      const total = Math.max(0, subtotal - discount + freight)

      const { data: quote, error: quoteError } = await admin
        .from('quotes')
        .insert({
          company_id: companyId,
          customer_id: null,
          customer_name: dq.customer_name,
          customer_phone: dq.customer_phone,
          customer_email: dq.customer_email,
          event_date: eventDateStr,
          event_address: dq.event_address,
          event_city: dq.event_city,
          event_state: dq.event_state,
          delivery_time: dq.delivery_time,
          pickup_time: dq.pickup_time,
          notes: dq.notes,
          discount,
          freight,
          total,
          status: 'pending',
          created_by: ownerId,
        })
        .select('id')
        .single()

      if (quoteError) return { error: 'Erro ao copiar orcamento: ' + quoteError.message }

      if (items.length > 0) {
        const { error: itemsError } = await admin.from('quote_items').insert(
          items.map((item) => ({
            quote_id: quote.id,
            product_id: null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          }))
        )
        if (itemsError) return { error: 'Erro ao copiar itens do orcamento: ' + itemsError.message }
      }
    }
  }

  // 4. Insert demo rentals
  if (demoRentals && demoRentals.length > 0) {
    for (const dr of demoRentals) {
      const eventDate = new Date()
      eventDate.setDate(eventDate.getDate() + (dr.event_date_offset || 0))
      const eventDateStr = eventDate.toISOString().split('T')[0]

      const items = (dr.items as unknown as DemoQuoteItem[]) || []
      const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
      const discount = dr.discount || 0
      const freight = dr.freight || 0
      const total = Math.max(0, subtotal - discount + freight)

      const { data: rental, error: rentalError } = await admin
        .from('rentals')
        .insert({
          company_id: companyId,
          customer_id: null,
          customer_name: dr.customer_name,
          customer_phone: dr.customer_phone,
          customer_email: dr.customer_email,
          customer_document: dr.customer_document,
          event_date: eventDateStr,
          event_address: dr.event_address,
          event_city: dr.event_city,
          event_state: dr.event_state,
          delivery_time: dr.delivery_time,
          pickup_time: dr.pickup_time,
          notes: dr.notes,
          discount,
          freight,
          total,
          status: (dr.status as 'confirmed' | 'delivered' | 'returned' | 'cancelled') || 'confirmed',
          created_by: ownerId,
        })
        .select('id')
        .single()

      if (rentalError) return { error: 'Erro ao copiar locacao: ' + rentalError.message }

      if (items.length > 0) {
        const { error: itemsError } = await admin.from('rental_items').insert(
          items.map((item) => ({
            rental_id: rental.id,
            product_id: null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          }))
        )
        if (itemsError) return { error: 'Erro ao copiar itens da locacao: ' + itemsError.message }
      }
    }
  }

  // 5. Log
  await admin.from('demo_data_logs').insert({
    company_id: companyId,
    pushed_at: new Date().toISOString(),
  })

  return { success: true }
}

export async function pushDemoDataToCompany(companyId: string) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  // Check if demo data was already pushed to this company
  const { data: existingLog } = await admin
    .from('demo_data_logs')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)

  if (existingLog && existingLog.length > 0) {
    return { error: 'Dados demo ja foram enviados para esta empresa. Para reenviar, exclua os dados existentes primeiro.' }
  }

  // Get company owner profile id
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'owner')
    .limit(1)
    .single()

  if (!ownerProfile) {
    return { error: 'Dono da empresa nao encontrado' }
  }

  const result = await pushDemoDataInternal(companyId, ownerProfile.id)
  return result
}

export async function pushDemoDataToAllCompanies() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: companies, error } = await admin
    .from('companies')
    .select('id')

  if (error) return { error: 'Erro ao buscar empresas: ' + error.message }
  if (!companies || companies.length === 0) return { error: 'Nenhuma empresa encontrada' }

  let successCount = 0
  let errorCount = 0

  // Get companies that already received demo data
  const { data: existingLogs } = await admin
    .from('demo_data_logs')
    .select('company_id')

  const pushedCompanyIds = new Set((existingLogs || []).map(l => l.company_id))

  for (const company of companies) {
    // Skip companies that already have demo data
    if (pushedCompanyIds.has(company.id)) continue

    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', company.id)
      .eq('role', 'owner')
      .limit(1)
      .single()

    if (ownerProfile) {
      const result = await pushDemoDataInternal(company.id, ownerProfile.id)
      if ('success' in result) {
        successCount++
      } else {
        errorCount++
      }
    } else {
      errorCount++
    }
  }

  return { success: true, message: `Enviado para ${successCount} empresas. ${errorCount} erros.` }
}

