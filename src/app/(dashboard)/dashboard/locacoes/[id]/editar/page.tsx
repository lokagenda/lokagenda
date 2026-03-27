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
import { ArrowLeft, Save, Loader2, Package } from 'lucide-react'
import type { Rental, RentalItem } from '@/types/database'

export default function EditarLocacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<RentalItem[]>([])
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

    const [rentalRes, itemsRes] = await Promise.all([
      supabase.from('rentals').select('*').eq('id', id).single(),
      supabase.from('rental_items').select('*').eq('rental_id', id),
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

    setItems(itemsRes.data || [])
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

        {/* Items (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens da Locação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Os itens são exibidos apenas para consulta. Para alterar itens, crie uma nova locação.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Produto
                    </th>
                    <th className="pb-3 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Preço Unit.
                    </th>
                    <th className="pb-3 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Qtd
                    </th>
                    <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 text-zinc-900 dark:text-zinc-50">
                        {item.product_name}
                      </td>
                      <td className="py-3 pr-4 text-right text-zinc-600 dark:text-zinc-400">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-3 pr-4 text-right text-zinc-600 dark:text-zinc-400">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
