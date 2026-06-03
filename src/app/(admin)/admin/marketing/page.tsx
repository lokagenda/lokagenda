'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import toast from 'react-hot-toast'
import {
  Megaphone,
  Users,
  Upload,
  Play,
  Pause,
  Send,
  Plus,
  Trash2,
  Loader2,
  Download,
  CheckSquare,
  Square,
  MinusSquare,
  Copy,
  Pencil,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CampaignContact, Campaign } from '@/types/database'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  deleteContacts,
  deleteAllContacts,
  importContactsCSV,
  listCampaigns,
  createCampaign,
  updateCampaign,
  duplicateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignStats,
} from '@/actions/campanhas'

type TabType = 'contatos' | 'campanhas'
type ContactStatus = CampaignContact['status']
type CampaignStatus = Campaign['status']

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  lead: 'Lead',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
}

const CONTACT_STATUS_VARIANT: Record<
  ContactStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  lead: 'neutral',
  contacted: 'info',
  qualified: 'default',
  converted: 'success',
  lost: 'danger',
}

const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
}

const CAMPAIGN_STATUS_VARIANT: Record<
  CampaignStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  draft: 'neutral',
  running: 'success',
  paused: 'warning',
  completed: 'info',
}

interface CampaignStats {
  sent: number
  pending: number
  failed: number
  replies: number
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('contatos')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          <Megaphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          Marketing
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Importe contatos e dispare campanhas de WhatsApp em massa com envio gradual.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('contatos')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'contatos'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="h-4 w-4" />
          Contatos
        </button>
        <button
          onClick={() => setActiveTab('campanhas')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'campanhas'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          Campanhas
        </button>
      </div>

      {activeTab === 'contatos' ? <ContatosTab /> : <CampanhasTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contatos tab
// ---------------------------------------------------------------------------
function ContatosTab() {
  const [contacts, setContacts] = useState<CampaignContact[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Add form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tags, setTags] = useState('')

  // Import
  const [csvRows, setCsvRows] = useState<{ name?: string; phone: string; tags?: string }[]>([])
  const [csvFileName, setCsvFileName] = useState('')

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Edição de contato
  const [editing, setEditing] = useState<CampaignContact | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; phone: string; tags: string; status: ContactStatus }>({
    name: '',
    phone: '',
    tags: '',
    status: 'lead',
  })

  const load = useCallback(async () => {
    const res = await listContacts({
      status: statusFilter || undefined,
      search: search || undefined,
    })
    if ('error' in res && res.error) {
      toast.error(res.error)
    } else {
      setContacts(res.contacts)
    }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    let active = true
    void (async () => {
      const res = await listContacts({
        status: statusFilter || undefined,
        search: search || undefined,
      })
      if (!active) return
      if ('error' in res && res.error) toast.error(res.error)
      else setContacts(res.contacts)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [statusFilter, search])

  const handleAdd = () => {
    if (!phone.trim()) {
      toast.error('Informe o telefone')
      return
    }
    startTransition(async () => {
      const res = await createContact({ name, phone, tags })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Contato adicionado')
        setName('')
        setPhone('')
        setTags('')
        setAddOpen(false)
        load()
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este contato?')) return
    startTransition(async () => {
      const res = await deleteContact(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Contato excluído')
        setContacts((prev) => prev.filter((c) => c.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    })
  }

  const openEdit = (c: CampaignContact) => {
    setEditing(c)
    setEditForm({ name: c.name || '', phone: c.phone || '', tags: c.tags || '', status: c.status })
  }

  const handleSaveEdit = () => {
    if (!editing) return
    startTransition(async () => {
      const res = await updateContact(editing.id, {
        name: editForm.name,
        phone: editForm.phone,
        tags: editForm.tags,
        status: editForm.status,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Contato atualizado')
        setEditing(null)
        load()
      }
    })
  }

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(contacts.map((c) => c.id)))

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`Excluir ${ids.length} contato(s) selecionado(s)?`)) return
    startTransition(async () => {
      const res = await deleteContacts(ids)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`${res.deleted ?? ids.length} contato(s) excluído(s)`)
        setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)))
        setSelectedIds(new Set())
      }
    })
  }

  const handleDeleteAll = () => {
    // Apaga tudo da empresa via SQL direto (DELETE WHERE company_id), sem depender
    // da seleção visual — que ficava limitada ao que estava carregado e deixava
    // centenas de contatos invisíveis pra trás.
    if (!confirm('Apagar TODOS os contatos da empresa? Esta ação não pode ser desfeita.')) return
    if (!confirm('Tem certeza absoluta? Vai apagar tudo, inclusive contatos que não estão na tela.')) return
    startTransition(async () => {
      const res = await deleteAllContacts()
      if (res.error) toast.error(res.error)
      else {
        toast.success(`${res.deleted ?? 0} contato(s) apagado(s)`)
        setContacts([])
        setSelectedIds(new Set())
      }
    })
  }

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.error('Nenhum contato para exportar')
      return
    }
    const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
    const header = ['Nome', 'Telefone', 'Origem', 'Status', 'Tags', 'Cadastrado em']
    const lines = contacts.map((c) =>
      [
        escape(c.name || ''),
        escape(c.phone || ''),
        escape(c.source || ''),
        escape(CONTACT_STATUS_LABELS[c.status] || c.status),
        escape(c.tags || ''),
        escape(c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : ''),
      ].join(',')
    )
    // BOM para o Excel reconhecer acentos.
    const csv = '﻿' + [header.join(','), ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const rows = parseCSV(text)
      setCsvRows(rows)
      if (rows.length === 0) toast.error('Nenhuma linha válida encontrada no arquivo')
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (csvRows.length === 0) {
      toast.error('Selecione um arquivo com contatos')
      return
    }
    startTransition(async () => {
      const res = await importContactsCSV(csvRows)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(
          `${res.imported} importado(s)${res.skipped ? `, ${res.skipped} ignorado(s)` : ''}`
        )
        setImportOpen(false)
        setCsvRows([])
        setCsvFileName('')
        load()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por nome, telefone ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContactStatus | '')}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Todos os status</option>
            {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={contacts.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {loading ? 'Carregando...' : `${contacts.length} contato(s)`}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={handleDeleteSelected}
              disabled={isPending}
              className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Excluir selecionados ({selectedIds.size})
            </Button>
          )}
          {contacts.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDeleteAll}
              disabled={isPending}
              className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              title="Apaga TODOS os contatos da empresa, mesmo os que não estão na tela"
            >
              <Trash2 className="h-4 w-4" />
              Apagar TODOS
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : contacts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum contato encontrado. Importe um CSV ou adicione manualmente.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">
                    <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400" aria-label="Selecionar todos">
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : someSelected ? (
                        <MinusSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {contacts.map((c) => (
                  <tr key={c.id} className={`text-zinc-700 dark:text-zinc-300 ${selectedIds.has(c.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(c.id)} className="text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400" aria-label="Selecionar contato">
                        {selectedIds.has(c.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {c.name || '—'}
                    </td>
                    <td className="px-4 py-3">{c.phone}</td>
                    <td className="px-4 py-3">
                      <Badge variant={CONTACT_STATUS_VARIANT[c.status]}>
                        {CONTACT_STATUS_LABELS[c.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.tags || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          disabled={isPending}
                          className="text-zinc-400 hover:text-blue-600 disabled:opacity-50"
                          aria-label="Editar contato"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={isPending}
                          className="text-zinc-400 hover:text-red-600 disabled:opacity-50"
                          aria-label="Excluir contato"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit modal */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar contato">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Opcional" />
          <Input label="Telefone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ContactStatus }))}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => (
                <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <Input label="Tags" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Ex: feira-2026, indicação" hint="Separe por vírgula. Opcional." />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Novo contato">
        <div className="space-y-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Opcional" />
          <Input
            label="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Ex: feira-2026, indicação"
            hint="Separe por vírgula. Opcional."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar contatos (CSV)">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Envie um arquivo com as colunas <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">nome,telefone</code>{' '}
            (ou apenas telefone). Telefones duplicados são ignorados.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 transition-colors hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-400">
            <Upload className="h-6 w-6" />
            <span>{csvFileName || 'Clique para selecionar um arquivo CSV'}</span>
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleFile} />
          </label>
          {csvRows.length > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {csvRows.length} linha(s) prontas para importar.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={isPending || csvRows.length === 0}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Lenient CSV parser: splits lines, expects name,phone (or just phone).
function parseCSV(text: string): { name?: string; phone: string; tags?: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  // Detect + skip a header row
  const first = lines[0].toLowerCase()
  const hasHeader =
    first.includes('telefone') ||
    first.includes('phone') ||
    first.includes('nome') ||
    first.includes('name')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows: { name?: string; phone: string; tags?: string }[] = []
  for (const line of dataLines) {
    const parts = line.split(/[;,\t]/).map((p) => p.trim())
    // Find the column that looks like a phone (most digits)
    const phoneIdx = parts.findIndex((p) => p.replace(/\D/g, '').length >= 8)
    if (phoneIdx === -1) {
      // Single-column fallback
      if (parts.length === 1 && parts[0].replace(/\D/g, '').length >= 8) {
        rows.push({ phone: parts[0] })
      }
      continue
    }
    const phone = parts[phoneIdx]
    // Name = first non-phone column before the phone, else first remaining
    const name =
      phoneIdx > 0 ? parts[0] : parts.length > 1 ? parts[1] : undefined
    const tags = parts[phoneIdx + 1] && phoneIdx === 0 ? undefined : parts[2]
    rows.push({
      phone,
      name: name && name.replace(/\D/g, '').length < 8 ? name : undefined,
      tags: tags && tags.replace(/\D/g, '').length < 8 ? tags : undefined,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Campanhas tab
// ---------------------------------------------------------------------------
function CampanhasTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [stats, setStats] = useState<Record<string, CampaignStats>>({})

  // Create form
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [dailyLimit, setDailyLimit] = useState('50')
  const [windowStart, setWindowStart] = useState('8')
  const [windowEnd, setWindowEnd] = useState('20')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')

  // Edit form (campos próprios pra não conflitar com o create)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editDailyLimit, setEditDailyLimit] = useState('50')
  const [editWindowStart, setEditWindowStart] = useState('8')
  const [editWindowEnd, setEditWindowEnd] = useState('20')
  const [editAiEnabled, setEditAiEnabled] = useState(false)
  const [editAiPrompt, setEditAiPrompt] = useState('')

  const load = useCallback(async () => {
    const res = await listCampaigns()
    if ('error' in res && res.error) {
      toast.error(res.error)
    } else {
      setCampaigns(res.campaigns)
      // Load stats for each campaign
      const statEntries = await Promise.all(
        res.campaigns.map(async (c) => [c.id, await getCampaignStats(c.id)] as const)
      )
      setStats(Object.fromEntries(statEntries))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const res = await listCampaigns()
      if (!active) return
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        setCampaigns(res.campaigns)
        const statEntries = await Promise.all(
          res.campaigns.map(async (c) => [c.id, await getCampaignStats(c.id)] as const)
        )
        if (!active) return
        setStats(Object.fromEntries(statEntries))
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Informe o nome da campanha')
      return
    }
    if (!message.trim()) {
      toast.error('Informe a mensagem')
      return
    }
    startTransition(async () => {
      const res = await createCampaign({
        name,
        message_template: message,
        daily_limit: parseInt(dailyLimit, 10) || 50,
        send_window_start: parseInt(windowStart, 10),
        send_window_end: parseInt(windowEnd, 10),
        ai_enabled: aiEnabled,
        ai_prompt: aiEnabled ? aiPrompt : null,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Campanha criada')
        setName('')
        setMessage('')
        setDailyLimit('50')
        setWindowStart('8')
        setWindowEnd('20')
        setAiEnabled(false)
        setAiPrompt('')
        setCreateOpen(false)
        load()
      }
    })
  }

  const handleStart = (id: string) => {
    startTransition(async () => {
      const res = await startCampaign(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Campanha iniciada (${res.queued ?? 0} na fila)`)
        load()
      }
    })
  }

  const handlePause = (id: string) => {
    startTransition(async () => {
      const res = await pauseCampaign(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Campanha pausada')
        load()
      }
    })
  }

  const handleResume = (id: string) => {
    startTransition(async () => {
      const res = await resumeCampaign(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Campanha retomada')
        load()
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta campanha e sua fila de envio?')) return
    startTransition(async () => {
      const res = await deleteCampaign(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Campanha excluída')
        setCampaigns((prev) => prev.filter((c) => c.id !== id))
      }
    })
  }

  const handleDuplicate = (id: string) => {
    startTransition(async () => {
      const res = await duplicateCampaign(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Campanha duplicada (rascunho) — ajuste os contatos e inicie.')
        await load()
      }
    })
  }

  const openCampaignEdit = (c: Campaign) => {
    setEditingId(c.id)
    setEditName(c.name || '')
    setEditMessage(c.message_template || '')
    setEditDailyLimit(String(c.daily_limit ?? 50))
    setEditWindowStart(String(c.send_window_start ?? 8))
    setEditWindowEnd(String(c.send_window_end ?? 20))
    setEditAiEnabled(!!c.ai_enabled)
    setEditAiPrompt(c.ai_prompt || '')
  }

  const handleSaveCampaignEdit = () => {
    if (!editingId) return
    if (!editName.trim()) {
      toast.error('Informe o nome da campanha')
      return
    }
    if (!editMessage.trim()) {
      toast.error('Informe a mensagem')
      return
    }
    startTransition(async () => {
      const res = await updateCampaign(editingId, {
        name: editName,
        message_template: editMessage,
        daily_limit: parseInt(editDailyLimit, 10) || 50,
        send_window_start: parseInt(editWindowStart, 10),
        send_window_end: parseInt(editWindowEnd, 10),
        ai_enabled: editAiEnabled,
        ai_prompt: editAiEnabled ? editAiPrompt : null,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Campanha atualizada')
        setEditingId(null)
        await load()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {loading ? 'Carregando...' : `${campaigns.length} campanha(s)`}
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma campanha ainda. Crie uma para começar a enviar mensagens.
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => {
            const s = stats[c.id]
            return (
              <Card key={c.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</h3>
                      <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </Badge>
                      {c.ai_enabled && <Badge variant="default">IA</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {c.message_template}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        Enviados:{' '}
                        <strong className="text-zinc-700 dark:text-zinc-200">
                          {c.sent_count}/{c.total_targets}
                        </strong>
                      </span>
                      <span>
                        Limite diário:{' '}
                        <strong className="text-zinc-700 dark:text-zinc-200">{c.daily_limit}</strong>
                      </span>
                    </div>
                    {s && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatBox label="Enviados" value={s.sent} color="text-emerald-600 dark:text-emerald-400" />
                        <StatBox label="Pendentes" value={s.pending} color="text-amber-600 dark:text-amber-400" />
                        <StatBox label="Falhas" value={s.failed} color="text-red-600 dark:text-red-400" />
                        <StatBox label="Respostas" value={s.replies} color="text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {c.status === 'draft' || c.status === 'completed' ? (
                      <Button size="sm" onClick={() => handleStart(c.id)} disabled={isPending}>
                        <Play className="h-4 w-4" />
                        Iniciar
                      </Button>
                    ) : c.status === 'running' ? (
                      <Button size="sm" variant="secondary" onClick={() => handlePause(c.id)} disabled={isPending}>
                        <Pause className="h-4 w-4" />
                        Pausar
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleResume(c.id)} disabled={isPending}>
                        <Send className="h-4 w-4" />
                        Retomar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openCampaignEdit(c)} disabled={isPending} title="Editar nome, mensagem, IA, janela e limite">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(c.id)} disabled={isPending} title="Duplicar (reaproveita o prompt e as configurações)">
                      <Copy className="h-4 w-4" />
                      Duplicar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)} disabled={isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova campanha">
        <div className="space-y-4">
          <Input
            label="Nome da campanha"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Reativação de leads"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mensagem
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Olá {{nome}}, temos novidades para você..."
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Use <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{{nome}}'}</code> para inserir o nome do contato.
            </p>
          </div>
          <Input
            label="Limite diário de envios"
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            hint="Quantidade máxima de mensagens por dia (anti-bloqueio)."
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horário de envio (distribuído na janela)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">até</span>
              <Input
                type="number"
                min={1}
                max={23}
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">horas</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              O robô divide o limite diário nessa faixa (horário de Brasília). Ex.: 50 entre 8h e 20h ≈ 1 a cada ~14 min.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
              />
              Habilitar respostas com IA
            </label>
            {aiEnabled && (
              <div className="mt-3">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="Instruções para a IA responder os contatos (opcional)..."
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar campanha
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit campaign modal */}
      <Modal open={editingId !== null} onClose={() => !isPending && setEditingId(null)} title="Editar campanha">
        <div className="space-y-4">
          <Input
            label="Nome da campanha"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Ex: Reativação de leads"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mensagem
            </label>
            <textarea
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              rows={4}
              placeholder="Olá {{nome}}, temos novidades para você..."
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Use <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{{nome}}'}</code> para inserir o nome do contato.
            </p>
          </div>
          <Input
            label="Limite diário de envios"
            type="number"
            min={1}
            value={editDailyLimit}
            onChange={(e) => setEditDailyLimit(e.target.value)}
            hint="Quantidade máxima de mensagens por dia (anti-bloqueio)."
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horário de envio (distribuído na janela)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={editWindowStart}
                onChange={(e) => setEditWindowStart(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">até</span>
              <Input
                type="number"
                min={1}
                max={23}
                value={editWindowEnd}
                onChange={(e) => setEditWindowEnd(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">horas</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={editAiEnabled}
                onChange={(e) => setEditAiEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
              />
              Habilitar respostas com IA
            </label>
            {editAiEnabled && (
              <div className="mt-3">
                <textarea
                  value={editAiPrompt}
                  onChange={(e) => setEditAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="Instruções para a IA responder os contatos (opcional)..."
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCampaignEdit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  )
}
