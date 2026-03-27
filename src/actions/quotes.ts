'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAvailableStock } from '@/lib/availability'

interface QuoteItemInput {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface CreateQuoteInput {
  customer_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  event_date: string
  event_end_date?: string | null
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  event_zip_code?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  freight?: number
  items: QuoteItemInput[]
}

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil não encontrado')
  return { userId: user.id, companyId: profile.company_id }
}

export async function createQuote(input: CreateQuoteInput) {
  const supabase = await createClient()
  const { userId, companyId } = await getCompanyId(supabase)

  const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = input.discount || 0
  const freight = input.freight || 0
  const total = subtotal - discount + freight

  // If no customer_id but customer_name exists, find or create customer
  let customerId = input.customer_id || null
  if (!customerId && input.customer_name) {
    // Check if customer with same name+phone already exists in this company
    let query = supabase
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', input.customer_name)

    if (input.customer_phone) {
      query = query.eq('phone', input.customer_phone)
    } else {
      query = query.is('phone', null)
    }

    const { data: existingCustomer } = await query.maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          name: input.customer_name.trim(),
          phone: input.customer_phone?.trim() || null,
          email: input.customer_email?.trim() || null,
        })
        .select('id')
        .single()

      if (!customerError && newCustomer) {
        customerId = newCustomer.id
      }
    }
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone || null,
      customer_email: input.customer_email || null,
      event_date: input.event_date,
      event_end_date: input.event_end_date || null,
      event_address: input.event_address || null,
      event_city: input.event_city || null,
      event_state: input.event_state || null,
      event_zip_code: input.event_zip_code || null,
      delivery_time: input.delivery_time || null,
      pickup_time: input.pickup_time || null,
      notes: input.notes || null,
      discount,
      freight,
      total,
      status: 'pending',
      created_by: userId,
    })
    .select('id')
    .single()

  if (quoteError) {
    return { error: `Erro ao criar orçamento: ${quoteError.message}` }
  }

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('quote_items').insert(
      input.items.map((item) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }))
    )

    if (itemsError) {
      return { error: `Erro ao criar itens: ${itemsError.message}` }
    }
  }

  revalidatePath('/dashboard/orcamentos')
  return { success: true, id: quote.id }
}

export async function updateQuote(id: string, input: CreateQuoteInput) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = input.discount || 0
  const freight = input.freight || 0
  const total = subtotal - discount + freight

  const { error: quoteError } = await supabase
    .from('quotes')
    .update({
      customer_id: input.customer_id || null,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone || null,
      customer_email: input.customer_email || null,
      event_date: input.event_date,
      event_end_date: input.event_end_date || null,
      event_address: input.event_address || null,
      event_city: input.event_city || null,
      event_state: input.event_state || null,
      event_zip_code: input.event_zip_code || null,
      delivery_time: input.delivery_time || null,
      pickup_time: input.pickup_time || null,
      notes: input.notes || null,
      discount,
      freight,
      total,
    })
    .eq('id', id)

  if (quoteError) {
    return { error: `Erro ao atualizar orçamento: ${quoteError.message}` }
  }

  // Delete old items and re-insert
  await supabase.from('quote_items').delete().eq('quote_id', id)

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('quote_items').insert(
      input.items.map((item) => ({
        quote_id: id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }))
    )

    if (itemsError) {
      return { error: `Erro ao atualizar itens: ${itemsError.message}` }
    }
  }

  revalidatePath('/dashboard/orcamentos')
  revalidatePath(`/dashboard/orcamentos/${id}`)
  return { success: true }
}

export async function updateQuoteStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'converted'
) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const { error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao atualizar status: ${error.message}` }
  }

  revalidatePath('/dashboard/orcamentos')
  revalidatePath(`/dashboard/orcamentos/${id}`)
  return { success: true }
}

export async function deleteQuote(id: string) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  await supabase.from('quote_items').delete().eq('quote_id', id)

  const { error } = await supabase.from('quotes').delete().eq('id', id)

  if (error) {
    return { error: `Erro ao excluir orçamento: ${error.message}` }
  }

  revalidatePath('/dashboard/orcamentos')
  return { success: true }
}

export async function convertQuoteToRental(quoteId: string) {
  const supabase = await createClient()
  const { userId, companyId } = await getCompanyId(supabase)

  // Fetch the quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote) {
    return { error: 'Orçamento não encontrado' }
  }

  if (quote.status === 'converted') {
    return { error: 'Orçamento já foi convertido' }
  }

  if (quote.status === 'rejected' || quote.status === 'expired') {
    return { error: 'Não é possível converter um orçamento rejeitado ou expirado' }
  }

  // Fetch quote items
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  if (!items || items.length === 0) {
    return { error: 'Orçamento sem itens' }
  }

  // Validate time-period-based stock availability before converting
  for (const item of items) {
    if (item.product_id) {
      const available = await getAvailableStock(
        companyId,
        item.product_id,
        quote.event_date,
        quote.delivery_time,
        quote.pickup_time
      )

      if (available < item.quantity) {
        const { data: product } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single()

        const productName = product?.name || item.product_name
        return {
          error: `Estoque insuficiente para "${productName}" na data ${quote.event_date}: disponível ${available}, necessário ${item.quantity}`,
        }
      }
    }
  }

  // Create rental
  const { data: rental, error: rentalError } = await supabase
    .from('rentals')
    .insert({
      company_id: companyId,
      quote_id: quoteId,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone,
      customer_email: quote.customer_email,
      event_date: quote.event_date,
      event_end_date: (quote as any).event_end_date || null,
      event_address: quote.event_address,
      event_city: quote.event_city,
      event_state: quote.event_state,
      event_zip_code: quote.event_zip_code,
      delivery_time: quote.delivery_time,
      pickup_time: quote.pickup_time,
      notes: quote.notes,
      total: quote.total,
      discount: quote.discount,
      freight: quote.freight || 0,
      status: 'confirmed',
      created_by: userId,
    })
    .select('id')
    .single()

  if (rentalError) {
    return { error: `Erro ao criar locação: ${rentalError.message}` }
  }

  // Create rental items
  const { error: rentalItemsError } = await supabase
    .from('rental_items')
    .insert(
      items.map((item) => ({
        rental_id: rental.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }))
    )

  if (rentalItemsError) {
    return { error: `Erro ao criar itens da locação: ${rentalItemsError.message}` }
  }

  // Update quote status
  await supabase
    .from('quotes')
    .update({ status: 'converted' })
    .eq('id', quoteId)

  revalidatePath('/dashboard/orcamentos')
  revalidatePath('/dashboard/locacoes')
  return { success: true, rentalId: rental.id }
}
