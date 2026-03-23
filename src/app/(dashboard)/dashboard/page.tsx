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

  const productsCount = r1.count
  const pendingQuotesCount = r2.count
  const monthRentalsCount = r3.count
  const customersCount = r4.count
  const upcomingRentals = r5.data

  const stats = [
    {
      label: 'Total de Produtos',
      value: String(productsCount ?? 0),
      icon: Package,
      color: 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
    },
    {
      label: 'Orçamentos Pendentes',
      value: String(pendingQuotesCount ?? 0),
      icon: FileText,
      color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
    },
    {
      label: 'Locações do Mês',
      value: String(monthRentalsCount ?? 0),
      icon: Calendar,
      color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
    },
    {
      label: 'Clientes Cadastrados',
      value: String(customersCount ?? 0),
      icon: Users,
      color: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-500/10',
    },
  ]

  const rentals = upcomingRentals ?? []

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Bem-vindo, {firstName}!
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Aqui está um resumo do seu negócio.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming rentals */}
      <Card>
        <CardHeader>
          <CardTitle>Próximas Locações</CardTitle>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="Nenhuma locação agendada"
              description="Quando você criar locações, elas aparecerão aqui organizadas por data."
            />
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rentals.map((rental) => (
                <Link
                  key={rental.id}
                  href={`/dashboard/locacoes/${rental.id}`}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-75 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <CalendarClock className="h-5 w-5" />
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
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
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
