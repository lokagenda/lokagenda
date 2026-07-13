'use client'

import { useEffect } from 'react'

/**
 * Registra o Service Worker + captura eventos PWA cedo (root layout).
 *
 * Por que aqui (e nao no PWAInstallButton):
 *   PWAInstallButton so eh montado em /dashboard/* (esta dentro do Header
 *   que so aparece autenticado). Chrome/Edge disparam `beforeinstallprompt`
 *   ~5s apos pageload, geralmente enquanto o usuario ainda esta em /login.
 *   Se nao ha listener naquele momento, Chrome DESCARTA o evento pra
 *   sempre nessa sessao (spec — nao ha retentativa).
 *
 * Solucao: capturar `beforeinstallprompt` no root layout (esse componente
 * roda em toda rota, incluindo /login) e cachear em window.__pwaInstallPrompt.
 * PWAInstallButton le esse cache no mount + escuta o CustomEvent que
 * emitimos aqui pra receber disparos futuros.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null
    __pwaInstalled?: boolean
  }
}

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Service Worker (produção apenas — em dev não faz sentido cachear)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // Silent — SW opcional. Se falhar, botao PWA continua funcionando
          // pelo caminho manual.
        })
    }

    // 2. Captura `beforeinstallprompt` em prod E dev (nao depende do SW).
    //    Salva em window pro PWAInstallButton ler mesmo se montar depois.
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault() // impede o mini-infobar padrao do Chrome
      window.__pwaInstallPrompt = e as BeforeInstallPromptEvent
      window.dispatchEvent(new CustomEvent('pwa:install-ready'))
    }

    const handleAppInstalled = () => {
      window.__pwaInstallPrompt = null
      window.__pwaInstalled = true
      window.dispatchEvent(new CustomEvent('pwa:installed'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return null
}
