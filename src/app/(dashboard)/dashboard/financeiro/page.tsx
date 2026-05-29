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
  Wallet,
  Receipt,
  CalendarCheck,
  PiggyBank,
  ArrowDownCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  listFinancialEntries,
  getFinancialOverview,
  createFinancialEntry,
  updateFinancialEntry,
  deleteFinancialEntry,
  listRecurringBills,
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  toggleBillPaid,
  getReceivables,
  type FinancialOverview,
  type RecurringBill,
  type Receivable,
} from '@/actions/financeiro'
import type { FinancialEntry } from '@/types/database'

const CATEGORY_SUGGESTIONS = ['Gasolina', 'Monitores', 'Manutenção', 'Alimentação', 'Marketing', 'Outros']

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

type PeriodPreset = 'hoje' | '7d' | '30d' | 'mes' | 'ano' | 'custom'
type Tab = 'dashboard' | 'pagar' | 'receber' | 'lancamentos'

function presetRange(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  switch (preset) {
    case 'hoje':
      return { start: iso(now), end: iso(now) }
    case '7d':
      return { start: iso(new Date(y, m, d - 6)), end: iso(now) }
    case '30d':
      return { start: iso(new Date(y, m, d - 29)), end: iso(now) }
    case 'mes':
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) }
    case 'ano':
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    default:
      return { start: iso(new Date(y, m, 1)), end: iso(now) }
  }
}

interface EntryFormState {
  type: 'income' | 'expense'
  description: string
  category: string
  amount: string
  date: string
}

