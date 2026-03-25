import { listCompanies, toggleCompanyStatus } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminSearchForm } from '@/components/admin/search-form'
import { CompanyActions } from '@/components/admin/company-actions'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

function subscriptionBadge(status?: string): { label: string; variant: StatusVariant } {
  const map: Record<string, { label: string; variant: StatusVariant }> = {
    trialing: { label: 'Trial', variant: 'info' },
    active: { label: 'Ativa', variant: 'success' },
    past_due: { label: 'Inadimplente', variant: 'warning' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
    expired: { label: 'Expirada', variant: 'neutral' },
  }
  return map[status || ''] || { label: 'Sem assinatura', variant: 'neutral' }
}

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const companies = await listCompanies(search || undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Empresas
        </h2>
      </div>

      <AdminSearchForm
        placeholder="Buscar por nome da empresa..."
        defaultValue={search}
        action="/admin/empresas"
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {companies?.length || 0} empresa(s) encontrada(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Empresa</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Proprietario</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Plano</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Cadastro</th>
                  <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(companies || []).map((company: any) => {
                  const owner = company.profiles?.find((p: any) => p.role === 'owner')
                  const subscription = company.subscriptions?.[0]
                  const planName = subscription?.plans?.name || '-'
                  const badge = subscriptionBadge(subscription?.status)
                  const isSuspended = subscription?.status === 'cancelled'

                  return (
                    <tr
                      key={company.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/50"
                    >
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {company.name}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {owner?.full_name || '-'}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {planName}
                      </td>
                      <td className="py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {formatDate(company.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <CompanyActions
                          companyId={company.id}
                          isSuspended={isSuspended}
                        />
                      </td>
                    </tr>
                  )
                })}
                {(!companies || companies.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                      Nenhuma empresa encontrada.
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
