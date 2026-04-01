import type { Quote, Company } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'

type QuoteItemLike = {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export function generateQuoteMessage(
  quote: Partial<Quote> & { customer_name: string; event_date: string; total: number; discount?: number; freight?: number },
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

  if (quote.freight && quote.freight > 0) {
    message += `*Frete:* ${formatCurrency(quote.freight)}\n`
  }

  message += `*TOTAL: ${formatCurrency(quote.total)}*\n\n`

  if (quote.notes) {
    message += `*Obs:* ${quote.notes}\n\n`
  }

  message += `Aguardamos sua confirmação! 😊`

  return message
}

type RentalLike = {
  customer_name: string
  event_date: string
  event_address?: string | null
  event_city?: string | null
  event_state?: string | null
  delivery_time?: string | null
  pickup_time?: string | null
  notes?: string | null
  total: number
  discount?: number | null
  freight?: number | null
}

export function generateRentalConfirmationMessage(
  rental: RentalLike,
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
  message += `*LOCAÇÃO CONFIRMADA* ✅\n\n`
  message += `*Cliente:* ${rental.customer_name}\n`
  message += `*Data do Evento:* ${formatDate(rental.event_date)}\n`

  if (rental.event_address) {
    const addressParts = [
      rental.event_address,
      rental.event_city,
      rental.event_state,
    ].filter(Boolean)
    message += `*Local:* ${addressParts.join(', ')}\n`
  }

  if (rental.delivery_time) {
    message += `*Entrega:* ${rental.delivery_time}\n`
  }
  if (rental.pickup_time) {
    message += `*Retirada:* ${rental.pickup_time}\n`
  }

  message += `\n*Itens:*\n${itemLines}\n\n`
  message += `*Subtotal:* ${formatCurrency(subtotal)}\n`

  if (rental.discount && rental.discount > 0) {
    message += `*Desconto:* ${formatCurrency(rental.discount)}\n`
  }

  if (rental.freight && rental.freight > 0) {
    message += `*Frete:* ${formatCurrency(rental.freight)}\n`
  }

  message += `*TOTAL: ${formatCurrency(rental.total)}*\n\n`

  if (rental.notes) {
    message += `*Obs:* ${rental.notes}\n\n`
  }

  message += `Locação confirmada! Aguardamos você no dia do evento. 😊`

  return message
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const phoneWithCountry = digits.startsWith('55') ? digits : `55${digits}`
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`
}
