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
  type: 'banner' | 'popup'
  created_at: string
}

type TabType = 'banner' | 'popup'

export default function BannersPage() {
  const [allBanners, setAllBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('banner')

  // Form state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [position, setPosition] = useState('0')
  const [active, setActive] = useState(true)
  const [formType, setFormType] = useState<TabType>('banner')

  const banners = allBanners.filter((b) => b.type === 'banner')
  const popups = allBanners.filter((b) => b.type === 'popup')
  const currentList = activeTab === 'banner' ? banners : popups

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

    if (data) setAllBanners(data as Banner[])
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
    setFormType(activeTab)
  }

  function openNewModal() {
    resetForm()
    setFormType(activeTab)
    setPosition(String(currentList.length))
    setModalOpen(true)
  }

  function openEditModal(banner: Banner) {
    setEditingBanner(banner)
    setImagePreview(banner.image_url)
    setImageFile(null)
    setLinkUrl(banner.link_url || '')
    setPosition(String(banner.position))
    setActive(banner.active)
    setFormType(banner.type)
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
      setToast({ type: 'error', message: 'Selecione uma imagem' })
      return
    }

    const typeList = formType === 'banner' ? banners : popups
    if (!editingBanner && typeList.length >= 5) {
      setToast({ type: 'error', message: `Limite maximo de 5 ${formType === 'popup' ? 'pop-ups' : 'banners'} atingido` })
      return
    }

    const formData = new FormData()
    if (imageFile) formData.append('image', imageFile)
    formData.append('link_url', linkUrl)
    formData.append('position', position)
    formData.append('active', String(active))
    formData.append('type', formType)

    startTransition(async () => {
      try {
        if (editingBanner) {
          await updateBanner(editingBanner.id, formData)
          setToast({ type: 'success', message: `${formType === 'popup' ? 'Pop-up' : 'Banner'} atualizado com sucesso` })
        } else {
          await createBanner(formData)
          setToast({ type: 'success', message: `${formType === 'popup' ? 'Pop-up' : 'Banner'} criado com sucesso` })
        }
        setModalOpen(false)
        resetForm()
        await loadBanners()
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar' })
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir?')) return

    startTransition(async () => {
      try {
        await deleteBanner(id)
        setToast({ type: 'success', message: 'Excluido com sucesso' })
        await loadBanners()
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao excluir' })
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
            Gerenciar Banners e Pop-ups
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os banners e pop-ups exibidos no painel
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => setActiveTab('banner')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'banner'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          Banners (retangular) — {banners.length}/5
        </button>
        <button
          onClick={() => setActiveTab('popup')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'popup'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          Pop-ups (quadrado) — {popups.length}/5
        </button>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button
          onClick={openNewModal}
          disabled={currentList.length >= 5}
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'popup' ? 'Novo Pop-up' : 'Novo Banner'}
        </Button>
      </div>

      {/* Banner / Popup list */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16 dark:border-zinc-700 dark:bg-zinc-900">
          <Megaphone className="h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {activeTab === 'popup' ? 'Nenhum pop-up cadastrado' : 'Nenhum banner cadastrado'}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            {activeTab === 'popup'
              ? 'Adicione pop-ups para exibir no painel'
              : 'Adicione banners para exibir no painel'}
          </p>
          <Button className="mt-4" onClick={openNewModal}>
            <Plus className="h-4 w-4" />
            {activeTab === 'popup' ? 'Adicionar primeiro pop-up' : 'Adicionar primeiro banner'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((banner) => (
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
              <div className={`shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 ${
                banner.type === 'popup' ? 'h-20 w-20' : 'h-20 w-32'
              }`}>
                <img
                  src={banner.image_url}
                  alt={banner.type === 'popup' ? 'Pop-up' : 'Banner'}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="mb-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    banner.type === 'popup'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {banner.type === 'popup' ? 'Pop-up' : 'Banner'}
                  </span>
                </div>
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
                  Posicao: {banner.position}
                </p>
              </div>

              {/* Status toggle */}
              <button
                onClick={() => handleToggle(banner.id, banner.active)}
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  banner.active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                aria-label={banner.active ? 'Desativar' : 'Ativar'}
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
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  aria-label="Excluir"
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
        title={editingBanner
          ? `Editar ${formType === 'popup' ? 'Pop-up' : 'Banner'}`
          : `Novo ${formType === 'popup' ? 'Pop-up' : 'Banner'}`
        }
        description={editingBanner
          ? `Altere as informacoes do ${formType === 'popup' ? 'pop-up' : 'banner'}`
          : `Adicione um novo ${formType === 'popup' ? 'pop-up' : 'banner'} ao painel`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as TabType)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="banner">Banner (retangular)</option>
              <option value="popup">Pop-up (quadrado)</option>
            </select>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {formType === 'popup'
                ? 'Formato quadrado (ex: 600x600)'
                : 'Formato retangular (ex: 1200x400)'}
            </p>
          </div>

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
                  className={`w-full object-cover ${formType === 'popup' ? 'h-40 max-w-[240px] mx-auto' : 'h-40'}`}
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
                <span className="mt-1 text-xs text-zinc-400">
                  {formType === 'popup' ? 'Formato quadrado (ex: 600x600)' : 'Formato retangular (ex: 1200x400)'}
                </span>
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
            label="Posicao"
            type="number"
            min="0"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            hint="Itens sao exibidos em ordem crescente de posicao"
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
              {isPending ? 'Salvando...' : editingBanner ? 'Salvar' : `Criar ${formType === 'popup' ? 'Pop-up' : 'Banner'}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
