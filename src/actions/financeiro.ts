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
