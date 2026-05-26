'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import toast from 'react-hot-toast'
import { Ticket, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCoupon,
} from '@/actions/coupons'
import type { Coupon } from '@/types/database'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sem validade'
  return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function formatDiscount(coupon: Coupon) {
  return coupon.discount_type === 'percentage'
    ? `${coupon.discount_value}%`
    : formatCurrency(coupon.discount_value)
}

export default function AdminCuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [saving, setSaving] = useState(false)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')

  const load = useCallback(async () => {
    try {
      const data = await listCoupons()
      setCoupons(data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar cupons')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setDiscountType('percentage')
    setModalOpen(true)
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon)
    setDiscountType(coupon.discount_type)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const code = (form.elements.namedItem('code') as HTMLInputElement).value
    const discount_value = parseFloat((form.elements.namedItem('discount_value') as HTMLInputElement).value) || 0
    const duration_months = parseInt((form.elements.namedItem('duration_months') as HTMLInputElement).value) || 1
    const validUntilRaw = (form.elements.namedItem('valid_until') as HTMLInputElement).value
    const maxUsesRaw = (form.elements.namedItem('max_uses') as HTMLInputElement).value

    const payload = {
      code,
      discount_type: discountType,
      discount_value,
      duration_months,
      valid_until: validUntilRaw ? new Date(validUntilRaw).toISOString() : null,
      max_uses: maxUsesRaw ? parseInt(maxUsesRaw) : null,
    }

    setSaving(true)
    const result = editing
      ? await updateCoupon(editing.id, payload)
      : await createCoupon(payload)
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(editing ? 'Cupom atualizado!' : 'Cupom criado!')
      setModalOpen(false)
      setEditing(null)
      load()
    }
  }

  async function handleToggle(coupon: Coupon) {
    const result = await toggleCoupon(coupon.id)
    if ('error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success(coupon.active ? 'Cupom desativado!' : 'Cupom ativado!')
      load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cupom?')) return
    const result = await deleteCoupon(id)
    if ('error' in result) {
      toast.error(result.error || 'Erro')
    } else {
      toast.success('Cupom excluido!')
      load()
    }
  }

  // toInputDate: ISO -> yyyy-MM-dd para input type=date
  function toInputDate(dateStr: string | null) {
    if (!dateStr) return ''
    return new Date(dateStr).toISOString().slice(0, 10)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            <Ticket className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Cupons de Desconto
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Crie e gerencie cupons de desconto aplicados na assinatura.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Cupom
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500 dark:text-zinc-400">
            Nenhum cupom cadastrado. Clique em &quot;Novo Cupom&quot; para criar o primeiro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {coupon.code}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {coupon.discount_type === 'percentage' ? 'Percentual' : 'Valor fixo'}
                    </p>
                  </div>
                  <Badge variant={coupon.active ? 'success' : 'neutral'}>
                    {coupon.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Desconto</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-50">{formatDiscount(coupon)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Duracao</dt>
                    <dd className="text-zinc-700 dark:text-zinc-300">
                      {coupon.duration_months} {coupon.duration_months === 1 ? 'mes' : 'meses'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Validade</dt>
                    <dd className="text-zinc-700 dark:text-zinc-300">{formatDate(coupon.valid_until)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Usos</dt>
                    <dd className="text-zinc-700 dark:text-zinc-300">
                      {coupon.used_count}
                      {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ' / ∞'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(coupon.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={coupon.active ? 'secondary' : 'primary'}
                    className="ml-auto"
                    onClick={() => handleToggle(coupon)}
                  >
                    {coupon.active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Editar Cupom' : 'Novo Cupom'}
      >
        <form key={editing?.id || 'create'} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Codigo *</label>
            <input
              name="code"
              defaultValue={editing?.code || ''}
              required
              autoCapitalize="characters"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="EX: BEMVINDO10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo *</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Valor * {discountType === 'percentage' ? '(%)' : '(R$)'}
              </label>
              <input
                name="discount_value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing?.discount_value ?? ''}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Duracao (meses) *</label>
              <input
                name="duration_months"
                type="number"
                min="1"
                defaultValue={editing?.duration_months ?? 1}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Limite de usos</label>
              <input
                name="max_uses"
                type="number"
                min="1"
                defaultValue={editing?.max_uses ?? ''}
                placeholder="Ilimitado"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Validade (opcional)</label>
            <input
              name="valid_until"
              type="date"
              defaultValue={toInputDate(editing?.valid_until ?? null)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="mt-1 text-xs text-zinc-400">Deixe em branco para nunca expirar.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalOpen(false)
                setEditing(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
