import type { WhatsAppProviderClient, WhatsAppConfig, SendMessageResult } from '../types'

export class ZApiClient implements WhatsAppProviderClient {
  private apiUrl: string
  private apiKey: string
  private instanceId: string

  constructor(config: WhatsAppConfig) {
    if (!config.api_url || !config.api_key || !config.instance_id) {
      throw new Error('Z-API requer api_url, api_key e instance_id')
    }
    this.apiUrl = config.api_url.replace(/\/$/, '')
    this.apiKey = config.api_key
    this.instanceId = config.instance_id
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const response = await fetch(
        `${this.apiUrl}/instances/${this.instanceId}/token/${this.apiKey}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone,
            message,
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
        error: data?.message || `HTTP ${response.status}`,
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão' }
    }
  }
}
