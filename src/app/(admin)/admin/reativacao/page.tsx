'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import {
  MessageCircle, Send, Users, Loader2, RefreshCw,
} from 'lucide-react'
import {
  listReactivationTargets,
  listReactivationTemplates,
  seedReactivationTemplates,
  sendReactivationBatch,
  type ReactivationFilter,
  type ReactivationTarget,
} from '@/actions/remarketing'

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const filterTabs: { key: ReactivationFilter; label: string }[] = [
  { key: 'trial_parado', label: 'Trial parado' },
  { key: 'trial_expirado', label: 'Trial expirado' },
  { key: 'cancelado', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
]

function statusBadge(status: string | null): { label: string; variant: StatusVariant } {
  const map: Record<string, { label: string; variant: StatusVariant }> = {
    trial: { label: 'Trial', variant: 'info' },
    active: { label: 'Ativa', variant: 'success' },
    past_due: { label: 'Inadimplente', variant: 'warning' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
    expired: { label: 'Expirada', variant: 'neutral' },
  }
  return map[status || ''] || { label: 'Sem assinatura', variant: 'neutral' }
}

interface Template {
  id: string
  slug: string
  name: string
  active: boolean
}

export default function AdminReativacaoPage() {
  const [filter, setFilter] = useState<ReactivationFilter>('trial_parado')
  const [targets, setTargets] = useState<ReactivationTarget[]>([])
  const [sendableCount, setSendableCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateSlug, setTemplateSlug] = useState('')
  const [sending, setSending] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const data = await listReactivationTemplates()
      setTemplates(data as Template[])
      if (data.length > 0) {
        setTemplateSlug((prev) => prev || data[0].slug)
      }
    } catch {
      // Silencioso: templates podem ainda não existir até clicar em "Criar templates padrão".
    }
  }, [])

  const loadTargets = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const result = await listReactivationTargets(filter)
      if ('error' in result && result.error) {
        toast.error(result.error)
      }
      setTargets(result.targets)
      setSendableCount(result.sendableCount)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar empresas')
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { loadTemplates() }, [loadTemplates])
  useEffect(() => { loadTargets() }, [loadTargets])

  const selectableIds = targets.filter((t) => t.hasPhone).map((t) => t.companyId)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const result = await seedReactivationTemplates()
      if (result && 'error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Templates de reativação criados/atualizados!')
        await loadTemplates()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar templates')
    }
    setSeeding(false)
  }

  async function handleSend() {
    if (selected.size === 0) {
      toast.error('Selecione ao menos uma empresa')
      return
    }
    if (!templateSlug) {
      toast.error('Selecione um template. Clique em "Criar templates padrão" se a lista estiver vazia.')
      return
    }
    if (!confirm(`Enviar mensagem de reativação para ${selected.size} empresa(s)?`)) return

    setSending(true)
    try {
      const result = await sendReactivationBatch(Array.from(selected), templateSlug)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(
          `Enviadas: ${result.sent} | Falhas: ${result.failed} | Puladas: ${result.skipped}`
        )
        setSelected(new Set())
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mensagens')
    }
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Reativação
        </h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Encontre empresas em trial, expiradas ou canceladas e envie mensagens de reativação por WhatsApp em lote.
      </p>

      {/* Ações globais */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Template
              </label>
              <select
                value={templateSlug}
                onChange={(e) => setTemplateSlug(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {templates.length === 0 && <option value="">Nenhum template (crie os padrões)</option>}
                {templates.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}{t.active ? '' : ' (inativo)'}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="primary" onClick={handleSend} disabled={sending || selected.size === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para selecionados ({selected.size})
            </Button>
            <Button variant="outline" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Criar templates padrão
            </Button>
            <Button variant="ghost" onClick={loadTargets} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de filtro */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {targets.length} empresa(s)
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" />
          {sendableCount} com telefone
        </span>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-2 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={selectableIds.length === 0}
                        className="h-4 w-4 rounded border-zinc-300"
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Nome</th>
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Telefone</th>
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                    <th className="pb-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="pb-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Dias desde cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const badge = statusBadge(t.status)
                    return (
                      <tr key={t.companyId} className="border-b border-zinc-100 dark:border-zinc-800/50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            checked={selected.has(t.companyId)}
                            onChange={() => toggleOne(t.companyId)}
                            disabled={!t.hasPhone}
                            className="h-4 w-4 rounded border-zinc-300"
                            aria-label={`Selecionar ${t.name}`}
                          />
                        </td>
                        <td className="py-3 font-medium text-zinc-900 dark:text-zinc-50">{t.name}</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-300">
                          {t.hasPhone ? (
                            t.phone
                          ) : (
                            <Badge variant="neutral">Sem telefone</Badge>
                          )}
                        </td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-300">{t.ownerEmail || '-'}</td>
                        <td className="py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="py-3 text-right text-zinc-600 dark:text-zinc-300">{t.daysSinceSignup}</td>
                      </tr>
                    )
                  })}
                  {targets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                        Nenhuma empresa encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
