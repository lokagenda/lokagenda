'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Bell,
  Calendar,
  Cake,
  Send,
  Plus,
  Trash2,
  Loader2,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  getUpcomingReminders,
  getReminderSettings,
  updateReminderSettings,
  buildEventReminderMessage,
  listEventTypes,
  createEventType,
  deleteEventType,
  type ReminderItem,
} from '@/actions/lembretes'
import type { EventType } from '@/types/database'

function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  if (!y) return dateStr
  return `${d}/${m}/${y}`
}

function daysLabel(days: number): string {
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `${days} dias`
}

export default function LembretesPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Settings
  const [daysBefore, setDaysBefore] = useState(30)
  const [savingSettings, setSavingSettings] = useState(false)

  // Event types modal
  const [typesModalOpen, setTypesModalOpen] = useState(false)
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)

  const loadReminders = useCallback(async () => {
    setLoadingReminders(true)
    try {
      const data = await getUpcomingReminders()
      setReminders(data)
    } catch {
      toast.error('Erro ao carregar lembretes')
    } finally {
      setLoadingReminders(false)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getReminderSettings()
      setDaysBefore(settings.days_before)
    } catch {
      // keep defaults
    }
  }, [])

  const loadEventTypes = useCallback(async () => {
    try {
      const types = await listEventTypes()
      setEventTypes(types)
    } catch {
      toast.error('Erro ao carregar tipos de evento')
    }
  }, [])

  useEffect(() => {
    loadReminders()
    loadSettings()
    loadEventTypes()
  }, [loadReminders, loadSettings, loadEventTypes])

  async function handleSendReminder(item: ReminderItem) {
    if (!item.phone) {
      toast.error('Cliente sem telefone cadastrado')
      return
    }
    setSendingId(item.id)
    try {
      // O texto é montado no servidor; o ENVIO é feito pelo WhatsApp do próprio
      // assinante (link wa.me), então sai do número dele — não do número da plataforma.
      const result = await buildEventReminderMessage(
        item.customerName,
        item.eventType || (item.type === 'aniversario' ? 'Aniversário' : 'Evento'),
        item.date
      )
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const digits = item.phone.replace(/\D/g, '')
      const waPhone = digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(result.message)}`, '_blank')
      toast.success('Abrindo seu WhatsApp para enviar...')
    } catch {
      toast.error('Erro ao montar o lembrete')
    } finally {
      setSendingId(null)
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await updateReminderSettings({ days_before: daysBefore })
      toast.success('Configurações salvas!')
      await loadReminders()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configurações'
      toast.error(message)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault()
    if (!newTypeName.trim()) return
    setAddingType(true)
    try {
      await createEventType(newTypeName)
      setNewTypeName('')
      toast.success('Tipo de evento adicionado!')
      await loadEventTypes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar tipo'
      toast.error(message)
    } finally {
      setAddingType(false)
    }
  }

  async function handleDeleteType(id: string) {
    setDeletingTypeId(id)
    try {
      await deleteEventType(id)
      toast.success('Tipo de evento removido!')
      await loadEventTypes()
    } catch {
      toast.error('Erro ao remover tipo')
    } finally {
      setDeletingTypeId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Lembretes de Eventos</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Acompanhe locações e aniversários próximos
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setTypesModalOpen(true)}>
          <Settings className="h-4 w-4" />
          Gerenciar Tipos de Evento
        </Button>
      </div>

      {/* Como funciona o disparo */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <p className="font-medium">Como funciona o lembrete</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-blue-700 dark:text-blue-300">
          <li>Ao clicar em <strong>&ldquo;Enviar WhatsApp&rdquo;</strong>, abre o <strong>seu WhatsApp</strong> com a mensagem pronta para o cliente — o envio sai do <strong>seu número</strong>, não de um número da plataforma.</li>
          <li>Quando um cliente tem <strong>aniversário</strong> cadastrado, todo ano ele aparece aqui na janela de antecedência para você reativar a venda.</li>
          <li>O texto é o modelo <strong>&ldquo;Lembrete de Evento&rdquo;</strong>, editável em Admin → WhatsApp (variáveis: nome do cliente, tipo e data).</li>
        </ul>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="sm:max-w-[200px]">
              <label htmlFor="days_before" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Dias de antecedência
              </label>
              <input
                type="number"
                id="days_before"
                min={1}
                value={daysBefore}
                onChange={(e) => setDaysBefore(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:ml-auto">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminders list */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Próximos Lembretes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReminders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : reminders.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="Nenhum lembrete próximo"
              description="Eventos e aniversários dentro da janela configurada aparecerão aqui."
            />
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {reminders.map((item) => {
                const isBirthday = item.type === 'aniversario'
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          isBirthday
                            ? 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                        }`}
                      >
                        {isBirthday ? <Cake className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {item.customerName}
                          </p>
                          <Badge variant={isBirthday ? 'warning' : 'info'}>
                            {item.eventType || (isBirthday ? 'Aniversário' : 'Evento')}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {formatDateBr(item.date)} • {daysLabel(item.daysRemaining)}
                          {item.phone ? ` • ${item.phone}` : ' • sem telefone'}
                        </p>
                      </div>
                    </div>
                    <div className="sm:shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendReminder(item)}
                        disabled={sendingId === item.id || !item.phone}
                      >
                        {sendingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Enviar WhatsApp
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event types modal */}
      <Modal
        open={typesModalOpen}
        onClose={() => setTypesModalOpen(false)}
        title="Tipos de Evento"
        description="Gerencie a lista de tipos de evento da sua empresa"
      >
        <form onSubmit={handleAddType} className="flex items-center gap-2">
          <input
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="Ex: Festa empresa"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button type="submit" disabled={addingType || !newTypeName.trim()}>
            {addingType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </form>

        <div className="mt-4 max-h-72 overflow-y-auto">
          {eventTypes.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum tipo de evento cadastrado.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {eventTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">{type.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteType(type.id)}
                    disabled={deletingTypeId === type.id}
                    className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"
                    aria-label={`Remover ${type.name}`}
                  >
                    {deletingTypeId === type.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
