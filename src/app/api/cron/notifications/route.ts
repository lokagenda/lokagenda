import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Notifications faz loop por todas as empresas e várias queries por empresa;
// com a base crescendo, precisa de janela maior. 5min cobre com folga.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // Verify authorization
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all companies (with reminder config)
  const { data: companies } = await admin
    .from('companies')
    .select('id, reminder_days_before')
  if (!companies || companies.length === 0) {
    return NextResponse.json({ success: true, message: 'No companies found' })
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  let created = 0

  for (const company of companies) {
    // 1. Rentals with event_date = tomorrow AND status = confirmed
    const { data: tomorrowRentals } = await admin
      .from('rentals')
      .select('id, customer_name, event_date')
      .eq('company_id', company.id)
      .eq('event_date', tomorrowStr)
      .eq('status', 'confirmed')

    if (tomorrowRentals && tomorrowRentals.length > 0) {
      for (const rental of tomorrowRentals) {
        // Check for existing notification to avoid duplicates
        const { data: existing } = await admin
          .from('notifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('rental_id', rental.id)
          .eq('type', 'rental_tomorrow')
          .gte('created_at', todayStr)
          .limit(1)

        if (!existing || existing.length === 0) {
          await admin.from('notifications').insert({
            company_id: company.id,
            type: 'rental_tomorrow',
            title: 'Locação amanhã',
            message: `A locação de ${rental.customer_name} está agendada para amanhã.`,
            rental_id: rental.id,
            read: false,
          })
          created++
        }
      }
    }

    // 2. Rentals with event_date < today AND payment_status != 'paid'
    const { data: overdueRentals } = await admin
      .from('rentals')
      .select('id, customer_name, total, amount_paid')
      .eq('company_id', company.id)
      .lt('event_date', todayStr)
      .neq('payment_status', 'paid')
      .neq('status', 'cancelled')

    if (overdueRentals && overdueRentals.length > 0) {
      for (const rental of overdueRentals) {
        // Check for existing notification to avoid duplicates (only today)
        const { data: existing } = await admin
          .from('notifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('rental_id', rental.id)
          .eq('type', 'payment_overdue')
          .gte('created_at', todayStr)
          .limit(1)

        if (!existing || existing.length === 0) {
          const remaining = rental.total - (rental.amount_paid || 0)
          await admin.from('notifications').insert({
            company_id: company.id,
            type: 'payment_overdue',
            title: 'Pagamento pendente',
            message: `${rental.customer_name} possui R$ ${remaining.toFixed(2).replace('.', ',')} pendente.`,
            rental_id: rental.id,
            read: false,
          })
          created++
        }
      }
    }

    // 3. Event reminders: rentals with event_date = today + reminder_days_before, confirmed
    const daysBefore = company.reminder_days_before ?? 30
    const reminderDate = new Date(today)
    reminderDate.setDate(reminderDate.getDate() + daysBefore)
    const reminderDateStr = reminderDate.toISOString().split('T')[0]

    const { data: reminderRentals } = await admin
      .from('rentals')
      .select('id, customer_name, customer_phone, event_type, event_date')
      .eq('company_id', company.id)
      .eq('event_date', reminderDateStr)
      .eq('status', 'confirmed')

    if (reminderRentals && reminderRentals.length > 0) {
      for (const rental of reminderRentals) {
        // Check for existing notification to avoid duplicates (only today)
        const { data: existing } = await admin
          .from('notifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('rental_id', rental.id)
          .eq('type', 'event_reminder')
          .gte('created_at', todayStr)
          .limit(1)

        if (!existing || existing.length === 0) {
          const eventTypeLabel = rental.event_type ? ` (${rental.event_type})` : ''
          const eventDateBr = (() => {
            const [y, m, d] = (rental.event_date || '').split('-')
            return y ? `${d}/${m}/${y}` : rental.event_date
          })()

          await admin.from('notifications').insert({
            company_id: company.id,
            type: 'event_reminder',
            title: `Evento em ${daysBefore} dias`,
            message: `${rental.customer_name}${eventTypeLabel} - evento em ${eventDateBr}.`,
            rental_id: rental.id,
            read: false,
          })
          created++
        }
      }
    }

    // 4. Aniversário do cliente: lembrete para reativar a venda. Compara mês-dia do
    //    aniversário com a data (hoje + dias de antecedência). Recorre todo ano.
    const rMonth = String(reminderDate.getMonth() + 1).padStart(2, '0')
    const rDay = String(reminderDate.getDate()).padStart(2, '0')
    const reminderMmDd = `${rMonth}-${rDay}`

    const { data: bdayCustomers } = await admin
      .from('customers')
      .select('id, name, phone, event_type, birthday')
      .eq('company_id', company.id)
      .not('birthday', 'is', null)

    for (const c of bdayCustomers ?? []) {
      if (!c.birthday) continue
      if (c.birthday.slice(5, 10) !== reminderMmDd) continue

      const { data: existing } = await admin
        .from('notifications')
        .select('id')
        .eq('company_id', company.id)
        .eq('customer_id', c.id)
        .eq('type', 'birthday_reminder')
        .gte('created_at', todayStr)
        .limit(1)

      if (existing && existing.length > 0) continue

      await admin.from('notifications').insert({
        company_id: company.id,
        type: 'birthday_reminder',
        title: `Aniversário em ${daysBefore} dias`,
        message: `${c.name} faz aniversário em breve — uma boa hora para oferecer brinquedos novamente.`,
        customer_id: c.id,
        read: false,
      })
      created++
    }

    // 5. Contas a pagar: avisa no sininho no dia do vencimento, se não paga no mês.
    const currentMonthStr = todayStr.slice(0, 7)
    const domToday = parseInt(todayStr.slice(8, 10), 10)

    const { data: bills } = await admin
      .from('recurring_bills')
      .select('id, name, amount, due_day, last_paid_month')
      .eq('company_id', company.id)
      .eq('active', true)
      .eq('due_day', domToday)

    for (const bill of bills ?? []) {
      if (bill.last_paid_month === currentMonthStr) continue

      const { data: existing } = await admin
        .from('notifications')
        .select('id')
        .eq('company_id', company.id)
        .eq('type', 'bill_due')
        .ilike('message', `%${bill.name}%`)
        .gte('created_at', `${todayStr}T00:00:00Z`)
        .limit(1)

      if (existing && existing.length > 0) continue

      const valor = (Number(bill.amount) || 0).toFixed(2).replace('.', ',')
      await admin.from('notifications').insert({
        company_id: company.id,
        type: 'bill_due',
        title: 'Conta a pagar vence hoje',
        message: `${bill.name} — R$ ${valor} vence hoje (dia ${bill.due_day}).`,
        read: false,
      })
      created++
    }
  }

  return NextResponse.json({ success: true, notifications_created: created })
}
