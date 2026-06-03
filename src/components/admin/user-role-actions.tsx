'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { updateUserRole, adminSetUserPassword } from '@/actions/admin'
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

  const [pwdOpen, setPwdOpen] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

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

  async function handleSavePassword() {
    if (newPwd.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('As senhas não coincidem.')
      return
    }
    setSavingPwd(true)
    try {
      await adminSetUserPassword(userId, newPwd)
      toast.success('Senha definida com sucesso. Passe a nova senha pro usuário.')
      setPwdOpen(false)
      setNewPwd('')
      setConfirmPwd('')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao definir senha')
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <>
      <div className="inline-flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Alterar Papel
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setNewPwd(''); setConfirmPwd(''); setPwdOpen(true) }}>
          Definir Senha
        </Button>
      </div>

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

      <Modal open={pwdOpen} onClose={() => !savingPwd && setPwdOpen(false)} title="Definir senha do usuário">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Use isto quando o cliente não consegue redefinir pelo email. Combine uma senha temporária com ele — depois ele troca em <strong>"Alterar senha"</strong> no perfil dele.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nova senha
            </label>
            <input
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Min. 6 caracteres"
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Confirmar nova senha
            </label>
            <input
              type="text"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Repetir a nova senha"
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setPwdOpen(false)} disabled={savingPwd}>
              Cancelar
            </Button>
            <Button onClick={handleSavePassword} disabled={savingPwd}>
              {savingPwd ? 'Salvando...' : 'Salvar senha'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
