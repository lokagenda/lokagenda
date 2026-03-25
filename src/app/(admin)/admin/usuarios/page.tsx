import { listUsers } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminSearchForm } from '@/components/admin/search-form'
import { UserRoleActions } from '@/components/admin/user-role-actions'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'default'

const roleLabels: Record<string, { label: string; variant: BadgeVariant }> = {
  super_admin: { label: 'Super Admin', variant: 'danger' },
  owner: { label: 'Proprietario', variant: 'default' },
  admin: { label: 'Admin', variant: 'info' },
  operator: { label: 'Operador', variant: 'neutral' },
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const users = await listUsers(search || undefined)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Usuarios
      </h2>

      <AdminSearchForm
        placeholder="Buscar por nome..."
        defaultValue={search}
        action="/admin/usuarios"
      />

      <Card>
        <CardHeader>
          <CardTitle>{users?.length || 0} usuario(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Nome</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Empresa</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Papel</th>
                  <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Cadastro</th>
                  <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((user: any) => {
                  const role = roleLabels[user.role] || { label: user.role, variant: 'neutral' as BadgeVariant }
                  return (
                    <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {user.full_name}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {user.email || '-'}
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {user.companies?.name || '-'}
                      </td>
                      <td className="py-3">
                        <Badge variant={role.variant}>{role.label}</Badge>
                      </td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <UserRoleActions userId={user.id} currentRole={user.role} />
                      </td>
                    </tr>
                  )
                })}
                {(!users || users.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                      Nenhum usuario encontrado.
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
