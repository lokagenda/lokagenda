import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Users, Phone, Mail } from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'

const ITEMS_PER_PAGE = 12

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    redirect('/login')
  }

  let query = supabase
    .from('customers')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name', { ascending: true })

  if (q && q.trim() !== '') {
    const search = `%${q.trim()}%`
    query = query.or(`name.ilike.${search},phone.ilike.${search},email.ilike.${search}`)
  }

  // Count query for pagination
  let countQuery = supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if (q && q.trim() !== '') {
    const search = `%${q.trim()}%`
    countQuery = countQuery.or(`name.ilike.${search},phone.ilike.${search},email.ilike.${search}`)
  }

  const { count } = await countQuery
  const totalCount = count
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE)

  const from = (currentPage - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  query = query.range(from, to)

  const { data } = await query
  const customers = data

  // Build baseUrl preserving existing filters
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  const baseUrl = `/dashboard/clientes${params.toString() ? `?${params.toString()}` : ''}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Clientes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gerencie os clientes da sua empresa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton type="customers" label="Exportar" />
          <Link
            href="/dashboard/clientes/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Link>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nome, telefone ou email..."
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </form>

      {/* Table / Empty state */}
      {!customers || customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-12 text-center">
          <Users className="h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            {q
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando o primeiro cliente da sua empresa.'}
          </p>
          {!q && (
            <Link
              href="/dashboard/clientes/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Link>
          )}
        </div>
      ) : (
        <>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Endereço
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/dashboard/clientes/${customer.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {customer.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                          {customer.phone}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {customer.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                          {customer.email}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {customer.document || <span className="text-zinc-400 dark:text-zinc-500">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                      {customer.address || <span className="text-zinc-400 dark:text-zinc-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-6 py-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalCount || customers.length} {(totalCount || customers.length) === 1 ? 'cliente' : 'clientes'}
            </p>
          </div>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
        </>
      )}
    </div>
  )
}
