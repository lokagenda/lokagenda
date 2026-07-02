/**
 * Client Asaas — provider de pagamento. Substituiu MercadoPago em 02/jul.
 *
 * Auth: header `access_token` (minusculo, literal — nao eh Bearer).
 * Base URL prod: https://api.asaas.com/v3
 * Valores em decimais reais (59.90), nao centavos.
 * Webhook: header `asaas-access-token` comparado literalmente com o token
 * cadastrado no painel. Nao eh HMAC.
 */

const ASAAS_BASE = 'https://api.asaas.com/v3'
const ASAAS_KEY = process.env.ASAAS_API_KEY
const USER_AGENT = 'LokAgenda/1.0 (+https://www.lokagenda.com.br)'

export function isAsaasConfigured(): boolean {
  return !!ASAAS_KEY && ASAAS_KEY.length > 10
}

type AsaasFetchResult<T> = T | { asaasError: string }

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<AsaasFetchResult<T>> {
  if (!ASAAS_KEY) return { asaasError: 'ASAAS_API_KEY nao configurada' }
  try {
    const res = await fetch(`${ASAAS_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        access_token: ASAAS_KEY,
        ...init?.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
    const data = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const errObj = data as { errors?: Array<{ description?: string }>; error?: string } | null
      const msg = errObj?.errors?.[0]?.description || errObj?.error || `HTTP ${res.status}`
      return { asaasError: msg }
    }
    return data as T
  } catch (err) {
    return { asaasError: err instanceof Error ? err.message : 'erro de conexao Asaas' }
  }
}

export interface AsaasCustomer {
  id: string
  name?: string
  email?: string
  cpfCnpj?: string
  phone?: string
  externalReference?: string
}

export interface CreateCustomerInput {
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  externalReference?: string
}

/** Cria customer novo no Asaas. cpfCnpj obrigatorio (11 CPF ou 14 CNPJ). */
export async function createAsaasCustomer(
  input: CreateCustomerInput,
): Promise<AsaasFetchResult<AsaasCustomer>> {
  const cleanDoc = input.cpfCnpj.replace(/\D/g, '')
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: cleanDoc,
      email: input.email,
      phone: input.phone,
      externalReference: input.externalReference,
    }),
  })
}

export interface AsaasCheckout {
  id: string
  status?: string
  link?: string
}

export interface CreateCheckoutInput {
  customerId: string
  value: number
  planTitle: string
  planDescription: string
  cycle: 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'
  maxInstallments: number
  externalReference: string
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}

/**
 * POST /v3/checkouts com chargeTypes RECURRENT. Cartao renova sozinho no
 * ciclo (MONTHLY/SEMIANNUALLY/YEARLY). Cliente escolhe cartao ou PIX na tela
 * hospedada do Asaas.
 */
export async function createAsaasCheckout(
  input: CreateCheckoutInput,
): Promise<AsaasFetchResult<AsaasCheckout>> {
  return asaasFetch<AsaasCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      billingTypes: ['CREDIT_CARD', 'PIX'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.expiredUrl,
      },
      customer: input.customerId,
      items: [
        {
          name: input.planTitle,
          description: input.planDescription,
          quantity: 1,
          value: input.value,
        },
      ],
      subscription: {
        cycle: input.cycle,
      },
      installment: {
        maxInstallmentCount: input.maxInstallments,
      },
      externalReference: input.externalReference,
    }),
  })
}

/** URL do checkout hosted a partir do checkoutId. */
export function asaasCheckoutUrl(checkoutId: string): string {
  return `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`
}

/** Mapeia billing_cycle interno pro cycle do Asaas. */
export function toAsaasCycle(billingCycle: 'monthly' | 'semiannual' | 'annual'): 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY' {
  switch (billingCycle) {
    case 'monthly':
      return 'MONTHLY'
    case 'semiannual':
      return 'SEMIANNUALLY'
    case 'annual':
      return 'YEARLY'
  }
}
