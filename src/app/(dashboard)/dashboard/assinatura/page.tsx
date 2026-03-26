'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CreditCard,
  Crown,
  Check,
  AlertTriangle,
  Loader2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { getSubscription, getPlans, cancelSubscription } from '@/actions/subscriptions'
import type { Plan, Subscription } from '@/types/database'
import { isSubscriptionActive, getTrialDaysRemaining } from '@/lib/plans'

type BillingCycle = 'monthly' | 'semiannual' | 'annual'

type SubscriptionWithPlan = Subscription & {
  plans: Plan
}

const cycleConfig: Record<BillingCycle, {
  label: string
  pricePerMonth: number
  totalPrice: number
  months: number
  savings: string | null
  description: string
}> = {
  monthly: {
    label: 'Mensal',
    pricePerMonth: 59.99,
    totalPrice: 59.99,
    months: 1,
    savings: null,
    description: 'Cobrança mensal, cancele quando quiser',
  },
  semiannual: {
    label: 'Semestral',
    pricePerMonth: 49.99,
    totalPrice: 299.94,
    months: 6,
    savings: '~17%',
    description: 'R$ 299,94 a cada 6 meses',
  },
  annual: {
    label: 'Anual',
    pricePerMonth: 39.99,
    totalPrice: 479.88,
    months: 12,
    savings: '~33%',
    description: 'R$ 479,88 por ano',
  },
}

const statusLabels: Record<string, { label: string; color: string }> = {
  trial: { label: 'Teste Grátis', color: 'bg-yellow-500/10 text-yellow-500' },
  active: { label: 'Ativo', color: 'bg-green-500/10 text-green-500' },
  past_due: { label: 'Pagamento Pendente', color: 'bg-red-500/10 text-red-500' },
  cancelled: { label: 'Cancelado', color: 'bg-zinc-500/10 text-zinc-500' },
  expired: { label: 'Expirado', color: 'bg-zinc-500/10 text-zinc-500' },
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function AssinaturaPage() {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<BillingCycle | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [subResult, plansResult] = await Promise.all([
        getSubscription(),
        getPlans(),
      ])
      setSubscription(subResult.data as SubscriptionWithPlan | null)
      // Single plan - use the first active one
      if (plansResult.data && plansResult.data.length > 0) {
        setPlan(plansResult.data[0])
      }
    } catch {
      console.error('Erro ao carregar dados da assinatura')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Verificar status do URL (retorno do Mercado Pago)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (status === 'success') {
      setMessage({ type: 'success', text: 'Pagamento realizado com sucesso! Sua assinatura será ativada em instantes.' })
      window.history.replaceState({}, '', '/dashboard/assinatura')
      setTimeout(() => loadData(), 3000)
    } else if (status === 'failure') {
      setMessage({ type: 'error', text: 'O pagamento não foi aprovado. Tente novamente.' })
      window.history.replaceState({}, '', '/dashboard/assinatura')
    } else if (status === 'pending') {
      setMessage({ type: 'success', text: 'Pagamento pendente. Aguarde a confirmação.' })
      window.history.replaceState({}, '', '/dashboard/assinatura')
    }
  }, [loadData])

  const handleSubscribe = async (cycle: BillingCycle) => {
    if (!plan) return
    setSubscribing(cycle)
    setMessage(null)

    try {
      const subData = await getSubscription()
      let companyId = ''

      if (subData.data) {
        companyId = (subData.data as SubscriptionWithPlan).company_id
      }

      if (!companyId) {
        setMessage({ type: 'error', text: 'Não foi possível identificar a empresa.' })
        setSubscribing(null)
        return
      }

      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: cycle,
          companyId,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        setSubscribing(null)
        return
      }

      const checkoutUrl = data.init_point || data.sandbox_init_point
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        setMessage({ type: 'error', text: 'Não foi possível criar o link de pagamento.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao processar assinatura. Tente novamente.' })
    } finally {
      setSubscribing(null)
    }
  }

  const handleCancel = async () => {
    if (!subscription) return
    setCancelling(true)
    setMessage(null)

    try {
      const result = await cancelSubscription(subscription.id)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Assinatura cancelada com sucesso.' })
        await loadData()
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao cancelar assinatura.' })
    } finally {
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const isActive = subscription ? isSubscriptionActive(subscription) : false
  const trialDays = subscription ? getTrialDaysRemaining(subscription) : 0
  const features = plan ? (plan.features as string[]) || [] : []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Assinatura</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Gerencie seu plano e assinatura
        </p>
      </div>

      {/* Mensagens */}
      {message && (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Assinatura Atual */}
      {subscription && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Plano Atual
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Detalhes da sua assinatura
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Plano</span>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                {subscription.plans?.name || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusLabels[subscription.status]?.color || 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {statusLabels[subscription.status]?.label || subscription.status}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Período</span>
              <p className="mt-1 text-sm text-zinc-900 dark:text-white">
                {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Valor</span>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                {subscription.status === 'trial'
                  ? 'Grátis (Trial)'
                  : formatCurrency(subscription.current_price)}
              </p>
            </div>
          </div>

          {/* Trial banner */}
          {subscription.status === 'trial' && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
              <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  {trialDays > 0
                    ? `Seu teste grátis expira em ${trialDays} dia${trialDays !== 1 ? 's' : ''}. Escolha um plano abaixo para continuar usando.`
                    : 'Seu teste grátis expirou. Assine um plano para continuar.'}
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          {subscription.status === 'active' && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                Cancelar assinatura
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmação de cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Cancelar assinatura
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos do plano
              quando o período atual terminar.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Manter plano
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plano e opções de ciclo */}
      {plan && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isActive && subscription?.status === 'active' ? 'Alterar Plano' : 'Escolher Plano'}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Selecione o ciclo de cobrança ideal para o seu negócio
            </p>
          </div>

          {/* Plan name header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Crown className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
              {plan.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.description}</p>
              )}
            </div>
          </div>

          {/* 3 pricing columns */}
          <div className="grid gap-6 md:grid-cols-3">
            {(['monthly', 'semiannual', 'annual'] as BillingCycle[]).map((cycle) => {
              const config = cycleConfig[cycle]
              const isPopular = cycle === 'semiannual'
              const isCurrentCycle = subscription?.billing_cycle === cycle && isActive && subscription?.status === 'active'

              return (
                <div
                  key={cycle}
                  className={`relative flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-lg ${
                    isPopular
                      ? 'border-blue-500 bg-white shadow-lg shadow-blue-500/10 dark:border-blue-500 dark:bg-zinc-900'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                        <Sparkles className="h-3 w-3" />
                        Melhor custo-benefício
                      </span>
                    </div>
                  )}

                  {/* Cycle header */}
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-zinc-900 dark:text-white">
                      {config.label}
                    </h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {config.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(config.pricePerMonth)}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">/mês</span>
                    </div>
                    {config.savings && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Total: {formatCurrency(config.totalPrice)}
                        </span>
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                          Economia de {config.savings}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-3">
                    <li className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                      Até {plan.max_products} produtos
                    </li>
                    <li className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                      Até {plan.max_rentals_month} locações/mês
                    </li>
                    <li className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                      Até {plan.max_users} usuários
                    </li>
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <Check className="h-4 w-4 shrink-0 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleSubscribe(cycle)}
                    disabled={!!subscribing || isCurrentCycle}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isCurrentCycle
                        ? 'border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        : isPopular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                    }`}
                  >
                    {subscribing === cycle ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrentCycle ? (
                      'Plano atual'
                    ) : (
                      'Assinar'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
