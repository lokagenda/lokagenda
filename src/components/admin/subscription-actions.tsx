'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { updateSubscription } from '@/actions/admin'
import toast from 'react-hot-toast'

interface SubscriptionActionsProps {
  subscription: {
    id: string
    status: string
    trial_ends_at: string | null
  }
}

const statusOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Inadimplente' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
]

export function SubscriptionActions({ subscription }: SubscriptionActionsProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(subscription.status)
  const [trialEnd, setTrialEnd] = useState(subscription.trial_ends_at?.split('T')[0] || '')

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSubscription(subscription.id, {
          status: status as any,
          trial_ends_at: trialEnd ? new Date(trialEnd + 'T23:59:59').toISOString() : undefined,
        })
        toast.success('Assinatura atualizada')
        setOpen(false)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar Assinatura">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Fim do Trial"
            type="date"
            value={trialEnd}
            onChange={(e) => setTrialEnd(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
