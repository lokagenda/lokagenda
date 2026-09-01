'use client'

import { useState, useRef, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Trash2,
  ImageIcon,
  Loader2,
  TrendingUp,
  History,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  updateProduct,
  deleteProduct,
  getProductHistory,
  type ProductHistory,
  type ProductHistoryRental,
} from '@/actions/products'
import { createBrowserClient } from '@supabase/ssr'
import { compressImage, replaceInputFile, MAX_UPLOAD_BYTES } from '@/lib/compress-image'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProductCalendar } from '@/components/product-calendar'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<ProductHistoryRental['status'], string> = {
  confirmed: 'Confirmada',
  delivered: 'Entregue',
  returned: 'Devolvida',
  cancelled: 'Cancelada',
}

const STATUS_VARIANTS: Record<
  ProductHistoryRental['status'],
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  confirmed: 'info',
  delivered: 'warning',
  returned: 'success',
  cancelled: 'danger',
}

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  track_stock: boolean | null
  cost_price: number | null
  status: string | null
  image_url: string | null
}

export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [trackStock, setTrackStock] = useState(true)
  const [history, setHistory] = useState<ProductHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showAllPast, setShowAllPast] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Arquivo ja comprimido — enviado explicitamente no submit (mesmo motivo
  // documentado em produtos/novo: DataTransfer falha calado em mobile).
  const arquivoComprimidoRef = useRef<File | null>(null)

  useEffect(() => {
    async function fetchProduct() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Buscar perfil do usuário para verificar company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile?.company_id ?? '')
        .single()

      if (error || !data) {
        toast.error('Produto não encontrado')
        router.push('/dashboard/produtos')
        return
      }

      setProduct(data)
      setTrackStock(data.track_stock !== false)
      if (data.image_url) {
        setPreview(data.image_url)
      }
      setLoadingData(false)
    }

    fetchProduct()
  }, [id, router])

  useEffect(() => {
    let active = true
    async function fetchHistory() {
      setLoadingHistory(true)
      try {
        const data = await getProductHistory(id)
        if (active) setHistory(data)
      } catch {
        if (active) setHistory(null)
      } finally {
        if (active) setLoadingHistory(false)
      }
    }
    fetchHistory()
    return () => {
      active = false
    }
  }, [id])

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG ou WEBP')
      e.target.value = ''
      return
    }

    try {
      const compressed = await compressImage(file)

      // Barra aqui o que estouraria o limite de upload — antes isso virava um
      // erro generico do servidor depois do upload inteiro subir.
      if (compressed.size > MAX_UPLOAD_BYTES) {
        const mb = (compressed.size / 1024 / 1024).toFixed(1)
        toast.error(
          `Esta imagem tem ${mb} MB e passa do limite de envio. ` +
            `Tire a foto de novo com qualidade menor, ou envie um print dela.`,
        )
        e.target.value = ''
        arquivoComprimidoRef.current = null
        return
      }

      arquivoComprimidoRef.current = compressed
      replaceInputFile(fileInputRef.current, compressed)
      setPreview(URL.createObjectURL(compressed))
    } catch {
      toast.error('Erro ao processar imagem. Tente outra foto.')
      e.target.value = ''
      arquivoComprimidoRef.current = null
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      // Garante que vai a versao comprimida, independente do DataTransfer.
      if (arquivoComprimidoRef.current) {
        formData.set('image', arquivoComprimidoRef.current)
      }
      await updateProduct(id, formData)
      toast.success('Produto atualizado com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar produto'
      if (message.includes('NEXT_REDIRECT')) {
        toast.success('Produto atualizado com sucesso!')
        return
      }
      const lower = message.toLowerCase()
      if (lower.includes('unexpected response') || lower.includes('failed to fetch') || lower.includes('body exceeded')) {
        toast.error('A imagem é muito grande. Tente outra foto.')
      } else {
        toast.error(message)
      }
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)

    try {
      await deleteProduct(id)
      toast.success('Produto excluído com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir produto'
      if (message.includes('NEXT_REDIRECT')) {
        toast.success('Produto excluído com sucesso!')
        return
      }
      toast.error(message)
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/produtos"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Editar Produto</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{product.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Tem certeza que deseja excluir o produto <strong>{product.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Nome */}
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nome do produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={product.name}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Descrição */}
          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={product.description || ''}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Preço */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Preço de locação (R$)
            </label>
            <input
              type="number"
              id="price"
              name="price"
              min="0"
              step="0.01"
              defaultValue={product.price}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Preço de custo */}
          <div>
            <label htmlFor="cost_price" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Preço de custo (R$)
            </label>
            <input
              type="number"
              id="cost_price"
              name="cost_price"
              min="0"
              step="0.01"
              placeholder="0,00"
              defaultValue={product.cost_price ?? ''}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Controlar estoque */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="track_stock"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
              />
              Controlar estoque
            </label>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Desmarque para produtos sem limite de quantidade (ex: pipoca, algodão doce).
            </p>
          </div>

          {/* Quantidade */}
          {trackStock && (
            <div>
              <label htmlFor="stock" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Quantidade em estoque
              </label>
              <input
                type="number"
                id="stock"
                name="stock"
                min="0"
                step="1"
                defaultValue={product.stock}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={product.status || 'active'}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="maintenance">Manutenção</option>
            </select>
          </div>

          {/* Imagem */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Imagem do produto
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 p-6 transition-colors hover:border-zinc-400 dark:hover:border-zinc-500"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-40 w-40 rounded-lg object-cover"
                />
              ) : (
                <>
                  <ImageIcon className="h-10 w-10 text-zinc-400 dark:text-zinc-500 mb-2" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Clique para selecionar uma imagem</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">PNG, JPG ou WEBP</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-700 pt-6">
          <Link
            href="/dashboard/produtos"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </form>

      {/* Histórico e Desempenho */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Histórico e Desempenho
          </h2>
        </div>

        {loadingHistory ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </CardContent>
          </Card>
        ) : !history ? (
          <Card>
            <CardContent className="py-6 text-sm text-zinc-500 dark:text-zinc-400">
              Não foi possível carregar o histórico deste produto.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total já rendido */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <DollarSign className="h-4 w-4" />
                    Total já rendido
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(history.totalEarned)}
                  </p>
                </CardContent>
              </Card>

              {/* Vezes locado */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <Calendar className="h-4 w-4" />
                    Vezes locado
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {history.timesRented}
                  </p>
                </CardContent>
              </Card>

              {/* Preço de custo */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <DollarSign className="h-4 w-4" />
                    Preço de custo
                  </div>
                  <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {history.costPrice != null ? formatCurrency(history.costPrice) : '—'}
                  </p>
                </CardContent>
              </Card>

              {/* ROI */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <TrendingUp className="h-4 w-4" />
                    ROI
                  </div>
                  {history.roi ? (
                    <>
                      <p
                        className={`mt-2 text-2xl font-bold ${
                          history.roi.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {history.roi.multiplier.toFixed(1)}x
                      </p>
                      <p
                        className={`mt-1 text-sm font-medium ${
                          history.roi.profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {history.roi.profit >= 0 ? 'Lucro ' : 'Prejuízo '}
                        {formatCurrency(history.roi.profit)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Cadastre o preço de custo para ver o ROI.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Calendário de ocupação */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Calendário de ocupação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductCalendar
                  bookings={[...history.futureRentals, ...history.pastRentals].map((r) => ({
                    eventDate: r.eventDate,
                    customerName: r.customerName,
                    quantity: r.quantity,
                  }))}
                />
              </CardContent>
            </Card>

            {/* Próximas locações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Próximas locações
                  <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
                    ({history.futureRentals.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.futureRentals.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma locação futura agendada para este produto.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {history.futureRentals.map((rental) => (
                      <li key={rental.rentalId}>
                        <Link
                          href={`/dashboard/locacoes/${rental.rentalId}`}
                          className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {rental.customerName}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {formatDate(rental.eventDate)} · Qtd: {rental.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge variant={STATUS_VARIANTS[rental.status]}>
                              {STATUS_LABELS[rental.status]}
                            </Badge>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {formatCurrency(rental.subtotal)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Locações anteriores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  Locações anteriores
                  <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
                    ({history.pastRentals.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.pastRentals.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Este produto ainda não foi locado.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {(showAllPast
                        ? history.pastRentals
                        : history.pastRentals.slice(0, 10)
                      ).map((rental) => (
                        <li key={rental.rentalId}>
                          <Link
                            href={`/dashboard/locacoes/${rental.rentalId}`}
                            className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 rounded-lg"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                {rental.customerName}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {formatDate(rental.eventDate)} · Qtd: {rental.quantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant={STATUS_VARIANTS[rental.status]}>
                                {STATUS_LABELS[rental.status]}
                              </Badge>
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {formatCurrency(rental.subtotal)}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {history.pastRentals.length > 10 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPast((v) => !v)}
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {showAllPast ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Ver menos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Ver todas ({history.pastRentals.length})
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  )
}
