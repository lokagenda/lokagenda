'use client'

import { useState, useTransition } from 'react'
import { UsersRound, RefreshCw, Send } from 'lucide-react'
import { listWhatsAppGroups, sendToGroup, type WhatsAppGroup } from '@/actions/grupos'
import { Button } from '@/components/ui/button'

export default function GruposPage() {
  const [isLoading, startLoading] = useTransition()
  const [isSending, startSending] = useTransition()
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, message: text })
    setTimeout(() => setToast(null), 4000)
  }

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
      if (result.groups.length === 0) {
        showToast('error', 'Nenhum grupo encontrado.')
      }
    })
  }

  function handleSend() {
    if (!selectedGroupId) {
      showToast('error', 'Selecione um grupo.')
      return
    }
    if (!message.trim()) {
      showToast('error', 'Escreva uma mensagem.')
      return
    }
    setToast(null)
    startSending(async () => {
      const result = await sendToGroup(selectedGroupId, message)
      if (result.error) {
        showToast('error', result.error)
        return
      }
      showToast('success', 'Mensagem enviada ao grupo com sucesso!')
      setMessage('')
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 rounded-lg border p-4 text-sm ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Grupos do WhatsApp</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Liste seus grupos e envie mensagens para eles.
            </p>
          </div>
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
              Clique em &quot;Carregar grupos&quot; para buscar os grupos da sua conta de WhatsApp.
            </p>
          )}

          {loaded && groups.length > 0 && (
            <div className="space-y-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedGroupId === group.id
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                      : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="group"
                    value={group.id}
                    checked={selectedGroupId === group.id}
                    onChange={() => setSelectedGroupId(group.id)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {group.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{group.id}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {loaded && groups.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum grupo disponível.
            </p>
          )}
        </div>

        {/* Compor mensagem */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Enviar mensagem</h2>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Mensagem
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Escreva a mensagem que será enviada ao grupo selecionado..."
            className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={handleSend} disabled={isSending || !selectedGroupId}>
              <Send className="h-4 w-4" />
              {isSending ? 'Enviando...' : 'Enviar ao grupo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
