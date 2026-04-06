'use client'

import { useState, useEffect, useTransition, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  listTemplatesForCompany,
  createTemplateForCompany,
  updateTemplateForCompany,
  deleteTemplateForCompany,
} from '@/actions/admin-company-items'
import { getCompanyDetails } from '@/actions/admin'
import { ArrowLeft, Plus, Pencil, Trash2, ScrollText, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminCompanyContractsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyId } = use(params)
  const [templates, setTemplates] = useState<any[]>([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  async function loadData() {
    try {
      const [tmpl, company] = await Promise.all([
        listTemplatesForCompany(companyId),
        getCompanyDetails(companyId),
      ])
      setTemplates(tmpl || [])
      setCompanyName(company?.name || '')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  function openCreateModal() {
    setEditingTemplate(null)
    setModalOpen(true)
  }

  function openEditModal(template: any) {
    setEditingTemplate(template)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const content = formData.get('content') as string
    const isDefault = formData.get('is_default') === 'on'

    startTransition(async () => {
      try {
        let result
        if (editingTemplate) {
          result = await updateTemplateForCompany(editingTemplate.id, name, content, isDefault, companyId)
        } else {
          result = await createTemplateForCompany(companyId, name, content, isDefault)
        }

        if (result?.error) {
          toast.error(result.error)
          return
        }

        toast.success(editingTemplate ? 'Modelo atualizado!' : 'Modelo criado!')
        setModalOpen(false)
        setEditingTemplate(null)
        loadData()
      } catch (err: any) {
        toast.error(err.message || 'Erro ao salvar modelo')
      }
    })
  }

  function handleDelete(templateId: string) {
    startDeleteTransition(async () => {
      try {
        const result = await deleteTemplateForCompany(templateId, companyId)
        if (result?.error) {
          toast.error(result.error)
          return
        }
        toast.success('Modelo excluido!')
        setDeleteConfirm(null)
        loadData()
      } catch (err: any) {
        toast.error(err.message || 'Erro ao excluir modelo')
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/empresas">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Modelos de Contrato
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{companyName}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Cadastre e edite contratos diretamente para esta empresa
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum modelo de contrato encontrado para esta empresa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {template.name}
                    </h3>
                    {template.is_default && (
                      <Badge variant="success">Padrao</Badge>
                    )}
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-4">
                      {template.content
                        ? template.content.replace(/<[^>]*>/g, '').substring(0, 200)
                        : 'Sem conteudo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(template)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteConfirm(template.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTemplate(null) }}
        title={editingTemplate ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato'}
        className="max-w-2xl"
      >
        <form key={editingTemplate?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nome *
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={editingTemplate?.name || ''}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Nome do modelo"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Conteudo (HTML) *
            </label>
            <textarea
              name="content"
              rows={12}
              required
              defaultValue={editingTemplate?.content || ''}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 font-mono"
              placeholder="Conteudo HTML do contrato..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              name="is_default"
              type="checkbox"
              id="is_default"
              defaultChecked={editingTemplate?.is_default || false}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="is_default" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Definir como modelo padrao
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setModalOpen(false); setEditingTemplate(null) }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar exclusao"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tem certeza que deseja excluir este modelo de contrato? Esta acao nao pode ser desfeita.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={isDeleting}
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  )
}
