'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renderiza children num portal para document.body.
 *
 * Use quando o componente pai (ou algum ancestral) tem propriedades CSS
 * que criam um "containing block" e quebram `position: fixed` de
 * descendentes:
 *   - transform (qualquer valor != none)
 *   - filter
 *   - backdrop-filter          <-- header do dashboard
 *   - perspective
 *   - will-change: transform
 *   - contain: layout|paint|strict|content
 *
 * Casos de uso conhecidos no repo:
 *   - Modais renderizados dentro do <header sticky> (que tem backdrop-blur-md).
 *     Sem portal, o fixed inset-0 do modal vira relativo a caixa de 64px
 *     do header em vez da viewport — no iPhone Safari o layout "colapsa".
 *
 * SSR-safe: primeiro render devolve null (sem document). Depois do mount,
 * portala. Nao ha hydration mismatch porque server e client render inicial
 * batem (null).
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
