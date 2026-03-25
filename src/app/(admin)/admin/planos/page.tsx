import { listPlans } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlanActions } from '@/components/admin/plan-actions'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default async function AdminPlanosPage() {
  const plans = await listPlans()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Planos
      </h2>

      <div className="grid gap-6">
        {(plans || []).map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.active ? 'success' : 'neutral'}>
                  {plan.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <PlanActions plan={plan} />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Precos</p>
                  <div className="mt-1 space-y-1 text-sm text-zinc-900 dark:text-zinc-50">
                    <p>Mensal: {formatCurrency(plan.price_monthly)}</p>
                    <p>Semestral: {formatCurrency(plan.price_semiannual)}</p>
                    <p>Anual: {formatCurrency(plan.price_annual)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Limites</p>
                  <div className="mt-1 space-y-1 text-sm text-zinc-900 dark:text-zinc-50">
                    <p>Produtos: {plan.max_products}</p>
                    <p>Locacoes/mes: {plan.max_rentals_month}</p>
                    <p>Usuarios: {plan.max_users}</p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Recursos</p>
                  <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                    {Array.isArray(plan.features) ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {(plan.features as string[]).map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">-</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!plans || plans.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum plano encontrado.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
