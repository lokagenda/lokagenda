'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { getCompanyDetails } from '@/actions/admin'
import { Eye, Loader2, Building2, User, Package, FileText, Truck, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const statusMap: Record<string, { label: string; variant: StatusVariant }> = {
  trial: { label: 'Trial', variant: 'info' },
  trialing: { label: 'Trial', variant: 'info' },
  active: { label: 'Ativa', variant: 'success' },
  past_due: { label: 'Inadimplente', variant: 'warning' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
  expired: { label: 'Expirada', variant: 'neutral' },
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface CompanyDetailsButtonProps {
  companyId: string
  companyName: string
  variant?: 'button' | 'link'
}

export function CompanyDetailsButton({ companyId, companyName, variant = 'button' }: CompanyDetailsButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [details, setDetails] = useState<any>(null)

  function handleOpen() {
    setOpen(true)
    startTransition(async () => {
      try {
        const data = await getCompanyDetails(companyId)
        setDetails(data)
      } catch (err: any) {
        toast.error(err.message || 'Erro ao carregar detalhes')
        setOpen(false)
      }
    })
  }

  const owner = details?.profiles?.find((p: any) => p.role === 'owner')
  const subscription = details?.subscriptions?.[0]
  const subStatus = statusMap[subscription?.status] || { label: 'Sem assinatura', variant: 'neutral' as StatusVariant }

  const productCount = details?.products?.[0]?.count ?? 0
  const customerCount = details?.customers?.[0]?.count ?? 0
  const rentalCount = details?.rentals?.[0]?.count ?? 0

  return (
    <>
      {variant === 'link' ? (
        <button
          onClick={handleOpen}
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          {companyName}
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Eye className="h-3.5 w-3.5" />
          Ver
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Detalhes da Empresa" className="max-w-2xl">
        {isPending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Company info */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                <Building2 className="h-4 w-4" />
                Empresa
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Nome:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{details.name}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">CNPJ/CPF:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{details.document || '-'}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Telefone:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{details.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">E-mail:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{details.email || '-'}</p>
                </div>
                {(details.address || details.city || details.state) && (
                  <div className="sm:col-span-2">
                    <span className="text-zinc-500 dark:text-zinc-400">Endereço:</span>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {[details.address, details.city, details.state].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Cadastro:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{formatDate(details.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Owner */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                <User className="h-4 w-4" />
                Proprietário
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Nome:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{owner?.full_name || '-'}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Desde:</span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{formatDate(owner?.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Counts */}
            <div>
              <div className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Números
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <Package className="mx-auto h-5 w-5 text-blue-500" />
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{productCount}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Produtos</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <FileText className="mx-auto h-5 w-5 text-green-500" />
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{customerCount}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Clientes</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <Truck className="mx-auto h-5 w-5 text-orange-500" />
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{rentalCount}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Locações</p>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                <CreditCard className="h-4 w-4" />
                Assinatura
              </div>
              {subscription ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Plano:</span>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{subscription.plans?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Status:</span>
                    <div className="mt-0.5">
                      <Badge variant={subStatus.variant}>{subStatus.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Valor:</span>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(subscription.current_price || 0)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Período:</span>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sem assinatura</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
