import type { Quote, Company } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'

type QuoteItemLike = {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export function generateQuoteMessage(
  quote: Partial<Quote> & { customer_name: string; event_date: string; total: number; discount?: number },
  items: QuoteItemLike[],
  company: Partial<Company> & { name: string }
): string {
  const itemLines = items
    .map(
      (item, i) =>
        `${i + 1}. ${item.product_name} — Qtd: ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.subtotal)}`
    )
    .join('\n')

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

  let message = `*${company.name}*\n`
  message += `──────────────────\n`
  message += `*ORÇAMENTO*\n\n`
  message += `*Cliente:* ${quote.customer_name}\n`
  message += `*Data do Evento:* ${formatDate(quote.event_date)}\n`

  if (quote.event_address) {
    const addressParts = [
      quote.event_address,
      quote.event_city,
      quote.event_state,
    ].filter(Boolean)
    message += `*Local:* ${addressParts.join(', ')}\n`
  }

  if (quote.delivery_time) {
    message += `*Entrega:* ${quote.delivery_time}\n`
  }
  if (quote.pickup_time) {
    message += `*Retirada:* ${quote.pickup_time}\n`
  }

  message += `\n*Itens:*\n${itemLines}\n\n`
  message += `*Subtotal:* ${formatCurrency(subtotal)}\n`

  if (quote.discount && quote.discount > 0) {
    message += `*Desconto:* ${formatCurrency(quote.discount)}\n`
  }

  message += `*TOTAL: ${formatCurrency(quote.total)}*\n\n`

  if (quote.notes) {
    message += `*Obs:* ${quote.notes}\n\n`
  }

  message += `Aguardamos sua confirmação! 😊`

  return message
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const phoneWithCountry = digits.startsWith('55') ? digits : `55${digits}`
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`
}
