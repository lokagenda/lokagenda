import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

/**
 * Normalize a date value to YYYY-MM-DD format.
 * Handles ISO timestamps (e.g. "2024-01-15T00:00:00+00:00") and plain date strings.
 */
function normalizeDate(date: string): string {
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  // Extract the date portion from ISO or other formats
  const match = date.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  // Fallback: parse as Date and extract YYYY-MM-DD
  const d = new Date(date)
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return date
}

/**
 * Check if two time periods overlap on the same date.
 * - If the existing rental has no times (null/empty) → full-day reservation, always conflicts
 * - If the new query has no times (null/empty) → wants the full day, always conflicts
 * - If both have complete times → check actual overlap
 */
function timesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined
): boolean {
  const aHasTime = !!(aStart && aEnd)
  const bHasTime = !!(bStart && bEnd)

  // If the existing rental has no time range, it occupies the full day → conflict
  if (!aHasTime) return true

  // If the query has no time range, it wants the full day → conflict
  if (!bHasTime) return true

  // Both have times: check actual overlap
  return aStart! < bEnd! && aEnd! > bStart!
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

  // Normalize date to YYYY-MM-DD to match Supabase date column format
  const normalizedDate = normalizeDate(eventDate)

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
    .eq('event_date', normalizedDate)
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

  // Normalize date to YYYY-MM-DD to match Supabase date column format
  const normalizedDate = normalizeDate(eventDate)

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
    .eq('event_date', normalizedDate)
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
