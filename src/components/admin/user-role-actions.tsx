'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { updateUserRole } from '@/actions/admin'
import toast from 'react-hot-toast'

interface UserRoleActionsProps {
  userId: string
  currentRole: string
}

const roleOptions = [
  { value: 'operator', label: 'Operador' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Proprietario' },
  { value: 'super_admin', label: 'Super Admin' },
]

export function UserRoleActions({ userId, currentRole }: UserRoleActionsProps) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(currentRole)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserRole(userId, role as any)
        toast.success('Papel atualizado')
        setOpen(false)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Alterar Papel
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Alterar Papel do Usuario">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Papel
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {role === 'super_admin' && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Atencao: este usuario tera acesso total ao painel administrativo.
            </p>
          )}

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
