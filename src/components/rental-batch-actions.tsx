'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateMultipleRentalStatus } from '@/actions/rentals'
import { formatCurrency, formatDate } from '@/lib/utils'
import { buildFullAddress, getGoogleMapsUrl, getWazeUrl } from '@/lib/maps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Eye,
  MapPin,
  Navigation,
  CalendarDays,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  confirmed: {
    label: 'Confirmada',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  delivered: {
    label: 'Entregue',
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  returned: {
    label: 'Devolvida',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelada',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

interface Rental {
  id: string
  customer_name: string
  event_date: string
  event_address: string | null
  event_city: string | null
  event_state: string | null
  event_zip_code: string | null
  total: number
  status: string
}

interface RentalBatchListProps {
  rentals: Rental[]
  view: string
  dateCounts: Record<string, number>
}

function groupByDate(rentals: Rental[]) {
  const groups: Record<string, Rental[]> = {}
  for (const rental of rentals) {
    const date = rental.event_date
    if (!groups[date]) groups[date] = []
    groups[date].push(rental)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

export function RentalBatchList({ rentals, view, dateCounts }: RentalBatchListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const allSelected = rentals.length > 0 && selectedIds.size === rentals.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < rentals.length

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rentals.map((r) => r.id)))
    }
  }

  function handleBatchStatus(status: 'confirmed' | 'delivered' | 'returned' | 'cancelled') {
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      const result = await updateMultipleRentalStatus(ids, status)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${ids.length} locação(ões) atualizada(s)`)
        setSelectedIds(new Set())
      }
    })
  }

  const SelectCheckbox = ({ id }: { id: string }) => (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(id) }}
      className="mr-2 text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400"
    >
      {selectedIds.has(id) ? (
        <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      ) : (
        <Square className="h-5 w-5" />
      )}
    </button>
  )

  const SelectAllCheckbox = () => (
    <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400">
      {allSelected ? (
        <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      ) : someSelected ? (
        <MinusSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      ) : (
        <Square className="h-5 w-5" />
      )}
    </button>
  )

  const grouped = groupByDate(rentals)

  return (
    <>
      {view === 'calendar' ? (
        <div className="space-y-6">
          {grouped.map(([date, dateRentals]) => {
            const count = dateCounts[date] || 0
            const isBusy = count >= 3

            return (
              <div key={date}>
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      isBusy
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(date)}
                    {isBusy && (
                      <span className="ml-1 text-xs">({count} locações)</span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {dateRentals.map((rental) => {
                    const statusConfig = STATUS_CONFIG[rental.status] || STATUS_CONFIG.confirmed
                    const fullAddress = buildFullAddress({
                      address: rental.event_address,
                      city: rental.event_city,
                      state: rental.event_state,
                      zip: rental.event_zip_code,
                    })

                    return (
                      <Card key={rental.id} className={selectedIds.has(rental.id) ? 'ring-2 ring-blue-500' : ''}>
                        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                          <div className="flex items-center flex-1">
                            <SelectCheckbox id={rental.id} />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                  {rental.customer_name}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.classes}`}
                                >
                                  {statusConfig.label}
                                </span>
                              </div>
                              {fullAddress && (
                                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  <MapPin className="h-3 w-3" />
                                  {fullAddress}
                                </div>
                              )}
                              <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                {formatCurrency(rental.total)}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {fullAddress && (
                              <>
                                <a href={getGoogleMapsUrl(fullAddress)} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm">
                                    <MapPin className="h-4 w-4" />
                                    Maps
                                  </Button>
                                </a>
                                <a href={getWazeUrl(fullAddress)} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm">
                                    <Navigation className="h-4 w-4" />
                                    Waze
                                  </Button>
                                </a>
                              </>
                            )}
                            <Link href={`/dashboard/locacoes/${rental.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                                Ver
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {rentals.length} locaç{rentals.length !== 1 ? 'ões' : 'ão'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-4 pr-2 text-left">
                      <SelectAllCheckbox />
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Cliente
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Data
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Endereço
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Valor
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="pb-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rentals.map((rental) => {
                    const statusConfig = STATUS_CONFIG[rental.status] || STATUS_CONFIG.confirmed
                    const fullAddress = buildFullAddress({
                      address: rental.event_address,
                      city: rental.event_city,
                      state: rental.event_state,
                      zip: rental.event_zip_code,
                    })

                    return (
                      <tr key={rental.id} className={selectedIds.has(rental.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                        <td className="py-4 pr-2">
                          <SelectCheckbox id={rental.id} />
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            {rental.customer_name}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-zinc-700 dark:text-zinc-300">
                          {formatDate(rental.event_date)}
                        </td>
                        <td className="py-4 pr-4 text-zinc-600 dark:text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[200px] truncate">
                              {fullAddress || '\u2014'}
                            </span>
                            {fullAddress && (
                              <a
                                href={getGoogleMapsUrl(fullAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 hover:text-blue-800 dark:text-blue-400"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 pr-4 font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(rental.total)}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Link href={`/dashboard/locacoes/${rental.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-6 py-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {selectedIds.size} selecionada(s)
            </span>
            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleBatchStatus('confirmed')}
                className="text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/20"
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleBatchStatus('delivered')}
                className="text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:hover:bg-yellow-900/20"
              >
                Entregar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleBatchStatus('returned')}
                className="text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
              >
                Devolver
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleBatchStatus('cancelled')}
                className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                Cancelar
              </Button>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
