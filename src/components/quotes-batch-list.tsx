'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteQuotes } from '@/actions/quotes'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, CheckSquare, Square, MinusSquare, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: { label: 'Pendente', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Aprovado', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejeitado', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  converted: { label: 'Convertido', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  expired: { label: 'Expirado', classes: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
}

interface Quote {
  id: string
  customer_name: string
  customer_phone: string | null
  event_date: string
  total: number
  status: string
}

interface QuotesBatchListProps {
  quotes: Quote[]
  totalCount: number
}

export function QuotesBatchList({ quotes, totalCount }: QuotesBatchListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const allSelected = quotes.length > 0 && selectedIds.size === quotes.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < quotes.length

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(quotes.map((q) => q.id)))
  }

  function handleBatchDelete() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`Excluir ${ids.length} orçamento(s)? Esta ação não pode ser desfeita.`)) return

    startTransition(async () => {
      const result = await deleteQuotes(ids)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${result.deleted ?? ids.length} orçamento(s) excluído(s)`)
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

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

  return (
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
                  <th className="pb-4 pr-2 text-left">
                    <SelectAllCheckbox />
                  </th>
                  <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Cliente</th>
                  <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Data do Evento</th>
                  <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Valor Total</th>
                  <th className="pb-4 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="pb-4 text-right font-medium text-zinc-500 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {quotes.map((quote) => {
                  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.pending
                  const selected = selectedIds.has(quote.id)
                  return (
                    <tr key={quote.id} className={selected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                      <td className="py-4 pr-2">
                        <button
                          onClick={() => toggleSelect(quote.id)}
                          className="text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400"
                        >
                          {selected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">{quote.customer_name}</div>
                        {quote.customer_phone && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{quote.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-zinc-700 dark:text-zinc-300">{formatDate(quote.event_date)}</td>
                      <td className="py-4 pr-4 font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(quote.total)}</td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}>
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

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-6 py-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {selectedIds.size} selecionado(s)
            </span>
            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleBatchDelete}
              className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Excluir selecionados
            </Button>
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
