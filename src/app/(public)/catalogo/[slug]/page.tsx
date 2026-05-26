import { PackageX } from 'lucide-react'
import { getPublicCatalog } from '@/actions/catalogo'
import { CatalogClient } from './catalog-client'

interface CatalogPageProps {
  params: Promise<{ slug: string }>
}

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { slug } = await params
  const { company, products, error } = await getPublicCatalog(slug)

  // Empresa não encontrada ou catálogo desativado
  if (!company || !company.catalog_enabled || error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <PackageX className="h-9 w-9" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Catálogo indisponível
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Este catálogo não está disponível no momento. Verifique o link com a empresa.
          </p>
        </div>
      </div>
    )
  }

  return <CatalogClient slug={slug} company={company} products={products} />
}
