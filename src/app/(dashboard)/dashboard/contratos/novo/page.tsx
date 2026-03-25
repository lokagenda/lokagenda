'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Save, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { createTemplate } from '@/actions/contracts'
import { replaceVariables, getSampleData, getDefaultTemplate } from '@/lib/contract'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const AVAILABLE_VARIABLES = [
  { var: '{{nome_cliente}}', desc: 'Nome do cliente' },
  { var: '{{cpf_cliente}}', desc: 'CPF do cliente' },
  { var: '{{telefone_cliente}}', desc: 'Telefone do cliente' },
  { var: '{{email_cliente}}', desc: 'E-mail do cliente' },
  { var: '{{endereco_evento}}', desc: 'Endereço do evento' },
  { var: '{{data_evento}}', desc: 'Data do evento' },
  { var: '{{horario_entrega}}', desc: 'Horário de entrega' },
  { var: '{{horario_retirada}}', desc: 'Horário de retirada' },
  { var: '{{itens_locacao}}', desc: 'Lista de itens da locação' },
  { var: '{{valor_total}}', desc: 'Valor total' },
  { var: '{{valor_desconto}}', desc: 'Valor do desconto' },
  { var: '{{valor_frete}}', desc: 'Valor do frete/deslocamento' },
  { var: '{{valor_pago}}', desc: 'Valor pago (sinal)' },
  { var: '{{valor_restante}}', desc: 'Valor restante a pagar' },
  { var: '{{status_pagamento}}', desc: 'Status do pagamento' },
  { var: '{{nome_empresa}}', desc: 'Nome da empresa' },
  { var: '{{telefone_empresa}}', desc: 'Telefone da empresa' },
  { var: '{{cnpj_empresa}}', desc: 'CNPJ/CPF da empresa' },
  { var: '{{data_atual}}', desc: 'Data atual' },
]

export default function NovoContratoPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [content, setContent] = useState(getDefaultTemplate())
  const [isDefault, setIsDefault] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const formData = new FormData()
    formData.set('name', name)
    formData.set('content', content)
    formData.set('is_default', isDefault ? 'true' : 'false')

    startTransition(async () => {
      const result = await createTemplate(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  const previewHtml = replaceVariables(content, getSampleData())

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/contratos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para modelos
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Novo Modelo de Contrato</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Crie um modelo de contrato com variáveis que serão substituídas automaticamente.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Nome do modelo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Contrato Padrão de Locação"
              required
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Conteúdo do contrato (HTML)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500"
                placeholder="Digite o conteúdo HTML do contrato..."
                required
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500 dark:border-zinc-700"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Definir como modelo padrão
              </span>
            </label>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                <Save className="h-4 w-4" />
                {isPending ? 'Salvando...' : 'Salvar Modelo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4" />
                {showPreview ? 'Ocultar Preview' : 'Preview'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowHelp(!showHelp)}
                className="lg:hidden"
              >
                <HelpCircle className="h-4 w-4" />
                Variáveis
           </Button>
            </div>
          </form>

          {/* Preview */}
          {showPreview && (
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Preview (com dados de exemplo)
              </h2>
              <div
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        {/* Variables Help Panel */}
        <div className={`${showHelp ? 'block' : 'hidden'} lg:block`}>
          <div className="sticky top-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Variáveis Disponíveis</h3>
            </div>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              Use estas variáveis no conteúdo do contrato. Elas serão substituídas pelos dados reais ao gerar o contrato.
            </p>
            <div className="space-y-2.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <div key={v.var} className="group">
                  <code className="block rounded bg-zinc-100 px-2 py-1 text-xs font-mono text-blue-800 dark:bg-zinc-800 dark:text-blue-400">
                    {v.var}
                  </code>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
