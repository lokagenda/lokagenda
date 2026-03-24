'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createQuote, updateQuote } from '@/actions/quotes'
import { generateQuoteMessage, getWhatsAppUrl } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  MessageCircle,
  Search,
  X,
} from 'lucide-react'
import type { Product, Customer, Company } from '@/types/database'

interface QuoteItemForm {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditing = Boolean(editId)

  const [loading, setLoading] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventAddress, setEventAddress] = useState('')
  const [eventCity, setEventCity] = useState('')
  const [eventState, setEventState] = useState('')
  const [eventZip, setEventZip] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [freight, setFreight] = useState(0)
  const [items, setItems] = useState<QuoteItemForm[]>([])

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = subtotal - discount + freight

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) return

    const [productsRes, customersRes, companyRes] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name'),
      supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single(),
    ])

    setProducts(productsRes.data || [])
    setCustomers(customersRes.data || [])
    setCompany(companyRes.data)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load existing quote data when editing
  useEffect(() => {
    if (!editId) return

    async function loadQuote() {
      setLoadingQuote(true)
      const supabase = createClient()

      const [quoteRes, itemsRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', editId!).single(),
        supabase.from('quote_items').select('*').eq('quote_id', editId!),
      ])

      if (quoteRes.data) {
        const q = quoteRes.data
        setSelectedCustomerId(q.customer_id || null)
        setCustomerName(q.customer_name || '')
        setCustomerPhone(q.customer_phone || '')
        setCustomerEmail(q.customer_email || '')
        setCustomerSearch(q.customer_name || '')
        setEventDate(q.event_date || '')
        setEventAddress(q.event_address || '')
        setEventCity(q.event_city || '')
        setEventState(q.event_state || '')
        setEventZip(q.event_zip_code || '')
        setDeliveryTime(q.delivery_time || '')
        setPickupTime(q.pickup_time || '')
        setNotes(q.notes || '')
        setDiscount(q.discount || 0)
        setFreight(q.freight || 0)
      }

      if (itemsRes.data) {
        setItems(
          itemsRes.data.map((item) => ({
            product_id: item.product_id || null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          }))
        )
      }

      setLoadingQuote(false)
    }

    loadQuote()
  }, [editId])

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  )

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  function selectCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id)
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone || '')
    setCustomerEmail(customer.email || '')
    setCustomerSearch(customer.name)
    setShowCustomerDropdown(false)
  }

  function clearCustomer() {
    setSelectedCustomerId(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setCustomerSearch('')
  }

  function addProduct(product: Product) {
    const existing = items.find((i) => i.product_id === product.id)
    if (existing) {
      setItems(
        items.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: (i.quantity + 1) * i.unit_price,
              }
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
    setItems(
      items.map((item, i) =>
        i === index
          ? { ...item, quantity, subtotal: quantity * item.unit_price }
          : item
      )
    )
  }

  function updateItemPrice(index: number, price: number) {
    if (price < 0) return
    setItems(
      items.map((item, i) =>
        i === index
          ? { ...item, unit_price: price, subtotal: item.quantity * price }
          : item
      )
    )
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!customerName || !eventDate || items.length === 0) {
      alert('Preencha o cliente, data do evento e adicione pelo menos um item.')
      return
    }

    setLoading(true)
    const quoteData = {
      customer_id: selectedCustomerId,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      event_date: eventDate,
      event_address: eventAddress || undefined,
      event_city: eventCity || undefined,
      event_state: eventState || undefined,
      event_zip_code: eventZip || undefined,
      delivery_time: deliveryTime || undefined,
      pickup_time: pickupTime || undefined,
      notes: notes || undefined,
      discount,
      items,
    }

    const result = isEditing
      ? await updateQuote(editId!, quoteData)
      : await createQuote(quoteData)
    setLoading(false)

    if (result.error) {
      alert(result.error)
      return
    }

    const quoteId = isEditing ? editId! : (result as { id?: string }).id
    router.push(`/dashboard/orcamentos/${quoteId}`)
  }

  async function handleSendWhatsApp() {
    if (!customerName || !eventDate || items.length === 0) {
      alert('Preencha o cliente, data do evento e adicione pelo menos um item.')
      return
    }

    if (!customerPhone) {
      alert('Informe o telefone do cliente para enviar via WhatsApp.')
      return
    }

    setLoading(true)
    const quoteData = {
      customer_id: selectedCustomerId,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      event_date: eventDate,
      event_address: eventAddress || undefined,
      event_city: eventCity || undefined,
      event_state: eventState || undefined,
      event_zip_code: eventZip || undefined,
      delivery_time: deliveryTime || undefined,
      pickup_time: pickupTime || undefined,
      notes: notes || undefined,
      discount,
      items,
    }

    const result = isEditing
      ? await updateQuote(editId!, quoteData)
      : await createQuote(quoteData)
    setLoading(false)

    if (result.error) {
      alert(result.error)
      return
    }

    const quoteId = isEditing ? editId! : (result as { id?: string }).id

    // Build the WhatsApp message
    if (company) {
      const quoteObj = {
        id: quoteId!,
        company_id: company.id,
        customer_id: selectedCustomerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        event_date: eventDate,
        event_address: eventAddress,
        event_city: eventCity,
        event_state: eventState,
        event_zip_code: eventZip,
        delivery_time: deliveryTime,
        pickup_time: pickupTime,
        notes,
        status: 'pending' as const,
        total,
        discount,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const message = generateQuoteMessage(quoteObj, items, company)
      const url = getWhatsAppUrl(customerPhone, message)
      window.open(url, '_blank')
    }

    router.push(`/dashboard/orcamentos/${quoteId}`)
  }

  if (loadingQuote) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Carregando orçamento...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isEditing
              ? 'Edite os dados do orçamento'
              : 'Crie um novo orçamento para seu cliente'}
          </p>
        </div>
      </div>

      {/* Customer Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              label="Buscar cliente existente"
              placeholder="Digite o nome ou telefone..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerDropdown(true)
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            {selectedCustomerId && (
              <button
                onClick={clearCustomer}
                className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {filteredCustomers.slice(0, 5).map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">
                        {customer.name}
                      </div>
                      {customer.phone && (
                        <div className="text-xs text-zinc-500">{customer.phone}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Nome do cliente *"
              placeholder="Nome completo"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              label="Telefone"
              placeholder="(00) 00000-0000"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <Input
              label="E-mail"
              placeholder="email@exemplo.com"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Data do evento *"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              label="Horário de entrega"
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
            />
            <Input
              label="Horário de retirada"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Endereço"
              placeholder="Rua, número"
              value={eventAddress}
              onChange={(e) => setEventAddress(e.target.value)}
            />
            <Input
              label="Cidade"
              placeholder="Cidade"
              value={eventCity}
              onChange={(e) => setEventCity(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Estado"
              placeholder="UF"
              value={eventState}
              onChange={(e) => setEventState(e.target.value)}
            />
            <Input
              label="CEP"
              placeholder="00000-000"
              value={eventZip}
              onChange={(e) => setEventZip(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Products / Items */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add product search */}
          <div className="relative">
            <Input
              placeholder="Buscar produto para adicionar..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowProductDropdown(true)
              }}
              onFocus={() => setShowProductDropdown(true)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            {showProductDropdown && productSearch && filteredProducts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {filteredProducts.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
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
              {/* Header */}
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
                      onClick={() => updateItemQuantity(index, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {item.quantity}
                    </span>
                    <button
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
                      onClick={() => removeItem(index)}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Desconto</span>
                <div className="w-40">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Frete / Deslocamento</span>
                <div className="w-40">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={freight || ''}
                    onChange={(e) => setFreight(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Total
                </span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            rows={3}
            placeholder="Observações adicionais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4" />
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Rascunho'}
        </Button>
        <Button onClick={handleSendWhatsApp} disabled={loading}>
          <MessageCircle className="h-4 w-4" />
          {loading ? 'Salvando...' : 'Salvar e Enviar WhatsApp'}
        </Button>
      </div>
    </div>
  )
}
