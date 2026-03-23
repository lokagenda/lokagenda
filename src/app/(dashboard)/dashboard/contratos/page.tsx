import Link from 'next/link'
import { Plus, FileText, Eye, Star, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { deleteTemplate } from '@/actions/contracts'
import { formatDate } from '@/lib/utils'

export const metadata = {
  title: 'Modelos de Contrato - Project Leo',
}

export default async function ContratosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-zinc-500">Faça login para visualizar seus modelos.</p>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-zinc-500">Empresa não encontrada.</p>
      </div>
    )
  }

  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-red-500">Erro ao carregar modelos: {error.message}</p>
      </div>
    )
  }

  const templates = data

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Modelos de Contrato</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os modelos de contrato da sua empresa.
          </p>
        </div>
        <Link
          href="/dashboard/contratos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          Novo Modelo
        </Link>
      </div>

      {/* Templates List */}
      {templates && templates.length > 0 ? (
        <div className="mt-8 space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{template.name}</h3>
                    {template.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <Star className="h-3 w-3" />
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Criado em {formatDate(template.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/contratos/${template.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Eye className="h-4 w-4" />
                  Editar
                </Link>
                <form
                  action={async () => {
                    'use server'
                    await deleteTemplate(template.id)
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
            <FileText className="h-8 w-8 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nenhum modelo encontrado</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Comece criando o primeiro modelo de contrato.
            </p>
          </div>
          <Link
            href="/dashboard/contratos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" />
            Criar Modelo
          </Link>
        </div>
      )}
    </div>
  )
}
