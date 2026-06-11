'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  getRentalsForDay,
  listEmployees,
  createEmployee,
  assignRentalEmployee,
  updateEmployee,
  deleteEmployee,
  buildMontagemMessage,
  type RentalWithItems,
} from '@/actions/montagem'
import { buildFullAddress } from '@/lib/maps'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  FileDown,
  Send,
  Loader2,
  Users,
} from 'lucide-react'
import type { Employee } from '@/types/database'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function MontagemPage() {
  const [date, setDate] = useState<string>(todayStr())
  const [rentals, setRentals] = useState<RentalWithItems[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  // WhatsApp send
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [sendLoading, setSendLoading] = useState(false)

  // Employee management modal
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeName, setEmployeeName] = useState('')
  const [employeePhone, setEmployeePhone] = useState('')
  const [employeeSaving, setEmployeeSaving] = useState(false)

  const loadRentals = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const data = await getRentalsForDay(d)
      setRentals(data)
      setSelected(new Set())
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar locações do dia.')
      setRentals([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEmployees = useCallback(async () => {
    try {
      const data = await listEmployees()
      setEmployees(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar funcionários.')
    }
  }, [])

  useEffect(() => {
    loadRentals(date)
  }, [date, loadRentals])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === rentals.length) return new Set()
      return new Set(rentals.map((r) => r.id))
    })
  }

  const allSelected = rentals.length > 0 && selected.size === rentals.length
  const selectedRentals = rentals.filter((r) => selected.has(r.id))

  async function handleExportPdf() {
    if (selectedRentals.length === 0) return
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

      let html = `<h1 style="font-size:22px;margin:0 0 4px 0;">Roteiro de Montagem</h1>`
      html += `<div style="font-size:14px;color:#444;margin-bottom:20px;">${formatDate(date)}</div>`

      selectedRentals.forEach((rental, index) => {
        const fullAddress = buildFullAddress({
          address: rental.event_address,
          city: rental.event_city,
          state: rental.event_state,
          zip: rental.event_zip_code,
        })
        const pending = rental.total - (rental.amount_paid || 0)
        const items = rental.rental_items || []

        html += `<div style="margin-bottom:18px;padding:14px;border:1px solid #ccc;border-radius:8px;">`
        html += `<div style="font-size:16px;font-weight:bold;margin-bottom:6px;">${index + 1}. ${escapeHtml(rental.customer_name)}</div>`
        if (rental.customer_phone) html += `<div>Telefone: ${escapeHtml(rental.customer_phone)}</div>`
        if (rental.customer_document) html += `<div>Documento: ${escapeHtml(rental.customer_document)}</div>`
        if (fullAddress) html += `<div>Endereço: ${escapeHtml(fullAddress)}</div>`
        if (rental.delivery_time) html += `<div>Entrega: ${escapeHtml(rental.delivery_time)}</div>`
        if (rental.pickup_time) html += `<div>Retirada: ${escapeHtml(rental.pickup_time)}</div>`

        if (items.length > 0) {
          html += `<div style="margin-top:6px;font-weight:bold;">Produtos:</div><ul style="margin:4px 0 0 0;padding-left:20px;">`
          items.forEach((item) => {
            html += `<li>${item.quantity}x ${escapeHtml(item.product_name)}</li>`
          })
          html += `</ul>`
        }

        html += `<div style="margin-top:8px;font-weight:bold;">Valor a receber: ${formatCurrency(pending)}</div>`
        if (rental.notes) html += `<div style="margin-top:6px;">Observações: ${escapeHtml(rental.notes)}</div>`
        html += `</div>`
      })

      container.innerHTML = html

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

      pdf.save(`roteiro_${date}.pdf`)
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

  async function handleSendWhatsApp() {
    if (selectedRentals.length === 0) return
    if (!selectedEmployeeId) {
      toast.error('Selecione um funcionário.')
      return
    }
    const employee = employees.find((e) => e.id === selectedEmployeeId)
    if (!employee) {
      toast.error('Funcionário não encontrado.')
      return
    }
    const digits = (employee.phone || '').replace(/\D/g, '')
    if (digits.length < 10) {
      toast.error('Telefone do funcionário inválido.')
      return
    }
    // Normaliza pro padrão internacional (DDI 55) usado pelo wa.me.
    const waPhone = digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits

    setSendLoading(true)
    try {
      // O texto é montado no servidor; o ENVIO é feito pelo WhatsApp do próprio
      // assinante (link wa.me), então sai do número dele — não do número da plataforma.
      const result = await buildMontagemMessage(selectedRentals.map((r) => r.id))
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      const message = (result as { message: string }).message
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank')
      toast.success(`Abrindo o WhatsApp para enviar a ${employee.name}...`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao montar o roteiro.')
    } finally {
      setSendLoading(false)
    }
  }

  function openEditEmployee(employee: Employee) {
    setEditingEmployee(employee)
    setEmployeeName(employee.name)
    setEmployeePhone(employee.phone)
    setEmployeeModalOpen(true)
  }

  async function handleSaveEmployee() {
    if (!employeeName.trim() || !employeePhone.trim()) {
      toast.error('Nome e telefone são obrigatórios.')
      return
    }
    setEmployeeSaving(true)
    try {
      const formData = new FormData()
      formData.set('name', employeeName.trim())
      formData.set('phone', employeePhone.trim())

      const result = editingEmployee
        ? await updateEmployee(editingEmployee.id, formData)
        : await createEmployee(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editingEmployee ? 'Funcionário atualizado!' : 'Funcionário adicionado!')
        setEditingEmployee(null)
        setEmployeeName('')
        setEmployeePhone('')
        await loadEmployees()
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar funcionário.')
    } finally {
      setEmployeeSaving(false)
    }
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return
    try {
      const result = await deleteEmployee(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Funcionário excluído!')
        if (selectedEmployeeId === id) setSelectedEmployeeId('')
        await loadEmployees()
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir funcionário.')
    }
  }

  const inputClasses =
    'w-full rounded-lg border border-zinc-300 bg-white py-2.5 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500'

  return (
    <div className="space-y-6">
      {/* Hidden div for PDF generation */}
      <div ref={pdfContainerRef} aria-hidden="true" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-700/10 p-2 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Montagem</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Roteiro de entregas do dia</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEmployeeModalOpen(true)}>
          <Users className="h-4 w-4" />
          Gerenciar Funcionários
        </Button>
      </div>

      {/* Date picker + actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="flex flex-1 flex-wrap items-end justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={selected.size === 0 || pdfLoading}
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar PDF
            </Button>

            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className={`${inputClasses} w-auto`}
              aria-label="Funcionário"
            >
              <option value="">Selecionar funcionário...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <Button
              onClick={handleSendWhatsApp}
              disabled={selected.size === 0 || sendLoading}
            >
              {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar WhatsApp
            </Button>
          </div>
        </div>
      </Card>

      {/* Rentals list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
        </div>
      ) : rentals.length === 0 ? (
        <div className="py-20 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Nenhuma locação para este dia
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Selecione outra data para ver o roteiro.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all */}
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500 dark:border-zinc-600"
            />
            Selecionar todos ({selected.size}/{rentals.length})
          </label>

          {rentals.map((rental) => {
            const fullAddress = buildFullAddress({
              address: rental.event_address,
              city: rental.event_city,
              state: rental.event_state,
              zip: rental.event_zip_code,
            })
            const pending = rental.total - (rental.amount_paid || 0)
            const itemsCount = (rental.rental_items || []).reduce((s, i) => s + i.quantity, 0)
            const isSelected = selected.has(rental.id)

            return (
              <Card
                key={rental.id}
                className={`p-4 transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(rental.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-blue-700 focus:ring-blue-500 dark:border-zinc-600"
                    aria-label={`Selecionar ${rental.customer_name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {rental.customer_name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {rental.delivery_time && (
                          <Badge variant="info">Entrega {rental.delivery_time}</Badge>
                        )}
                        <Badge variant={rental.status === 'delivered' ? 'warning' : 'default'}>
                          {rental.status === 'delivered' ? 'Entregue' : 'Confirmada'}
                        </Badge>
                      </div>
                    </div>

                    {fullAddress && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fullAddress}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        A receber: {formatCurrency(pending)}
                      </span>
                    </div>

                    {/* Funcionário responsável por essa locação */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Responsável:</label>
                      <select
                        value={(rental as any).assigned_employee_id || ''}
                        onChange={async (e) => {
                          const empId = e.target.value || null
                          const res = await assignRentalEmployee(rental.id, empId)
                          if (res.error) {
                            toast.error(res.error)
                            return
                          }
                          setRentals((prev) =>
                            prev.map((r) =>
                              r.id === rental.id
                                ? ({ ...r, assigned_employee_id: empId } as RentalWithItems)
                                : r
                            )
                          )
                        }}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">— sem responsável —</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Employee management modal */}
      <Modal
        open={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title="Gerenciar Funcionários"
        description="Cadastre os funcionários que receberão o roteiro de montagem por WhatsApp."
      >
        <div className="space-y-5">
          {/* Form */}
          <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {editingEmployee ? 'Editar funcionário' : 'Novo funcionário'}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Nome
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Nome do funcionário"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                WhatsApp
              </label>
              <input
                type="tel"
                value={employeePhone}
                onChange={(e) => setEmployeePhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className={inputClasses}
              />
            </div>
            <div className="flex justify-end gap-2">
              {editingEmployee && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingEmployee(null)
                    setEmployeeName('')
                    setEmployeePhone('')
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button size="sm" onClick={handleSaveEmployee} disabled={employeeSaving}>
                {employeeSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingEmployee ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingEmployee ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {employees.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum funcionário cadastrado.
              </p>
            ) : (
              employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {emp.name}
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {emp.phone}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditEmployee(emp)}
                      className="rounded p-1.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="rounded p-1.5 text-zinc-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
