'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createFreeSubscription, listCompaniesForSelect } from '@/actions/admin'
import { Gift, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function CreateFreeSubscription() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  useEffect(() => {
    if (open) {
      setLoadingCompanies(true)
      listCompaniesForSelect()
        .then((data) => {
          setCompanies(data)
          setSelectedCompanyId('')
        })
        .catch(() => toast.error('Erro ao carregar empresas'))
        .finally(() => setLoadingCompanies(false))
    }
  }, [open])

  function handleCreate() {
    if (!selectedCompanyId) {
      toast.error('Selecione uma empresa')
      return
    }
    startTransition(async () => {
      try {
        await createFreeSubscription(selectedCompanyId)
        toast.success('Assinatura grátis criada com sucesso')
        setOpen(false)
        setSelectedCompanyId('')
      } catch (err: any) {
        toast.error(err.message || 'Erro ao criar assinatura')
      }
    })
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Gift className="h-4 w-4" />
        Criar Assinatura Grátis
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Criar Assinatura Grátis">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Crie uma assinatura gratuita e sem expiração para uma empresa. Ideal para amigos e familiares.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Empresa
            </label>
            {loadingCompanies ? (
              <div className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando empresas...
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Selecione uma empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <p><strong>Status:</strong> Ativa</p>
              <p><strong>Valor:</strong> R$ 0,00</p>
              <p><strong>Expiração:</strong> Sem expiração (31/12/2099)</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !selectedCompanyId}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Assinatura'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
