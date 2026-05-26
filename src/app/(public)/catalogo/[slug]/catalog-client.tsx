'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  Package,
  Loader2,
} from 'lucide-react'
import { submitCatalogQuote } from '@/actions/catalogo'
import type {
  PublicCatalogCompany,
  PublicCatalogProduct,
} from '@/actions/catalogo'

interface CartItem {
  product: PublicCatalogProduct
  quantity: number
}

interface CatalogClientProps {
  slug: string
  company: PublicCatalogCompany
  products: PublicCatalogProduct[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function CatalogClient({ slug, company, products }: CatalogClientProps) {
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    event_date: '',
    notes: '',
  })

  const cartItems = useMemo(() => Object.values(cart), [cart])
  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  )
  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  )

  function addToCart(product: PublicCatalogProduct) {
    setCart((prev) => {
      const existing = prev[product.id]
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: existing ? existing.quantity + 1 : 1,
        },
      }
    })
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      const existing = prev[productId]
      if (!existing) return prev
      return { ...prev, [productId]: { ...existing, quantity } }
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  function handleField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (cartItems.length === 0) {
      setError('Adicione ao menos um produto ao carrinho.')
      return
    }

    const payload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email || undefined,
      event_date: form.event_date,
      notes: form.notes || undefined,
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      })),
    }

    startTransition(async () => {
      const result = await submitCatalogQuote(slug, payload)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        setCart({})
        setCartOpen(false)
        setCheckout(false)
      }
    })
  }

  // ── Tela de sucesso ─────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Orçamento enviado!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            A empresa entrará em contato em breve para confirmar os detalhes.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-700"
          >
            Voltar ao catálogo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                <Package className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-zinc-900 sm:text-lg dark:text-zinc-50">
                {company.name}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Catálogo de produtos</p>
            </div>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-700"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Grade de produtos */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {products.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Package className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum produto disponível no momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product) => {
              const inCart = cart[product.id]
              return (
                <div
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {product.description}
                      </p>
                    )}
                    <p className="mt-2 text-base font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(product.price)}
                    </p>

                    <div className="mt-3">
                      {inCart ? (
                        <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <button
                            onClick={() => setQuantity(product.id, inCart.quantity - 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-l-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(product.id, inCart.quantity + 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-r-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Resumo flutuante do carrinho (mobile) */}
      {totalItems > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-xl bg-blue-700 px-5 py-3 text-white shadow-lg transition-colors hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-700"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="h-4 w-4" />
            {totalItems} {totalItems === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-sm font-bold">{formatCurrency(totalPrice)}</span>
        </button>
      )}

      {/* Drawer do carrinho */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {checkout ? 'Finalizar orçamento' : 'Seu carrinho'}
              </h2>
              <button
                onClick={() => setCartOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingCart className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Seu carrinho está vazio.
                  </p>
                </div>
              ) : !checkout ? (
                <ul className="space-y-3">
                  {cartItems.map((item) => (
                    <li
                      key={item.product.id}
                      className="flex gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                        {item.product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatCurrency(item.product.price)} cada
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                              onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              aria-label="Diminuir"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => setQuantity(item.product.id, item.quantity + 1)}
                              className="flex h-7 w-7 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              aria-label="Aumentar"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(item.product.price * item.quantity)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.customer_name}
                      onChange={handleField('customer_name')}
                      placeholder="Seu nome"
                      className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Telefone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.customer_phone}
                      onChange={handleField('customer_phone')}
                      placeholder="(00) 00000-0000"
                      className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={form.customer_email}
                      onChange={handleField('customer_email')}
                      placeholder="seu@email.com"
                      className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Data do evento *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.event_date}
                      onChange={handleField('event_date')}
                      className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Observações
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={handleField('notes')}
                      rows={3}
                      placeholder="Local do evento, horários, detalhes..."
                      className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Rodapé do drawer */}
            {cartItems.length > 0 && (
              <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Total estimado</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
                {!checkout ? (
                  <button
                    onClick={() => {
                      setError(null)
                      setCheckout(true)
                    }}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-700"
                  >
                    Continuar para dados
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckout(false)}
                      disabled={isPending}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={isPending}
                      className="inline-flex flex-[2] items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-700"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar orçamento'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
