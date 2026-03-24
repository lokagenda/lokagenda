import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

/**
 * Check if two time periods overlap.
 * If any time is null/undefined, treat as full-day (always conflicts).
 */
function timesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return true
  return aStart < bEnd && aEnd > bStart
}

/**
 * Server-side: Get available stock for a product on a given date and time period.
 * Available = total stock - sum of rental_items.quantity for that product
 * on rentals with matching event_date, overlapping time period,
 * and status NOT in ('cancelled', 'returned').
 */
export async function getAvailableStock(
  companyId: string,
  productId: string,
  eventDate: string,
  deliveryTime?: string | null,
  pickupTime?: string | null
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
    .select('id, delivery_time, pickup_time')
    .eq('company_id', companyId)
    .eq('event_date', eventDate)
    .not('status', 'in', '("cancelled","returned")')

  if (!rentals || rentals.length === 0) return product.stock

  // Filter rentals that have overlapping time periods
  const overlappingRentals = rentals.filter(r =>
    timesOverlap(r.delivery_time, r.pickup_time, deliveryTime, pickupTime)
  )

  if (overlappingRentals.length === 0) return product.stock

  const rentalIds = overlappingRentals.map(r => r.id)

  // Sum quantities for this product across overlapping rentals
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
  companyId: string,
  deliveryTime?: string | null,
  pickupTime?: string | null
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
    .select('id, delivery_time, pickup_time')
    .eq('company_id', companyId)
    .eq('event_date', eventDate)
    .not('status', 'in', '("cancelled","returned")')

  if (!rentals || rentals.length === 0) return product.stock

  // Filter rentals that have overlapping time periods
  const overlappingRentals = rentals.filter(r =>
    timesOverlap(r.delivery_time, r.pickup_time, deliveryTime, pickupTime)
  )

  if (overlappingRentals.length === 0) return product.stock

  const rentalIds = overlappingRentals.map(r => r.id)

  const { data: rentalItems } = await supabase
    .from('rental_items')
    .select('quantity')
    .eq('product_id', productId)
    .in('rental_id', rentalIds)

  const reserved = rentalItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  return Math.max(0, product.stock - reserved)
}
