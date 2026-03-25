'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAvailableStock } from '@/lib/availability'

interface RentalItemInput {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface CreateRentalInput {
  customer_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_document?: string | null
  event_date: string
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  event_zip_code?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  items: RentalItemInput[]
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

export async function createRental(input: CreateRentalInput) {
  const supabase = await createClient()
  const { userId, companyId } = await getCompanyId(supabase)

  // Validate date-based stock availability before creating the rental
  for (const item of input.items) {
    if (item.product_id) {
      const available = await getAvailableStock(companyId, item.product_id, input.event_date, input.delivery_time, input.pickup_time)

      if (available < item.quantity) {
        const { data: product } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single()

        const productName = product?.name || item.product_name
        return {
          error: `Estoque insuficiente para "${productName}" na data ${input.event_date}: disponível ${available}, necessário ${item.quantity}`,
        }
      }
    }
  }

  const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = input.discount || 0
  const total = subtotal - discount

  const { data: rental, error: rentalError } = await supabase
    .from('rentals')
    .insert({
      company_id: companyId,
      customer_id: input.customer_id || null,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone || null,
      customer_email: input.customer_email || null,
      customer_document: input.customer_document || null,
      event_date: input.event_date,
      event_address: input.event_address || null,
      event_city: input.event_city || null,
      event_state: input.event_state || null,
      event_zip_code: input.event_zip_code || null,
      delivery_time: input.delivery_time || null,
      pickup_time: input.pickup_time || null,
      notes: input.notes || null,
      discount,
      total,
      status: 'confirmed',
      created_by: userId,
    })
    .select('id')
    .single()

  if (rentalError) {
    return { error: `Erro ao criar locação: ${rentalError.message}` }
  }

  // Create rental items
  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('rental_items').insert(
      input.items.map((item) => ({
        rental_id: rental.id,
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

  revalidatePath('/dashboard/locacoes')
  return { success: true, id: rental.id }
}

export async function updateRentalStatus(
  id: string,
  status: 'confirmed' | 'delivered' | 'returned' | 'cancelled'
) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const { error } = await supabase
    .from('rentals')
    .update({ status })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao atualizar status: ${error.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  revalidatePath(`/dashboard/locacoes/${id}`)
  return { success: true }
}

export async function cancelRental(id: string) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const { error } = await supabase
    .from('rentals')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao cancelar locação: ${error.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  revalidatePath(`/dashboard/locacoes/${id}`)
  return { success: true }
}

export async function recordPayment(rentalId: string, amount: number, method?: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  // Fetch current rental and verify ownership
  const { data: rental, error: fetchError } = await supabase
    .from('rentals')
    .select('id, company_id, total, amount_paid')
    .eq('id', rentalId)
    .single()

  if (fetchError || !rental) {
    return { error: 'Locação não encontrada' }
  }

  if (rental.company_id !== companyId) {
    return { error: 'Sem permissão para esta locação' }
  }

  if (amount <= 0) {
    return { error: 'O valor deve ser maior que zero' }
  }

  // Insert into payments table
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      rental_id: rentalId,
      company_id: companyId,
      amount,
      method: method || 'pix',
      paid_at: new Date().toISOString(),
    })

  if (paymentError) {
    return { error: `Erro ao registrar pagamento: ${paymentError.message}` }
  }

  const newAmountPaid = (rental.amount_paid || 0) + amount
  let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending'

  if (newAmountPaid >= rental.total) {
    paymentStatus = 'paid'
  } else if (newAmountPaid > 0) {
    paymentStatus = 'partial'
  }

  const { error: updateError } = await supabase
    .from('rentals')
    .update({
      amount_paid: newAmountPaid,
      payment_status: paymentStatus,
    })
    .eq('id', rentalId)

  if (updateError) {
    return { error: `Erro ao atualizar locação: ${updateError.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  revalidatePath(`/dashboard/locacoes/${rentalId}`)
  return { success: true }
}

interface UpdateRentalInput {
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_document?: string | null
  event_date: string
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  event_zip_code?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  discount?: number
  freight?: number
}

export async function updateRental(id: string, data: UpdateRentalInput) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  // Verify ownership
  const { data: rental, error: fetchError } = await supabase
    .from('rentals')
    .select('id, company_id')
    .eq('id', id)
    .single()

  if (fetchError || !rental) {
    return { error: 'Locação não encontrada' }
  }

  if (rental.company_id !== companyId) {
    return { error: 'Sem permissão para esta locação' }
  }

  // Recalculate total based on items + discount/freight
  const { data: items } = await supabase
    .from('rental_items')
    .select('subtotal')
    .eq('rental_id', id)

  const subtotal = (items || []).reduce((sum, item) => sum + item.subtotal, 0)
  const discount = data.discount || 0
  const freight = data.freight || 0
  const total = subtotal - discount + freight

  const { error } = await supabase
    .from('rentals')
    .update({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || null,
      customer_email: data.customer_email || null,
      customer_document: data.customer_document || null,
      event_date: data.event_date,
      event_address: data.event_address || null,
      event_city: data.event_city || null,
      event_state: data.event_state || null,
      event_zip_code: data.event_zip_code || null,
      delivery_time: data.delivery_time || null,
      pickup_time: data.pickup_time || null,
      notes: data.notes || null,
      discount,
      freight,
      total,
    })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao atualizar locação: ${error.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  revalidatePath(`/dashboard/locacoes/${id}`)
  return { success: true }
}

export async function deleteRental(id: string) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  await supabase.from('rental_items').delete().eq('rental_id', id)

  const { error } = await supabase.from('rentals').delete().eq('id', id)

  if (error) {
    return { error: `Erro ao excluir locação: ${error.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  return { success: true }
}
