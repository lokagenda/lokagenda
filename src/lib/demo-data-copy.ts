import { createAdminClient } from '@/lib/supabase/admin'

type DemoQuoteItem = {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

/**
 * Copy demo data to a new company during registration.
 * This is NOT a server action - it runs server-side only via auth.ts.
 * Errors are thrown so the caller (auth.ts try/catch) handles them gracefully.
 */
export async function copyDemoDataForNewCompany(companyId: string, ownerId: string) {
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

  // If no demo data configured, skip silently
  const hasData = (demoProducts?.length || 0) + (demoCustomers?.length || 0) +
    (demoQuotes?.length || 0) + (demoRentals?.length || 0)
  if (hasData === 0) return

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
    if (error) throw new Error('Erro ao copiar produtos demo: ' + error.message)
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
    if (error) throw new Error('Erro ao copiar clientes demo: ' + error.message)
  }

  // 3. Insert demo quotes with items
  if (demoQuotes && demoQuotes.length > 0) {
    for (const dq of demoQuotes) {
      const eventDate = new Date()
      eventDate.setDate(eventDate.getDate() + (dq.event_date_offset || 7))
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

      if (quoteError) throw new Error('Erro ao copiar orcamento demo: ' + quoteError.message)

      if (quote && items.length > 0) {
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
        if (itemsError) throw new Error('Erro ao copiar itens do orcamento: ' + itemsError.message)
      }
    }
  }

  // 4. Insert demo rentals with items
  if (demoRentals && demoRentals.length > 0) {
    for (const dr of demoRentals) {
      const eventDate = new Date()
      eventDate.setDate(eventDate.getDate() + (dr.event_date_offset || 14))
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

      if (rentalError) throw new Error('Erro ao copiar locacao demo: ' + rentalError.message)

      if (rental && items.length > 0) {
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
        if (itemsError) throw new Error('Erro ao copiar itens da locacao: ' + itemsError.message)
      }
    }
  }

  // 5. Log
  await admin.from('demo_data_logs').insert({
    company_id: companyId,
    pushed_at: new Date().toISOString(),
  })
}
