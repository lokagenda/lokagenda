'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  listFinancialEntries,
  getFinancialSummary,
  createFinancialEntry,
  updateFinancialEntry,
  deleteFinancialEntry,
  type FinancialSummary,
} from '@/actions/financeiro'
import type { FinancialEntry } from '@/types/database'

const CATEGORY_SUGGESTIONS = [
  'Aluguel',
  'Manutenção',
  'Combustível',
  'Funcionário',
  'Marketing',
  'Outros',
]

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Display a 'YYYY-MM-DD' date as 'DD/MM/YYYY' without timezone shifts
function formatDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface EntryFormState {
  type: 'income' | 'expense'
  description: string
  category: string
  amount: string
  date: string
}

const emptyForm = (): EntryFormState => ({
  type: 'expense',
  description: '',
  category: '',
  amount: '',
  date: todayISO(),
})

export default function FinanceiroPage() {
  const [month, setMonth] = useState(currentMonth)
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Modal / form
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EntryFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, entriesData] = await Promise.all([
        getFinancialSummary(month),
        listFinancialEntries({
          month,
          type: typeFilter === 'all' ? undefined : typeFilter,
          category: categoryFilter || undefined,
        }),
      ])
      setSummary(summaryData)
      setEntries(entriesData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }, [month, typeFilter, categoryFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Distinct categories from current entries for the filter dropdown
  const knownCategories = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.category) set.add(e.category)
    }
    return Array.from(set).sort()
  }, [entries])

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (entry: FinancialEntry) => {
    setEditingId(entry.id)
    setForm({
      type: entry.type,
      description: entry.description,
      category: entry.category ?? '',
      amount: String(entry.amount),
      date: entry.date.slice(0, 10),
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!form.description.trim()) {
      toast.error('Informe uma descrição')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    if (!form.date) {
      toast.error('Informe uma data')
      return
    }

    setSaving(true)
    try {
      const payload = {
        type: form.type,
        category: form.category.trim() || null,
        description: form.description.trim(),
        amount,
        date: form.date,
      }
      const result = editingId
        ? await updateFinancialEntry(editingId, payload)
        : await createFinancialEntry(payload)

      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(editingId ? 'Lançamento atualizado' : 'Lançamento criado')
      setModalOpen(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar lançamento')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return
    setDeletingId(id)
    try {
      const result = await deleteFinancialEntry(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Lançamento excluído')
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir lançamento')
    } finally {
      setDeletingId(null)
    }
  }

  const totalIncome = summary?.totalIncome ?? 0
  const totalExpense = summary?.totalExpense ?? 0
  const balance = summary?.balance ?? 0
  const cashflow = summary?.cashflow ?? []
  const maxFlow = Math.max(1, ...cashflow.map((d) => Math.max(d.income, d.expense)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Controle Financeiro</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Acompanhe entradas, saídas e o fluxo de caixa da sua empresa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Selecionar mês"
          />
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Os pagamentos das locações entram automaticamente como entrada (somente leitura). Adicione
          aqui despesas e outras receitas manuais.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Entradas</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? '—' : formatBRL(totalIncome)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Saídas</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                {loading ? '—' : formatBRL(totalExpense)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-2.5 dark:bg-red-500/10">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Saldo</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  balance >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {loading ? '—' : formatBRL(balance)}
              </p>
            </div>
            <div
              className={`rounded-lg p-2.5 ${
                balance >= 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-red-50 dark:bg-red-500/10'
              }`}
            >
              <DollarSign
                className={`h-6 w-6 ${
                  balance >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Cash flow */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Fluxo de Caixa</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Movimentação diária do mês</p>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : cashflow.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nenhuma movimentação neste mês.
          </p>
        ) : (
          <div className="space-y-3">
            {cashflow.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {formatDate(day.date).slice(0, 5)}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  {/* Income bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(day.income / maxFlow) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-emerald-600 dark:text-emerald-400">
                      {day.income > 0 ? formatBRL(day.income) : '—'}
                    </span>
                  </div>
                  {/* Expense bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${(day.expense / maxFlow) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-red-600 dark:text-red-400">
                      {day.expense > 0 ? formatBRL(day.expense) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'income' | 'expense')}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Todos os tipos</option>
          <option value="income">Entrada</option>
          <option value="expense">Saída</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todas as categorias</option>
          {knownCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Entries list */}
      <Card className="overflow-hidden">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Lançamentos manuais
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="mb-3 h-10 w-10 text-zinc-400 dark:text-zinc-500" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Nenhum lançamento encontrado
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Adicione uma entrada ou saída para começar.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {entry.description}
                    </span>
                    <Badge variant={entry.type === 'income' ? 'success' : 'danger'}>
                      {entry.type === 'income' ? 'Entrada' : 'Saída'}
                    </Badge>
                    {entry.category && <Badge variant="neutral">{entry.category}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`whitespace-nowrap font-semibold ${
                      entry.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {entry.type === 'income' ? '+' : '-'} {formatBRL(Number(entry.amount))}
                  </span>
                  <button
                    onClick={() => openEdit(entry)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    aria-label="Excluir"
                  >
                    {deletingId === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
        description="Registre uma entrada ou saída manual"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: 'income' }))}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  form.type === 'income'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: 'expense' }))}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  form.type === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                    : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                Saída
              </button>
            </div>
          </div>

          {/* Descrição */}
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ex: Pagamento de fornecedor"
            required
          />

          {/* Categoria */}
          <div>
            <Input
              label="Categoria"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Opcional"
              list="categoria-suggestions"
            />
            <datalist id="categoria-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0,00"
              required
            />
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
