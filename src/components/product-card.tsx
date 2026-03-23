import Image from 'next/image'
import Link from 'next/link'
import { Package } from 'lucide-react'
import type { Database } from '@/types/database'

type Product = Database['public']['Tables']['products']['Row']

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Ativo', bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-800 dark:text-green-400' },
  inactive: { label: 'Inativo', bg: 'bg-zinc-100 dark:bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400' },
  maintenance: { label: 'Manutenção', bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-800 dark:text-amber-400' },
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function ProductCard({ product }: { product: Product }) {
  const status = statusConfig[product.status || 'active'] || statusConfig.active

  return (
    <Link
      href={`/dashboard/produtos/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{product.name}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
        </div>

        {product.description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{product.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {formatCurrency(product.price)}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {product.stock} {product.stock === 1 ? 'unidade' : 'unidades'}
          </span>
        </div>
      </div>
    </Link>
  )
}
