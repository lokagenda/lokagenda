'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Star, ArrowRight } from 'lucide-react'

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

function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const pricingOptions: {
  key: BillingCycle
  label: string
  suffix: string
  badge?: string
  highlight?: boolean
  totalMonths: number
}[] = [
  { key: 'monthly', label: 'Mensal', suffix: '/mês', totalMonths: 1 },
  { key: 'semiannual', label: 'Semestral', suffix: '/mês', badge: 'Economize ~17%', totalMonths: 6 },
  { key: 'annual', label: 'Anual', suffix: '/mês', badge: 'Economize ~33%', highlight: true, totalMonths: 12 },
]

export function PricingSection({ plans }: { plans: Plan[] }) {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('annual')

  // Use the first (and likely only) plan
  const plan = plans.length > 0 ? plans[0] : null

  if (!plan) return null

  const features = Array.isArray(plan.features) ? plan.features : []

  const prices: Record<BillingCycle, number> = {
    monthly: plan.price_monthly || 59.99,
    semiannual: plan.price_semiannual || 49.99,
    annual: plan.price_annual || 39.99,
  }

  return (
    <section id="precos" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Planos que cabem no seu bolso
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Escolha o período ideal para o seu negócio. Teste grátis por 7 dias.
          </p>
        </div>

        {/* Single plan card with 3 pricing columns */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-700 dark:bg-zinc-800/50">
            {/* Plan name */}
            <div className="mb-8 text-center">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
              {plan.description && (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{plan.description}</p>
              )}
            </div>

            {/* Pricing options */}
            <div className="grid gap-4 sm:grid-cols-3">
              {pricingOptions.map((option) => {
                const price = prices[option.key]
                const isSelected = selectedCycle === option.key
                const total = price * option.totalMonths

                return (
                  <button
                    key={option.key}
                    onClick={() => setSelectedCycle(option.key)}
                    className={`relative flex flex-col items-center rounded-xl border-2 p-5 transition-all ${
                      isSelected
                        ? option.highlight
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20 dark:bg-primary/10'
                          : 'border-primary bg-primary/5 shadow-md dark:bg-primary/10'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500'
                    }`}
                  >
                    {option.badge && (
                      <span
                        className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-semibold ${
                          option.highlight
                            ? 'bg-primary text-white'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {option.highlight && <Star className="h-3 w-3 fill-current" />}
                        {option.badge}
                      </span>
                    )}

                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {option.label}
                    </span>

                    <span className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-white">
                      {formatPrice(price)}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{option.suffix}</span>

                    {option.totalMonths > 1 && (
                      <span className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                        {formatPrice(total)} total
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Limits */}
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Até {plan.max_products} produtos</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>Até {plan.max_rentals_month} locações/mês</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>Até {plan.max_users} {plan.max_users === 1 ? 'usuário' : 'usuários'}</span>
            </div>

            {/* Features */}
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-8 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/30"
              >
                Começar grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                7 dias grátis, sem compromisso. Cancele quando quiser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
