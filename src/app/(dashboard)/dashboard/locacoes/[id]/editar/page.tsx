'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { use } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { updateRental } from '@/actions/rentals'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Loader2, Package, Search, Trash2 } from 'lucide-react'
import type { Rental, RentalItem, Product } from '@/types/database'

export default function EditarLocacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Array<{
    product_id: string | null
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_document: '',
    event_date: '',
    event_end_date: '',
    delivery_time: '',
    pickup_time: '',
    event_address: '',
    event_city: '',
    event_state: '',
    event_zip_code: '',
    notes: '',
    discount: 0,
    freight: 0,
  })

  const loadData = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const [rentalRes, itemsRes, productsRes] = await Promise.all([
      supabase.from('rentals').select('*').eq('id', id).single(),
      supabase.from('rental_items').select('*').eq('rental_id', id),
      profile
        ? supabase.from('products').select('*').eq('company_id', profile.company_id).eq('status', 'active').order('name')
        : Promise.resolve({ data: [] }),
    ])

    if (rentalRes.data) {
      const r = rentalRes.data as Rental
      setForm({
        customer_name: r.customer_name || '',
        customer_phone: r.customer_phone || '',
        customer_email: r.customer_email || '',
        customer_document: r.customer_document || '',
        event_date: r.event_date || '',
        event_end_date: (r as any).event_end_date || '',
        delivery_time: r.delivery_time || '',
        pickup_time: r.pickup_time || '',
        event_address: r.event_address || '',
        event_city: r.event_city || '',
        event_state: r.event_state || '',
        event_zip_code: r.event_zip_code || '',
        notes: r.notes || '',
        discount: r.discount || 0,
        freight: r.freight || 0,
      })
    }

    setItems((itemsRes.data || []).map((item: RentalItem) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    })))
    setProducts((productsRes as any).data || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'discount' || name === 'freight' ? parseFloat(value) || 0 : value,
    }))
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  function addProduct(product: Product) {
    const existing = items.find((i) => i.product_id === product.id)
    if (existing) {
      setItems(
        items.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
            : i
        )
      )
    } else {
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          subtotal: product.price,
        },
      ])
    }
    setProductSearch('')
    setShowProductDropdown(false)
  }

  function updateItemQuantity(index: number, quantity: number) {
    if (quantity < 1) return
    setItems(items.map((item, i) =>
      i === index ? { ...item, quantity, subtotal: quantity * item.unit_price } : item
    ))
  }

  function updateItemPrice(index: number, price: number) {
    if (price < 0) return
    setItems(items.map((item, i) =>
      i === index ? { ...item, unit_price: price, subtotal: item.quantity * price } : item
    ))
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = subtotal - form.discount + form.freight

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.customer_name.trim()) {
      toast.error('O nome do cliente é obrigatório.')
      return
    }
    if (!form.event_date) {
      toast.error('A data do evento é obrigatória.')
      return
    }

    setSaving(true)
    try {
      const result = await updateRental(id, {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        customer_document: form.customer_document || null,
        event_date: form.event_date,
        event_end_date: form.event_end_date || null,
        delivery_time: form.delivery_time || null,
        pickup_time: form.pickup_time || null,
        event_address: form.event_address || null,
        event_city: form.event_city || null,
        event_state: form.event_state || null,
        event_zip_code: form.event_zip_code || null,
        notes: form.notes || null,
        discount: form.discount,
        freight: form.freight,
        items: items.length > 0 ? items : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Locação atualizada com sucesso!')
        router.push(`/dashboard/locacoes/${id}`)
      }
    } catch {
      toast.error('Erro ao atualizar locação.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  const inputClasses =
    'w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500'
  const labelClasses = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/locacoes/${id}`}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Editar Locação
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Altere os dados da locação abaixo
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="customer_name" className={labelClasses}>
                  Nome *
                </label>
                <input
                  id="customer_name"
                  name="customer_name"
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="customer_phone" className={labelClasses}>
                  Telefone
                </label>
                <input
                  id="customer_phone"
                  name="customer_phone"
                  type="text"
                  value={form.customer_phone}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="customer_email" className={labelClasses}>
                  E-mail
                </label>
                <input
                  id="customer_email"
                  name="customer_email"
                  type="email"
                  value={form.customer_email}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="customer_document" className={labelClasses}>
                  Documento
                </label>
                <input
                  id="customer_document"
                  name="customer_document"
                  type="text"
                  value={form.customer_document}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="event_date" className={labelClasses}>
                  Data do Evento *
                </label>
                <input
                  id="event_date"
                  name="event_date"
                  type="date"
                  required
                  value={form.event_date}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="event_end_date" className={labelClasses}>
                  Data de Retirada
                </label>
                <input
                  id="event_end_date"
                  name="event_end_date"
                  type="date"
                  value={form.event_end_date}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="delivery_time" className={labelClasses}>
                  Horário de Entrega
                </label>
                <input
                  id="delivery_time"
                  name="delivery_time"
                  type="time"
                  value={form.delivery_time}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="pickup_time" className={labelClasses}>
                  Horário de Retirada
                </label>
                <input
                  id="pickup_time"
                  name="pickup_time"
                  type="time"
                  value={form.pickup_time}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="event_address" className={labelClasses}>
                  Endereço
                </label>
                <input
                  id="event_address"
                  name="event_address"
                  type="text"
                  value={form.event_address}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="event_city" className={labelClasses}>
                  Cidade
                </label>
                <input
                  id="event_city"
                  name="event_city"
                  type="text"
                  value={form.event_city}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event_state" className={labelClasses}>
                    Estado
                  </label>
                  <input
                    id="event_state"
                    name="event_state"
                    type="text"
                    maxLength={2}
                    value={form.event_state}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="event_zip_code" className={labelClasses}>
                    CEP
                  </label>
                  <input
                    id="event_zip_code"
                    name="event_zip_code"
                    type="text"
                    value={form.event_zip_code}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens da Locação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add product search */}
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar produto para adicionar..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setShowProductDropdown(true)
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  className={`${inputClasses} pl-9`}
                />
              </div>
              {showProductDropdown && productSearch && filteredProducts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {filteredProducts.slice(0, 8).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">
                          {product.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Estoque: {product.stock}
                        </div>
                      </div>
                      <div className="font-medium text-blue-700 dark:text-blue-400">
                        {formatCurrency(product.price)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items list */}
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum item adicionado. Busque um produto acima para adicionar.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-12 gap-4 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 md:grid">
                  <div className="col-span-5">Produto</div>
                  <div className="col-span-2">Preço Unit.</div>
                  <div className="col-span-2">Quantidade</div>
                  <div className="col-span-2">Subtotal</div>
                  <div className="col-span-1" />
                </div>

                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 md:grid-cols-12 md:gap-4"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50 md:col-span-5">
                      {item.product_name}
                    </div>
                    <div className="md:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItemPrice(index, Number(e.target.value))}
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(index, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(index, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50 md:col-span-2">
                      {formatCurrency(item.subtotal)}
                    </div>
                    <div className="flex justify-end md:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total summary */}
                <div className="mt-4 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-700">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-8">
                      <span className="text-zinc-500">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {form.discount > 0 && (
                      <div className="flex justify-between gap-8">
                        <span className="text-zinc-500">Desconto:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(form.discount)}</span>
                      </div>
                    )}
                    {form.freight > 0 && (
                      <div className="flex justify-between gap-8">
                        <span className="text-zinc-500">Frete:</span>
                        <span className="font-medium">+{formatCurrency(form.freight)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-8 border-t pt-1">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discount, Freight, Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Valores e Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="discount" className={labelClasses}>
                  Desconto (R$)
                </label>
                <input
                  id="discount"
                  name="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="freight" className={labelClasses}>
                  Frete / Deslocamento (R$)
                </label>
                <input
                  id="freight"
                  name="freight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.freight}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="notes" className={labelClasses}>
                  Observações
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/dashboard/locacoes/${id}`}>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </div>
  )
}
