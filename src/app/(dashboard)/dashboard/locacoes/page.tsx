import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { buildFullAddress, getGoogleMapsUrl, getWazeUrl } from '@/lib/maps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Package,
  Eye,
  MapPin,
  Navigation,
  CalendarDays,
  List,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'

const ITEMS_PER_PAGE = 12

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

function groupByDate(
  rentals: Array<{
    id: string
    customer_name: string
    event_date: string
    event_address: string | null
    event_city: string | null
    event_state: string | null
    event_zip_code: string | null
    total: number
    status: string
  }>
) {
  const groups: Record<string, typeof rentals> = {}
  for (const rental of rentals) {
    const date = rental.event_date
    if (!groups[date]) groups[date] = []
    groups[date].push(rental)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

export default async function LocacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; page?: string }>
}) {
  const { view: viewParam, status: filterStatus, page: pageParam } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const view = viewParam || 'calendar'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  let query = supabase
    .from('rentals')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('event_date', { ascending: true })

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus as 'confirmed' | 'delivered' | 'returned' | 'cancelled')
  }

  // Count query for pagination
  let countQuery = supabase
    .from('rentals')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if (filterStatus && filterStatus !== 'all') {
    countQuery = countQuery.eq('status', filterStatus as 'confirmed' | 'delivered' | 'returned' | 'cancelled')
  }

  const { count } = await countQuery
  const totalCount = count
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE)

  const from = (currentPage - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  query = query.range(from, to)

  const { data } = await query
  const rentals = data

  // Build baseUrl preserving existing filters
  const urlParams = new URLSearchParams()
  if (viewParam) urlParams.set('view', viewParam)
  if (filterStatus) urlParams.set('status', filterStatus)
  const baseUrl = `/dashboard/locacoes${urlParams.toString() ? `?${urlParams.toString()}` : ''}`
  const rentalsList = rentals || []
  const grouped = groupByDate(rentalsList)

  // Count rentals per date for highlighting busy dates
  const dateCounts: Record<string, number> = {}
  for (const rental of rentalsList) {
    dateCounts[rental.event_date] = (dateCounts[rental.event_date] || 0) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Locações
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie suas locações e entregas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton type="rentals" label="Exportar" />
          <Link href="/dashboard/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4" />
              Nova Locação
            </Button>
          </Link>
        </div>
      </div>

      {/* View Toggle + Status Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'confirmed', label: 'Confirmadas' },
            { value: 'delivered', label: 'Entregues' },
            { value: 'returned', label: 'Devolvidas' },
            { value: 'cancelled', label: 'Canceladas' },
          ].map((filter) => (
            <Link
              key={filter.value}
              href={`/dashboard/locacoes?view=${view}${filter.value !== 'all' ? `&status=${filter.value}` : ''}`}
            >
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  (filterStatus === filter.value || (!filterStatus && filter.value === 'all'))
                    ? 'bg-blue-700 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {filter.label}
              </button>
            </Link>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          <Link
            href={`/dashboard/locacoes?view=calendar${filterStatus ? `&status=${filterStatus}` : ''}`}
          >
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-blue-700 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <CalendarDays className="inline-block h-4 w-4 mr-1" />
              Agenda
            </button>
          </Link>
          <Link
            href={`/dashboard/locacoes?view=list${filterStatus ? `&status=${filterStatus}` : ''}`}
          >
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'list'
                  ? 'bg-blue-700 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <List className="inline-block h-4 w-4 mr-1" />
              Lista
            </button>
          </Link>
        </div>
      </div>

      {/* Empty State */}
      {rentalsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Nenhuma locação encontrada
            </h3>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Crie um orçamento e converta em locação para começar
            </p>
            <Link href="/dashboard/orcamentos/novo">
              <Button>
                <Plus className="h-4 w-4" />
                Novo Orçamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : view === 'calendar' ? (
        /* Calendar / Agenda View */
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
                    const statusConfig =
                      STATUS_CONFIG[rental.status] || STATUS_CONFIG.confirmed
                    const fullAddress = buildFullAddress({
                      address: rental.event_address,
                      city: rental.event_city,
                      state: rental.event_state,
                      zip: rental.event_zip_code,
                    })

                    return (
                      <Card key={rental.id}>
                        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
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
                          <div className="flex gap-2">
                            {fullAddress && (
                              <>
                                <a
                                  href={getGoogleMapsUrl(fullAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button variant="outline" size="sm">
                                    <MapPin className="h-4 w-4" />
                                    Maps
                                  </Button>
                                </a>
                                <a
                                  href={getWazeUrl(fullAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
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
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle>
              {rentalsList.length} locaç{rentalsList.length !== 1 ? 'ões' : 'ão'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Cliente
                    </th>
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Data
                    </th>
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Endereço
                    </th>
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Valor
                    </th>
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rentalsList.map((rental) => {
                    const statusConfig =
                      STATUS_CONFIG[rental.status] || STATUS_CONFIG.confirmed
                    const fullAddress = buildFullAddress({
                      address: rental.event_address,
                      city: rental.event_city,
                      state: rental.event_state,
                      zip: rental.event_zip_code,
                    })

                    return (
                      <tr key={rental.id}>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            {rental.customer_name}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">
                          {formatDate(rental.event_date)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[200px] truncate">
                              {fullAddress || '—'}
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
                        <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(rental.total)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
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

      {rentalsList.length > 0 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
      )}
    </div>
  )
}
