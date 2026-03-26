import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calendar,
  MessageCircle,
  FileText,
  DollarSign,
  Bell,
  BarChart3,
  Building2,
  Package,
  Rocket,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  Ban,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PricingSection } from '@/components/public/pricing-section'
import { FaqSection } from '@/components/public/faq-section'
import { PublicHeader } from '@/components/public/header'
import { PublicFooter } from '@/components/public/footer'

const features = [
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    description: 'Controle de disponibilidade por data e horário com visualização simplificada.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    description: 'Envie orçamentos e confirmações direto para o cliente via WhatsApp.',
  },
  {
    icon: FileText,
    title: 'Contratos automáticos',
    description: 'Assinatura digital e exportação em PDF com modelos personalizáveis.',
  },
  {
    icon: DollarSign,
    title: 'Controle financeiro',
    description: 'Pagamentos, sinais e contas a receber em um só lugar.',
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Alertas de locações e pagamentos pendentes para não perder nada.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard completo',
    description: 'Visão geral do seu negócio em tempo real com gráficos e métricas.',
  },
]

const steps = [
  {
    icon: Building2,
    title: 'Cadastre sua empresa',
    description: 'Crie sua conta e configure as informações do seu negócio em minutos.',
  },
  {
    icon: Package,
    title: 'Configure seus produtos',
    description: 'Adicione seus brinquedos e equipamentos com preços e disponibilidade.',
  },
  {
    icon: Rocket,
    title: 'Comece a gerenciar',
    description: 'Receba orçamentos, gerencie locações e acompanhe tudo pelo painel.',
  },
]

const desafios = [
  {
    icon: AlertTriangle,
    title: 'Perda de agendamentos',
    description: 'Evite duplicidades e reservas perdidas',
  },
  {
    icon: ShieldAlert,
    title: 'Desorganização e erros',
    description: 'Controle manual de estoque e contratos',
  },
  {
    icon: Ban,
    title: 'Prejuízo financeiro',
    description: 'Reservas bloqueadas por falta de disponibilidade',
  },
]

export default async function LandingPage() {
  const supabase = await createClient()

  // Redirect authenticated users to dashboard
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true })

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden pt-28 pb-20 lg:pt-40 lg:pb-28">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/5 blur-3xl dark:bg-accent/10" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary dark:border-primary/30 dark:bg-primary/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              7 dias grátis para testar
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-6xl">
              Gerencie suas locações de forma{' '}
              <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                inteligente
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl">
              Sistema completo para empresas de locação de brinquedos e equipamentos para festas.
              Orçamentos, contratos, agenda e financeiro em um só lugar.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/30"
              >
                Começar grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#precos"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-8 py-4 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Ver planos
              </a>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative mx-auto mt-16 flex justify-center">
            <div className="relative w-full max-w-lg">
              <Image
                src="/images/hero-mobile.png"
                alt="LokAgenda no celular"
                width={600}
                height={800}
                className="w-full rounded-2xl shadow-2xl"
                priority
              />
              {/* Glow effect */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-transparent to-accent/20 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="funcionalidades" className="scroll-mt-20 bg-zinc-50/50 py-20 dark:bg-zinc-900/50 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Funcionalidades pensadas para simplificar a gestão do seu negócio de locação.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-primary/30 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-primary/30"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white dark:bg-primary/20">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Comece em 3 passos simples
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Configure tudo em poucos minutos e comece a gerenciar suas locações.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((step, idx) => (
              <div key={step.title} className="relative text-center">
                {/* Connector line (desktop only) */}
                {idx < steps.length - 1 && (
                  <div className="absolute top-12 left-[60%] hidden h-0.5 w-[80%] bg-gradient-to-r from-primary/30 to-primary/5 md:block" />
                )}
                <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-primary/5 dark:bg-primary/10" />
                  <step.icon className="relative h-10 w-10 text-primary" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Desafios ───── */}
      <section className="bg-zinc-50/50 py-20 dark:bg-zinc-900/50 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Os desafios de quem aluga brinquedos...
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {desafios.map((desafio) => (
              <div
                key={desafio.title}
                className="group rounded-2xl border border-red-200 bg-white p-6 transition-all hover:shadow-lg dark:border-red-900/40 dark:bg-zinc-800/50"
              >
                <div className="mb-4 inline-flex rounded-xl bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  <desafio.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{desafio.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {desafio.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-2xl text-center">
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Com <span className="font-bold text-primary">LokAgenda</span>, isso fica no passado. Sua gestão fica online, inteligente e sem perdas.
            </p>
          </div>
        </div>
      </section>

      {/* ───── Pricing ───── */}
      <div className="bg-zinc-50/50 dark:bg-zinc-900/50">
        <PricingSection plans={(plans as any) || []} />
      </div>

      {/* ───── FAQ ───── */}
      <FaqSection />

      {/* ───── Final CTA ───── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-8 py-16 text-center shadow-2xl sm:px-16">
            {/* Decorative circles */}
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-white/10" />

            <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
              Pronto para começar?
            </h2>
            <p className="relative mt-4 text-lg text-blue-100">
              Junte-se a centenas de empresas que já simplificaram sua gestão de locações.
            </p>
            <Link
              href="/register"
              className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl"
            >
              Criar conta grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
      </main>
      <PublicFooter />
    </div>
  )
}
