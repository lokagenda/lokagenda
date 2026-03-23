import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null

  function buildUrl(page: number) {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}page=${page}`
  }

  // Generate page numbers to display
  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  const isFirst = currentPage <= 1
  const isLast = currentPage >= totalPages

  return (
    <nav className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between" aria-label="Paginação">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Página {currentPage} de {totalPages}
      </p>
      <div className="flex items-center gap-1">
        {isFirst ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </span>
        ) : (
          <Link
            href={buildUrl(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        )}

        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-zinc-400 dark:text-zinc-500">
              ...
            </span>
          ) : page === currentPage ? (
            <span
              key={page}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-500 text-sm font-medium text-white"
            >
              {page}
            </span>
          ) : (
            <Link
              key={page}
              href={buildUrl(page)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {page}
            </Link>
          )
        )}

        {isLast ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
            Próximo
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <Link
            href={buildUrl(currentPage + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </nav>
  )
}
