'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomer, deleteCustomer } from '@/actions/customers'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  address: string | null
}

export default function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')

  useEffect(() => {
    async function fetchCustomer() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        toast.error('Cliente não encontrado')
        router.push('/dashboard/clientes')
        return
      }

      setCustomer(data)
      setPhone(data.phone || '')
      setCpf(data.document || '')
      setLoadingData(false)
    }

    fetchCustomer()
  }, [id, router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      await updateCustomer(id, formData)
      toast.success('Cliente atualizado com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cliente'
      if (message.includes('NEXT_REDIRECT')) {
        toast.success('Cliente atualizado com sucesso!')
        return
      }
      toast.error(message)
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)

    try {
      await deleteCustomer(id)
      toast.success('Cliente excluído com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir cliente'
      if (message.includes('NEXT_REDIRECT')) {
        toast.success('Cliente excluído com sucesso!')
        return
      }
      toast.error(message)
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!customer) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/clientes"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Editar Cliente</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{customer.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Tem certeza que deseja excluir o cliente <strong>{customer.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Nome */}
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={customer.name}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Nome completo do cliente"
            />
          </div>

          {/* Telefone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Telefone
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={customer.email || ''}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="email@exemplo.com"
            />
          </div>

          {/* CPF */}
          <div>
            <label htmlFor="document" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              CPF
            </label>
            <input
              type="text"
              id="document"
              name="document"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="000.000.000-00"
            />
          </div>

          {/* Endereço */}
          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Endereço
            </label>
            <input
              type="text"
              id="address"
              name="address"
              defaultValue={customer.address || ''}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Rua, número, bairro, cidade - UF, CEP"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-700 pt-6">
          <Link
            href="/dashboard/clientes"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </form>
    </div>
  )
}
