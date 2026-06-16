export type WhatsAppProvider = 'evolution_api' | 'z_api' | 'twilio' | 'meta_cloud' | 'uazapi'

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
