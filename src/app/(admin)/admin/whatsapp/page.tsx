'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageCircle,
  Settings,
  FileText,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  testWhatsAppConnection,
  listWhatsAppTemplates,
  updateWhatsAppTemplate,
  listWhatsAppLogs,
} from '@/actions/admin-whatsapp'
import type { WhatsAppProvider } from '@/lib/whatsapp-api/types'

// ── Types ─────────────────────────────────────────────────

type ConfigData = {
  provider: WhatsAppProvider
  api_url: string
  api_key: string
  instance_id: string
  phone_number_id: string
}

type TemplateRow = {
  id: string
  slug: string
  name: string
  content: string
  active: boolean
}

type LogRow = {
  id: string
  created_at: string
  phone: string
  template_slug: string | null
  status: string
  error_message: string | null
  companies: { name: string } | null
}

// ── Provider Config Fields ────────────────────────────────

const providerOptions: { value: WhatsAppProvider; label: string }[] = [
  { value: 'evolution_api', label: 'Evolution API' },
  { value: 'z_api', label: 'Z-API' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'meta_cloud', label: 'Meta Cloud API' },
]

function getProviderFields(provider: WhatsAppProvider) {
  switch (provider) {
    case 'evolution_api':
      return [
        { key: 'api_url', label: 'API URL', placeholder: 'https://api.evolution.com' },
        { key: 'api_key', label: 'API Key', placeholder: 'Sua API Key' },
        { key: 'instance_id', label: 'Instance ID', placeholder: 'Seu Instance ID' },
      ]
    case 'z_api':
      return [
        { key: 'api_url', label: 'API URL', placeholder: 'https://api.z-api.io' },
        { key: 'api_key', label: 'Token', placeholder: 'Seu Token da instancia' },
        { key: 'instance_id', label: 'Instance ID', placeholder: 'Seu Instance ID' },
        { key: 'phone_number_id', label: 'Client-Token (Seguranca)', placeholder: 'Token de seguranca da conta (opcional)' },
      ]
    case 'twilio':
      return [
        { key: 'instance_id', label: 'Account SID', placeholder: 'ACxxxxxxxxx' },
        { key: 'api_key', label: 'Auth Token', placeholder: 'Seu Auth Token' },
        { key: 'phone_number_id', label: 'Numero Remetente', placeholder: '5511999999999' },
      ]
    case 'meta_cloud':
      return [
        { key: 'api_key', label: 'Access Token', placeholder: 'Seu Access Token' },
        { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'ID do numero' },
      ]
  }
}

// ── Main Page Component ───────────────────────────────────

