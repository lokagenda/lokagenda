import type { WhatsAppProviderClient, WhatsAppConfig, SendMessageResult } from '../types'

export class TwilioClient implements WhatsAppProviderClient {
  private accountSid: string
  private authToken: string
  private fromNumber: string

  constructor(config: WhatsAppConfig) {
    if (!config.instance_id || !config.api_key || !config.phone_number_id) {
      throw new Error('Twilio requer instance_id (Account SID), api_key (Auth Token) e phone_number_id')
    }
    this.accountSid = config.instance_id
    this.authToken = config.api_key
    // Strip leading + to prevent double-prefix
    this.fromNumber = config.phone_number_id.replace(/^\+/, '')
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

    try {
      const body = new URLSearchParams({
        From: `whatsapp:+${this.fromNumber}`,
        To: `whatsapp:+${phone}`,
        Body: message,
      })

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
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
