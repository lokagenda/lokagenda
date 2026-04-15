'use client'

import { useState, useEffect, useTransition, use, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  listProductsForCompany,
  createProductForCompany,
  updateProductForCompany,
  deleteProductForCompany,
} from '@/actions/admin-company-items'
import { getCompanyDetails } from '@/actions/admin'
import { ArrowLeft, Plus, Pencil, Trash2, Package, Loader2, ImageIcon, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { compressImage, replaceInputFile } from '@/lib/compress-image'

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral'

const statusLabels: Record<string, { label: string; variant: StatusVariant }> = {
  active: { label: 'Ativo', variant: 'success' },
  inactive: { label: 'Inativo', variant: 'neutral' },
  maintenance: { label: 'Manutencao', variant: 'warning' },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AdminCompanyProductsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyId } = use(params)
  const [products, setProducts] = useState<any[]>([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    try {
      const [prods, company] = await Promise.all([
        listProductsForCompany(companyId),
        getCompanyDetails(companyId),
      ])
      setProducts(prods || [])
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
    setEditingProduct(null)
    setImagePreview(null)
    setModalOpen(true)
  }

  function openEditModal(product: any) {
    setEditingProduct(product)
    setImagePreview(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      try {
        let result
        if (editingProduct) {
          result = await updateProductForCompany(companyId, editingProduct.id, formData)
        } else {
          result = await createProductForCompany(companyId, formData)
        }

        if (result?.error) {
          toast.error(result.error)
          return
        }

        toast.success(editingProduct ? 'Produto atualizado!' : 'Produto criado!')
        setModalOpen(false)
        setEditingProduct(null)
        loadData()
      } catch (err: any) {
        toast.error(err.message || 'Erro ao salvar produto')
      }
    })
  }

  function handleDelete(productId: string) {
    startDeleteTransition(async () => {
      try {
        const result = await deleteProductForCompany(companyId, productId)
        if (result?.error) {
          toast.error(result.error)
          return
        }
        toast.success('Produto excluido!')
        setDeleteConfirm(null)
        loadData()
      } catch (err: any) {
        toast.error(err.message || 'Erro ao excluir produto')
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
              Produtos
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{companyName}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Cadastre produtos diretamente para esta empresa
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum produto encontrado para esta empresa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const st = statusLabels[product.status] || { label: product.status, variant: 'neutral' as StatusVariant }
            return (
              <Card key={product.id}>
                <CardContent className="p-4">
                  <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {product.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {product.name}
                      </h3>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    {product.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Estoque: {product.stock}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(product)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteConfirm(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null) }}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
        className="max-w-lg"
      >
        <form key={editingProduct?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nome *
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={editingProduct?.name || ''}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Nome do produto"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Descricao
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={editingProduct?.description || ''}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Descricao do produto"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Preco (R$)
              </label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editingProduct?.price ?? ''}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Estoque
              </label>
              <input
                name="stock"
                type="number"
                min="0"
                defaultValue={editingProduct?.stock ?? ''}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              name="status"
              defaultValue={
                editingProduct?.status === 'active' ? 'ativo'
                : editingProduct?.status === 'inactive' ? 'inativo'
                : editingProduct?.status === 'maintenance' ? 'manutencao'
                : 'ativo'
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="manutencao">Manutencao</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Imagem
            </label>
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const compressed = await compressImage(file)
                  replaceInputFile(fileInputRef.current, compressed)
                  setImagePreview(URL.createObjectURL(compressed))
                } catch {
                  toast.error('Erro ao processar imagem. Tente outra foto.')
                  e.target.value = ''
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-400 bg-zinc-50 p-3 transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-blue-400 dark:hover:bg-zinc-700"
            >
              <Upload className="h-5 w-5 text-zinc-400" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {imagePreview ? 'Imagem selecionada - clique para trocar' : 'Clique para selecionar uma imagem'}
              </span>
            </button>
            {(imagePreview || editingProduct?.image_url) && (
              <div className="mt-2">
                <img src={imagePreview || editingProduct?.image_url} alt="" className="h-16 w-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setModalOpen(false); setEditingProduct(null) }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {editingProduct ? 'Salvar' : 'Criar'}
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
          Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.
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
