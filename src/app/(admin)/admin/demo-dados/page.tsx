'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import toast from 'react-hot-toast'
import {
  Package, Users, FileText, Truck, Plus, Pencil, Trash2, Send, Loader2, ScrollText, Upload, ImageIcon,
} from 'lucide-react'
import {
  listDemoProducts, createDemoProduct, updateDemoProduct, deleteDemoProduct,
  listDemoCustomers, createDemoCustomer, updateDemoCustomer, deleteDemoCustomer,
  listDemoQuotes, createDemoQuote, updateDemoQuote, deleteDemoQuote,
  listDemoRentals, createDemoRental, updateDemoRental, deleteDemoRental,
  listDemoContracts, createDemoContract, updateDemoContract, deleteDemoContract,
  pushDemoDataToCompany, pushDemoDataToAllCompanies,
} from '@/actions/demo-data'
import { listCompaniesForSelect } from '@/actions/admin'

type Tab = 'produtos' | 'clientes' | 'orcamentos' | 'locacoes' | 'contratos'

interface DemoQuoteItem {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ── Products Tab ──────────────────────────────────────────

function ProductsTab() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await listDemoProducts()
      setProducts(data || [])
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar dados') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const result = editing
      ? await updateDemoProduct(editing.id, form)
      : await createDemoProduct(form)

    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Produto atualizado!' : 'Produto criado!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este produto demo?')) return
    const result = await deleteDemoProduct(id)
    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Produto excluido!')
      load()
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditing(null); setImagePreview(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4" /> Adicionar Produto
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {p.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatCurrency(p.price)}</p>
              <p className="text-xs text-zinc-400">Estoque: {p.stock}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(p); setImagePreview(null); setModalOpen(true) }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum produto demo encontrado.
            </CardContent>
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Editar Produto Demo' : 'Novo Produto Demo'}>
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome *</label>
            <input name="name" defaultValue={editing?.name || ''} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descricao</label>
            <textarea name="description" defaultValue={editing?.description || ''} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Preco</label>
              <input name="price" type="number" step="0.01" defaultValue={editing?.price || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estoque</label>
              <input name="stock" type="number" defaultValue={editing?.stock || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Imagem</label>
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setImagePreview(URL.createObjectURL(file))
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
            {(imagePreview || editing?.image_url) && (
              <div className="mt-2">
                <img src={imagePreview || editing?.image_url} alt="" className="h-16 w-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Customers Tab ─────────────────────────────────────────

function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const data = await listDemoCustomers()
      setCustomers(data || [])
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar dados') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const result = editing
      ? await updateDemoCustomer(editing.id, form)
      : await createDemoCustomer(form)

    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Cliente atualizado!' : 'Cliente criado!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente demo?')) return
    const result = await deleteDemoCustomer(id)
    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Cliente excluido!')
      load()
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4" /> Adicionar Cliente
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Nome</th>
              <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Telefone</th>
              <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Email</th>
              <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Documento</th>
              <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-3 text-zinc-900 dark:text-zinc-50">{c.name}</td>
                <td className="py-3 text-zinc-600 dark:text-zinc-300">{c.phone || '-'}</td>
                <td className="py-3 text-zinc-600 dark:text-zinc-300">{c.email || '-'}</td>
                <td className="py-3 text-zinc-600 dark:text-zinc-300">{c.document || '-'}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(c); setModalOpen(true) }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">Nenhum cliente demo encontrado.</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Editar Cliente Demo' : 'Novo Cliente Demo'} className="max-w-2xl">
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome *</label>
              <input name="name" defaultValue={editing?.name || ''} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Telefone</label>
              <input name="phone" defaultValue={editing?.phone || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input name="email" type="email" defaultValue={editing?.email || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Documento</label>
              <input name="document" defaultValue={editing?.document || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">CEP</label>
              <input name="zip_code" defaultValue={editing?.zip_code || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Endereco</label>
              <input name="address" defaultValue={editing?.address || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade</label>
              <input name="city" defaultValue={editing?.city || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado</label>
              <input name="state" defaultValue={editing?.state || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observacoes</label>
              <textarea name="notes" defaultValue={editing?.notes || ''} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Quotes Tab ────────────────────────────────────────────

function ItemsEditor({ items, onChange }: { items: DemoQuoteItem[]; onChange: (items: DemoQuoteItem[]) => void }) {
  function addItem() {
    onChange([...items, { product_name: '', quantity: 1, unit_price: 0, subtotal: 0 }])
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...items]
    const item = { ...updated[index], [field]: value }
    if (field === 'quantity' || field === 'unit_price') {
      item.subtotal = Number(item.quantity) * Number(item.unit_price)
    }
    updated[index] = item
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Itens</label>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="h-3 w-3" /> Item
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <input
              placeholder="Produto"
              value={item.product_name}
              onChange={(e) => updateItem(i, 'product_name', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              placeholder="Qtd"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="col-span-3">
            <input
              type="number"
              step="0.01"
              placeholder="Preco"
              value={item.unit_price}
              onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="col-span-2 text-sm text-zinc-500 dark:text-zinc-400 py-1.5">
            {formatCurrency(item.subtotal)}
          </div>
          <div className="col-span-1">
            <Button type="button" size="sm" variant="danger" onClick={() => removeItem(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuotesTab() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [items, setItems] = useState<DemoQuoteItem[]>([])

  const load = useCallback(async () => {
    try {
      const data = await listDemoQuotes()
      setQuotes(data || [])
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar dados') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setItems([{ product_name: '', quantity: 1, unit_price: 0, subtotal: 0 }])
    setModalOpen(true)
  }

  function openEdit(q: any) {
    setEditing(q)
    setItems((q.items as DemoQuoteItem[]) || [])
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = {
      customer_name: (form.elements.namedItem('customer_name') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('customer_phone') as HTMLInputElement).value || null,
      customer_email: (form.elements.namedItem('customer_email') as HTMLInputElement).value || null,
      event_date_offset: parseInt((form.elements.namedItem('event_date_offset') as HTMLInputElement).value) || 0,
      event_address: (form.elements.namedItem('event_address') as HTMLInputElement).value || null,
      event_city: (form.elements.namedItem('event_city') as HTMLInputElement).value || null,
      event_state: (form.elements.namedItem('event_state') as HTMLInputElement).value || null,
      delivery_time: (form.elements.namedItem('delivery_time') as HTMLInputElement).value || null,
      pickup_time: (form.elements.namedItem('pickup_time') as HTMLInputElement).value || null,
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value || null,
      discount: parseFloat((form.elements.namedItem('discount') as HTMLInputElement).value) || 0,
      freight: parseFloat((form.elements.namedItem('freight') as HTMLInputElement).value) || 0,
      items,
    }

    const result = editing
      ? await updateDemoQuote(editing.id, data)
      : await createDemoQuote(data)

    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Orcamento atualizado!' : 'Orcamento criado!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este orcamento demo?')) return
    const result = await deleteDemoQuote(id)
    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Orcamento excluido!')
      load()
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Adicionar Orcamento
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((q) => {
          const qItems = (q.items as DemoQuoteItem[]) || []
          const subtotal = qItems.reduce((s, it) => s + (it.subtotal || 0), 0)
          const total = subtotal - (q.discount || 0) + (q.freight || 0)
          return (
            <Card key={q.id}>
              <CardContent className="p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{q.customer_name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Evento: +{q.event_date_offset} dias</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{qItems.length} iten(s)</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(total)}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(q)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {quotes.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum orcamento demo encontrado.
            </CardContent>
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Editar Orcamento Demo' : 'Novo Orcamento Demo'} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cliente *</label>
              <input name="customer_name" defaultValue={editing?.customer_name || ''} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Telefone</label>
              <input name="customer_phone" defaultValue={editing?.customer_phone || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input name="customer_email" defaultValue={editing?.customer_email || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Dias ate o evento *</label>
              <input name="event_date_offset" type="number" defaultValue={editing?.event_date_offset ?? 7} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Endereco</label>
              <input name="event_address" defaultValue={editing?.event_address || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade</label>
              <input name="event_city" defaultValue={editing?.event_city || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado</label>
              <input name="event_state" defaultValue={editing?.event_state || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hora entrega</label>
              <input name="delivery_time" type="time" defaultValue={editing?.delivery_time || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hora retirada</label>
              <input name="pickup_time" type="time" defaultValue={editing?.pickup_time || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Desconto</label>
              <input name="discount" type="number" step="0.01" defaultValue={editing?.discount || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Frete</label>
              <input name="freight" type="number" step="0.01" defaultValue={editing?.freight || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observacoes</label>
              <textarea name="notes" defaultValue={editing?.notes || ''} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
          </div>
          <ItemsEditor items={items} onChange={setItems} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Rentals Tab ───────────────────────────────────────────

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmada',
  delivered: 'Entregue',
  returned: 'Devolvida',
}
const statusVariants: Record<string, 'success' | 'warning' | 'info'> = {
  confirmed: 'info',
  delivered: 'warning',
  returned: 'success',
}

function RentalsTab() {
  const [rentals, setRentals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [items, setItems] = useState<DemoQuoteItem[]>([])
  const [status, setStatus] = useState<'confirmed' | 'delivered' | 'returned'>('confirmed')

  const load = useCallback(async () => {
    try {
      const data = await listDemoRentals()
      setRentals(data || [])
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar dados') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setItems([{ product_name: '', quantity: 1, unit_price: 0, subtotal: 0 }])
    setStatus('confirmed')
    setModalOpen(true)
  }

  function openEdit(r: any) {
    setEditing(r)
    setItems((r.items as DemoQuoteItem[]) || [])
    setStatus(r.status || 'confirmed')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = {
      customer_name: (form.elements.namedItem('customer_name') as HTMLInputElement).value,
      customer_phone: (form.elements.namedItem('customer_phone') as HTMLInputElement).value || null,
      customer_email: (form.elements.namedItem('customer_email') as HTMLInputElement).value || null,
      customer_document: (form.elements.namedItem('customer_document') as HTMLInputElement).value || null,
      event_date_offset: parseInt((form.elements.namedItem('event_date_offset') as HTMLInputElement).value) || 0,
      event_address: (form.elements.namedItem('event_address') as HTMLInputElement).value || null,
      event_city: (form.elements.namedItem('event_city') as HTMLInputElement).value || null,
      event_state: (form.elements.namedItem('event_state') as HTMLInputElement).value || null,
      delivery_time: (form.elements.namedItem('delivery_time') as HTMLInputElement).value || null,
      pickup_time: (form.elements.namedItem('pickup_time') as HTMLInputElement).value || null,
      notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value || null,
      discount: parseFloat((form.elements.namedItem('discount') as HTMLInputElement).value) || 0,
      freight: parseFloat((form.elements.namedItem('freight') as HTMLInputElement).value) || 0,
      status,
      items,
    }

    const result = editing
      ? await updateDemoRental(editing.id, data)
      : await createDemoRental(data)

    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Locacao atualizada!' : 'Locacao criada!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta locacao demo?')) return
    const result = await deleteDemoRental(id)
    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Locacao excluida!')
      load()
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Adicionar Locacao
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rentals.map((r) => {
          const rItems = (r.items as DemoQuoteItem[]) || []
          const subtotal = rItems.reduce((s, it) => s + (it.subtotal || 0), 0)
          const total = subtotal - (r.discount || 0) + (r.freight || 0)
          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{r.customer_name}</h3>
                  <Badge variant={statusVariants[r.status] || 'neutral'}>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Evento: +{r.event_date_offset} dias</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{rItems.length} iten(s)</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(total)}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {rentals.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              Nenhuma locacao demo encontrada.
            </CardContent>
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Editar Locacao Demo' : 'Nova Locacao Demo'} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cliente *</label>
              <input name="customer_name" defaultValue={editing?.customer_name || ''} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Telefone</label>
              <input name="customer_phone" defaultValue={editing?.customer_phone || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input name="customer_email" defaultValue={editing?.customer_email || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Documento</label>
              <input name="customer_document" defaultValue={editing?.customer_document || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'confirmed' | 'delivered' | 'returned')}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="confirmed">Confirmada</option>
                <option value="delivered">Entregue</option>
                <option value="returned">Devolvida</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Dias ate o evento *</label>
              <input name="event_date_offset" type="number" defaultValue={editing?.event_date_offset ?? 7} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Endereco</label>
              <input name="event_address" defaultValue={editing?.event_address || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidade</label>
              <input name="event_city" defaultValue={editing?.event_city || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado</label>
              <input name="event_state" defaultValue={editing?.event_state || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hora entrega</label>
              <input name="delivery_time" type="time" defaultValue={editing?.delivery_time || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Hora retirada</label>
              <input name="pickup_time" type="time" defaultValue={editing?.pickup_time || ''} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Desconto</label>
              <input name="discount" type="number" step="0.01" defaultValue={editing?.discount || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Frete</label>
              <input name="freight" type="number" step="0.01" defaultValue={editing?.freight || 0} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observacoes</label>
              <textarea name="notes" defaultValue={editing?.notes || ''} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
          </div>
          <ItemsEditor items={items} onChange={setItems} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Contracts Tab ────────────────────────────────────────

function ContractsTab() {
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const data = await listDemoContracts()
      setContracts(data || [])
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar dados') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    // Convert checkbox to string 'true'/'false' for FormData
    form.set('is_default', form.get('is_default') === 'on' ? 'true' : 'false')

    const result = editing
      ? await updateDemoContract(editing.id, form)
      : await createDemoContract(form)

    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Contrato atualizado!' : 'Contrato criado!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este contrato demo?')) return
    const result = await deleteDemoContract(id)
    if (result && 'error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Contrato excluido!')
      load()
    }
  }

  function stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, '').slice(0, 120) + '...'
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Contrato
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum contrato demo encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</p>
                    {c.is_default && <Badge variant="success">Padrao</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">{stripHtml(c.content || '')}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c); setModalOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Editar Contrato Demo' : 'Novo Contrato Demo'} className="max-w-2xl">
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome *</label>
            <input name="name" defaultValue={editing?.name || ''} required className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Conteudo HTML *</label>
            <textarea name="content" defaultValue={editing?.content || ''} required rows={12} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="flex items-center gap-2">
            <input id="is_default_contract" name="is_default" type="checkbox" defaultChecked={editing?.is_default || false} className="h-4 w-4 rounded border-zinc-300" />
            <label htmlFor="is_default_contract" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Modelo padrao</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────

const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'orcamentos', label: 'Orcamentos', icon: FileText },
  { key: 'locacoes', label: 'Locacoes', icon: Truck },
  { key: 'contratos', label: 'Contratos', icon: ScrollText },
]

export default function AdminDemoDadosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('produtos')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [pushingAll, setPushingAll] = useState(false)
  const [pushingOne, setPushingOne] = useState(false)

  useEffect(() => {
    listCompaniesForSelect().then(setCompanies).catch(() => {})
  }, [])

  async function handlePushAll() {
    if (!confirm('Enviar dados demo para TODAS as empresas?')) return
    setPushingAll(true)
    try {
      const result = await pushDemoDataToAllCompanies()
      if ('error' in result) {
        toast.error(result.error || 'Erro')
      } else {
        toast.success(result.message || 'Dados demo enviados para todas as empresas!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar dados demo')
    }
    setPushingAll(false)
  }

  async function handlePushOne() {
    if (!selectedCompany) {
      toast.error('Selecione uma empresa')
      return
    }
    setPushingOne(true)
    try {
      const result = await pushDemoDataToCompany(selectedCompany)
      if ('error' in result) {
        toast.error(result.error || 'Erro')
      } else {
        toast.success('Dados demo enviados com sucesso!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar dados demo')
    }
    setPushingOne(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Dados Demo
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cadastre aqui produtos, clientes, orcamentos, locacoes e contratos de exemplo. Esses dados aparecem automaticamente em toda nova empresa que se registrar.
      </p>

      {/* Global Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Button variant="primary" onClick={handlePushAll} disabled={pushingAll}>
              {pushingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para Todas as Empresas
            </Button>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Empresa</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Selecione...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Button variant="outline" onClick={handlePushOne} disabled={pushingOne || !selectedCompany}>
                {pushingOne ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'produtos' && <ProductsTab />}
      {activeTab === 'clientes' && <CustomersTab />}
      {activeTab === 'orcamentos' && <QuotesTab />}
      {activeTab === 'locacoes' && <RentalsTab />}
      {activeTab === 'contratos' && <ContractsTab />}
    </div>
  )
}
