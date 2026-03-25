import { getAdminStats } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, CreditCard, DollarSign, Users } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  const cards = [
    {
      title: 'Total de Empresas',
      value: stats.totalCompanies.toString(),
      icon: Building2,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      title: 'Assinaturas Ativas',
      value: stats.activeSubscriptions.toString(),
      icon: CreditCard,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      title: 'Receita Mensal',
      value: formatCurrency(stats.monthlyRevenue),
      icon: DollarSign,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      title: 'Total de Usuarios',
      value: stats.totalUsers.toString(),
      icon: Users,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent signups */}
      <Card>
        <CardHeader>
          <CardTitle>Ultimas Empresas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentCompanies.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma empresa cadastrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Nome
                    </th>
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Data de Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentCompanies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/50"
                    >
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {company.name}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {formatDate(company.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
