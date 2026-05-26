'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp-api/sender'
import type { EventType } from '@/types/database'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('Perfil não encontrado')
  return { userId: user.id, companyId: profile.company_id }
}

// ---------------------------------------------------------------------------
// Event types (editable list per company)
// ---------------------------------------------------------------------------

export async function listEventTypes(): Promise<EventType[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('event_types')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) throw new Error('Erro ao listar tipos de evento: ' + error.message)
  return data ?? []
}

export async function createEventType(name: string): Promise<EventType> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nome do tipo de evento é obrigatório')

  const { data, error } = await supabase
    .from('event_types')
    .insert({ company_id: companyId, name: trimmed })
    .select('*')
    .single()

  if (error) throw new Error('Erro ao criar tipo de evento: ' + error.message)

  revalidatePath('/dashboard/lembretes')
  return data
}

export async function deleteEventType(id: string): Promise<void> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('event_types')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) throw new Error('Erro ao excluir tipo de evento: ' + error.message)

  revalidatePath('/dashboard/lembretes')
}

// ---------------------------------------------------------------------------
// Upcoming reminders (rentals event_date + customer birthdays)
// ---------------------------------------------------------------------------

export interface ReminderItem {
  id: string
  customerName: string
  phone: string | null
  eventType: string | null
  date: string // YYYY-MM-DD (the date the reminder is about, this year)
  type: 'locacao' | 'aniversario'
  rentalId: string | null
  daysRemaining: number
}

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + 'T00:00:00')
  const to = new Date(toStr + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export async function getUpcomingReminders(): Promise<ReminderItem[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data: company } = await supabase
    .from('companies')
    .select('reminder_days_before')
    .eq('id', companyId)
    .single()

  const daysBefore = company?.reminder_days_before ?? 30

  const today = new Date()
  const todayStr = toDateOnly(today)
  const end = new Date(today)
  end.setDate(end.getDate() + daysBefore)
  const endStr = toDateOnly(end)

  const items: ReminderItem[] = []

  // 1. Upcoming rentals within the window (not cancelled)
  const { data: rentals } = await supabase
    .from('rentals')
    .select('id, customer_name, customer_phone, event_type, event_date')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .gte('event_date', todayStr)
    .lte('event_date', endStr)

  for (const r of rentals ?? []) {
    if (!r.event_date) continue
    items.push({
      id: `rental-${r.id}`,
      customerName: r.customer_name,
      phone: r.customer_phone ?? null,
      eventType: r.event_type ?? null,
      date: r.event_date,
      type: 'locacao',
      rentalId: r.id,
      daysRemaining: daysBetween(todayStr, r.event_date),
    })
  }

  // 2. Customer birthdays within the window (compare month/day, project to current/next year)
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, event_type, birthday')
    .eq('company_id', companyId)
    .not('birthday', 'is', null)

  for (const c of customers ?? []) {
    if (!c.birthday) continue
    // birthday stored as YYYY-MM-DD; build this year's occurrence
    const [, month, day] = c.birthday.split('-')
    const year = today.getFullYear()
    let occurrence = `${year}-${month}-${day}`
    // If already passed this year, use next year's occurrence
    if (daysBetween(todayStr, occurrence) < 0) {
      occurrence = `${year + 1}-${month}-${day}`
    }
    const remaining = daysBetween(todayStr, occurrence)
    if (remaining >= 0 && remaining <= daysBefore) {
      items.push({
        id: `birthday-${c.id}`,
        customerName: c.name,
        phone: c.phone ?? null,
        eventType: c.event_type ?? 'Aniversário',
        date: occurrence,
        type: 'aniversario',
        rentalId: null,
        daysRemaining: remaining,
      })
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  return items
}

// ---------------------------------------------------------------------------
// Reminder settings
// ---------------------------------------------------------------------------

export interface ReminderSettings {
  days_before: number
  auto_send: boolean
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('companies')
    .select('reminder_days_before, reminder_auto_send')
    .eq('id', companyId)
    .single()

  if (error) throw new Error('Erro ao buscar configurações: ' + error.message)

  return {
    days_before: data?.reminder_days_before ?? 30,
    auto_send: data?.reminder_auto_send ?? false,
  }
}

export async function updateReminderSettings({
  days_before,
  auto_send,
}: ReminderSettings): Promise<void> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const safeDays = Number.isFinite(days_before) ? Math.max(1, Math.round(days_before)) : 30

  const { error } = await supabase
    .from('companies')
    .update({
      reminder_days_before: safeDays,
      reminder_auto_send: !!auto_send,
    })
    .eq('id', companyId)

  if (error) throw new Error('Erro ao salvar configurações: ' + error.message)

  revalidatePath('/dashboard/lembretes')
}

// ---------------------------------------------------------------------------
// Manual WhatsApp send
// ---------------------------------------------------------------------------

export async function sendEventReminderNow(
  customerPhone: string,
  customerName: string,
  eventType: string,
  eventDate: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!customerPhone || !customerPhone.trim()) {
    return { success: false, error: 'Cliente sem telefone cadastrado' }
  }

  const formattedDate = (() => {
    try {
      const [y, m, d] = eventDate.split('-')
      return `${d}/${m}/${y}`
    } catch {
      return eventDate
    }
  })()

  const ok = await sendTemplateMessage(
    'event_reminder',
    customerPhone,
    {
      nome_cliente: customerName,
      tipo_evento: eventType || 'evento',
      data_evento: formattedDate,
    },
    companyId
  )

  if (!ok) {
    return { success: false, error: 'Não foi possível enviar a mensagem. Verifique a configuração do WhatsApp.' }
  }

  return { success: true }
}
