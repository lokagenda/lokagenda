'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { updatePlan, togglePlanActive } from '@/actions/admin'
import toast from 'react-hot-toast'

interface PlanActionsProps {
  plan: {
    id: string
    name: string
    price_monthly: number
    price_semiannual: number
    price_annual: number
    max_products: number
    max_rentals_month: number
    max_users: number
    active: boolean
    features: unknown
  }
}

export function PlanActions({ plan }: PlanActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: plan.name,
    price_monthly: plan.price_monthly,
    price_semiannual: plan.price_semiannual,
    price_annual: plan.price_annual,
    max_products: plan.max_products,
    max_rentals_month: plan.max_rentals_month,
    max_users: plan.max_users,
  })

  function handleToggle() {
    startTransition(async () => {
      try {
        await togglePlanActive(plan.id, !plan.active)
        toast.success(plan.active ? 'Plano desativado' : 'Plano ativado')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePlan(plan.id, form)
        toast.success('Plano atualizado')
        setEditOpen(false)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Editar
        </Button>
        <Button
          variant={plan.active ? 'danger' : 'primary'}
          size="sm"
          onClick={handleToggle}
          disabled={isPending}
        >
          {plan.active ? 'Desativar' : 'Ativar'}
        </Button>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Plano">
        <div className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Mensal (R$)"
              type="number"
              step="0.01"
              value={form.price_monthly}
              onChange={(e) => setForm({ ...form, price_monthly: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Semestral (R$)"
              type="number"
              step="0.01"
              value={form.price_semiannual}
              onChange={(e) => setForm({ ...form, price_semiannual: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Anual (R$)"
              type="number"
              step="0.01"
              value={form.price_annual}
              onChange={(e) => setForm({ ...form, price_annual: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Max Produtos"
              type="number"
              value={form.max_products}
              onChange={(e) => setForm({ ...form, max_products: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Max Locacoes/mes"
              type="number"
              value={form.max_rentals_month}
              onChange={(e) => setForm({ ...form, max_rentals_month: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Max Usuarios"
              type="number"
              value={form.max_users}
              onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
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
