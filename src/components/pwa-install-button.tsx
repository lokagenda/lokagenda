'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Botao "Instalar app" pro header do dashboard.
 *
 * Comportamento:
 *   - Chrome/Edge/Android: captura o evento `beforeinstallprompt`, mostra o
 *     botao. Ao clicar, dispara o prompt nativo do navegador.
 *   - Safari iOS: NAO dispara `beforeinstallprompt`. Detectamos iOS e
 *     mostramos um botao com dica "Adicione a Tela de Inicio pelo botao
 *     Compartilhar" (comportamento padrao Apple).
 *   - App ja instalado (`display-mode: standalone` OU `navigator.standalone`
 *     no iOS): esconde o botao.
 *   - Navegador nao suporta PWA (Firefox desktop antigo, etc): esconde.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    // Ja instalado?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error — Safari-only
      window.navigator.standalone === true
    if (standalone) {
      setIsInstalled(true)
      return
    }

    // Detecta iOS Safari (nao dispara beforeinstallprompt).
    const ua = window.navigator.userAgent.toLowerCase()
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios|edgios/.test(ua)
    setIsIOS(iOS)

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSHint(true)
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (isInstalled) return null
  if (!isIOS && !deferredPrompt) return null

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Instalar como app"
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>

      {showIOSHint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="mx-4 mb-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-white">
              Instalar no iPhone/iPad
            </h3>
            <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <li>
                1. Toque no botao <strong>Compartilhar</strong> na barra do Safari (icone com
                seta pra cima).
              </li>
              <li>
                2. Role e escolha <strong>Adicionar a Tela de Inicio</strong>.
              </li>
              <li>3. Toque em <strong>Adicionar</strong>. O icone do LokAgenda aparece na sua tela.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSHint(false)}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  )
}
