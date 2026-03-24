import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all companies
  const { data: companies } = await admin.from('companies').select('id')
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
  }

  return NextResponse.json({ success: true, notifications_created: created })
}
