import { listSubscriptions } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SubscriptionActions } from '@/components/admin/subscription-actions'
import { SubscriptionFilter } from '@/components/admin/subscription-filter'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const statusMap: Record<string, { label: string; variant: StatusVariant }> = {
  trialing: { label: 'Trial', variant: 'info' },
  active: { label: 'Ativa', variant: 'success' },
  past_due: { label: 'Inadimplente', variant: 'warning' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
  expired: { label: 'Expirada', variant: 'neutral' },
}

const cycleLabels: Record<string, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
}

export default async function AdminAssinaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status || 'all'
  const subscriptions = await listSubscriptions(statusFilter)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Assinaturas
      </h2>

      <SubscriptionFilter current={statusFilter} />

      <Card>
        <CardHeader>
          <CardTitle>
            {subscriptions?.length || 0} assinatura(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Empresa</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Plano</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Ciclo</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Preco</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Periodo</th>
                  <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(subscriptions || []).map((sub: any) => {
                  const badge = statusMap[sub.status] || { label: sub.status, variant: 'neutral' as StatusVariant }
                  return (
                    <tr key={sub.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {sub.companies?.name || '-'}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {sub.plans?.name || '-'}
                      </td>
                      <td className="py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {cycleLabels[sub.billing_cycle] || sub.billing_cycle}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {formatCurrency(sub.current_price)}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                      </td>
                      <td className="py-3 text-right">
                        <SubscriptionActions subscription={sub} />
                      </td>
                    </tr>
                  )
                })}
                {(!subscriptions || subscriptions.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                      Nenhuma assinatura encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