export default function AdminWhatsAppPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'templates' | 'logs'>('config')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-7 w-7 text-emerald-500" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          WhatsApp
        </h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'config'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuracao
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          <FileText className="h-4 w-4" />
          Templates
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          }`}
        >
          <Clock className="h-4 w-4" />
          Logs
        </button>
      </div>

      {activeTab === 'config' && <ConfigSection />}
      {activeTab === 'templates' && <TemplatesSection />}
      {activeTab === 'logs' && <LogsSection />}
    </div>
  )
}

// ── Section 1: Provider Configuration ─────────────────────

function ConfigSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [config, setConfig] = useState<ConfigData>({
    provider: 'evolution_api',
    api_url: '',
    api_key: '',
    instance_id: '',
    phone_number_id: '',
  })

  useEffect(() => {
    getWhatsAppConfig()
      .then((data) => {
        if (data) {
          setConfig({
            provider: data.provider as WhatsAppProvider,
            api_url: data.api_url || '',
            api_key: data.api_key || '',
            instance_id: data.instance_id || '',
            phone_number_id: data.phone_number_id || '',
          })
        }
      })
      .catch(() => toast.error('Erro ao carregar configuracao'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await saveWhatsAppConfig({
        provider: config.provider,
        api_url: config.api_url || null,
        api_key: config.api_key || null,
        instance_id: config.instance_id || null,
        phone_number_id: config.phone_number_id || null,
      })
      toast.success('Configuracao salva com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testPhone.trim()) {
      toast.error('Informe um numero para teste')
      return
    }
    setTesting(true)
    try {
      const result = await testWhatsAppConnection(testPhone)
      if (result.success) {
        toast.success('Mensagem de teste enviada!')
      } else {
        toast.error('Falha ao enviar mensagem de teste')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const fields = getProviderFields(config.provider)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuracao do Provedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Provedor
          </label>
          <select
            value={config.provider}
            onChange={(e) =>
              setConfig({ ...config, provider: e.target.value as WhatsAppProvider })
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {providerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Fields */}
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {field.label}
            </label>
            <input
              type="text"
              value={(config as any)[field.key] || ''}
              onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>

        {/* Test Connection */}
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Testar Conexao
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Numero do telefone (ex: 5511999999999)"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Section 2: Templates ──────────────────────────────────

function TemplatesSection() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<Record<string, { name: string; content: string; active: boolean }>>({})

  const load = useCallback(() => {
    listWhatsAppTemplates()
      .then((data) => {
        setTemplates(data as TemplateRow[])
        const state: typeof editState = {}
        for (const t of data as TemplateRow[]) {
          state[t.id] = { name: t.name, content: t.content, active: t.active }
        }
        setEditState(state)
      })
      .catch(() => toast.error('Erro ao carregar templates'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function updateField(id: string, field: string, value: string | boolean) {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  async function handleSave(id: string) {
    const state = editState[id]
    if (!state) return
    setSavingId(id)
    try {
      await updateWhatsAppTemplate(id, state)
      toast.success('Template salvo!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSavingId(null)
    }
  }

  function getPreview(content: string) {
    return content
      .replace(/\{\{nome_empresa\}\}/g, 'Empresa Exemplo')
      .replace(/\{\{data_validade\}\}/g, '01/01/2027')
      .replace(/\{\{dias_restantes\}\}/g, '3')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => {
        const state = editState[template.id]
        if (!state) return null

        return (
          <Card key={template.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    {template.slug}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.active}
                    onChange={(e) => updateField(template.id, 'active', e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-zinc-600 dark:text-zinc-400">Ativo</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nome
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => updateField(template.id, 'name', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Conteudo
                </label>
                <textarea
                  value={state.content}
                  onChange={(e) => updateField(template.id, 'content', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                <p className="mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Pre-visualizacao:
                </p>
                <p className="whitespace-pre-wrap text-sm text-emerald-800 dark:text-emerald-300">
                  {getPreview(state.content)}
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSave(template.id)}
                  disabled={savingId === template.id}
                >
                  {savingId === template.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            Nenhum template encontrado.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Section 3: Message Logs ───────────────────────────────

function LogsSection() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    listWhatsAppLogs(page, {
      status: statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then((result) => {
        setLogs(result.logs as unknown as LogRow[])
        setTotalPages(result.totalPages)
      })
      .catch(() => toast.error('Erro ao carregar logs'))
      .finally(() => setLoading(false))
  }, [page, statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  function statusBadge(status: string) {
    switch (status) {
      case 'sent':
      case 'delivered':
        return (
          <Badge variant="success">
            <CheckCircle className="mr-1 h-3 w-3" />
            {status === 'sent' ? 'Enviado' : 'Entregue'}
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="danger">
            <XCircle className="mr-1 h-3 w-3" />
            Falhou
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="warning">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        )
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  function formatDateBR(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="all">Todos os status</option>
          <option value="sent">Enviado</option>
          <option value="failed">Falhou</option>
          <option value="pending">Pendente</option>
          <option value="delivered">Entregue</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Data
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Telefone
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Template
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Erro
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-400" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {formatDateBR(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {log.companies?.name || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {log.phone}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {log.template_slug || '-'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(log.status)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-red-500">
                      {log.error_message || ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Pagina {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Proxima
          </Button>
        </div>
      )}
    </div>
  )
}
