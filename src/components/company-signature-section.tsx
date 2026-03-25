'use client'

import { useState, useEffect } from 'react'
import { PenTool, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignaturePad } from '@/components/signature-pad'
import { saveCompanySignature, getCompanySignature } from '@/actions/company'

export function CompanySignatureSection() {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await getCompanySignature()
        if (result.signatureUrl) {
          setSignatureUrl(result.signatureUrl)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  async function handleSave() {
    const dataUrl = drawnSignature
    if (!dataUrl) return

    setSaving(true)
    try {
      const result = await saveCompanySignature(dataUrl)
      if (result.error) {
        setToast({ type: 'error', message: result.error })
      } else {
        setSignatureUrl(dataUrl)
        setDrawing(false)
        setDrawnSignature(null)
        setToast({ type: 'success', message: 'Assinatura salva com sucesso!' })
      }
    } catch {
      setToast({ type: 'error', message: 'Erro ao salvar assinatura.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
          <span className="text-sm text-zinc-500">Carregando assinatura...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
          <PenTool className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Assinatura da Empresa
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Esta assinatura sera usada automaticamente nos contratos de locacao.
          </p>
        </div>
      </div>

      {signatureUrl && !drawing ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-300 bg-white p-4 dark:border-green-700 dark:bg-zinc-950">
            <img
              src={signatureUrl}
              alt="Assinatura da Empresa"
              className="mx-auto max-h-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Assinatura salva
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDrawing(true)
                setDrawnSignature(null)
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Refazer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <SignaturePad
            label="Desenhe a assinatura da empresa"
            onSave={(dataUrl) => setDrawnSignature(dataUrl)}
            width={500}
            height={180}
          />
          <div className="flex items-center gap-2">
            {drawing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawing(false)
                  setDrawnSignature(null)
                }}
              >
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !drawnSignature}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="h-4 w-4" />
              )}
              Salvar Assinatura
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
