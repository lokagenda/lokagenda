import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Package } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { ExportButton } from '@/components/export-button'
import { Pagination } from '@/components/pagination'

const ITEMS_PER_PAGE = 12

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const { q, status, page: pageParam } = await searchParams
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
    .from('products')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (q && q.trim() !== '') {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  if (status && status.trim() !== '') {
    query = query.eq('status', status as 'active' | 'inactive' | 'maintenance')
  }

  // Count query for pagination
  let countQuery = supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)

  if (q && q.trim() !== '') {
    countQuery = countQuery.ilike('name', `%${q.trim()}%`)
  }

  if (status && status.trim() !== '') {
    countQuery = countQuery.eq('status', status as 'active' | 'inactive' | 'maintenance')
  }

  const { count } = await countQuery
  const totalCount = count
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE)

  const from = (currentPage - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  query = query.range(from, to)

  const { data } = await query
  const products = data

  // Build baseUrl preserving existing filters
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  const baseUrl = `/dashboard/produtos${params.toString() ? `?${params.toString()}` : ''}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Produtos</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gerencie os brinquedos e equipamentos da sua empresa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton type="products" label="Exportar" />
          <Link
            href="/dashboard/produtos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="maintenance">Manutenção</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Products Grid / Empty State */}
      {!products || products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-12 text-center">
          <Package className="h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {q || status ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            {q || status
              ? 'Tente ajustar os filtros de busca.'
              : 'Comece adicionando o primeiro brinquedo ao seu catálogo.'}
          </p>
          {!q && !status && (
            <Link
              href="/dashboard/produtos/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar Produto
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {totalCount || products.length} {(totalCount || products.length) === 1 ? 'produto' : 'produtos'}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
        </>
      )}
    </div>
  )
}
