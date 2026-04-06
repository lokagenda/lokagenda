import type { WhatsAppProviderClient, WhatsAppConfig, SendMessageResult } from '../types'

export class MetaCloudClient implements WhatsAppProviderClient {
  private accessToken: string
  private phoneNumberId: string

  constructor(config: WhatsAppConfig) {
    if (!config.api_key || !config.phone_number_id) {
      throw new Error('Meta Cloud API requer api_key (Access Token) e phone_number_id')
    }
    this.accessToken = config.api_key
    this.phoneNumberId = config.phone_number_id
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message },
          }),
          signal: AbortSignal.timeout(15000),
        }
      )

      const data = await response.json().catch(() => null)

      if (response.ok) {
        return { success: true, provider_response: data }
      }

      return {
        success: false,
        provider_response: data,
        error: data?.error?.message || `HTTP ${response.status}`,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão' }
    }
  }
}
