import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Search } from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'
import { DateFilter } from '@/components/date-filter'
import { QuotesBatchList } from '@/components/quotes-batch-list'

const ITEMS_PER_PAGE = 12

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    page?: string
    customer?: string
    date_from?: string
    date_to?: string
  }>
}) {
  const {
    status: filterStatus,
    page: pageParam,
    customer: customerSearch,
    date_from: dateFrom,
    date_to: dateTo,
  } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

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
    .from('quotes')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus as 'pending' | 'approved' | 'rejected' | 'expired' | 'converted')
  }

  if (customerSearch) {
    query = query.ilike('customer_name', `%${customerSearch}%`)
  }

  if (dateFrom) {
    query = query.gte('event_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('event_date', dateTo)
  }

  // Count query for pagination
  let countQuery = supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if (filterStatus && filterStatus !== 'all') {
    countQuery = countQuery.eq('status', filterStatus as 'pending' | 'approved' | 'rejected' | 'expired' | 'converted')
  }

  if (customerSearch) {
    countQuery = countQuery.ilike('customer_name', `%${customerSearch}%`)
  }

  if (dateFrom) {
    countQuery = countQuery.gte('event_date', dateFrom)
  }

  if (dateTo) {
    countQuery = countQuery.lte('event_date', dateTo)
  }

  const { count } = await countQuery
  const totalCount = count
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE)

  const from = (currentPage - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  query = query.range(from, to)

  const { data } = await query
  const quotes = data

  // Build baseUrl preserving existing filters
  const params = new URLSearchParams()
  if (filterStatus) params.set('status', filterStatus)
  if (customerSearch) params.set('customer', customerSearch)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const baseUrl = `/dashboard/orcamentos${params.toString() ? `?${params.toString()}` : ''}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Orçamentos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie seus orçamentos e propostas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton type="quotes" label="Exportar" />
          <Link href="/dashboard/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-3">
        {[
          { value: 'all', label: 'Todos' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'approved', label: 'Aprovados' },
          { value: 'rejected', label: 'Rejeitados' },
          { value: 'converted', label: 'Convertidos' },
        ].map((filter) => (
          <Link
            key={filter.value}
            href={`/dashboard/orcamentos${filter.value !== 'all' ? `?status=${filter.value}` : ''}`}
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

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Customer Search */}
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cliente</label>
          <form action="/dashboard/orcamentos" method="GET">
            {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
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

        {/* Date Range */}
        <DateFilter paramName="date_from" label="De" defaultValue={dateFrom} />
        <DateFilter paramName="date_to" label="Até" defaultValue={dateTo} />
      </div>

      {/* Quotes List */}
      {!quotes || quotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Nenhum orçamento encontrado
            </h3>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Crie seu primeiro orçamento para começar
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
        <>
          <QuotesBatchList quotes={quotes} totalCount={totalCount || 0} />
          <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
        </>
      )}
    </div>
  )
}
