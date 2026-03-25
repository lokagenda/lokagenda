'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { use } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { updateRentalStatus, cancelRental, deleteRental, recordPayment } from '@/actions/rentals'
import { generateContract, saveSignatures } from '@/actions/contracts'
import { getCompanySignature } from '@/actions/company'
import { buildFullAddress, getGoogleMapsUrl, getWazeUrl } from '@/lib/maps'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SignaturePad } from '@/components/signature-pad'
import {
  ArrowLeft,
  Truck,
  RotateCcw,
  XCircle,
  Trash2,
  MapPin,
  Navigation,
  FileText,
  Package,
  Loader2,
  CheckCircle2,
  DollarSign,
  PenTool,
  Download,
  Edit,
  MessageCircle,
} from 'lucide-react'
import type { Rental, RentalItem, Payment, Company } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  confirmed: {
    label: 'Confirmada',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  delivered: {
    label: 'Entregue',
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  returned: {
    label: 'Devolvida',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelada',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

const STATUS_FLOW: Record<string, { next: string; label: string; icon: typeof Truck }> = {
  confirmed: { next: 'delivered', label: 'Marcar como Entregue', icon: Truck },
  delivered: { next: 'returned', label: 'Marcar como Devolvida', icon: RotateCcw },
}

export default function LocacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [rental, setRental] = useState<Rental | null>(null)
  const [items, setItems] = useState<RentalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [contractLoading, setContractLoading] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [signatureClient, setSignatureClient] = useState<string | null>(null)
  const [signatureCompany, setSignatureCompany] = useState<string | null>(null)
  const [signatureSaving, setSignatureSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()

    const [rentalRes, itemsRes, paymentsRes] = await Promise.all([
      supabase.from('rentals').select('*').eq('id', id).single(),
      supabase.from('rental_items').select('*').eq('rental_id', id),
      supabase.from('payments').select('*').eq('rental_id', id).order('paid_at', { ascending: false }),
    ])

    setRental(rentalRes.data)
    setItems(itemsRes.data || [])
    setPayments(paymentsRes.data || [])

    // Load company for WhatsApp message
    if (rentalRes.data?.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', rentalRes.data.company_id)
        .single()
      setCompany(companyData)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleStatusAdvance() {
    if (!rental) return
    const flow = STATUS_FLOW[rental.status]
    if (!flow) return

    setActionLoading(true)
    const result = await updateRentalStatus(
      id,
      flow.next as Rental['status']
    )
    if (result.error) {
      alert(result.error)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Tem certeza que deseja cancelar esta locação? O estoque será restaurado.'))
      return
    setActionLoading(true)
    const result = await cancelRental(id)
    if (result.error) {
      alert(result.error)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta locação?')) return
    setActionLoading(true)
    const result = await deleteRental(id)
    if (result.error) {
      alert(result.error)
    } else {
      router.push('/dashboard/locacoes')
    }
    setActionLoading(false)
  }

  async function handleGenerateContract() {
    if (!rental) return
    setContractLoading(true)
    try {
      const result = await generateContract(rental.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrato gerado com sucesso!')
        await loadData()
      }
    } catch {
      toast.error('Erro ao gerar contrato.')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleRecordPayment() {
    if (!rental) return
    const amount = parseFloat(paymentAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    setPaymentLoading(true)
    try {
      const result = await recordPayment(rental.id, amount, paymentMethod)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Pagamento registrado com sucesso!')
        setPaymentAmount('')
        setPaymentMethod('pix')
        await loadData()
      }
    } catch {
      toast.error('Erro ao registrar pagamento.')
    } finally {
      setPaymentLoading(false)
    }
  }

  async function handleSaveSignatures() {
    if (!rental || (!signatureClient && !signatureCompany)) {
      toast.error('É necessário ao menos uma assinatura.')
      return
    }
    setSignatureSaving(true)
    try {
      const result = await saveSignatures(rental.id, signatureClient || '', signatureCompany || '')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Assinaturas salvas com sucesso!')
        setSignatureModalOpen(false)
        await loadData()
      }
    } catch {
      toast.error('Erro ao salvar assinaturas.')
    } finally {
      setSignatureSaving(false)
    }
  }

  async function handleExportPdf() {
    if (!rental) return
    setPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const container = pdfContainerRef.current
      if (!container) return

      container.innerHTML = ''
      container.style.width = '794px'
      container.style.padding = '40px'
      container.style.background = 'white'
      container.style.color = 'black'
      container.style.fontFamily = 'Arial, sans-serif'
      container.style.fontSize = '14px'
      container.style.lineHeight = '1.6'
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'

      const contractDiv = document.createElement('div')
      contractDiv.innerHTML = rental.contract_html || ''
      container.appendChild(contractDiv)

      const clientSig = rental.signature_client
      const companySig = rental.signature_company
      if (clientSig || companySig) {
        const sigSection = document.createElement('div')
        sigSection.style.marginTop = '40px'
        sigSection.style.display = 'flex'
        sigSection.style.justifyContent = 'space-between'
        sigSection.style.gap = '40px'

        if (clientSig) {
          const clientDiv = document.createElement('div')
          clientDiv.style.textAlign = 'center'
          clientDiv.style.flex = '1'
          const clientImg = document.createElement('img')
          clientImg.src = clientSig
          clientImg.style.maxWidth = '250px'
          clientImg.style.maxHeight = '120px'
          clientImg.style.display = 'block'
          clientImg.style.margin = '0 auto'
          clientDiv.appendChild(clientImg)
          const clientLine = document.createElement('div')
          clientLine.style.borderTop = '1px solid #333'
          clientLine.style.marginTop = '8px'
          clientLine.style.paddingTop = '8px'
          clientLine.textContent = 'Assinatura do Cliente'
          clientDiv.appendChild(clientLine)
          sigSection.appendChild(clientDiv)
        }

        if (companySig) {
          const companyDiv = document.createElement('div')
          companyDiv.style.textAlign = 'center'
          companyDiv.style.flex = '1'
          const companyImg = document.createElement('img')
          companyImg.src = companySig
          companyImg.style.maxWidth = '250px'
          companyImg.style.maxHeight = '120px'
          companyImg.style.display = 'block'
          companyImg.style.margin = '0 auto'
          companyDiv.appendChild(companyImg)
          const companyLine = document.createElement('div')
          companyLine.style.borderTop = '1px solid #333'
          companyLine.style.marginTop = '8px'
          companyLine.style.paddingTop = '8px'
          companyLine.textContent = 'Assinatura da Empresa'
          companyDiv.appendChild(companyLine)
          sigSection.appendChild(companyDiv)
        }

        container.appendChild(sigSection)
      }

      const images = container.querySelectorAll('img')
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
              } else {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              }
            })
        )
      )

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

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

      const clientName = rental.customer_name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
      const dateStr = rental.event_date.replace(/-/g, '')
      pdf.save(`${clientName}_${dateStr}.pdf`)

      toast.success('PDF exportado com sucesso!')
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      toast.error('Erro ao exportar PDF.')
    } finally {
      setPdfLoading(false)
      if (pdfContainerRef.current) {
        pdfContainerRef.current.innerHTML = ''
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  if (!rental) {
    return (
      <div className="py-20 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Locação não encontrada
        </h2>
        <Link href="/dashboard/locacoes">
          <Button variant="outline" className="mt-4">
            Voltar
          </Button>
        </Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[rental.status] || STATUS_CONFIG.confirmed
  const statusFlow = STATUS_FLOW[rental.status]
  const fullAddress = buildFullAddress({
    address: rental.event_address,
    city: rental.event_city,
    state: rental.event_state,
    zip: rental.event_zip_code,
  })

  return (
    <div className="space-y-6">
      {/* Hidden div for PDF generation */}
      <div ref={pdfContainerRef} aria-hidden="true" />

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
                Locação
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Evento em {formatDate(rental.event_date)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFlow && rental.status !== 'cancelled' && rental.status !== 'returned' && (
            <Button
              size="sm"
              onClick={handleStatusAdvance}
              disabled={actionLoading}
            >
              <statusFlow.icon className="h-4 w-4" />
              {statusFlow.label}
            </Button>
          )}
          {rental.status !== 'cancelled' && rental.status !== 'returned' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </Button>
          )}
          {rental.status !== 'cancelled' && rental.status !== 'returned' && (
            <Link href={`/dashboard/locacoes/${id}/editar`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </Link>
          )}
          {rental.contract_html ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (w) {
                    w.document.write(rental.contract_html!)
                    w.document.close()
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Ver Contrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateContract}
                disabled={contractLoading}
              >
                {contractLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Regerar Contrato
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateContract}
              disabled={contractLoading}
            >
              {contractLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Gerar Contrato
            </Button>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Nome
              </div>
              <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {rental.customer_name}
              </div>
            </div>
            {rental.customer_phone && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Telefone
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {rental.customer_phone}
                </div>
              </div>
            )}
            {rental.customer_email && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  E-mail
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {rental.customer_email}
                </div>
              </div>
            )}
            {rental.customer_document && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Documento
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {rental.customer_document}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Details + Map buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Data
              </div>
              <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                {formatDate(rental.event_date)}
              </div>
            </div>
            {rental.delivery_time && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Entrega
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {rental.delivery_time}
                </div>
              </div>
            )}
            {rental.pickup_time && (
              <div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Retirada
                </div>
                <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {rental.pickup_time}
                </div>
              </div>
            )}
          </div>

          {fullAddress && (
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Endereço
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-sm text-zinc-900 dark:text-zinc-50">
                  {fullAddress}
                </span>
                <div className="flex gap-2">
                  <a
                    href={getGoogleMapsUrl(fullAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <MapPin className="h-4 w-4" />
                      Google Maps
                    </Button>
                  </a>
                  <a
                    href={getWazeUrl(fullAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Navigation className="h-4 w-4" />
                      Waze
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Itens da Locação</CardTitle>
        </CardHeader>
        <CardContent>
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

          <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="text-zinc-900 dark:text-zinc-50">
                {formatCurrency(items.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>
            {rental.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Desconto</span>
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(rental.discount)}
                </span>
              </div>
            )}
            {rental.freight > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Frete / Deslocamento</span>
                <span className="text-zinc-900 dark:text-zinc-50">
                  +{formatCurrency(rental.freight)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total
              </span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(rental.total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status:</span>
            {rental.payment_status === 'paid' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Pago
              </span>
            ) : rental.payment_status === 'partial' ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Parcial
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                Pendente
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(rental.total)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Valor Pago</div>
              <div className="mt-1 text-sm font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(rental.amount_paid || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Restante</div>
              <div className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(Math.max(0, rental.total - (rental.amount_paid || 0)))}
              </div>
            </div>
          </div>

          {rental.payment_status === 'paid' ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                Pagamento completo
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500"
                />
              </div>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white py-2 px-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-blue-500"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
              </select>
              <Button
                size="sm"
                onClick={handleRecordPayment}
                disabled={paymentLoading || !paymentAmount}
              >
                {paymentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Registrar Pagamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contrato - Assinaturas e PDF */}
      {rental.contract_html && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (w) {
                    w.document.write(rental.contract_html!)
                    w.document.close()
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Ver Contrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setSignatureClient(rental.signature_client || null)
                  // Pre-populate company signature from saved company signature if not already signed
                  if (rental.signature_company) {
                    setSignatureCompany(rental.signature_company)
                  } else {
                    try {
                      const result = await getCompanySignature()
                      if (result.signatureUrl) {
                        setSignatureCompany(result.signatureUrl)
                      } else {
                        setSignatureCompany(null)
                      }
                    } catch {
                      setSignatureCompany(null)
                    }
                  }
                  setSignatureModalOpen(true)
                }}
              >
                <PenTool className="h-4 w-4" />
                Assinar Contrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Exportar PDF
              </Button>
              {rental.customer_phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const companyName = company?.name || 'Empresa'
                    const itemLines = items
                      .map(
                        (item, i) =>
                          `${i + 1}. ${item.product_name} - ${item.quantity}x ${formatCurrency(item.unit_price)}`
                      )
                      .join('\n')

                    const addressParts = [
                      rental.event_address,
                      rental.event_city,
                      rental.event_state,
                    ].filter(Boolean)

                    let message = `*CONTRATO DE LOCAÇÃO*\n`
                    message += `*${companyName}*\n\n`
                    message += `Cliente: ${rental.customer_name}\n`
                    message += `Data: ${formatDate(rental.event_date)}\n`
                    if (rental.delivery_time) message += `Entrega: ${rental.delivery_time}\n`
                    if (rental.pickup_time) message += `Retirada: ${rental.pickup_time}\n`
                    if (addressParts.length > 0) message += `Local: ${addressParts.join(', ')}\n`
                    message += `\nItens:\n${itemLines}\n\n`
                    message += `Total: ${formatCurrency(rental.total)}\n\n`
                    message += `Contrato disponível para assinatura.`

                    const url = getWhatsAppUrl(rental.customer_phone!, message)
                    window.open(url, '_blank')
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </Button>
              )}
            </div>

            {/* Show saved signatures */}
            {(rental.signature_client || rental.signature_company) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {rental.signature_client && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Assinatura do Cliente
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                      <img
                        src={rental.signature_client}
                        alt="Assinatura do Cliente"
                        className="mx-auto max-h-24"
                      />
                    </div>
                  </div>
                )}
                {rental.signature_company && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Assinatura da Empresa
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                      <img
                        src={rental.signature_company}
                        alt="Assinatura da Empresa"
                        className="mx-auto max-h-24"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signature Modal */}
      <Modal
        open={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        title="Assinar Contrato"
        description="Desenhe as assinaturas do cliente e da empresa."
        className="max-w-2xl"
      >
        <div className="space-y-6">
          <SignaturePad
            label="Assinatura do Cliente"
            onSave={(dataUrl) => setSignatureClient(dataUrl)}
            width={500}
            height={180}
          />

          {/* Company signature: show pre-populated if available, otherwise show pad */}
          {signatureCompany ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assinatura da Empresa
              </label>
              <div className="rounded-lg border border-green-300 bg-white p-2 dark:border-green-700 dark:bg-zinc-900">
                <img
                  src={signatureCompany}
                  alt="Assinatura da Empresa"
                  className="mx-auto max-h-[180px]"
                  style={{ maxWidth: 500 }}
                />
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                Assinatura carregada automaticamente
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSignatureCompany(null)}
              >
                Refazer Assinatura
              </Button>
            </div>
          ) : (
            <SignaturePad
              label="Assinatura da Empresa"
              onSave={(dataUrl) => setSignatureCompany(dataUrl)}
              width={500}
              height={180}
            />
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSignatureModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSignatures}
              disabled={signatureSaving || (!signatureClient && !signatureCompany)}
            >
              {signatureSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="h-4 w-4" />
              )}
              Salvar Assinaturas
            </Button>
          </div>
        </div>
      </Modal>

      {/* Notes */}
      {rental.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {rental.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quote Reference */}
      {rental.quote_id && (
        <Card>
          <CardContent className="py-4">
            <Link
              href={`/dashboard/orcamentos/${rental.quote_id}`}
              className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <FileText className="h-4 w-4" />
              Ver orçamento de origem
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
