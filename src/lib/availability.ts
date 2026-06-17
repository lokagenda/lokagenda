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
 * Server-side: Get available stock for a product on a date or date range.
 * Considera locações que SOBREPÕEM o intervalo [eventDate..eventEndDate]:
 *   existing.event_date <= eventEndDate AND
 *   coalesce(existing.event_end_date, existing.event_date) >= eventDate
 * Pra mesma data (single-day), checa também sobreposição de horário
 * (delivery_time/pickup_time). Se qualquer lado é multi-dia, conflito automático
 * (horário dia-a-dia não importa em períodos longos).
 *
 * Available = total stock - sum of rental_items.quantity for that product
 * on overlapping rentals with status NOT in ('cancelled', 'returned').
 */
export async function getAvailableStock(
  companyId: string,
  productId: string,
  eventDate: string,
  deliveryTime?: string | null,
  pickupTime?: string | null,
  excludeRentalId?: string,
  eventEndDate?: string | null
): Promise<number> {
  const supabase = await createClient()

  const normStart = normalizeDate(eventDate)
  const normEnd = normalizeDate(eventEndDate ?? eventDate)
  const newIsMultiDay = normEnd > normStart

  const { data: product } = await supabase
    .from('products')
    .select('stock, track_stock')
    .eq('id', productId)
    .single()

  if (!product) return 0
  if (product.track_stock === false) return 999999

  // Busca locações que começam ANTES OU IGUAL ao fim do novo intervalo.
  // Depois filtra pós-query por (event_end_date OR event_date) >= normStart
  // — Supabase não suporta coalesce em .gte direto.
  let rentalQuery = supabase
    .from('rentals')
    .select('id, event_date, event_end_date, delivery_time, pickup_time')
    .eq('company_id', companyId)
    .lte('event_date', normEnd)
    .not('status', 'in', '("cancelled","returned")')

  if (excludeRentalId) {
    rentalQuery = rentalQuery.neq('id', excludeRentalId)
  }

  const { data: rentals } = await rentalQuery
  if (!rentals || rentals.length === 0) return product.stock

  const overlappingRentals = rentals.filter((r) => {
    const rEnd = r.event_end_date ?? r.event_date
    if (rEnd < normStart) return false // nao sobrepoe o intervalo de datas
    const rIsMultiDay = r.event_end_date != null && r.event_end_date > r.event_date
    // Multi-dia em qualquer lado: conflito automatico (horario nao importa)
    if (newIsMultiDay || rIsMultiDay) return true
    // Ambos same-day: checa sobreposicao de horario
    return timesOverlap(r.delivery_time, r.pickup_time, deliveryTime, pickupTime)
  })

  if (overlappingRentals.length === 0) return product.stock

  const rentalIds = overlappingRentals.map((r) => r.id)

  const { data: rentalItems } = await supabase
    .from('rental_items')
    .select('quantity')
    .eq('product_id', productId)
    .in('rental_id', rentalIds)

  const reserved = rentalItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
  return Math.max(0, product.stock - reserved)
}

/**
 * Client-side: Get available stock using browser client. Mesma logica de
 * getAvailableStock com suporte a intervalo eventEndDate.
 */
export async function getAvailableStockClient(
  productId: string,
  eventDate: string,
  companyId: string,
  deliveryTime?: string | null,
  pickupTime?: string | null,
  eventEndDate?: string | null
): Promise<number> {
  const supabase = createBrowserClient()

  const normStart = normalizeDate(eventDate)
  const normEnd = normalizeDate(eventEndDate ?? eventDate)
  const newIsMultiDay = normEnd > normStart

  const { data: product } = await supabase
    .from('products')
    .select('stock, track_stock')
    .eq('id', productId)
    .single()

  if (!product) return 0
  if (product.track_stock === false) return 999999

  const { data: rentals } = await supabase
    .from('rentals')
    .select('id, event_date, event_end_date, delivery_time, pickup_time')
    .eq('company_id', companyId)
    .lte('event_date', normEnd)
    .not('status', 'in', '("cancelled","returned")')

  if (!rentals || rentals.length === 0) return product.stock

  const overlappingRentals = rentals.filter((r) => {
    const rEnd = r.event_end_date ?? r.event_date
    if (rEnd < normStart) return false
    const rIsMultiDay = r.event_end_date != null && r.event_end_date > r.event_date
    if (newIsMultiDay || rIsMultiDay) return true
    return timesOverlap(r.delivery_time, r.pickup_time, deliveryTime, pickupTime)
  })

  if (overlappingRentals.length === 0) return product.stock

  const rentalIds = overlappingRentals.map((r) => r.id)

  const { data: rentalItems } = await supabase
    .from('rental_items')
    .select('quantity')
    .eq('product_id', productId)
    .in('rental_id', rentalIds)

  const reserved = rentalItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
  return Math.max(0, product.stock - reserved)
}
