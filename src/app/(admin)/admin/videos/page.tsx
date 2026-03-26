'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Edit, Trash2, PlayCircle, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

interface Video {
  id: string
  title: string
  description: string | null
  youtube_id: string
  position: number
  active: boolean
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [position, setPosition] = useState(0)

  function extractYoutubeId(url: string): string {
    if (url.length === 11 && !url.includes('/')) return url
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : url
  }

  async function loadVideos() {
    const supabase = createClient() as any
    const { data } = await supabase
      .from('help_videos')
      .select('*')
      .order('position', { ascending: true })
    setVideos(data || [])
    setLoading(false)
  }

  useEffect(() => { loadVideos() }, [])

  async function handleSave() {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast.error('Título e link do YouTube são obrigatórios')
      return
    }
    const youtubeId = extractYoutubeId(youtubeUrl.trim())
    const supabase = createClient() as any

    if (editingId) {
      const { error } = await supabase
        .from('help_videos')
        .update({ title, description: description || null, youtube_id: youtubeId, position })
        .eq('id', editingId)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Vídeo atualizado!')
    } else {
      const { error } = await supabase
        .from('help_videos')
        .insert({ title, description: description || null, youtube_id: youtubeId, position: videos.length })
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Vídeo adicionado!')
    }
    closeModal()
    loadVideos()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este vídeo?')) return
    const supabase = createClient() as any
    await supabase.from('help_videos').delete().eq('id', id)
    toast.success('Vídeo excluído')
    loadVideos()
  }

  async function handleToggle(id: string, active: boolean) {
    const supabase = createClient() as any
    await supabase.from('help_videos').update({ active: !active }).eq('id', id)
    loadVideos()
  }

  function openEdit(v: Video) {
    setEditingId(v.id)
    setTitle(v.title)
    setDescription(v.description || '')
    setYoutubeUrl(v.youtube_id)
    setPosition(v.position)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setYoutubeUrl('')
    setPosition(0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Vídeos de Ajuda</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os vídeos tutoriais exibidos na Central de Ajuda ({videos.length} vídeos)
          </p>
        </div>
        <Button onClick={() => { closeModal(); setShowModal(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Vídeo
        </Button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PlayCircle className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <p className="font-medium text-zinc-900 dark:text-zinc-50">Nenhum vídeo cadastrado</p>
            <p className="mt-1 text-sm text-zinc-500">Adicione vídeos tutoriais do YouTube.</p>
            <Button onClick={() => { closeModal(); setShowModal(true) }} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar primeiro vídeo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Card key={v.id} className={`overflow-hidden ${!v.active ? 'opacity-50' : ''}`}>
              <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title}
                  className="h-full w-full object-cover"
                />
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition hover:opacity-100"
                >
                  <PlayCircle className="h-14 w-14 text-white" />
                </a>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{v.title}</h3>
                {v.description && <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{v.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggle(v.id, v.active)}>
                    {v.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={editingId ? 'Editar Vídeo' : 'Adicionar Vídeo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Ex: Como gerar um contrato"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Breve descrição do vídeo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Link do YouTube *</label>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="https://www.youtube.com/watch?v=... ou ID do vídeo"
            />
            {youtubeUrl && (
              <div className="mt-2 aspect-video overflow-hidden rounded-lg">
                <img
                  src={`https://img.youtube.com/vi/${extractYoutubeId(youtubeUrl)}/hqdefault.jpg`}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
