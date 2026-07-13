'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Portal } from '@/components/ui/portal'

/**
 * Botao "Instalar app" pro header do dashboard.
 *
 * Comportamento:
 *   - Modo PWA (rodando dentro do app instalado, `display-mode: standalone`):
 *     esconde o botao — nao faz sentido mostrar la dentro.
 *   - Chrome/Edge/Android: se o navegador emitiu `beforeinstallprompt`,
 *     ao clicar dispara o prompt nativo. Senao, abre o modal com passo
 *     a passo manual.
 *   - Safari iOS: sempre mostra o botao com passo a passo (iOS nao dispara
 *     `beforeinstallprompt` nem oferece prompt automatico).
 *   - Desktop sem PWA API: mesma coisa — mostra botao que abre modal
 *     universal com instrucoes de cada navegador.
 *
 * Ajuste 13/jul/2026: antes usava `navigator.standalone` (Safari-only) pra
 * detectar "ja instalado", mas ele fica true fantasma em alguns iOS depois
 * que o usuario apaga o atalho. Trocamos por `matchMedia('display-mode:
 * standalone')` que so eh true DENTRO do PWA rodando. Fora do PWA (mesmo
 * apos instalar+desinstalar), botao volta a aparecer.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

type Platform = 'ios' | 'android' | 'desktop-chromium' | 'desktop-safari' | 'other'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'other'
  const ua = window.navigator.userAgent.toLowerCase()
  // iOS eh iOS pra qualquer browser (Safari, Chrome, Firefox, Edge — todos
  // usam o mesmo Add to Home Screen do WebKit, ninguem tem beforeinstallprompt).
  const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('mac') && 'ontouchend' in document)
  if (isIOS) return 'ios'
  const isAndroid = /android/.test(ua)
  if (isAndroid) return 'android'
  const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|edg/.test(ua)
  if (isSafari) return 'desktop-safari'
  const isChromium = /chrome|chromium|edg/.test(ua)
  if (isChromium) return 'desktop-chromium'
  return 'other'
}

export function PWAInstallButton() {
  const [mounted, setMounted] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [inPWA, setInPWA] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    setMounted(true)
    setPlatform(detectPlatform())

    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    setInPWA(standaloneMedia.matches || !!window.__pwaInstalled)
    const onChange = (e: MediaQueryListEvent) => setInPWA(e.matches)
    standaloneMedia.addEventListener('change', onChange)

    // Le o cache global setado pelo PWARegister — o evento
    // `beforeinstallprompt` provavelmente ja foi capturado em /login antes
    // deste componente montar. Sem esse lookup, prompt nativo eh perdido.
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt)
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    // CustomEvent do PWARegister — dispara depois que ele captura o evento.
    const handleInstallReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt)
      }
    }
    const handleInstalled = () => {
      setDeferredPrompt(null)
      setInPWA(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('pwa:install-ready', handleInstallReady)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('pwa:installed', handleInstalled)

    return () => {
      standaloneMedia.removeEventListener('change', onChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('pwa:install-ready', handleInstallReady)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('pwa:installed', handleInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setDeferredPrompt(null)
      } catch {
        setShowHint(true)
      }
      return
    }
    setShowHint(true)
  }

  // Nao renderiza durante SSR/primeiro mount pra evitar hydration mismatch.
  if (!mounted) return null
  // Ja tá rodando dentro do app instalado — nao faz sentido mostrar.
  if (inPWA) return null

  const hintTitle =
    platform === 'ios'
      ? 'Instalar no iPhone/iPad'
      : platform === 'android'
        ? 'Instalar no Android'
        : platform === 'desktop-safari'
          ? 'Instalar no Safari (Mac)'
          : 'Instalar como app'

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Instalar como app"
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
      >
        <Download className="h-4 w-4" />
        <span>Instalar</span>
      </button>

      {showHint && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={() => setShowHint(false)}
          >
            <div
              className="mx-4 mb-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:mb-0"
              onClick={(e) => e.stopPropagation()}
            >
            <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-white">
              {hintTitle}
            </h3>

            {platform === 'ios' && (
              <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li>
                  1. Toque no botao <strong>Compartilhar</strong> na barra do Safari (icone com seta pra cima).
                </li>
                <li>
                  2. Role e escolha <strong>Adicionar a Tela de Inicio</strong>.
                </li>
                <li>
                  3. Toque em <strong>Adicionar</strong>. O icone do LokAgenda aparece na sua tela.
                </li>
              </ol>
            )}

            {platform === 'android' && (
              <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li>1. Toque no menu do navegador (tres pontinhos no canto superior direito).</li>
                <li>
                  2. Escolha <strong>Instalar app</strong> ou <strong>Adicionar a tela inicial</strong>.
                </li>
                <li>3. Confirme. O icone aparece na sua tela inicial.</li>
              </ol>
            )}

            {platform === 'desktop-chromium' && (
              <>
                <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <li>
                    1. Na barra de endereco, clique no icone de <strong>Instalar</strong> (parece um monitor
                    com seta pra baixo).
                  </li>
                  <li>
                    2. Se nao aparecer, va no menu (3 pontinhos) &gt; <strong>Salvar e compartilhar</strong>
                    {' '}&gt; <strong>Instalar LokAgenda</strong>.
                  </li>
                  <li>3. Confirma. O app abre em janela propria e cria atalho.</li>
                </ol>
                <p className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <strong>Ja instalou antes?</strong> Se o prompt automatico nao voltou, cola{' '}
                  <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">chrome://apps</code> (ou{' '}
                  <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">edge://apps</code>) na barra
                  de endereco, clica com botao direito no LokAgenda &gt; <strong>Remover</strong>, e
                  recarrega esta pagina.
                </p>
              </>
            )}

            {platform === 'desktop-safari' && (
              <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li>
                  1. Menu <strong>Arquivo</strong> &gt; <strong>Adicionar ao Dock</strong>.
                </li>
                <li>2. Confirma o nome LokAgenda e clica adicionar.</li>
                <li>3. O icone aparece no Dock e abre em janela propria.</li>
              </ol>
            )}

            {platform === 'other' && (
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
                Use Chrome, Edge, Safari ou Firefox atualizado. No menu do navegador procure por
                <strong> Instalar app</strong> ou <strong>Adicionar a tela inicial</strong>.
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowHint(false)}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Entendi
            </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
