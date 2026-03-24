import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Eye, Search } from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'

const ITEMS_PER_PAGE = 12

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: {
    label: 'Pendente',
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    label: 'Aprovado',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    label: 'Rejeitado',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  converted: {
    label: 'Convertido',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  expired: {
    label: 'Expirado',
    classes: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
}

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
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">De</label>
          <form>
            <input
              type="date"
              name="date_from"
              defaultValue={dateFrom || ''}
              onChange={(e) => {
                const p = new URLSearchParams(window.location.search)
                if (e.target.value) {
                  p.set('date_from', e.target.value)
                } else {
                  p.delete('date_from')
                }
                p.delete('page')
                window.location.href = `/dashboard/orcamentos?${p.toString()}`
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </form>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ate</label>
          <form>
            <input
              type="date"
              name="date_to"
              defaultValue={dateTo || ''}
              onChange={(e) => {
                const p = new URLSearchParams(window.location.search)
                if (e.target.value) {
                  p.set('date_to', e.target.value)
                } else {
                  p.delete('date_to')
                }
                p.delete('page')
                window.location.href = `/dashboard/orcamentos?${p.toString()}`
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </form>
        </div>
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
        <Card>
          <CardHeader>
            <CardTitle>
              {totalCount || quotes.length} orçamento{(totalCount || quotes.length) !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Cliente
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Data do Evento
                    </th>
                    <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Valor Total
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
                  {quotes.map((quote) => {
                    const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.pending
                    return (
                      <tr key={quote.id} className="group">
                        <td className="py-4 pr-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            {quote.customer_name}
                          </div>
                          {quote.customer_phone && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {quote.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-zinc-700 dark:text-zinc-300">
                          {formatDate(quote.event_date)}
                        </td>
                        <td className="py-4 pr-4 font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(quote.total)}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Link href={`/dashboard/orcamentos/${quote.id}`}>
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
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
        </>
      )}
    </div>
  )
}
