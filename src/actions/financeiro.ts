'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { FinancialEntry } from '@/types/database'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil não encontrado')
  return { userId: user.id, companyId: profile.company_id }
}

interface ListFilters {
  month?: string // 'YYYY-MM'
  type?: string // 'income' | 'expense'
  category?: string
}

interface FinancialEntryInput {
  type: 'income' | 'expense'
  category?: string | null
  description: string
  amount: number
  date: string // 'YYYY-MM-DD'
}

// Returns the first day of the month and the first day of the next month
function monthBounds(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10) // 1-12
  const start = `${year}-${String(m).padStart(2, '0')}-01`
  const nextYear = m === 12 ? year + 1 : year
  const nextMonth = m === 12 ? 1 : m + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end }
}

/**
 * Manual financial entries for the current company, most recent first.
 * Does NOT include rental payments (those are aggregated in getFinancialSummary).
 */
export async function listFinancialEntries(filters?: ListFilters): Promise<FinancialEntry[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  let query = supabase
    .from('financial_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.month) {
    const { start, end } = monthBounds(filters.month)
    query = query.gte('date', start).lt('date', end)
  }

  if (filters?.type === 'income' || filters?.type === 'expense') {
    query = query.eq('type', filters.type)
  }

  if (filters?.category && filters.category.trim() !== '') {
    query = query.eq('category', filters.category.trim())
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar lançamentos: ${error.message}`)
  }

  return data ?? []
}

export async function createFinancialEntry(data: FinancialEntryInput) {
  const supabase = await createClient()
  const { userId, companyId } = await getCompanyId(supabase)

  if (!data.description || data.description.trim() === '') {
    return { error: 'A descrição é obrigatória' }
  }
  if (!data.amount || data.amount <= 0) {
    return { error: 'O valor deve ser maior que zero' }
  }
  if (data.type !== 'income' && data.type !== 'expense') {
    return { error: 'Tipo inválido' }
  }

  const { error } = await supabase.from('financial_entries').insert({
    company_id: companyId,
    type: data.type,
    category: data.category?.trim() || null,
    description: data.description.trim(),
    amount: data.amount,
    date: data.date,
    created_by: userId,
  })

  if (error) {
    return { error: `Erro ao criar lançamento: ${error.message}` }
  }

  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

export async function updateFinancialEntry(id: string, data: FinancialEntryInput) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!data.description || data.description.trim() === '') {
    return { error: 'A descrição é obrigatória' }
  }
  if (!data.amount || data.amount <= 0) {
    return { error: 'O valor deve ser maior que zero' }
  }
  if (data.type !== 'income' && data.type !== 'expense') {
    return { error: 'Tipo inválido' }
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      type: data.type,
      category: data.category?.trim() || null,
      description: data.description.trim(),
      amount: data.amount,
      date: data.date,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao atualizar lançamento: ${error.message}` }
  }

  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

export async function deleteFinancialEntry(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return { error: `Erro ao excluir lançamento: ${error.message}` }
  }

  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

export interface CashflowDay {
  date: string // 'YYYY-MM-DD'
  income: number
  expense: number
}

export interface FinancialSummary {
  month: string
  totalIncome: number
  totalExpense: number
  balance: number
  cashflow: CashflowDay[]
}

/**
 * Monthly summary combining manual financial_entries with rental payments.
 * - totalIncome = manual incomes + sum of payments (paid_at) in the month
 * - totalExpense = manual expenses in the month
 * - balance = totalIncome - totalExpense
 * - cashflow = per-day income/expense for the month
 */
