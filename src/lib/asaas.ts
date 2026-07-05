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
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
}

/**
 * Cria customer novo no Asaas. cpfCnpj obrigatorio (11 CPF ou 14 CNPJ).
 * Address fields opcionais na criacao MAS obrigatorios pra checkout com
 * parcelamento (Asaas retorna "O campo address deve existir para o customer
 * informado" se ausente). Passar sempre que disponivel.
 */
export async function createAsaasCustomer(
  input: CreateCustomerInput,
): Promise<AsaasFetchResult<AsaasCustomer>> {
  const cleanDoc = input.cpfCnpj.replace(/\D/g, '')
  const cleanCep = input.postalCode?.replace(/\D/g, '')
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: cleanDoc,
      email: input.email,
      phone: input.phone,
      externalReference: input.externalReference,
      postalCode: cleanCep,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      province: input.province,
    }),
  })
}

/**
 * Atualiza um customer Asaas existente. Usado quando o asaas_customer_id ja
 * esta gravado na subscription mas o customer foi criado antes de a gente
 * mandar endereco. Garante que address, postalCode, addressNumber e province
 * estao presentes antes de tentar checkout com parcelamento.
 */
export async function updateAsaasCustomer(
  customerId: string,
  input: Partial<CreateCustomerInput>,
): Promise<AsaasFetchResult<AsaasCustomer>> {
  const cleanCep = input.postalCode?.replace(/\D/g, '')
  return asaasFetch<AsaasCustomer>(`/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      postalCode: cleanCep,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      province: input.province,
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
  maxInstallments: number
  externalReference: string
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}

/**
 * POST /v3/checkouts com chargeTypes ["DETACHED","INSTALLMENT"] + installment.maxInstallmentCount.
 *
 * Formato validado ao vivo em 02/jul via curl+Playwright:
 *   - Payload exato aceito pela API
 *   - Checkout hosted apresenta seletor com "Pagar em 1x/2x/.../12x"
 *   - 12x fica SEM JUROS porque Leo ativou "Parcelamento sem juros ao
 *     comprador" no painel Asaas (Configuracoes -> Cobrancas)
 *
 * Modelo: cobranca unica parcelada. Igual ao MP anterior. Renovacao do
 * proximo ciclo eh MANUAL (cliente volta em /dashboard/assinatura e clica
 * Renovar) — mesma UX de antes.
 *
 * PIX ligado desde 03/jul (Leo cadastrou chave aleatoria no painel Asaas).
 *
 * NAO usar chargeTypes RECURRENT: RECURRENT so aceita CREDIT_CARD sem
 * parcelamento (installment eh proibido). Quebraria o "12x sem juros"
 * que eh o valor comercial do plano anual.
 */
export async function createAsaasCheckout(
  input: CreateCheckoutInput,
): Promise<AsaasFetchResult<AsaasCheckout>> {
  return asaasFetch<AsaasCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      billingTypes: ['CREDIT_CARD', 'PIX'],
      chargeTypes: ['DETACHED', 'INSTALLMENT'],
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
      installment: {
        maxInstallmentCount: input.maxInstallments,
      },
      externalReference: input.externalReference,
    }),
  })
}

/**
 * URL do checkout hosted a partir de um AsaasCheckout ou checkoutId.
 * Prefere o `link` retornado pelo Asaas (formato definitivo). Fallback pro
 * path builder correto (`/show/{id}`), testado empiricamente em 02/jul.
 */
export function asaasCheckoutUrl(checkout: AsaasCheckout | string): string {
  if (typeof checkout === 'string') {
    return `https://www.asaas.com/checkoutSession/show/${encodeURIComponent(checkout)}`
  }
  if (checkout.link) return checkout.link
  return `https://www.asaas.com/checkoutSession/show/${encodeURIComponent(checkout.id)}`
}

/** Mapeia billing_cycle interno pro cycle do Asaas (nao usado no modelo DETACHED atual — mantido pra fallback futuro se voltar pra RECURRENT). */
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
