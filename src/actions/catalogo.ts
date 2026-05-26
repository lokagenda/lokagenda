'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'

// ── Tipos públicos ────────────────────────────────────────

export interface PublicCatalogProduct {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
}

export interface PublicCatalogCompany {
  id: string
  name: string
  logo_url: string | null
  phone: string | null
  catalog_enabled: boolean
}

export interface PublicCatalogResult {
  company: PublicCatalogCompany | null
  products: PublicCatalogProduct[]
  error?: string
}

interface SubmitItemInput {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface SubmitCatalogQuoteInput {
  customer_name: string
  customer_phone: string
  customer_email?: string
  event_date: string
  notes?: string
  items: SubmitItemInput[]
}

// ── getPublicCatalog ──────────────────────────────────────

export async function getPublicCatalog(slug: string): Promise<PublicCatalogResult> {
  if (!slug || typeof slug !== 'string') {
    return { company: null, products: [], error: 'Catálogo não encontrado.' }
  }

  const admin = createAdminClient()

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, logo_url, phone, catalog_enabled')
    .eq('slug', slug)
    .maybeSingle()

  if (companyError || !company) {
    return { company: null, products: [], error: 'Catálogo não encontrado.' }
  }

  if (!company.catalog_enabled) {
    return {
      company: { ...company, catalog_enabled: false },
      products: [],
      error: 'Catálogo indisponível.',
    }
  }

  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id, name, description, image_url, price')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (productsError) {
    return { company, products: [], error: 'Erro ao carregar produtos.' }
  }

  return { company, products: products || [] }
}

// ── submitCatalogQuote ────────────────────────────────────

export async function submitCatalogQuote(
  slug: string,
  data: SubmitCatalogQuoteInput
): Promise<{ success: true; quoteId: string } | { error: string }> {
  // Validação básica
  if (!slug || typeof slug !== 'string') {
    return { error: 'Catálogo não encontrado.' }
  }

  const customerName = data?.customer_name?.trim()
  const customerPhone = data?.customer_phone?.trim()
  const eventDate = data?.event_date?.trim()
  const customerEmail = data?.customer_email?.trim() || null
  const notes = data?.notes?.trim() || null

  if (!customerName) {
    return { error: 'Informe seu nome.' }
  }
  if (!customerPhone) {
    return { error: 'Informe seu telefone.' }
  }
  if (!eventDate) {
    return { error: 'Informe a data do evento.' }
  }
  // Validar formato e que a data não está no passado
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < new Date().toISOString().slice(0, 10)) {
    return { error: 'Informe uma data de evento válida (não pode ser no passado).' }
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: 'Adicione ao menos um produto ao carrinho.' }
  }

  const admin = createAdminClient()

  // Resolver empresa pelo slug
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name, phone, catalog_enabled')
    .eq('slug', slug)
    .maybeSingle()

  if (companyError || !company) {
    return { error: 'Catálogo não encontrado.' }
  }

  if (!company.catalog_enabled) {
    return { error: 'Catálogo indisponível no momento.' }
  }

  // Validar que a data não cai em período bloqueado (férias/folga da empresa)
  const { data: blocked } = await admin
    .from('blocked_periods')
    .select('id')
    .eq('company_id', company.id)
    .lte('start_date', eventDate)
    .gte('end_date', eventDate)
    .limit(1)

  if (blocked && blocked.length > 0) {
    return { error: 'A data escolhida não está disponível. Por favor, escolha outra data.' }
  }

  // Encontrar o perfil do proprietário (owner) da empresa para usar como created_by
  const { data: owner, error: ownerError } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', company.id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (ownerError || !owner) {
    return { error: 'Não foi possível processar o orçamento. Tente novamente mais tarde.' }
  }

  // Validar que todos os produtos pertencem à empresa e estão ativos
  const productIds = [...new Set(data.items.map((item) => item.product_id))]
  const { data: validProducts, error: productsError } = await admin
    .from('products')
    .select('id, name, price')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .in('id', productIds)

  if (productsError) {
    return { error: 'Erro ao validar produtos.' }
  }

  const productMap = new Map((validProducts || []).map((p) => [p.id, p]))

  // Reconstruir os itens com base nos dados confiáveis do banco (preço/nome)
  const normalizedItems = data.items.map((item) => {
    const product = productMap.get(item.product_id)
    if (!product) return null

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0))
    const unitPrice = Number(product.price) || 0
    const subtotal = unitPrice * quantity

    return {
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      subtotal,
    }
  })

  if (normalizedItems.some((item) => item === null)) {
    return { error: 'Um ou mais produtos são inválidos.' }
  }

  const items = normalizedItems as SubmitItemInput[]
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  // Criar o orçamento
  const { data: quote, error: quoteError } = await admin
    .from('quotes')
    .insert({
      company_id: company.id,
      customer_id: null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      event_date: eventDate,
      notes,
      total,
      discount: 0,
      freight: 0,
      status: 'pending',
      created_by: owner.id,
    })
    .select('id')
    .single()

  if (quoteError || !quote) {
    return { error: `Erro ao enviar orçamento: ${quoteError?.message || 'desconhecido'}` }
  }

  // Criar os itens
  const { error: itemsError } = await admin.from('quote_items').insert(
    items.map((item) => ({
      quote_id: quote.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }))
  )

  if (itemsError) {
    // Reverter o orçamento para evitar registro órfão
    await admin.from('quotes').delete().eq('id', quote.id)
    return { error: `Erro ao registrar itens: ${itemsError.message}` }
  }

  // Notificação in-app para a empresa (não impede o sucesso do orçamento)
  try {
    await admin.from('notifications').insert({
      company_id: company.id,
      type: 'catalog_quote',
      title: 'Novo orçamento pelo catálogo',
      message: `${customerName} solicitou um orçamento pelo catálogo público.`,
      quote_id: quote.id,
      read: false,
    })
  } catch {
    /* notificação é secundária, não bloqueia o sucesso */
  }

  // Notificação opcional via WhatsApp para a empresa (não bloqueia o sucesso)
  if (company.phone) {
    try {
      await sendWhatsAppMessage(
        company.phone,
        `🛒 *Novo orçamento pelo catálogo*\n\nCliente: ${customerName}\nTelefone: ${customerPhone}\nData do evento: ${eventDate}\nTotal estimado: R$ ${total.toFixed(2)}\n\nAcesse o painel para confirmar.`,
        { companyId: company.id }
      )
    } catch {
      /* falha de WhatsApp não impede o envio do orçamento */
    }
  }

  return { success: true, quoteId: quote.id }
}
