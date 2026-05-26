'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'
import { buildFullAddress } from '@/lib/maps'
import type { Rental, RentalItem } from '@/types/database'

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

export type RentalWithItems = Rental & { rental_items: RentalItem[] }

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/**
 * Returns rentals (status confirmed/delivered) for the given event_date for the
 * user's company, including rental_items and all customer fields.
 */
export async function getRentalsForDay(date: string): Promise<RentalWithItems[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('rentals')
    .select('*, rental_items(*)')
    .eq('company_id', companyId)
    .eq('event_date', date)
    .in('status', ['confirmed', 'delivered'])
    .order('delivery_time', { ascending: true, nullsFirst: true })

  if (error) {
    throw new Error(`Erro ao buscar locações do dia: ${error.message}`)
  }

  return (data || []) as RentalWithItems[]
}

export async function listEmployees() {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar funcionários: ${error.message}`)
  }

  return data || []
}

export async function createEmployee(formData: FormData) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || !phone) {
    return { error: 'Nome e telefone são obrigatórios.' }
  }

  const { error } = await supabase
    .from('employees')
    .insert({ company_id: companyId, name, phone, active: true })

  if (error) {
    return { error: `Erro ao criar funcionário: ${error.message}` }
  }

  revalidatePath('/dashboard/montagem')
  return { success: true }
}

export async function updateEmployee(id: string, formData: FormData) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || !phone) {
    return { error: 'Nome e telefone são obrigatórios.' }
  }

  const { error } = await supabase
    .from('employees')
    .update({ name, phone })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao atualizar funcionário: ${error.message}` }
  }

  revalidatePath('/dashboard/montagem')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient()
  await getCompanyId(supabase)

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `Erro ao excluir funcionário: ${error.message}` }
  }

  revalidatePath('/dashboard/montagem')
  return { success: true }
}

/**
 * Builds the "roteiro do dia" message and sends it to the employee's WhatsApp.
 * NOTE: never includes the rental total — only the pending amount to receive.
 */
export async function sendMontagemToWhatsApp(rentalIds: string[], employeePhone: string) {
  if (!rentalIds || rentalIds.length === 0) {
    return { error: 'Nenhuma locação selecionada.' }
  }
  if (!employeePhone) {
    return { error: 'Funcionário sem telefone cadastrado.' }
  }

  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('rentals')
    .select('*, rental_items(*)')
    .eq('company_id', companyId)
    .in('id', rentalIds)
    .order('delivery_time', { ascending: true, nullsFirst: true })

  if (error) {
    return { error: `Erro ao buscar locações: ${error.message}` }
  }

  const rentals = (data || []) as RentalWithItems[]
  if (rentals.length === 0) {
    return { error: 'Locações não encontradas.' }
  }

  let message = '*ROTEIRO DO DIA*\n'
  if (rentals[0]?.event_date) {
    const [y, m, d] = rentals[0].event_date.split('-')
    message += `${d}/${m}/${y}\n`
  }
  message += '\n'

  rentals.forEach((rental, index) => {
    const fullAddress = buildFullAddress({
      address: rental.event_address,
      city: rental.event_city,
      state: rental.event_state,
      zip: rental.event_zip_code,
    })
    const pending = rental.total - (rental.amount_paid || 0)

    message += `*${index + 1}. ${rental.customer_name}*\n`
    if (rental.customer_phone) message += `Telefone: ${rental.customer_phone}\n`
    if (fullAddress) message += `Endereço: ${fullAddress}\n`
    if (rental.delivery_time) message += `Entrega: ${rental.delivery_time}\n`
    if (rental.pickup_time) message += `Retirada: ${rental.pickup_time}\n`

    const items = rental.rental_items || []
    if (items.length > 0) {
      message += 'Produtos:\n'
      items.forEach((item) => {
        message += `  - ${item.quantity}x ${item.product_name}\n`
      })
    }

    message += `Valor a receber: ${formatBRL(pending)}\n`
    if (rental.notes) message += `Obs: ${rental.notes}\n`
    message += '\n'
  })

  const sent = await sendWhatsAppMessage(employeePhone, message.trim(), { companyId })

  if (!sent) {
    return { error: 'Falha ao enviar a mensagem no WhatsApp. Verifique a configuração do provedor.' }
  }

  return { success: true }
}
