import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Package,
  FileText,
  Calendar,
  Users,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  DollarSign,
  CircleDollarSign,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { BannerCarousel } from '@/components/banner-carousel'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_id')
    .eq('id', user!.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] || 'Usuário'
  const companyId = profile?.company_id || ''
  if (!companyId) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  // Previous month range for comparison
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const [
    productsCount,
    pendingQuotesCount,
    monthRentalsCount,
    customersCount,
    monthRentals,
    prevMonthRentals,
    upcomingRentals,
    pendingQuotes,
  ] = await Promise.all([
    // Row 1 stats
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
    supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('event_date', monthStart).lte('event_date', monthEnd),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    // Row 2 financial data - current month rentals with amounts
    supabase.from('rentals').select('total, amount_paid, payment_status, event_date').eq('company_id', companyId).gte('event_date', monthStart).lte('event_date', monthEnd),
    // Previous month rentals for comparison
    supabase.from('rentals').select('total').eq('company_id', companyId).gte('event_date', prevMonthStart).lte('event_date', prevMonthEnd),
    // Row 3 - upcoming rentals
    supabase.from('rentals').select('id, customer_name, event_date, total, status').eq('company_id', companyId).gte('event_date', today).in('status', ['confirmed', 'delivered']).order('event_date', { ascending: true }).limit(5),
    // Row 3 - pending quotes
    supabase.from('quotes').select('id, customer_name, created_at, total').eq('company_id', companyId).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
  ])

  // Row 1 stats data
  const stats = [
    {
      label: 'Produtos',
      value: String(productsCount.count ?? 0),
      icon: Package,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      href: '/dashboard/produtos',
    },
    {
      label: 'Orçamentos Pendentes',
      value: String(pendingQuotesCount.count ?? 0),
      icon: FileText,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      href: '/dashboard/orcamentos?status=pending',
    },
    {
      label: 'Locações do Mês',
      value: String(monthRentalsCount.count ?? 0),
      icon: Calendar,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      href: '/dashboard/locacoes',
    },
    {
      label: 'Clientes',
      value: String(customersCount.count ?? 0),
      icon: Users,
      iconColor: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-500/10',
      href: '/dashboard/clientes',
    },
  ]

  // Row 2 financial calculations
  const rentalsData = monthRentals.data ?? []
  const prevRentalsData = prevMonthRentals.data ?? []

  const faturamentoMensal = rentalsData.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
  const faturamentoPrevMonth = prevRentalsData.reduce((sum, r) => sum + (Number(r.total) || 0), 0)

  const aReceber = rentalsData
    .filter((r) => r.payment_status !== 'paid')
    .reduce((sum, r) => sum + ((Number(r.total) || 0) - (Number(r.amount_paid) || 0)), 0)

  const recebido = rentalsData.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0)

  // Percentage comparison with previous month
  const percentChange = faturamentoPrevMonth > 0
    ? ((faturamentoMensal - faturamentoPrevMonth) / faturamentoPrevMonth) * 100
    : faturamentoMensal > 0 ? 100 : 0
  const isPositiveChange = percentChange >= 0

  // Chart data: daily revenue for current month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyRevenue: number[] = new Array(daysInMonth).fill(0)

  for (const rental of rentalsData) {
    if (rental.event_date) {
      const day = parseInt(rental.event_date.split('-')[2], 10)
      dailyRevenue[day - 1] += Number(rental.total) || 0
    }
  }

  const maxRevenue = Math.max(...dailyRevenue, 1)

  // Row 3 data
  const upcoming = upcomingRentals.data ?? []
  const quotes = pendingQuotes.data ?? []

  return (
    <div className="space-y-8">
      {/* Banner carousel */}
      <BannerCarousel />

      {/* Welcome header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Bem-vindo de volta,
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {firstName}
          </h2>
        </div>
        <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 sm:flex">
          <TrendingUp className="h-3.5 w-3.5" />
          Resumo do negócio
        </div>
      </div>

      {/* Row 1 - Stats cards */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {stat.value}
                </p>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2 - Financial summary */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        {/* Financial cards */}
        <div className="lg:col-span-4 grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
          {/* Faturamento Mensal */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isPositiveChange
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                }`}>
                  {isPositiveChange
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />
                  }
                  {Math.abs(percentChange).toFixed(1)}%
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(faturamentoMensal)}
                </p>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Faturamento Mensal
                </p>
              </div>
            </CardContent>
          </Card>

          {/* A Receber */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <CircleDollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  Em aberto
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(aReceber)}
                </p>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Receber
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recebido */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  Pago
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(recebido)}
                </p>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Recebido
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue chart + quick action */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Receita Diária</CardTitle>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-[2px] h-40">
                {dailyRevenue.map((revenue, i) => {
                  const heightPercent = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
                  const isToday = i + 1 === now.getDate()
                  return (
                    <div
                      key={i}
                      className="group/bar relative flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div
                        className={`w-full min-h-[2px] rounded-t transition-colors ${
                          isToday
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : revenue > 0
                              ? 'bg-emerald-300 dark:bg-emerald-600'
                              : 'bg-zinc-100 dark:bg-zinc-800'
                        }`}
                        style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      />
                      {revenue > 0 && (
                        <div className="absolute bottom-full mb-1 hidden group-hover/bar:block z-10 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg">
                          Dia {i + 1}: {formatCurrency(revenue)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                <span>1</span>
                <span>{Math.ceil(daysInMonth / 4)}</span>
                <span>{Math.ceil(daysInMonth / 2)}</span>
                <span>{Math.ceil((daysInMonth * 3) / 4)}</span>
                <span>{daysInMonth}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick action button */}
          <Link
            href="/dashboard/orcamentos/novo"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 dark:border-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Novo Orçamento
          </Link>
        </div>
      </div>

      {/* Row 3 - Two columns */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Próximas Locações */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Próximas Locações</CardTitle>
              {upcoming.length > 0 && (
                <Link
                  href="/dashboard/locacoes"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Ver todas
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="Nenhuma locação agendada"
                description="Quando você criar locações, elas aparecerão aqui organizadas por data."
              />
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {upcoming.map((rental) => (
                  <Link
                    key={rental.id}
                    href={`/dashboard/locacoes/${rental.id}`}
                    className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {rental.customer_name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(rental.event_date)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(rental.total)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orçamentos Pendentes */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Orçamentos Pendentes</CardTitle>
              {quotes.length > 0 && (
                <Link
                  href="/dashboard/orcamentos?status=pending"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Ver todos
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="Nenhum orçamento pendente"
                description="Orçamentos pendentes aparecerão aqui para acompanhamento."
              />
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/dashboard/orcamentos/${quote.id}`}
                    className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {quote.customer_name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(quote.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(quote.total)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
