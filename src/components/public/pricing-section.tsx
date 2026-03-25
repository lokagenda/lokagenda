'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Star } from 'lucide-react'

type BillingCycle = 'monthly' | 'semiannual' | 'annual'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_semiannual: number
  price_annual: number
  max_products: number
  max_rentals_month: number
  max_users: number
  features: string[]
  position: number
}

const cycleLabels: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
}

const cycleDiscount: Record<BillingCycle, string> = {
  monthly: '',
  semiannual: 'Economize 10%',
  annual: 'Economize 20%',
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getPriceForCycle(plan: Plan, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return plan.price_monthly
    case 'semiannual':
      return plan.price_semiannual
    case 'annual':
      return plan.price_annual
  }
}

function getCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly':
      return '/mes'
    case 'semiannual':
      return '/mes'
    case 'annual':
      return '/mes'
  }
}

export function PricingSection({ plans }: { plans: Plan[] }) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  const sortedPlans = [...plans].sort((a, b) => a.position - b.position)

  return (
    <section id="precos" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Planos que cabem no seu bolso
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Escolha o plano ideal para o tamanho do seu negocio. Teste gratis por 7 dias.
          </p>
        </div>

        {/* Toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {(Object.keys(cycleLabels) as BillingCycle[]).map((key) => (
              <button
                key={key}
                onClick={() => setCycle(key)}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  cycle === key
                    ? 'bg-white text-primary shadow-sm dark:bg-zinc-700 dark:text-primary'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {cycleLabels[key]}
                {cycleDiscount[key] && (
                  <span className="ml-1.5 hidden rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400 sm:inline">
                    {cycleDiscount[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {sortedPlans.map((plan) => {
            const isPopular = plan.slug === 'profissional'
            const price = getPriceForCycle(plan, cycle)
            const features = Array.isArray(plan.features) ? plan.features : []

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 transition-shadow hover:shadow-lg ${
                  isPopular
                    ? 'border-primary bg-primary/[0.02] shadow-md ring-2 ring-primary/20 dark:border-primary dark:bg-primary/[0.05]'
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      <Star className="h-3 w-3 fill-current" />
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.description}</p>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">
                    {formatPrice(price)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">{getCycleLabel(cycle)}</span>
                </div>

                <div className="mb-6 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <p>Ate {plan.max_products} produtos</p>
                  <p>Ate {plan.max_rentals_month} locacoes/mes</p>
                  <p>Ate {plan.max_users} {plan.max_users === 1 ? 'usuario' : 'usuarios'}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                    isPopular
                      ? 'bg-primary text-white hover:bg-primary-hover'
                      : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600'
                  }`}
                >
                  Escolher plano
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