const emptyEntry = (): EntryFormState => ({
  type: 'expense',
  description: '',
  category: '',
  amount: '',
  date: todayISO(),
})

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#14b8a6', '#ec4899']

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>('dashboard')

  // Period
  const [preset, setPreset] = useState<PeriodPreset>('mes')
  const [customStart, setCustomStart] = useState(presetRange('mes').start)
  const [customEnd, setCustomEnd] = useState(presetRange('mes').end)
  const range = useMemo(
    () => (preset === 'custom' ? { start: customStart, end: customEnd } : presetRange(preset)),
    [preset, customStart, customEnd]
  )

  const [overview, setOverview] = useState<FinancialOverview | null>(null)
  const [loading, setLoading] = useState(true)

  // Lançamentos
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Entry modal
  const [entryModal, setEntryModal] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState<EntryFormState>(emptyEntry)
  const [savingEntry, setSavingEntry] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)

  // Contas a pagar
  const [bills, setBills] = useState<RecurringBill[]>([])
  const [billModal, setBillModal] = useState(false)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [billForm, setBillForm] = useState({ name: '', amount: '', due_day: '' })
  const [savingBill, setSavingBill] = useState(false)

  // Contas a receber
  const [receivables, setReceivables] = useState<Receivable[]>([])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFinancialOverview(range.start, range.end)
      setOverview(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar resumo')
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end])

  const loadEntries = useCallback(async () => {
    try {
      const data = await listFinancialEntries({
        type: typeFilter === 'all' ? undefined : typeFilter,
        category: categoryFilter || undefined,
      })
      setEntries(data)
    } catch {
      /* ignore */
    }
  }, [typeFilter, categoryFilter])

  const loadBills = useCallback(async () => {
    try {
      setBills(await listRecurringBills())
    } catch {
      /* ignore */
    }
  }, [])

  const loadReceivables = useCallback(async () => {
    try {
      setReceivables(await getReceivables())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])
  useEffect(() => {
    loadEntries()
  }, [loadEntries])
  useEffect(() => {
    loadBills()
    loadReceivables()
  }, [loadBills, loadReceivables])

  const knownCategories = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.category) set.add(e.category)
    return Array.from(set).sort()
  }, [entries])

  // ── Entry handlers ──
  const openNewEntry = () => {
    setEditingEntryId(null)
    setEntryForm(emptyEntry())
    setEntryModal(true)
  }
  const openEditEntry = (entry: FinancialEntry) => {
    setEditingEntryId(entry.id)
    setEntryForm({
      type: entry.type,
      description: entry.description,
      category: entry.category ?? '',
      amount: String(entry.amount),
      date: entry.date.slice(0, 10),
    })
    setEntryModal(true)
  }
  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(entryForm.amount.replace(',', '.'))
    if (!entryForm.description.trim()) return toast.error('Informe uma descrição')
    if (!amount || amount <= 0) return toast.error('Informe um valor válido')
    if (!entryForm.date) return toast.error('Informe uma data')
    setSavingEntry(true)
    try {
      const payload = {
        type: entryForm.type,
        category: entryForm.category.trim() || null,
        description: entryForm.description.trim(),
        amount,
        date: entryForm.date,
      }
      const result = editingEntryId
        ? await updateFinancialEntry(editingEntryId, payload)
        : await createFinancialEntry(payload)
      if (result?.error) return toast.error(result.error)
      toast.success(editingEntryId ? 'Lançamento atualizado' : 'Lançamento criado')
      setEntryModal(false)
      await Promise.all([loadEntries(), loadOverview()])
    } finally {
      setSavingEntry(false)
    }
  }
  const removeEntry = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return
    setDeletingEntryId(id)
    try {
      const result = await deleteFinancialEntry(id)
      if (result?.error) return toast.error(result.error)
      toast.success('Lançamento excluído')
      await Promise.all([loadEntries(), loadOverview()])
    } finally {
      setDeletingEntryId(null)
    }
  }

  // ── Bill handlers ──
  const openNewBill = () => {
    setEditingBillId(null)
    setBillForm({ name: '', amount: '', due_day: '' })
    setBillModal(true)
  }
  const openEditBill = (bill: RecurringBill) => {
    setEditingBillId(bill.id)
    setBillForm({ name: bill.name, amount: String(bill.amount), due_day: String(bill.due_day) })
    setBillModal(true)
  }
  const submitBill = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(billForm.amount.replace(',', '.'))
    const dueDay = parseInt(billForm.due_day, 10)
    if (!billForm.name.trim()) return toast.error('Informe o nome da conta')
    if (!amount || amount <= 0) return toast.error('Informe um valor válido')
    if (!dueDay || dueDay < 1 || dueDay > 31) return toast.error('Dia de vencimento entre 1 e 31')
    setSavingBill(true)
    try {
      const payload = { name: billForm.name.trim(), amount, due_day: dueDay }
      const result = editingBillId
        ? await updateRecurringBill(editingBillId, payload)
        : await createRecurringBill(payload)
      if (result?.error) return toast.error(result.error)
      toast.success(editingBillId ? 'Conta atualizada' : 'Conta criada')
      setBillModal(false)
      await loadBills()
    } finally {
      setSavingBill(false)
    }
  }
  const removeBill = async (id: string) => {
    if (!confirm('Excluir esta conta a pagar?')) return
    const result = await deleteRecurringBill(id)
    if (result?.error) return toast.error(result.error)
    toast.success('Conta excluída')
    await loadBills()
  }
  // Mês corrente em horário de Brasília (UTC-3) — precisa bater com o cálculo do
  // servidor em toggleBillPaid, senão cliente e servidor discordam do "mês atual".
  const currentMonthStr = (() => {
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`
  })()
  const togglePaid = async (bill: RecurringBill) => {
    const paid = bill.last_paid_month !== currentMonthStr
    const result = await toggleBillPaid(bill.id, paid)
    if (result?.error) return toast.error(result.error)
    toast.success(paid ? 'Conta paga — lançada nas despesas' : 'Pagamento desfeito — despesa removida')
    await Promise.all([loadBills(), loadOverview(), loadEntries()])
  }

  const cashflow = overview?.cashflow ?? []
  const maxFlow = Math.max(1, ...cashflow.map((d) => Math.max(d.income, d.expense)))
  const totalCategory = (overview?.categoryBreakdown ?? []).reduce((s, c) => s + c.amount, 0)

  const cards = overview
    ? [
        { title: 'Faturamento bruto', value: formatBRL(overview.faturamento), icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', growth: overview.growthPct },
        { title: 'Despesas totais', value: formatBRL(overview.despesas), icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
        { title: 'Lucro líquido', value: formatBRL(overview.lucro), icon: PiggyBank, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
        { title: 'Ticket médio', value: formatBRL(overview.ticketMedio), icon: Receipt, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
        { title: 'Eventos realizados', value: String(overview.eventos), icon: CalendarCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        { title: 'A receber', value: formatBRL(overview.aReceber), icon: Wallet, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', hint: `${overview.pendingRentals} locações pendentes` },
      ]
    : []

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'pagar', label: 'Contas a Pagar' },
    { key: 'receber', label: 'Contas a Receber' },
    { key: 'lancamentos', label: 'Lançamentos' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Financeiro</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Acompanhe o desempenho financeiro da sua empresa
          </p>
        </div>
        <Button onClick={openNewEntry}>
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      {/* Sub-nav */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          {/* Period filters */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['hoje', 'Hoje'],
              ['7d', '7 dias'],
              ['30d', '30 dias'],
              ['mes', 'Este mês'],
              ['ano', 'Ano atual'],
              ['custom', 'Personalizado'],
            ] as [PeriodPreset, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === key
                    ? 'bg-blue-700 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <span className="text-sm text-zinc-400">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading || !overview
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-5">
                    <div className="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  </Card>
                ))
              : cards.map((card) => (
                  <Card key={card.title} className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{card.title}</p>
                        <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
                        {'growth' in card && card.growth != null && (
                          <p className={`mt-0.5 text-xs font-medium ${card.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {card.growth >= 0 ? '▲' : '▼'} {Math.abs(card.growth).toFixed(1)}% vs período anterior
                          </p>
                        )}
                        {'hint' in card && card.hint && (
                          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{card.hint}</p>
                        )}
                      </div>
                      <div className={`rounded-lg p-2.5 ${card.bg}`}>
                        <card.icon className={`h-6 w-6 ${card.color}`} />
                      </div>
                    </div>
                  </Card>
                ))}
          </div>

          {/* Cashflow + category */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Fluxo de Caixa</h2>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Entradas e saídas no período</p>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : cashflow.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma movimentação no período.</p>
              ) : (
                <div className="space-y-3">
                  {cashflow.map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {formatDate(day.date).slice(0, 5)}
                      </span>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(day.income / maxFlow) * 100}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs text-emerald-600 dark:text-emerald-400">
                            {day.income > 0 ? formatBRL(day.income) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-red-500" style={{ width: `${(day.expense / maxFlow) * 100}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs text-red-600 dark:text-red-400">
                            {day.expense > 0 ? formatBRL(day.expense) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Despesas por Categoria</h2>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Distribuição das saídas no período</p>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !overview || overview.categoryBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma despesa no período.</p>
              ) : (
                <div className="space-y-2.5">
                  {overview.categoryBreakdown.map((c, i) => {
                    const pct = totalCategory > 0 ? (c.amount / totalCategory) * 100 : 0
                    return (
                      <div key={c.category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            {c.category}
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-50">
                            {formatBRL(c.amount)} <span className="text-xs text-zinc-400">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Contas a Pagar */}
      {tab === 'pagar' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Contas a Pagar</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Contas recorrentes — você é avisado no sininho no dia do vencimento.</p>
            </div>
            <Button onClick={openNewBill}>
              <Plus className="h-4 w-4" />
              Nova Conta
            </Button>
          </div>
          {bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowDownCircle className="mb-3 h-10 w-10 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Nenhuma conta cadastrada</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ex.: mensalidade do LokAgenda (dia 10), MEI.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {bills.map((bill) => {
                const paid = bill.last_paid_month === currentMonthStr
                return (
                  <div key={bill.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <button onClick={() => togglePaid(bill)} className="flex items-center gap-3 text-left">
                      {paid ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                      )}
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{bill.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Vence dia {bill.due_day} {paid && <Badge variant="success">Pago este mês</Badge>}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatBRL(Number(bill.amount))}</span>
                      <button onClick={() => openEditBill(bill)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeBill(bill.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Contas a Receber */}
      {tab === 'receber' && (
        <Card className="overflow-hidden">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Contas a Receber</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Locações com saldo pendente.</p>
          </div>
          {receivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="mb-3 h-10 w-10 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Nada a receber</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Todas as locações estão quitadas.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {receivables.map((r) => (
                <a key={r.rentalId} href={`/dashboard/locacoes/${r.rentalId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.customerName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(r.eventDate)} · pago {formatBRL(r.amountPaid)} de {formatBRL(r.total)}
                    </p>
                  </div>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">{formatBRL(r.pending)}</span>
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Lançamentos */}
      {tab === 'lancamentos' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'income' | 'expense')}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="all">Todos os tipos</option>
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Todas as categorias</option>
              {knownCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lançamentos manuais</h2>
            </div>
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="mb-3 h-10 w-10 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{entry.description}</span>
                        <Badge variant={entry.type === 'income' ? 'success' : 'danger'}>
                          {entry.type === 'income' ? 'Entrada' : 'Saída'}
                        </Badge>
                        {entry.category && <Badge variant="neutral">{entry.category}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(entry.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`whitespace-nowrap font-semibold ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {entry.type === 'income' ? '+' : '-'} {formatBRL(Number(entry.amount))}
                      </span>
                      <button onClick={() => openEditEntry(entry)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeEntry(entry.id)} disabled={deletingEntryId === entry.id} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10" aria-label="Excluir">
                        {deletingEntryId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Entry modal */}
      <Modal open={entryModal} onClose={() => setEntryModal(false)} title={editingEntryId ? 'Editar Lançamento' : 'Novo Lançamento'} description="Registre uma entrada ou saída manual">
        <form onSubmit={submitEntry} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEntryForm((f) => ({ ...f, type: 'income' }))} className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${entryForm.type === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
                Entrada
              </button>
              <button type="button" onClick={() => setEntryForm((f) => ({ ...f, type: 'expense' }))} className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${entryForm.type === 'expense' ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
                Saída
              </button>
            </div>
          </div>
          <Input label="Descrição" value={entryForm.description} onChange={(e) => setEntryForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Pagamento de fornecedor" required />
          <div>
            <Input label="Categoria" value={entryForm.category} onChange={(e) => setEntryForm((f) => ({ ...f, category: e.target.value }))} placeholder="Opcional" list="cat-suggestions" />
            <datalist id="cat-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setEntryForm((f) => ({ ...f, category: c }))} className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor (R$)" type="number" step="0.01" min="0" value={entryForm.amount} onChange={(e) => setEntryForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
            <Input label="Data" type="date" value={entryForm.date} onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEntryModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingEntry}>
              {savingEntry && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingEntryId ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bill modal */}
      <Modal open={billModal} onClose={() => setBillModal(false)} title={editingBillId ? 'Editar Conta' : 'Nova Conta a Pagar'} description="Conta recorrente mensal com aviso no vencimento">
        <form onSubmit={submitBill} className="space-y-4">
          <Input label="Nome da conta" value={billForm.name} onChange={(e) => setBillForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Mensalidade LokAgenda" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor (R$)" type="number" step="0.01" min="0" value={billForm.amount} onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
            <Input label="Dia do vencimento" type="number" min="1" max="31" value={billForm.due_day} onChange={(e) => setBillForm((f) => ({ ...f, due_day: e.target.value }))} placeholder="10" required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setBillModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingBill}>
              {savingBill && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingBillId ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
