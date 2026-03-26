'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Edit, Trash2, Star, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface GlobalTemplate {
  id: string
  name: string
  content: string
  is_default: boolean
  created_at: string
}

export default function AdminContratosPage() {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  async function loadTemplates() {
    const supabase = createClient() as any
    const { data } = await supabase
      .from('global_contract_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  async function handleSave() {
    const supabase = createClient() as any
    if (!name.trim() || !content.trim()) {
      toast.error('Nome e conteúdo são obrigatórios')
      return
    }

    if (editingId) {
      const { error } = await supabase
        .from('global_contract_templates')
        .update({ name, content, is_default: isDefault })
        .eq('id', editingId)
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return }
      toast.success('Template atualizado!')
    } else {
      const { error } = await supabase
        .from('global_contract_templates')
        .insert({ name, content, is_default: isDefault })
      if (error) { toast.error('Erro ao criar: ' + error.message); return }
      toast.success('Template criado!')
    }

    setShowModal(false)
    setEditingId(null)
    setName('')
    setContent('')
    setIsDefault(false)
    loadTemplates()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este template?')) return
    const supabase = createClient() as any
    await supabase.from('global_contract_templates').delete().eq('id', id)
    toast.success('Template excluído')
    loadTemplates()
  }

  function openEdit(t: GlobalTemplate) {
    setEditingId(t.id)
    setName(t.name)
    setContent(t.content)
    setIsDefault(t.is_default)
    setShowModal(true)
  }

  function openNew() {
    setEditingId(null)
    setName('')
    setContent('')
    setIsDefault(false)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Contratos Globais</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Templates de contrato padrão para novas empresas
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <p className="font-medium text-zinc-900 dark:text-zinc-50">Nenhum template global</p>
            <p className="mt-1 text-sm text-zinc-500">Crie um template padrão que será copiado para novas empresas.</p>
            <Button onClick={openNew} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-zinc-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{t.name}</h3>
                      {t.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <Star className="h-3 w-3" />
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500">{t.content.substring(0, 100).replace(/<[^>]*>/g, '')}...</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Template' : 'Novo Template'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Contrato Padrão"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Conteúdo (HTML)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="<h1>CONTRATO DE LOCAÇÃO</h1>..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
            <span className="text-zinc-700 dark:text-zinc-300">Modelo padrão para novas empresas</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
