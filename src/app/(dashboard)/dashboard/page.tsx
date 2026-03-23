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
} from 'lucide-react'
import Link from 'next/link'

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

  const [r1, r2, r3, r4, r5] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
    supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('event_date', monthStart).lte('event_date', monthEnd),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('rentals').select('id, customer_name, event_date, total, status').eq('company_id', companyId).gte('event_date', today).order('event_date', { ascending: true }).limit(5),
  ])

  const stats = [
    {
      label: 'Produtos',
      value: String(r1.count ?? 0),
      icon: Package,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      href: '/dashboard/produtos',
    },
    {
      label: 'Orçamentos Pendentes',
      value: String(r2.count ?? 0),
      icon: FileText,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      href: '/dashboard/orcamentos',
    },
    {
      label: 'Locações do Mês',
      value: String(r3.count ?? 0),
      icon: Calendar,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      href: '/dashboard/locacoes',
    },
    {
      label: 'Clientes',
      value: String(r4.count ?? 0),
      icon: Users,
      iconColor: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-500/10',
      href: '/dashboard/clientes',
    },
  ]

  const rentals = r5.data ?? []

  return (
    <div className="space-y-8">
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

      {/* Stats grid */}
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

      {/* Upcoming rentals */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Próximas Locações</CardTitle>
            {rentals.length > 0 && (
              <Link
                href="/dashboard/locacoes"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Ver todas
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="Nenhuma locação agendada"
              description="Quando você criar locações, elas aparecerão aqui organizadas por data."
            />
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rentals.map((rental) => (
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
    </div>
  )
}
