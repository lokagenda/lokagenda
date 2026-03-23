import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

/**
 * Server-side: Get available stock for a product on a given date
 * Available = total stock - sum of rental_items.quantity for that product
 * on rentals with matching event_date and status NOT in ('cancelled', 'returned')
 */
export async function getAvailableStock(
  companyId: string,
  productId: string,
  eventDate: string
): Promise<number> {
  const supabase = await createClient()

  // Get total stock
  const { data: product } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()

  if (!product) return 0

  // Get rentals for this date that are active (not cancelled/returned)
  const { data: rentals } = await supabase
    .from('rentals')
    .select('id')
    .eq('company_id', companyId)
    .eq('event_date', eventDate)
    .not('status', 'in', '("cancelled","returned")')

  if (!rentals || rentals.length === 0) return product.stock

  const rentalIds = rentals.map(r => r.id)

  // Sum quantities for this product across active rentals
  const { data: rentalItems } = await supabase
    .from('rental_items')
    .select('quantity')
    .eq('product_id', productId)
    .in('rental_id', rentalIds)

  const reserved = rentalItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  return Math.max(0, product.stock - reserved)
}

/**
 * Client-side: Get available stock using browser client
 */
export async function getAvailableStockClient(
  productId: string,
  eventDate: string,
  companyId: string
): Promise<number> {
  const supabase = createBrowserClient()

  const { data: product } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()

  if (!product) return 0

  const { data: rentals } = await supabase
    .from('rentals')
    .select('id')
    .eq('company_id', companyId)
    .eq('event_date', eventDate)
    .not('status', 'in', '("cancelled","returned")')

  if (!rentals || rentals.length === 0) return product.stock

  const rentalIds = rentals.map(r => r.id)

  const { data: rentalItems } = await supabase
    .from('rental_items')
    .select('quantity')
    .eq('product_id', productId)
    .in('rental_id', rentalIds)

  const reserved = rentalItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  return Math.max(0, product.stock - reserved)
}
