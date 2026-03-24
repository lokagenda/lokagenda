'use client'

import { useState, useEffect, useTransition } from 'react'
import { Megaphone, Plus, Trash2, Pencil, Image, ExternalLink, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createBanner, updateBanner, deleteBanner, toggleBanner } from '@/actions/banners'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface Banner {
  id: string
  image_url: string
  link_url: string | null
  active: boolean
  position: number
  is_global: boolean
  created_at: string
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [position, setPosition] = useState('0')
  const [active, setActive] = useState(true)

  async function loadBanners() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    const { data } = await supabase
      .from('banners')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('position', { ascending: true })

    if (data) setBanners(data)
    setLoading(false)
  }

  useEffect(() => {
    loadBanners()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  function resetForm() {
    setImageFile(null)
    setImagePreview(null)
    setLinkUrl('')
    setPosition('0')
    setActive(true)
    setEditingBanner(null)
  }

  function openNewModal() {
    resetForm()
    setPosition(String(banners.length))
    setModalOpen(true)
  }

  function openEditModal(banner: Banner) {
    setEditingBanner(banner)
    setImagePreview(banner.image_url)
    setImageFile(null)
    setLinkUrl(banner.link_url || '')
    setPosition(String(banner.position))
    setActive(banner.active)
    setModalOpen(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!editingBanner && !imageFile) {
      setToast({ type: 'error', message: 'Selecione uma imagem para o banner' })
      return
    }

    if (!editingBanner && banners.length >= 5) {
      setToast({ type: 'error', message: 'Limite máximo de 5 banners atingido' })
      return
    }

    const formData = new FormData()
    if (imageFile) formData.append('image', imageFile)
    formData.append('link_url', linkUrl)
    formData.append('position', position)
    formData.append('active', String(active))

    startTransition(async () => {
      try {
        if (editingBanner) {
          await updateBanner(editingBanner.id, formData)
          setToast({ type: 'success', message: 'Banner atualizado com sucesso' })
        } else {
          await createBanner(formData)
          setToast({ type: 'success', message: 'Banner criado com sucesso' })
        }
        setModalOpen(false)
        resetForm()
        await loadBanners()
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar banner' })
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este banner?')) return

    startTransition(async () => {
      try {
        await deleteBanner(id)
        setToast({ type: 'success', message: 'Banner excluído com sucesso' })
        await loadBanners()
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao excluir banner' })
      }
    })
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      try {
        await toggleBanner(id, !currentActive)
        await loadBanners()
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao alterar status' })
      }
    })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Gerenciar Banners
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os banners exibidos no painel ({banners.length}/5)
          </p>
        </div>
        <Button
          onClick={openNewModal}
          disabled={banners.length >= 5}
        >
          <Plus className="h-4 w-4" />
          Novo Banner
        </Button>
      </div>

      {/* Banner list */}
      {banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16 dark:border-zinc-700 dark:bg-zinc-900">
          <Megaphone className="h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Nenhum banner cadastrado
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Adicione banners para exibir no painel
          </p>
          <Button className="mt-4" onClick={openNewModal}>
            <Plus className="h-4 w-4" />
            Adicionar primeiro banner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Position indicator */}
              <div className="flex flex-col items-center text-zinc-400">
                <GripVertical className="h-5 w-5" />
                <span className="mt-1 text-xs font-medium">{banner.position}</span>
              </div>

              {/* Image preview */}
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                <img
                  src={banner.image_url}
                  alt="Banner"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                {banner.link_url ? (
                  <a
                    href={banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{banner.link_url}</span>
                  </a>
                ) : (
                  <span className="text-sm text-zinc-400">Sem link</span>
                )}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Posição: {banner.position}
                </p>
              </div>

              {/* Status toggle */}
              <button
                onClick={() => handleToggle(banner.id, banner.active)}
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  banner.active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                aria-label={banner.active ? 'Desativar banner' : 'Ativar banner'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    banner.active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(banner)}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label="Editar banner"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  aria-label="Excluir banner"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editingBanner ? 'Editar Banner' : 'Novo Banner'}
        description={editingBanner ? 'Altere as informações do banner' : 'Adicione um novo banner ao painel'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Imagem {!editingBanner && '*'}
            </label>
            {imagePreview ? (
              <div className="relative mb-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-40 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(editingBanner?.image_url || null) }}
                  className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-blue-500/50">
                <Image className="h-8 w-8 text-zinc-400" />
                <span className="mt-2 text-sm text-zinc-500">Clique para selecionar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
            {imageFile && (
              <label className="mt-2 block">
                <span className="cursor-pointer text-xs text-blue-600 hover:underline dark:text-blue-400">
                  Alterar imagem
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Link URL */}
          <Input
            label="URL do Link"
            type="url"
            placeholder="https://exemplo.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />

          {/* Position */}
          <Input
            label="Posição"
            type="number"
            min="0"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            hint="Banners são exibidos em ordem crescente de posição"
          />

          {/* Active */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {active ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setModalOpen(false); resetForm() }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : editingBanner ? 'Salvar' : 'Criar Banner'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
