import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Package,
  CalendarDays,
  List,
  Search,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'
import { DateFilter } from '@/components/date-filter'
import { RentalBatchList } from '@/components/rental-batch-actions'

const ITEMS_PER_PAGE = 12

export default async function LocacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    status?: string
    page?: string
    payment_status?: string
    date_from?: string
    date_to?: string
    customer?: string
  }>
}) {
  const {
    view: viewParam,
    status: filterStatus,
    page: pageParam,
    payment_status: paymentStatusFilter,
    date_from: dateFrom,
    date_to: dateTo,
    customer: customerSearch,
  } = await searchParams
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

  // Ao entrar no menu (sem filtro explícito) mostramos as CONFIRMADAS de hoje em
  // diante. "Todas" passa status=all explicitamente; filtros de data sobrescrevem
  // o piso de hoje para permitir ver locações passadas.
  const todayStr = new Date().toISOString().split('T')[0]
  const effectiveStatus = filterStatus || 'confirmed'
  const applyTodayFloor = !dateFrom && !dateTo

  let query = supabase
    .from('rentals')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('event_date', { ascending: true })

  if (effectiveStatus !== 'all') {
    query = query.eq('status', effectiveStatus as 'confirmed' | 'delivered' | 'returned' | 'cancelled')
  }

  if (paymentStatusFilter && paymentStatusFilter !== 'all') {
    query = query.eq('payment_status', paymentStatusFilter as 'pending' | 'partial' | 'paid')
  }

  if (dateFrom) {
    query = query.gte('event_date', dateFrom)
  } else if (applyTodayFloor) {
    query = query.gte('event_date', todayStr)
  }

  if (dateTo) {
    query = query.lte('event_date', dateTo)
  }

  if (customerSearch) {
    query = query.ilike('customer_name', `%${customerSearch}%`)
  }

  // Count query for pagination
  let countQuery = supabase
    .from('rentals')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if (effectiveStatus !== 'all') {
    countQuery = countQuery.eq('status', effectiveStatus as 'confirmed' | 'delivered' | 'returned' | 'cancelled')
  }

  if (paymentStatusFilter && paymentStatusFilter !== 'all') {
    countQuery = countQuery.eq('payment_status', paymentStatusFilter as 'pending' | 'partial' | 'paid')
  }

  if (dateFrom) {
    countQuery = countQuery.gte('event_date', dateFrom)
  } else if (applyTodayFloor) {
    countQuery = countQuery.gte('event_date', todayStr)
  }

  if (dateTo) {
    countQuery = countQuery.lte('event_date', dateTo)
  }

  if (customerSearch) {
    countQuery = countQuery.ilike('customer_name', `%${customerSearch}%`)
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
  if (paymentStatusFilter) urlParams.set('payment_status', paymentStatusFilter)
  if (dateFrom) urlParams.set('date_from', dateFrom)
  if (dateTo) urlParams.set('date_to', dateTo)
  if (customerSearch) urlParams.set('customer', customerSearch)
  const baseUrl = `/dashboard/locacoes${urlParams.toString() ? `?${urlParams.toString()}` : ''}`
  const rentalsList = rentals || []

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
        <div className="flex items-center gap-3">
          <ExportButton type="rentals" label="Exportar" />
          <Link href="/dashboard/orcamentos/novo?mode=locacao">
            <Button>
              <Plus className="h-4 w-4" />
              Nova Locação
            </Button>
          </Link>
        </div>
      </div>

      {/* View Toggle + Status Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'confirmed', label: 'Confirmadas' },
            { value: 'delivered', label: 'Entregues' },
            { value: 'returned', label: 'Devolvidas' },
            { value: 'cancelled', label: 'Canceladas' },
          ].map((filter) => (
            <Link
              key={filter.value}
              href={`/dashboard/locacoes?view=${view}&status=${filter.value}`}
            >
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  (filterStatus === filter.value || (!filterStatus && filter.value === 'confirmed'))
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

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Payment Status Pills */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pagamento</label>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos Pagamentos' },
              { value: 'pending', label: 'Pendente' },
              { value: 'partial', label: 'Parcial' },
              { value: 'paid', label: 'Pago' },
            ].map((filter) => {
              const params = new URLSearchParams()
              if (viewParam) params.set('view', viewParam)
              if (filterStatus) params.set('status', filterStatus)
              if (filter.value !== 'all') params.set('payment_status', filter.value)
              if (dateFrom) params.set('date_from', dateFrom)
              if (dateTo) params.set('date_to', dateTo)
              if (customerSearch) params.set('customer', customerSearch)
              const href = `/dashboard/locacoes${params.toString() ? `?${params.toString()}` : ''}`

              return (
                <Link key={filter.value} href={href}>
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      (paymentStatusFilter === filter.value || (!paymentStatusFilter && filter.value === 'all'))
                        ? 'bg-blue-700 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Date Range */}
        <DateFilter paramName="date_from" label="De" defaultValue={dateFrom} />
        <DateFilter paramName="date_to" label="Até" defaultValue={dateTo} />

        {/* Customer Search */}
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cliente</label>
          <form
            action="/dashboard/locacoes"
            method="GET"
          >
            {viewParam && <input type="hidden" name="view" value={viewParam} />}
            {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
            {paymentStatusFilter && <input type="hidden" name="payment_status" value={paymentStatusFilter} />}
            {dateFrom && <input type="hidden" name="date_from" value={dateFrom} />}
            {dateTo && <input type="hidden" name="date_to" value={dateTo} />}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                name="customer"
                placeholder="Buscar cliente..."
                defaultValue={customerSearch || ''}
                className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
          </form>
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
      ) : (
        <RentalBatchList rentals={rentalsList} view={view} dateCounts={dateCounts} />
      )}

      {rentalsList.length > 0 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
      )}
    </div>
  )
}
