'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { UsersRound, RefreshCw, Send, Clock, Trash2, Upload, UserPlus, Loader2, X, Download, Pencil, Check } from 'lucide-react'
import {
  listWhatsAppGroups,
  sendToGroup,
  sendMediaToGroup,
  scheduleGroupMessage,
  listScheduledGroupMessages,
  deleteScheduledGroupMessage,
  deleteScheduledGroupMessages,
  updateScheduledGroupMessage,
  captureGroupContacts,
  exportGroupContactsCsv,
  type WhatsAppGroup,
  type ScheduledGroupMessage,
} from '@/actions/grupos'
import { createClient as createSbClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function GruposPage() {
  const [isLoading, startLoading] = useTransition()
  const [isSending, startSending] = useTransition()
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [intervalMinutes, setIntervalMinutes] = useState('15')

  // Seleção múltipla e edição das mensagens agendadas
  const [selectedScheduledIds, setSelectedScheduledIds] = useState<Set<string>>(new Set())
  const [editingScheduled, setEditingScheduled] = useState<ScheduledGroupMessage | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editRecurrence, setEditRecurrence] = useState<'once' | 'daily' | 'weekly'>('once')
  const [savingEdit, setSavingEdit] = useState(false)
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly'>('once')
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<ScheduledGroupMessage[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const selectedGroupId = selectedGroupIds.size > 0 ? Array.from(selectedGroupIds)[0] : ''
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  function toggleSelectGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, message: text })
    setTimeout(() => setToast(null), 4000)
  }

  const loadScheduled = useCallback(async () => {
    try {
      setScheduled(await listScheduledGroupMessages())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadScheduled()
  }, [loadScheduled])

  function handleLoadGroups() {
    setToast(null)
    startLoading(async () => {
      const result = await listWhatsAppGroups()
      setLoaded(true)
      if (result.error) {
        setGroups([])
        showToast('error', result.error)
        return
      }
      setGroups(result.groups)
      if (result.groups.length === 0) showToast('error', 'Nenhum grupo encontrado.')
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setToast(null)
    try {
      // Validações no client antes de subir.
      if (file.size > 25 * 1024 * 1024) {
        showToast('error', 'Arquivo muito grande (limite 25MB). Compacte o vídeo (ex.: HandBrake) ou use uma imagem.')
        return
      }
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) {
        showToast('error', 'Envie uma imagem ou vídeo.')
        return
      }

      // Upload direto pro Storage do Supabase (sem passar por server action).
      // Server actions têm body limit + timeout que tropeçam em vídeos de 10MB+;
      // o caminho via client-SDK vai direto pro S3 do Storage, sem essa fricção.
      const supabase = createSbClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg')
      const fileName = `${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('group-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) {
        showToast('error', `Falha no upload: ${upErr.message}`)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('group-media').getPublicUrl(fileName)
      setMedia({ url: publicUrl, type: isVideo ? 'video' : 'image' })
      showToast('success', 'Mídia anexada.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado no upload.'
      showToast('error', msg)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleSendNow() {
    if (!selectedGroupId) return showToast('error', 'Selecione um grupo.')
    if (!message.trim() && !media) return showToast('error', 'Escreva uma mensagem ou anexe mídia.')
    setToast(null)
    startSending(async () => {
      const result = media
        ? await sendMediaToGroup(selectedGroupId, media.url, media.type, message)
        : await sendToGroup(selectedGroupId, message)
      if (result.error) return showToast('error', result.error)
      showToast('success', 'Mensagem enviada ao grupo!')
      setMessage('')
      setMedia(null)
    })
  }

  function handleSchedule() {
    const ids = Array.from(selectedGroupIds)
    if (ids.length === 0) return showToast('error', 'Selecione ao menos um grupo.')
    if (!message.trim() && !media) return showToast('error', 'Escreva uma mensagem ou anexe mídia.')
    if (!scheduledAt) return showToast('error', 'Defina a data e hora do envio.')
    const interval = parseInt(intervalMinutes, 10)
    setToast(null)
    startSending(async () => {
      const result = await scheduleGroupMessage({
        group_ids: ids,
        group_name: ids.length === 1 ? selectedGroup?.name : undefined,
        content: message,
        media_url: media?.url,
        media_type: media?.type,
        scheduled_at: scheduledAt,
        recurrence,
        interval_minutes: ids.length > 1 ? (Number.isFinite(interval) && interval > 0 ? interval : 15) : 0,
      })
      if (result.error) return showToast('error', result.error)
      showToast('success', `${result.scheduled || ids.length} mensagem(ns) agendada(s)!`)
      setMessage('')
      setMedia(null)
      setScheduledAt('')
      setRecurrence('once')
      setSelectedGroupIds(new Set())
      await loadScheduled()
    })
  }

  async function handleDeleteScheduled(id: string) {
    const result = await deleteScheduledGroupMessage(id)
    if (result.error) return showToast('error', result.error)
    setSelectedScheduledIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    await loadScheduled()
  }

  function toggleSelectScheduled(id: string) {
    setSelectedScheduledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllScheduledPending() {
    const pendingIds = scheduled.filter((m) => m.status === 'pending').map((m) => m.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedScheduledIds.has(id))
    setSelectedScheduledIds(allSelected ? new Set() : new Set(pendingIds))
  }

  async function handleBulkDeleteScheduled() {
    const ids = Array.from(selectedScheduledIds)
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length} agendamento(s) selecionado(s)?`)) return
    const result = await deleteScheduledGroupMessages(ids)
    if (result.error) return showToast('error', result.error)
    showToast('success', `${result.deleted ?? ids.length} agendamento(s) excluído(s).`)
    setSelectedScheduledIds(new Set())
    await loadScheduled()
  }

  function openEditScheduled(m: ScheduledGroupMessage) {
    setEditingScheduled(m)
    setEditContent(m.content || '')
    // Converte o ISO UTC do banco pro formato datetime-local em BRT (UTC-3).
    const d = new Date(m.scheduled_at)
    const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const value = `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`
    setEditScheduledAt(value)
    setEditRecurrence((m.recurrence as 'once' | 'daily' | 'weekly') || 'once')
  }

  async function handleSaveEditScheduled() {
    if (!editingScheduled) return
    setSavingEdit(true)
    try {
      const result = await updateScheduledGroupMessage(editingScheduled.id, {
        content: editContent,
        scheduled_at: editScheduledAt,
        recurrence: editRecurrence,
      })
      if (result.error) return showToast('error', result.error)
      showToast('success', 'Agendamento atualizado!')
      setEditingScheduled(null)
      await loadScheduled()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleCapture(groupId: string) {
    setCapturingId(groupId)
    setToast(null)
    try {
      const result = await captureGroupContacts(groupId)
      if (result.error) return showToast('error', result.error)
      // Toast detalhado pra diagnosticar quando o número parece estranho
      // (ex.: grupo pequeno mas captação alta = Z-API mandando demais).
      const raw = result.rawCount ?? result.total ?? 0
      const unique = result.total ?? 0
      const existing = result.existingCount ?? 0
      showToast(
        'success',
        `Importados ${result.imported} novos. Z-API enviou ${raw} participantes, ${unique} únicos, ${existing} já cadastrados.`
      )
    } finally {
      setCapturingId(null)
    }
  }

  async function handleExportCsv(group: WhatsAppGroup) {
    setExportingId(group.id)
    setToast(null)
    try {
      const result = await exportGroupContactsCsv(group.id)
      if (result.error || !result.csv) return showToast('error', result.error || 'Erro ao gerar CSV.')

      const safeName = (group.name || 'grupo').replace(/[^\w\-]+/g, '_').slice(0, 40)
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contatos_${safeName}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('success', `CSV gerado com ${result.total} contato(s). Abra direto no Excel.`)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {toast && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${toast.type === 'success' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
          <UsersRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Grupos do WhatsApp</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Liste grupos, envie ou agende mensagens com mídia e capte contatos.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Lista de grupos */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Seus grupos</h2>
            <Button type="button" variant="outline" onClick={handleLoadGroups} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Carregando...' : loaded ? 'Atualizar' : 'Carregar grupos'}
            </Button>
          </div>

          {!loaded && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Clique em &quot;Carregar grupos&quot; para buscar todos os grupos da sua conta.
            </p>
          )}

          {loaded && groups.length > 0 && (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${selectedGroupIds.has(group.id) ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : 'border-zinc-200 dark:border-zinc-800'}`}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={() => toggleSelectGroup(group.id)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{group.name}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{group.id}</p>
                    </div>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCapture(group.id)}
                    disabled={capturingId === group.id}
                    title="Importar participantes como contatos"
                  >
                    {capturingId === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Captar contatos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportCsv(group)}
                    disabled={exportingId === group.id}
                    title="Baixar participantes como CSV (abre no Excel)"
                  >
                    {exportingId === group.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Baixar CSV
                  </Button>
                </div>
              ))}
              <p className="pt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Dica: capte contatos com responsabilidade (evite spam/ban). Envie só para quem tem interesse.
              </p>
            </div>
          )}

          {loaded && groups.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum grupo disponível.</p>
          )}
        </div>

        {/* Compor mensagem */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Mensagem</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Escreva a mensagem (vira legenda se houver mídia)..."
            className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />

          {/* Mídia */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Enviando...' : 'Anexar foto/vídeo'}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {media && (
              <span className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {media.type === 'video' ? 'Vídeo anexado' : 'Imagem anexada'}
                <button onClick={() => setMedia(null)} className="text-zinc-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </div>

          {/* Agendamento */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Agendar para (opcional)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Repetição</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as 'once' | 'daily' | 'weekly')}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="once">Uma vez</option>
                <option value="daily">Todo dia</option>
                <option value="weekly">Toda semana</option>
              </select>
            </div>
            {selectedGroupIds.size > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Intervalo entre grupos (min)</label>
                <input
                  type="number"
                  min={1}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                  className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={handleSchedule} disabled={isSending || selectedGroupIds.size === 0 || !scheduledAt}>
                <Clock className="h-4 w-4" />
                Agendar{selectedGroupIds.size > 1 ? ` (${selectedGroupIds.size})` : ''}
              </Button>
              <Button type="button" onClick={handleSendNow} disabled={isSending || !selectedGroupId}>
                <Send className="h-4 w-4" />
                {isSending ? 'Enviando...' : 'Enviar agora'}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            Hora em <strong>BRT</strong>. O cron processa a cada ~5min, então pode haver leve atraso. Selecione vários grupos pra agendar a mesma mensagem com intervalo (anti-ban). &quot;Enviar agora&quot; usa só o primeiro grupo selecionado.
          </p>
        </div>

        {/* Agendamentos */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Mensagens agendadas</h2>
            {scheduled.some((m) => m.status === 'pending') && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={
                      scheduled.filter((m) => m.status === 'pending').length > 0 &&
                      scheduled.filter((m) => m.status === 'pending').every((m) => selectedScheduledIds.has(m.id))
                    }
                    onChange={toggleSelectAllScheduledPending}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Selecionar todas pendentes
                </label>
                {selectedScheduledIds.size > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDeleteScheduled}
                    className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir selecionados ({selectedScheduledIds.size})
                  </Button>
                )}
              </div>
            )}
          </div>
          {scheduled.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma mensagem agendada.</p>
          ) : (
            <div className="space-y-2">
              {scheduled.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {m.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedScheduledIds.has(m.id)}
                        onChange={() => toggleSelectScheduled(m.id)}
                        className="h-4 w-4 shrink-0 accent-blue-600"
                        aria-label="Selecionar agendamento"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {m.group_name || m.group_id}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(m.scheduled_at)}
                        {m.recurrence === 'daily' && ' · todo dia'}
                        {m.recurrence === 'weekly' && ' · toda semana'}
                        {' · '}
                        {m.content ? m.content.slice(0, 40) : `[${m.media_type || 'mídia'}]`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : m.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {m.status === 'sent' ? 'Enviada' : m.status === 'failed' ? 'Falhou' : 'Agendada'}
                    </span>
                    {m.status === 'pending' && (
                      <>
                        <button onClick={() => openEditScheduled(m)} className="rounded-md p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10" aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteScheduled(m.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal editar agendamento */}
        <Modal open={editingScheduled !== null} onClose={() => !savingEdit && setEditingScheduled(null)} title="Editar agendamento">
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Grupo: <strong className="text-zinc-700 dark:text-zinc-300">{editingScheduled?.group_name || editingScheduled?.group_id}</strong>
              {editingScheduled?.media_url && <> · <span>mídia anexada (preservada)</span></>}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Mensagem</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Agendar para</label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Repetição</label>
                <select
                  value={editRecurrence}
                  onChange={(e) => setEditRecurrence(e.target.value as 'once' | 'daily' | 'weekly')}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="once">Uma vez</option>
                  <option value="daily">Todo dia</option>
                  <option value="weekly">Toda semana</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Pra trocar o grupo ou a mídia, apague esse agendamento e crie um novo.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingScheduled(null)} disabled={savingEdit}>Cancelar</Button>
              <Button onClick={handleSaveEditScheduled} disabled={savingEdit}>
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
