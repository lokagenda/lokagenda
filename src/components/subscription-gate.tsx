'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, CreditCard } from 'lucide-react'

interface SubscriptionGateProps {
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due'
  trialDaysRemaining?: number
  children: React.ReactNode
}

export function SubscriptionGate({
  status,
  trialDaysRemaining = 0,
  children,
}: SubscriptionGateProps) {
  const needsSubscription = status === 'none' || status === 'expired' || status === 'cancelled'
  const isTrial = status === 'trial' && trialDaysRemaining > 0
  const isTrialExpired = status === 'trial' && trialDaysRemaining <= 0
  const isPastDue = status === 'past_due'

  return (
    <>
      {/* Trial banner */}
      {isTrial && (
        <div className="border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Teste grátis: <strong>{trialDaysRemaining} dia{trialDaysRemaining !== 1 ? 's' : ''} restante{trialDaysRemaining !== 1 ? 's' : ''}</strong>
              </span>
            </div>
            <Link
              href="/dashboard/assinatura"
              className="shrink-0 rounded-md bg-yellow-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-yellow-700"
            >
              Escolher plano
            </Link>
          </div>
        </div>
      )}

      {/* Past due banner */}
      {isPastDue && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Pagamento pendente.</strong> Atualize seu método de pagamento para evitar a suspensão.
              </span>
            </div>
            <Link
              href="/dashboard/assinatura"
              className="shrink-0 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              Resolver
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative">
        {children}

        {/* Overlay para assinatura expirada/inexistente */}
        {(needsSubscription || isTrialExpired) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <CreditCard className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {isTrialExpired ? 'Seu teste grátis expirou' : 'Assine um plano para continuar'}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {isTrialExpired
                  ? 'O período de teste acabou. Escolha um plano para continuar utilizando todos os recursos do LokAgenda.'
                  : 'Para acessar o sistema, você precisa de uma assinatura ativa. Escolha o plano ideal para o seu negócio.'}
              </p>
              <Link
                href="/dashboard/assinatura"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <CreditCard className="h-4 w-4" />
                Ver planos e assinar
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
