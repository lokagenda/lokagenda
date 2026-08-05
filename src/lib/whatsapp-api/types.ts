export type WhatsAppProvider = 'evolution_api' | 'z_api' | 'twilio' | 'meta_cloud' | 'uazapi'

/**
 * Qual das 2 instancias WhatsApp manda a mensagem.
 * - 'marketing': campanhas, follow-up, reativacao, grupos (chip separado)
 * - 'transactional': lembretes de vencimento, plan_activated, boas-vindas,
 *   Nick atendendo cliente pagante (numero principal)
 *
 * Mora aqui (modulo puro de tipos) e nao em sender.ts porque componente client
 * precisa do tipo — sender.ts importa createAdminClient.
 */
export type WhatsAppPurpose = 'marketing' | 'transactional'

export interface SendMessageResult {
  success: boolean
  provider_response?: any
  error?: string
}

export interface WhatsAppProviderClient {
  sendMessage(phone: string, message: string): Promise<SendMessageResult>
}

export interface WhatsAppConfig {
  provider: WhatsAppProvider
  api_url: string | null
  api_key: string | null
  instance_id: string | null
  phone_number_id: string | null
}
