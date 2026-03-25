import { MercadoPagoConfig, Preference } from 'mercadopago'

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

/**
 * Retorna a instância configurada do MercadoPago.
 * Retorna null se o token não estiver configurado.
 */
export function getMercadoPagoConfig(): MercadoPagoConfig | null {
  if (!accessToken) {
    console.warn('[MercadoPago] MERCADOPAGO_ACCESS_TOKEN não configurado. Integração desabilitada.')
    return null
  }

  return new MercadoPagoConfig({ accessToken })
}

/**
 * Retorna o client de Preference do Mercado Pago.
 * Retorna null se a integração não estiver configurada.
 */
export function getPreferenceClient(): Preference | null {
  const config = getMercadoPagoConfig()
  if (!config) return null
  return new Preference(config)
}
