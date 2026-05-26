'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock, ChevronLeft, ChevronRight, Package, Users } from 'lucide-react'
import { getRentalsForMonth, getBlockedPeriodsForMonth } from '@/actions/rentals'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Image from 'next/image'

type RentalItem = {
  product_name: string
  product_id: string | null
  quantity: number
  products: { image_url: string | null } | null
}

type CalendarRental = {
  id: string
  customer_name: string
  event_date: string
  total: number
  status: string
  rental_items: RentalItem[]
}

type BlockedPeriodRange = {
  id: string
  start_date: string
  end_date: string
  reason: string | null
}

type DetailFilter = 'customer' | 'product'

export function DashboardCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [rentals, setRentals] = useState<CalendarRental[]>([])
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriodRange[]>([])
  const [loading, setLoading] = useState(true)
  const [detailFilter, setDetailFilter] = useState<DetailFilter>('customer')

  const fetchRentals = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const [data, blocked] = await Promise.all([
        getRentalsForMonth(year, month),
        getBlockedPeriodsForMonth(year, month),
      ])
      setRentals(data as CalendarRental[])
      setBlockedPeriods(blocked as BlockedPeriodRange[])
    } catch {
      setRentals([])
      setBlockedPeriods([])
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchRentals()
  }, [fetchRentals])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Leading empty days (Sunday = 0)
  const startDayOfWeek = getDay(monthStart)

  // Rental dates set for quick lookup
  const rentalDateSet = new Set(rentals.map((r) => r.event_date))

  // Returns true if a yyyy-MM-dd date falls within any blocked period
  const isDateBlocked = (dateStr: string) =>
    blockedPeriods.some((p) => dateStr >= p.start_date && dateStr <= p.end_date)

  // Reason of the first matching blocked period (for the selected-day detail)
  const blockedReasonFor = (dateStr: string) =>
    blockedPeriods.find((p) => dateStr >= p.start_date && dateStr <= p.end_date)?.reason ?? null

  // Rentals for selected date, sorted by customer name
  const selectedRentals = (
    selectedDate ? rentals.filter((r) => r.event_date === selectedDate) : []
  )
    .slice()
    .sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'pt-BR'))

  // Products rented on the selected date, aggregated by product with quantities
  const selectedProducts = (() => {
    const map = new Map<string, { name: string; quantity: number; image_url: string | null }>()
    for (const rental of selectedRentals) {
      for (const item of rental.rental_items || []) {
        const key = item.product_id || item.product_name
        const existing = map.get(key)
        if (existing) {
          existing.quantity += item.quantity || 0
        } else {
          map.set(key, {
            name: item.product_name,
            quantity: item.quantity || 0,
            image_url: item.products?.image_url ?? null,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  })()

  const handlePrevMonth = () => {
    setCurrentMonth((m) => subMonths(m, 1))
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    setCurrentMonth((m) => addMonths(m, 1))
    setSelectedDate(null)
  }

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return
    const dateStr = format(day, 'yyyy-MM-dd')
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

  // Build 6-row grid
  const totalCells = 42
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1))
  const prevMonthDays = startDayOfWeek
  const calendarDays: { date: Date; inMonth: boolean }[] = []

  // Previous month trailing days
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    const d = new Date(prevMonthEnd)
    d.setDate(prevMonthEnd.getDate() - i)
    calendarDays.push({ date: d, inMonth: false })
  }

  // Current month days
  for (const day of daysInMonth) {
    calendarDays.push({ date: day, inMonth: true })
  }

  // Next month leading days
  let nextDay = 1
  while (calendarDays.length < totalCells) {
    const nextMonth = addMonths(currentMonth, 1)
    calendarDays.push({
      date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay++),
      inMonth: false,
    })
  }

  function getProductImage(rental: CalendarRental): string | null {
    if (!rental.rental_items || rental.rental_items.length === 0) return null
    const firstItem = rental.rental_items[0]
    if (firstItem.products && firstItem.products.image_url) {
      return firstItem.products.image_url
    }
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            <CalendarClock className="mr-2 inline h-5 w-5" />
            Calendario
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button
            onClick={handleNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days of week header */}
        <div className="mb-1 grid grid-cols-7 gap-0">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0">
          {calendarDays.map(({ date, inMonth }, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const hasRentals = rentalDateSet.has(dateStr)
            const blocked = inMonth && isDateBlocked(dateStr)
            const isSelected = selectedDate === dateStr
            const todayDate = isToday(date)

            return (
              <button
                key={idx}
                onClick={() => inMonth && handleDayClick(date)}
                disabled={!inMonth}
                title={blocked ? 'Período bloqueado' : undefined}
                className={`
                  relative flex min-h-[40px] flex-col items-center justify-center rounded-lg py-1.5 text-sm transition-colors
                  ${!inMonth ? 'cursor-default text-zinc-300 dark:text-zinc-700' : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'}
                  ${isSelected && inMonth ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' : ''}
                  ${blocked && !isSelected ? 'bg-rose-50 text-rose-600 line-through hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20' : ''}
                  ${todayDate && inMonth && !isSelected ? 'font-bold ring-1 ring-blue-400 dark:ring-blue-500' : ''}
                  ${inMonth && !isSelected && !todayDate && !blocked ? 'text-zinc-900 dark:text-zinc-50' : ''}
                `}
              >
                <span>{date.getDate()}</span>
                {(hasRentals || blocked) && inMonth && (
                  <span
                    className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : blocked
                          ? 'bg-rose-500 dark:bg-rose-400'
                          : 'bg-blue-500 dark:bg-blue-400'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="mt-3 flex items-center justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">Carregando...</span>
          </div>
        )}

        {/* Selected day details */}
        {selectedDate && !loading && (
          <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {format(new Date(selectedDate + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              {/* Filter toggle: por cliente / por produto */}
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
                <button
                  onClick={() => setDetailFilter('customer')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    detailFilter === 'customer'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Users className="h-3 w-3" />
                  Por cliente
                </button>
                <button
                  onClick={() => setDetailFilter('product')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    detailFilter === 'product'
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Package className="h-3 w-3" />
                  Por produto
                </button>
              </div>
            </div>

            {/* Blocked period notice */}
            {isDateBlocked(selectedDate) && (
              <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                Período bloqueado na agenda
                {blockedReasonFor(selectedDate) ? ` — ${blockedReasonFor(selectedDate)}` : ''}
              </div>
            )}

            {selectedRentals.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Nenhuma locacao neste dia
              </p>
            ) : detailFilter === 'customer' ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {selectedRentals.map((rental) => {
                  const imageUrl = getProductImage(rental)
                  return (
                    <Link
                      key={rental.id}
                      href={`/dashboard/locacoes/${rental.id}`}
                      className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="flex items-center gap-3">
                        {imageUrl ? (
                          <div className="relative h-9 w-9 overflow-hidden rounded-lg">
                            <Image
                              src={imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {rental.customer_name}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(rental.total)}
                      </p>
                    </Link>
                  )
                })}
              </div>
            ) : selectedProducts.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Nenhum produto neste dia
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {selectedProducts.map((product, i) => (
                  <div
                    key={i}
                    className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <div className="relative h-9 w-9 overflow-hidden rounded-lg">
                          <Image
                            src={product.image_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {product.name}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {product.quantity} un.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