export async function getFinancialSummary(month: string): Promise<FinancialSummary> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { start, end } = monthBounds(month)

  // Manual entries within the month
  const { data: entries, error: entriesError } = await supabase
    .from('financial_entries')
    .select('type, amount, date')
    .eq('company_id', companyId)
    .gte('date', start)
    .lt('date', end)

  if (entriesError) {
    throw new Error(`Erro ao calcular resumo: ${entriesError.message}`)
  }

  // Rental payments within the month (paid_at is a timestamptz).
  // Brazil é UTC-3: ancoramos os limites no horário de Brasília (-03:00)
  // para que pagamentos perto da meia-noite caiam no mês/dia local correto.
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .eq('company_id', companyId)
    .gte('paid_at', `${start}T00:00:00-03:00`)
    .lt('paid_at', `${end}T00:00:00-03:00`)

  if (paymentsError) {
    throw new Error(`Erro ao calcular resumo: ${paymentsError.message}`)
  }

  // Aggregate per day
  const dayMap = new Map<string, CashflowDay>()
  const ensureDay = (date: string): CashflowDay => {
    let day = dayMap.get(date)
    if (!day) {
      day = { date, income: 0, expense: 0 }
      dayMap.set(date, day)
    }
    return day
  }

  let totalIncome = 0
  let totalExpense = 0

  for (const entry of entries ?? []) {
    const amount = Number(entry.amount) || 0
    const day = ensureDay(entry.date)
    if (entry.type === 'income') {
      totalIncome += amount
      day.income += amount
    } else {
      totalExpense += amount
      day.expense += amount
    }
  }

  for (const payment of payments ?? []) {
    const amount = Number(payment.amount) || 0
    // Converte paid_at (UTC) para a data local de Brasília (UTC-3) antes do day-key
    const dateKey = new Date(
      new Date(payment.paid_at).getTime() - 3 * 60 * 60 * 1000
    ).toISOString().slice(0, 10)
    totalIncome += amount
    ensureDay(dateKey).income += amount
  }

  const cashflow = Array.from(dayMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  )

  return {
    month,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    cashflow,
  }
}

// ── Overview por período (filtros do painel financeiro) ───────────────────

export interface CategorySlice {
  category: string
  amount: number
}

