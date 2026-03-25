'use client'

import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  createGlobalBanner,
  updateGlobalBanner,
  deleteGlobalBanner,
  toggleGlobalBanner,
} from '@/actions/admin'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

// ── Create Button ──────────────────────────────────────────

export function CreateBannerButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('active', 'true')

    startTransition(async () => {
      try {
        await createGlobalBanner(formData)
        toast.success('Banner criado')
        setOpen(false)
        formRef.current?.reset()
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo Banner
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo Banner Global">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Imagem
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              required
              className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-400 dark:file:bg-blue-500/10 dark:file:text-blue-400"
            />
          </div>
          <Input label="Link (opcional)" name="link_url" placeholder="https://..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Posicao" name="position" type="number" defaultValue="0" />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipo
              </label>
              <select
                name="type"
                defaultValue="banner"
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="banner">Banner</option>
                <option value="popup">Pop-up</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Banner Actions ─────────────────────────────────────────

interface BannerActionsProps {
  banner: {
    id: string
    image_url: string
    link_url: string | null
    position: number
    active: boolean
    type: 'banner' | 'popup'
  }
}

export function BannerActions({ banner }: BannerActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('active', banner.active ? 'true' : 'false')

    startTransition(async () => {
      try {
        await updateGlobalBanner(banner.id, formData)
        toast.success('Banner atualizado')
        setEditOpen(false)
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este banner?')) return
    startTransition(async () => {
      try {
        await deleteGlobalBanner(banner.id)
        toast.success('Banner excluido')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleGlobalBanner(banner.id, !banner.active)
        toast.success(banner.active ? 'Banner desativado' : 'Banner ativado')
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <>
      <div className="flex gap-1">
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="rounded p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title={banner.active ? 'Desativar' : 'Ativar'}
        >
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${banner.active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="rounded p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Banner">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nova Imagem (opcional)
            </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-400 dark:file:bg-blue-500/10 dark:file:text-blue-400"
            />
          </div>
          <Input
            label="Link (opcional)"
            name="link_url"
            defaultValue={banner.link_url || ''}
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Posicao"
              name="position"
              type="number"
              defaultValue={banner.position}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipo
              </label>
              <select
                name="type"
                defaultValue={banner.type}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="banner">Banner</option>
                <option value="popup">Pop-up</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
