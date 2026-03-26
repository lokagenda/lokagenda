'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqItems = [
  {
    question: 'Posso testar grátis?',
    answer:
      'Sim! Oferecemos 7 dias de teste grátis em todos os planos. Você pode explorar todas as funcionalidades sem compromisso e sem precisar cadastrar cartão de crédito.',
  },
  {
    question: 'Quais formas de pagamento?',
    answer:
      'Aceitamos PIX, cartão de crédito (todas as bandeiras) e boleto bancário. Para planos semestrais e anuais, oferecemos descontos especiais.',
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer:
      'Sim, você pode cancelar sua assinatura a qualquer momento diretamente pelo painel. Não há multa ou taxa de cancelamento. Seu acesso continua até o fim do período já pago.',
  },
  {
    question: 'Quantos produtos posso cadastrar?',
    answer:
      'O LokAgenda oferece cadastro ilimitado de produtos, locações e usuários em todos os planos.',
  },
  {
    question: 'O sistema funciona no celular?',
    answer:
      'Sim, o LokAgenda é 100% responsivo e funciona perfeitamente em smartphones, tablets e computadores. Você pode gerenciar suas locações de qualquer lugar.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer:
      'Absolutamente. Utilizamos criptografia de ponta a ponta, servidores seguros e fazemos backups diários automáticos. Seus dados e os dos seus clientes estão sempre protegidos.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Tire suas dúvidas sobre o LokAgenda
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white sm:text-base">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? 'max-h-96 pb-4' : 'max-h-0'
                  }`}
                >
                  <p className="px-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.answer}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
