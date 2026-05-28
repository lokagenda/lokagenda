'use client'

import { useState } from 'react'

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '')
}

export function formatCPF(value: string): string {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatCNPJ(value: string): string {
  const d = digitsOnly(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

const inputClasses =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface DocumentFieldProps {
  /** Valor inicial do documento (CPF ou CNPJ, formatado ou só dígitos). */
  defaultValue?: string | null
  /** Nome do input enviado no FormData (default: "document"). */
  name?: string
  label?: string
}

/**
 * Campo combinado de CPF/CNPJ com seletor de tipo e máscara dinâmica.
 * Infere o tipo inicial pelo tamanho (>11 dígitos = CNPJ). O valor é enviado
 * formatado no input `name` (default "document"); um input oculto envia o tipo.
 */
export function DocumentField({ defaultValue, name = 'document', label = 'CPF / CNPJ' }: DocumentFieldProps) {
  const initialDigits = digitsOnly(defaultValue || '')
  const initialType: 'cpf' | 'cnpj' = initialDigits.length > 11 ? 'cnpj' : 'cpf'
  const [type, setType] = useState<'cpf' | 'cnpj'>(initialType)
  const [value, setValue] = useState(
    defaultValue ? (initialType === 'cnpj' ? formatCNPJ(defaultValue) : formatCPF(defaultValue)) : ''
  )

  function format(v: string, t: 'cpf' | 'cnpj') {
    return t === 'cnpj' ? formatCNPJ(v) : formatCPF(v)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as 'cpf' | 'cnpj'
            setType(t)
            setValue(format(value, t))
          }}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Tipo de documento"
        >
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
        </select>
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(format(e.target.value, type))}
          placeholder={type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
          className={inputClasses}
          inputMode="numeric"
        />
        <input type="hidden" name={`${name}_type`} value={type} />
      </div>
    </div>
  )
}
