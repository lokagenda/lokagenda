'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface Booking {
  eventDate: string // YYYY-MM-DD
  customerName: string
  quantity: number
}

interface ProductCalendarProps {
  bookings: Booking[]
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Calendário mensal de ocupação de um produto. Recebe a lista de locações
 * (passadas + futuras) e destaca os dias alugados, com navegação de mês.
 * Tudo no cliente — sem fetch adicional.
 */
export function ProductCalendar({ bookings }: ProductCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-11
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Agrupa locações por data (YYYY-MM-DD).
  const byDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    for (const b of bookings) {
      const key = b.eventDate.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(b)
    }
    return map
  }, [bookings])

  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function goPrev() {
    setSelectedDate(null)
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goNext() {
    setSelectedDate(null)
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedBookings = selectedDate ? byDate[selectedDate] || [] : []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={goNext}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayBookings = byDate[key] || []
          const isBooked = dayBookings.length > 0
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(isBooked ? key : null)}
              className={`relative aspect-square rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isBooked
                  ? 'bg-blue-100 font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              } ${isToday && !isSelected ? 'ring-1 ring-blue-400' : ''}`}
            >
              {day}
              {isBooked && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && selectedBookings.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <CalendarDays className="h-3.5 w-3.5" />
            Locações em {selectedDate.split('-').reverse().join('/')}
          </div>
          <ul className="space-y-1">
            {selectedBookings.map((b, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{b.customerName}</span>
                <span className="text-zinc-500 dark:text-zinc-400">Qtd: {b.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
