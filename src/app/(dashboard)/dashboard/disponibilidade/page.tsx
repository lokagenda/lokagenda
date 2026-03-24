'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Package, Search, CalendarDays, Clock, ShoppingCart, Minus, Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/database'

interface ProductAvailability {
  product: Product
  available: number
  pendingQuotes: number
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function timesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return true
  return aStart < bEnd && aEnd > bStart
}

export default function DisponibilidadePage() {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ProductAvailability[] | null>(null)
  const [selected, setSelected] = useState<Record<string, number>>({})

  const selectedCount = Object.keys(selected).length

  async function handleSearch() {
    if (!date) return
    setLoading(true)
    setResults(null)
    setSelected({})

    try {
      const supabase = createClient()

      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      const companyId = profile.company_id

      // Fetch all active products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('name')

      if (!products) {
        setResults([])
        setLoading(false)
        return
      }

      // Fetch rentals for this date (active ones)
      const { data: rentals } = await supabase
        .from('rentals')
        .select('id, delivery_time, pickup_time')
        .eq('company_id', companyId)
        .eq('event_date', date)
        .not('status', 'in', '("cancelled","returned")')

      // Filter overlapping rentals
      const overlappingRentals = (rentals || []).filter(r =>
        timesOverlap(
          r.delivery_time,
          r.pickup_time,
          deliveryTime || null,
          pickupTime || null
        )
      )

      const overlappingRentalIds = overlappingRentals.map(r => r.id)

      // Fetch rental items for overlapping rentals
      let rentalItemsByProduct: Record<string, number> = {}
      if (overlappingRentalIds.length > 0) {
        const { data: rentalItems } = await supabase
          .from('rental_items')
          .select('product_id, quantity')
          .in('rental_id', overlappingRentalIds)

        for (const item of rentalItems || []) {
          if (item.product_id) {
            rentalItemsByProduct[item.product_id] =
              (rentalItemsByProduct[item.product_id] || 0) + item.quantity
          }
        }
      }

      // Fetch pending quotes for this date
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, delivery_time, pickup_time')
        .eq('company_id', companyId)
        .eq('event_date', date)
        .eq('status', 'pending')

      const overlappingQuotes = (quotes || []).filter(r =>
        timesOverlap(
          r.delivery_time,
          r.pickup_time,
          deliveryTime || null,
          pickupTime || null
        )
      )

      const overlappingQuoteIds = overlappingQuotes.map(q => q.id)

      let quoteItemsByProduct: Record<string, number> = {}
      if (overlappingQuoteIds.length > 0) {
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select('product_id, quantity')
          .in('quote_id', overlappingQuoteIds)

        for (const item of quoteItems || []) {
          if (item.product_id) {
            quoteItemsByProduct[item.product_id] =
              (quoteItemsByProduct[item.product_id] || 0) + item.quantity
          }
        }
      }

      // Build availability data
      const availability: ProductAvailability[] = products.map(product => {
        const reserved = rentalItemsByProduct[product.id] || 0
        const pendingQuotes = quoteItemsByProduct[product.id] || 0
        const available = Math.max(0, product.stock - reserved)
        return { product, available, pendingQuotes }
      })

      setResults(availability)
    } catch (error) {
      console.error('Error checking availability:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(productId: string, available: number) {
    setSelected(prev => {
      const next = { ...prev }
      if (next[productId] !== undefined) {
        delete next[productId]
      } else {
        next[productId] = Math.min(1, available)
      }
      return next
    })
  }

  function updateQuantity(productId: string, delta: number, max: number) {
    setSelected(prev => {
      const current = prev[productId]
      if (current === undefined) return prev
      const newQty = Math.max(1, Math.min(max, current + delta))
      return { ...prev, [productId]: newQty }
    })
  }

  function handleGenerateQuote() {
    const items = Object.entries(selected)
      .map(([id, qty]) => `${id}:${qty}`)
      .join(',')

    const params = new URLSearchParams()
    params.set('date', date)
    if (deliveryTime) params.set('delivery', deliveryTime)
    if (pickupTime) params.set('pickup', pickupTime)
    params.set('items', items)

    router.push(`/dashboard/orcamentos/novo?${params.toString()}`)
  }

  function getBorderColor(item: ProductAvailability): string {
    if (item.available === 0) return 'border-red-400 dark:border-red-500'
    if (item.pendingQuotes > 0) return 'border-amber-400 dark:border-amber-500'
    return 'border-green-400 dark:border-green-500'
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Disponibilidade</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Consulte a disponibilidade dos produtos para uma data específica
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Data do evento *
          </label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Horário de entrega
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Horário de retirada
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={!date || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Consultar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-12 text-center">
              <Package className="h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Nenhum produto ativo encontrado
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Cadastre produtos ativos para verificar a disponibilidade.
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {results.length} {results.length === 1 ? 'produto' : 'produtos'} encontrados
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((item) => {
                  const isSelected = selected[item.product.id] !== undefined
                  const isUnavailable = item.available === 0

                  return (
                    <div
                      key={item.product.id}
                      className={`group flex flex-col overflow-hidden rounded-lg border-2 ${getBorderColor(item)} bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-950' : ''
                      }`}
                    >
                      {/* Image */}
                      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        {item.product.image_url ? (
                          <Image
                            src={item.product.image_url}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
                          </div>
                        )}

                        {/* Checkbox overlay */}
                        {!isUnavailable && (
                          <button
                            onClick={() => toggleSelect(item.product.id, item.available)}
                            className={`absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-500 bg-white/80 dark:bg-zinc-800/80 hover:border-blue-400'
                            }`}
                          >
                            {isSelected && (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.product.name}
                        </h3>

                        <span className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(item.product.price)}
                        </span>

                        {/* Stock info */}
                        <div className="mt-2 space-y-1">
                          <p className={`text-sm font-medium ${
                            item.available === 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {item.available} {item.available === 1 ? 'disponível' : 'disponíveis'} de {item.product.stock} total
                          </p>

                          {item.pendingQuotes > 0 && (
                            <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                              {item.pendingQuotes} em orçamento pendente
                            </span>
                          )}
                        </div>

                        {/* Quantity selector */}
                        {isSelected && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Qtd:</span>
                            <div className="flex items-center rounded-lg border border-zinc-300 dark:border-zinc-600">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1, item.available)}
                                className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="flex h-8 w-8 items-center justify-center text-sm font-medium text-zinc-900 dark:text-zinc-100 border-x border-zinc-300 dark:border-zinc-600">
                                {selected[item.product.id]}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1, item.available)}
                                className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Bottom sticky bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] lg:left-64">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium">
                {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
            </div>
            <button
              onClick={handleGenerateQuote}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Gerar Orçamento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
