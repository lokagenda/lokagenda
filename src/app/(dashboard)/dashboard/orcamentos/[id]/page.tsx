'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  updateQuoteStatus,
  deleteQuote,
  convertQuoteToRental,
} from '@/actions/quotes'
import { generateQuoteMessage, getWhatsAppUrl } from '@/lib/whatsapp'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  X,
  RefreshCw,
  MessageCircle,
  Trash2,
  Edit,
  FileText,
  FileDown,
  Loader2,
  Package,
} from 'lucide-react'
import type { Quote, QuoteItem, Company } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: {
    label: 'Pendente',
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    label: 'Aprovado',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    label: 'Rejeitado',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  converted: {
    label: 'Convertido',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  expired: {
    label: 'Expirado',
    classes: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
}

export default function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

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

    const [quoteRes, itemsRes, companyRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', id).single(),
      supabase.from('quote_items').select('*, products:product_id(image_url)').eq('quote_id', id),
      supabase.from('companies').select('*').eq('id', profile.company_id).single(),
    ])

    setQuote(quoteRes.data)
    setItems(itemsRes.data || [])
    setCompany(companyRes.data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleStatusChange(status: Quote['status']) {
    setActionLoading(true)
    const result = await updateQuoteStatus(id, status)
    if (result.error) {
      alert(result.error)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  async function handleConvert() {
    if (!confirm('Converter este orçamento em locação? O estoque será reduzido.')) return
    setActionLoading(true)
    const result = await convertQuoteToRental(id)
    if (result.error) {
      alert(result.error)
    } else {
      router.push(`/dashboard/locacoes/${result.rentalId}`)
    }
    setActionLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return
    setActionLoading(true)
    const result = await deleteQuote(id)
    if (result.error) {
      alert(result.error)
    } else {
      router.push('/dashboard/orcamentos')
    }
    setActionLoading(false)
  }

  function handleWhatsApp() {
    if (!quote || !company) return
    if (!quote.customer_phone) {
      alert('Cliente sem telefone cadastrado.')
      return
    }
    const message = generateQuoteMessage(quote, items, company)
    const url = getWhatsAppUrl(quote.customer_phone, message)
    window.open(url, '_blank')
  }

  async function handleExportPdf() {
    if (!quote) return
    setPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const fmt = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

      const fmtDate = (d: string | null | undefined) => {
        if (!d) return '—'
        const [y, m, day] = d.split('-')
        return `${day}/${m}/${y}`
      }

      const subtotal = items.reduce((s, i) => s + i.subtotal, 0)

      const addressParts = [
        quote.event_address,
        quote.event_city,
        quote.event_state,
        quote.event_zip_code,
      ].filter(Boolean).join(', ')

      const itemsHtml = items.map((item: any) => {
        const imgCell = item.products?.image_url
          ? `<img src="${item.products.image_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" crossorigin="anonymous" />`
          : `<div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 4px;"></div>`
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${imgCell}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
          <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${fmt(item.unit_price)}</td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${fmt(item.subtotal)}</td>
        </tr>`
      }).join('')

      const logoHtml = company?.logo_url
        ? `<div style="text-align: center; margin-bottom: 24px;"><img src="${company.logo_url}" style="max-height: 80px;" crossorigin="anonymous" /></div>`
        : ''

      const notesHtml = quote.notes
        ? `<div style="margin-top: 24px; padding: 12px; background: #fafafa; border-radius: 8px;"><strong>Observações:</strong><br/><span style="white-space: pre-wrap;">${quote.notes}</span></div>`
        : ''

      const html = `
        <div style="padding: 40px; font-family: Arial, sans-serif; max-width: 794px; background: white; color: #1a1a1a;">
          ${logoHtml}
          <h1 style="text-align: center; font-size: 24px; margin-bottom: 24px; color: #1a1a1a;">ORÇAMENTO</h1>
          <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
            <div>
              <strong>${company?.name || ''}</strong><br/>
              ${company?.phone || ''}<br/>
              ${(company as any)?.document || ''}
            </div>
            <div style="text-align: right;">
              <strong>Cliente:</strong> ${quote.customer_name}<br/>
              ${quote.customer_phone ? `<strong>Telefone:</strong> ${quote.customer_phone}<br/>` : ''}
              ${quote.customer_email ? `<strong>Email:</strong> ${quote.customer_email}` : ''}
            </div>
          </div>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 24px;">
            <strong>Data do Evento:</strong> ${fmtDate(quote.event_date)}<br/>
            ${addressParts ? `<strong>Local:</strong> ${addressParts}<br/>` : ''}
            ${quote.delivery_time ? `<strong>Entrega:</strong> ${quote.delivery_time}` : ''}
            ${quote.delivery_time && quote.pickup_time ? ' | ' : ''}
            ${quote.pickup_time ? `<strong>Retirada:</strong> ${quote.pickup_time}` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Foto</th>
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Produto</th>
                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Qtd</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Valor Un.</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="text-align: right; line-height: 2;">
            Subtotal: ${fmt(subtotal)}<br/>
            ${quote.discount > 0 ? `Desconto: -${fmt(quote.discount)}<br/>` : ''}
            ${quote.freight > 0 ? `Frete: +${fmt(quote.freight)}<br/>` : ''}
            <strong style="font-size: 18px;">Total: ${fmt(quote.total)}</strong>
          </div>
          ${notesHtml}
        </div>
      `

      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '794px'
      container.innerHTML = html
      document.body.appendChild(container)

      const images = container.querySelectorAll('img')
      await Promise.all(
        Array.from(images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
        )
      )

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      document.body.removeChild(container)

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight

      while (heightLeft > 0) {
        position = position - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
      }

      const customerName = quote.customer_name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
      const dateStr = quote.event_date?.replace(/-/g, '') || 'sem_data'
      pdf.save(`orcamento_${customerName}_${dateStr}.pdf`)

      alert('PDF exportado com sucesso!')
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      alert('Erro ao exportar PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="py-20 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Orçamento não encontrado
        </h2>
        <Link href="/dashboard/orcamentos">
          <Button variant="outline" className="mt-4">
            Voltar
          </Button>
        </Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.pending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Orçamento
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Criado em {formatDate(quote.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(quote.status === 'pending' || quote.status === 'approved') && (
            <>
              <Button
                size="sm"
                onClick={handleConvert}
                disabled={actionLoading}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <RefreshCw className="h-4 w-4" />
                Converter em Locação
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('rejected')}
                disabled={actionLoading}
              >
                <X className="h-4 w-4" />
                Cancelar Orçamento
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleWhatsApp}
            disabled={actionLoading}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exportar PDF
          </Button>
          {quote.status === 'pending' && (
            <Link href={`/dashboard/orcamentos/novo?edit=${id}`}>
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </Link>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Nome
              </div>
              <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {quote.customer_name}
              </div>
            </div>
            {quote.customer_phone && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Telefone
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {quote.customer_phone}
                </div>
              </div>
            )}
            {quote.customer_email && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  E-mail
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {quote.customer_email}
                </div>
              </div>
            )}
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
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Data
              </div>
              <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {formatDate(quote.event_date)}
              </div>
            </div>
            {(quote as any).event_end_date && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Retirada
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {formatDate((quote as any).event_end_date)}
                </div>
              </div>
            )}
            {quote.delivery_time && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Entrega
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {quote.delivery_time}
                </div>
              </div>
            )}
            {quote.pickup_time && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Retirada
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {quote.pickup_time}
                </div>
              </div>
            )}
            {quote.event_address && (
              <div className="md:col-span-3">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Endereço
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {[
                    quote.event_address,
                    quote.event_city,
                    quote.event_state,
                    quote.event_zip_code,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Foto
                  </th>
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
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3">
                      {item.products?.image_url ? (
                        <img src={item.products.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                          <Package className="h-5 w-5 text-zinc-400" />
                        </div>
                      )}
                    </td>
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

          <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="text-zinc-900 dark:text-zinc-50">
                {formatCurrency(items.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Desconto</span>
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(quote.discount)}
                </span>
              </div>
            )}
            {quote.freight > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Frete / Deslocamento</span>
                <span className="text-zinc-900 dark:text-zinc-50">
                  +{formatCurrency(quote.freight)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total
              </span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(quote.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {quote.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
