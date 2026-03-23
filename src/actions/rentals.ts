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
      const available = await getAvailableStock(companyId, item.product_id, input.event_date)

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

  // Decrease stock
  for (const item of input.items) {
    if (item.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single()

      if (product) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, product.stock - item.quantity) })
          .eq('id', item.product_id)
      }
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

  // If returning, restore stock
  if (status === 'returned') {
    const { data: items } = await supabase
      .from('rental_items')
      .select('*')
      .eq('rental_id', id)

    if (items) {
      for (const item of items) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock + item.quantity })
              .eq('id', item.product_id)
          }
        }
      }
    }
  }

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

  // Restore stock
  const { data: items } = await supabase
    .from('rental_items')
    .select('*')
    .eq('rental_id', id)

  if (items) {
    for (const item of items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single()

        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock + item.quantity })
            .eq('id', item.product_id)
        }
      }
    }
  }

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

export async function deleteRental(id: string) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  // Restore stock before deleting
  const { data: rental } = await supabase
    .from('rentals')
    .select('status')
    .eq('id', id)
    .single()

  if (rental && rental.status !== 'returned' && rental.status !== 'cancelled') {
    const { data: items } = await supabase
      .from('rental_items')
      .select('*')
      .eq('rental_id', id)

    if (items) {
      for (const item of items) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock + item.quantity })
              .eq('id', item.product_id)
          }
        }
      }
    }
  }

  await supabase.from('rental_items').delete().eq('rental_id', id)

  const { error } = await supabase.from('rentals').delete().eq('id', id)

  if (error) {
    return { error: `Erro ao excluir locação: ${error.message}` }
  }

  revalidatePath('/dashboard/locacoes')
  return { success: true }
}
