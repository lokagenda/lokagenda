'use client'

import { useEffect } from 'react'

/**
 * Registra o Service Worker no root do app.
 *
 * Sem SW ativo, Chrome/Edge nao emitem `beforeinstallprompt` e o botao
 * "Instalar app" nunca aparece. Este componente eh silent — nao renderiza
 * UI, so registra o SW no primeiro load.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Silent — SW opcional. Se falhar, botao PWA nao aparece mas app
        // funciona normal.
      })
  }, [])

  return null
}
