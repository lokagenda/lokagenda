import type { WhatsAppProviderClient, WhatsAppConfig, SendMessageResult } from '../types'

/**
 * UazAPI (uazapiGO v2) — Baileys multi-device, fix do problema raiz da Z-API:
 * - Multi-device suportado (entrega fromMe no webhook).
 * - Webhook nativo `excludeMessages: ["wasSentByApi"]` mata loop IA→IA sem
 *   precisar de heurística no nosso lado.
 *
 * Auth: header `token: <instance-token>` em todas chamadas. NÃO usa path
 * param token como a Z-API.
 *
 * Config mapping (whatsapp_config):
 * - api_url  = base subdomain (ex. "https://api.uazapi.com")
 * - api_key  = instance token (retornado por POST /instance/create)
 * - instance_id = nome humano da instância (informativo)
 * - phone_number_id = admin token (opcional, só pra recriar instância via UI)
 */
export class UazapiClient implements WhatsAppProviderClient {
  private apiUrl: string
  private instanceToken: string

  constructor(config: WhatsAppConfig) {
    if (!config.api_url || !config.api_key) {
      throw new Error('UazAPI requer api_url e api_key (token da instância)')
    }
    let url: URL
    try {
      url = new URL(config.api_url)
    } catch {
      throw new Error('UazAPI api_url inválido')
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('uazapi.com')) {
      throw new Error('UazAPI api_url precisa ser https://*.uazapi.com')
    }
    this.apiUrl = url.origin
    this.instanceToken = config.api_key
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const res = await fetch(`${this.apiUrl}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: this.instanceToken,
        },
        body: JSON.stringify({ number: phone, text: message }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })

      const data = await res.json().catch(() => null)
      if (res.ok) {
        return { success: true, provider_response: data }
      }
      return {
        success: false,
        provider_response: data,
        error: data?.error || data?.message || `HTTP ${res.status}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro de conexão UazAPI',
      }
    }
  }
}
