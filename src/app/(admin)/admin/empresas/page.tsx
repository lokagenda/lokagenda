import Link from 'next/link'
import { listCompanies } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminSearchForm } from '@/components/admin/search-form'
import { CompanyActions } from '@/components/admin/company-actions'
import { CompanyDetailsButton } from '@/components/admin/company-details-modal'

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

type CompanyFilter = 'todas' | 'pagantes' | 'trial' | 'expiradas'

const filterTabs: { key: CompanyFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pagantes', label: 'Pagantes' },
  { key: 'trial', label: 'Trial' },
  { key: 'expiradas', label: 'Expiradas' },
]

type CompanyRow = { subscriptions?: { status?: string }[] | null }

function latestSubscription(company: CompanyRow) {
  const subs = company.subscriptions || []
  if (subs.length === 0) return null
  return subs[0]
}

function matchesFilter(company: CompanyRow, filter: CompanyFilter): boolean {
  const status = latestSubscription(company)?.status
  switch (filter) {
    case 'pagantes':
      return status === 'active'
    case 'trial':
      return status === 'trial'
    case 'expiradas':
      return status === 'expired' || status === 'cancelled'
    case 'todas':
    default:
      return true
  }
}

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const validFilters: CompanyFilter[] = ['pagantes', 'trial', 'expiradas']
  const filter: CompanyFilter = validFilters.includes(params.status as CompanyFilter)
    ? (params.status as CompanyFilter)
    : 'todas'

  const allCompanies = (await listCompanies(search || undefined)) as CompanyRow[] | null

  const payingCount = (allCompanies || []).filter(
    (c) => latestSubscription(c)?.status === 'active'
  ).length

  const companies = (allCompanies || []).filter((c) => matchesFilter(c, filter))

  function filterHref(key: CompanyFilter) {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (key !== 'todas') sp.set('status', key)
    const qs = sp.toString()
    return qs ? `/admin/empresas?${qs}` : '/admin/empresas'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Empresas
        </h2>
        <Badge variant="success">Pagantes: {payingCount}</Badge>
      </div>

      <AdminSearchForm
        placeholder="Buscar por nome da empresa..."
        defaultValue={search}
        action="/admin/empresas"
      />

      <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {filterTabs.map((tab) => (
          <Link
            key={tab.key}
            href={filterHref(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

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
                        <div className="flex items-center justify-end gap-2">
                          <CompanyDetailsButton
                            companyId={company.id}
                            companyName={company.name}
                          />
                          <CompanyActions
                            companyId={company.id}
                            isSuspended={isSuspended}
                          />
                        </div>
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