export interface FinancialOverview {
  faturamento: number
  despesas: number
  lucro: number
  ticketMedio: number
  eventos: number
  aReceber: number
  pendingRentals: number
  growthPct: number | null
  cashflow: CashflowDay[]
  categoryBreakdown: CategorySlice[]
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDaysInclusive(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z').getTime()
  const b = new Date(end + 'T00:00:00Z').getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Resumo financeiro para um intervalo de datas [start, end] inclusivo.
 * Faturamento = entradas manuais + pagamentos de locação no período.
 * Despesas = saídas manuais. Lucro = faturamento - despesas.
 * Eventos = locações (não canceladas) com event_date no período.
 * A receber = saldo pendente de todas as locações em aberto (independe do período).
 * growthPct compara o faturamento com o período anterior espelhado.
 */
export async function getFinancialOverview(start: string, end: string): Promise<FinancialOverview> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const endExclusive = addDaysStr(end, 1)

  // Helper: soma entradas/saídas manuais + pagamentos para um intervalo [s, e] inclusivo
  async function sumRange(s: string, e: string) {
    const eExclusive = addDaysStr(e, 1)
    const [{ data: entries }, { data: payments }] = await Promise.all([
      supabase
        .from('financial_entries')
        .select('type, amount, date, category')
        .eq('company_id', companyId)
        .gte('date', s)
        .lt('date', eExclusive),
      supabase
        .from('payments')
        .select('amount, paid_at')
        .eq('company_id', companyId)
        .gte('paid_at', `${s}T00:00:00-03:00`)
        .lt('paid_at', `${eExclusive}T00:00:00-03:00`),
    ])

    let income = 0
    let expense = 0
    const dayMap = new Map<string, CashflowDay>()
    const catMap = new Map<string, number>()
    const ensureDay = (date: string): CashflowDay => {
      let d = dayMap.get(date)
      if (!d) {
        d = { date, income: 0, expense: 0 }
        dayMap.set(date, d)
      }
      return d
    }

    for (const en of entries ?? []) {
      const amount = Number(en.amount) || 0
      const day = ensureDay(en.date)
      if (en.type === 'income') {
        income += amount
        day.income += amount
      } else {
        expense += amount
        day.expense += amount
        const cat = en.category?.trim() || 'Outros'
        catMap.set(cat, (catMap.get(cat) || 0) + amount)
      }
    }

    for (const p of payments ?? []) {
      const amount = Number(p.amount) || 0
      const dateKey = new Date(new Date(p.paid_at).getTime() - 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      income += amount
      ensureDay(dateKey).income += amount
    }

    return { income, expense, dayMap, catMap }
  }

  const current = await sumRange(start, end)

  // Período anterior espelhado
  const len = diffDaysInclusive(start, end)
  const prevEnd = addDaysStr(start, -1)
  const prevStart = addDaysStr(prevEnd, -(len - 1))
  const previous = await sumRange(prevStart, prevEnd)

  // Eventos (locações não canceladas com event_date no período)
  const { count: eventos } = await supabase
    .from('rentals')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .gte('event_date', start)
    .lt('event_date', endExclusive)

  // A receber (todas as locações em aberto)
  const { data: openRentals } = await supabase
    .from('rentals')
    .select('total, amount_paid')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .neq('payment_status', 'paid')

  let aReceber = 0
  for (const r of openRentals ?? []) {
    aReceber += Math.max(0, (Number(r.total) || 0) - (Number(r.amount_paid) || 0))
  }

  const faturamento = current.income
  const despesas = current.expense
  const lucro = faturamento - despesas
  const eventCount = eventos || 0
  const ticketMedio = eventCount > 0 ? faturamento / eventCount : 0

  const prevFaturamento = previous.income
  const growthPct =
    prevFaturamento > 0 ? ((faturamento - prevFaturamento) / prevFaturamento) * 100 : null

  const cashflow = Array.from(current.dayMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  )

  const categoryBreakdown = Array.from(current.catMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    faturamento,
    despesas,
    lucro,
    ticketMedio,
    eventos: eventCount,
    aReceber,
    pendingRentals: (openRentals ?? []).length,
    growthPct,
    cashflow,
    categoryBreakdown,
  }
}

// ── Contas a Pagar (recurring_bills) ──────────────────────────────────────

export interface RecurringBill {
  id: string
  name: string
  amount: number
  due_day: number
  active: boolean
  last_paid_month: string | null
}

export async function listRecurringBills(): Promise<RecurringBill[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('recurring_bills')
    .select('id, name, amount, due_day, active, last_paid_month')
    .eq('company_id', companyId)
    .order('due_day', { ascending: true })

  if (error) throw new Error(`Erro ao listar contas a pagar: ${error.message}`)
  return (data ?? []) as RecurringBill[]
}

export async function createRecurringBill(data: { name: string; amount: number; due_day: number }) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  if (!data.name?.trim()) return { error: 'Informe o nome da conta' }
  if (!data.amount || data.amount <= 0) return { error: 'Informe um valor válido' }
  const dueDay = Math.min(31, Math.max(1, Math.round(data.due_day) || 1))

  const { error } = await supabase.from('recurring_bills').insert({
    company_id: companyId,
    name: data.name.trim(),
    amount: data.amount,
    due_day: dueDay,
  })

  if (error) return { error: `Erro ao criar conta: ${error.message}` }
  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

export async function updateRecurringBill(
  id: string,
  data: { name: string; amount: number; due_day: number; active?: boolean }
) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const dueDay = Math.min(31, Math.max(1, Math.round(data.due_day) || 1))
  const { error } = await supabase
    .from('recurring_bills')
    .update({
      name: data.name.trim(),
      amount: data.amount,
      due_day: dueDay,
      active: data.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: `Erro ao atualizar conta: ${error.message}` }
  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

export async function deleteRecurringBill(id: string) {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { error } = await supabase
    .from('recurring_bills')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: `Erro ao excluir conta: ${error.message}` }
  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

/**
 * Marca/desmarca a conta recorrente como paga no mês.
 * - Ao marcar paga: cria UMA despesa em financial_entries (categoria fixa
 *   "Contas Recorrentes", vinculada via recurring_bill_id, datada no dia do
 *   vencimento do mês), de forma idempotente (não duplica se já existir no mês).
 * - Ao desmarcar: remove a despesa auto-gerada daquele mês.
 * Datas/mês calculados no fuso de Brasília (UTC-3) para casar com o financeiro.
 */
export async function toggleBillPaid(id: string, paid: boolean) {
  const supabase = await createClient()
  const { userId, companyId } = await getCompanyId(supabase)

  const { data: bill, error: billError } = await supabase
    .from('recurring_bills')
    .select('id, name, amount, due_day, last_paid_month')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (billError || !bill) return { error: 'Conta não encontrada' }

  // Mês corrente em horário de Brasília.
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const y = brt.getUTCFullYear()
  const m = brt.getUTCMonth() + 1 // 1-12
  const monthStr = `${y}-${String(m).padStart(2, '0')}`

  const monthBounds = (year: number, month1: number) => {
    const start = `${year}-${String(month1).padStart(2, '0')}-01`
    const nextYear = month1 === 12 ? year + 1 : year
    const nextMonth = month1 === 12 ? 1 : month1 + 1
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    return { start, end }
  }

  if (paid) {
    // Data da despesa = dia do vencimento dentro do mês corrente (clampado).
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const day = Math.min(Math.max(1, bill.due_day || 1), lastDay)
    const entryDate = `${monthStr}-${String(day).padStart(2, '0')}`

    const { start, end } = monthBounds(y, m)

    // Idempotência: já existe despesa dessa conta no mês? Então não duplica.
    const { data: existing } = await supabase
      .from('financial_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('recurring_bill_id', id)
      .gte('date', start)
      .lt('date', end)
      .limit(1)

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase.from('financial_entries').insert({
        company_id: companyId,
        type: 'expense',
        category: 'Contas Recorrentes',
        description: `${bill.name} (${String(m).padStart(2, '0')}/${y})`,
        amount: bill.amount,
        date: entryDate,
        recurring_bill_id: id,
        created_by: userId,
      })
      if (insertError) return { error: `Erro ao lançar a despesa: ${insertError.message}` }
    }

    const { error } = await supabase
      .from('recurring_bills')
      .update({ last_paid_month: monthStr, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) return { error: `Erro ao atualizar conta: ${error.message}` }
  } else {
    // Remove a despesa auto-gerada do mês em que estava marcada como paga.
    const paidMonth = bill.last_paid_month || monthStr
    const [py, pm] = paidMonth.split('-').map(Number)
    if (py && pm) {
      const { start, end } = monthBounds(py, pm)
      await supabase
        .from('financial_entries')
        .delete()
        .eq('company_id', companyId)
        .eq('recurring_bill_id', id)
        .gte('date', start)
        .lt('date', end)
    }

    const { error } = await supabase
      .from('recurring_bills')
      .update({ last_paid_month: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) return { error: `Erro ao atualizar conta: ${error.message}` }
  }

  revalidatePath('/dashboard/financeiro')
  return { success: true }
}

// ── Contas a Receber (locações em aberto) ─────────────────────────────────

export interface Receivable {
  rentalId: string
  customerName: string
  eventDate: string
  total: number
  amountPaid: number
  pending: number
}

export async function getReceivables(): Promise<Receivable[]> {
  const supabase = await createClient()
  const { companyId } = await getCompanyId(supabase)

  const { data, error } = await supabase
    .from('rentals')
    .select('id, customer_name, event_date, total, amount_paid')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .neq('payment_status', 'paid')
    .order('event_date', { ascending: true })

  if (error) throw new Error(`Erro ao listar contas a receber: ${error.message}`)

  return (data ?? [])
    .map((r) => ({
      rentalId: r.id,
      customerName: r.customer_name,
      eventDate: r.event_date,
      total: Number(r.total) || 0,
      amountPaid: Number(r.amount_paid) || 0,
      pending: Math.max(0, (Number(r.total) || 0) - (Number(r.amount_paid) || 0)),
    }))
    .filter((r) => r.pending > 0)
}
