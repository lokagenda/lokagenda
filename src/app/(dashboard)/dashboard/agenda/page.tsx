'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Plus, CalendarOff, Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  listBlockedPeriods,
  createBlockedPeriod,
  deleteBlockedPeriod,
} from '@/actions/agenda'
import type { BlockedPeriod } from '@/types/database'
import toast from 'react-hot-toast'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AgendaPage() {
  const [periods, setPeriods] = useState<BlockedPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const fetchPeriods = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listBlockedPeriods()
      setPeriods(data as BlockedPeriod[])
    } catch {
      setPeriods([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  function openModal() {
    setStartDate('')
    setEndDate('')
    setReason('')
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createBlockedPeriod({
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Período bloqueado com sucesso')
      setModalOpen(false)
      fetchPeriods()
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteBlockedPeriod(id)
      if (result?.error) {
        toast.error(result.error)
        setDeletingId(null)
        return
      }
      toast.success('Período removido')
      setDeletingId(null)
      fetchPeriods()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Agenda</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Bloqueie períodos de férias ou folga para impedir novas locações e orçamentos nessas datas.
          </p>
        </div>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4" />
          Bloquear período
        </Button>
      </div>

      {/* List / Empty / Loading */}
      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-white py-12 dark:border-zinc-700 dark:bg-zinc-900">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-600 dark:bg-zinc-900">
          <CalendarOff className="mb-4 h-12 w-12 text-zinc-400 dark:text-zinc-500" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Nenhum período bloqueado
          </h3>
          <p className="mb-6 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Bloqueie um período para que ele fique indisponível na agenda.
          </p>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4" />
            Bloquear período
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Início
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Fim
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Motivo
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {periods.map((period) => (
                  <tr
                    key={period.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {formatDate(period.start_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(period.end_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {period.reason || <span className="text-zinc-400 dark:text-zinc-500">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(period.id)}
                        disabled={isPending && deletingId === period.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        aria-label="Remover período"
                      >
                        {isPending && deletingId === period.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Bloquear período"
        description="Defina o intervalo de datas que ficará indisponível na agenda."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Data inicial
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Data final
              </label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Motivo <span className="text-zinc-400 dark:text-zinc-500">(opcional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Férias, feriado, folga..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Bloquear
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
