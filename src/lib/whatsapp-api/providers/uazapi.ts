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
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (url.protocol !== 'https:' || !(host === 'uazapi.com' || host.endsWith('.uazapi.com'))) {
      throw new Error('UazAPI api_url precisa ser https://uazapi.com ou subdominio')
    }
    this.apiUrl = url.origin
    this.instanceToken = config.api_key
  }

  /**
   * Baixa uma midia (audio, imagem, etc) do WhatsApp via UazAPI.
   * POST /message/download com header `token` e body `{ id: messageid }`.
   *
   * A UazAPI tem DOIS formatos de resposta e trocou o padrao sem aviso:
   *   1) { base64, mimetype, fileName }   <- formato antigo
   *   2) { cached, fileURL, mimetype }    <- formato ATUAL (verificado 18/ago)
   *
   * O codigo so aceitava base64 e lancava "sem base64 na resposta". O erro era
   * engolido pelo catch do inbound, incomingText ficava vazio e o audio do lead
   * era descartado em silencio — a Nick nao respondia quem mandava audio.
   * Confirmado ao vivo: /message/download devolve
   * { cached: true, fileURL: ".../files/<hash>.mp3", mimetype: "audio/mpeg" }
   * e nenhum parametro (base64 / returnBase64) traz o base64 de volta.
   *
   * Retorna { buffer, mimeType, filename } ou lanca erro.
   */
  async downloadMedia(messageId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const res = await fetch(`${this.apiUrl}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: this.instanceToken,
      },
      body: JSON.stringify({ id: messageId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = (await res.json().catch(() => null)) as {
      base64?: string
      fileURL?: string
      mimetype?: string
      fileName?: string
      error?: string | boolean
      message?: string
    } | null
    if (!res.ok || !data) {
      throw new Error(
        (typeof data?.error === 'string' ? data.error : null) ||
          (typeof data?.message === 'string' ? data.message : null) ||
          `UazAPI download HTTP ${res.status}`,
      )
    }

    const mimeType = data.mimetype || 'audio/ogg'

    // Formato 1 (legado): base64 inline.
    if (data.base64) {
      // As vezes vem com prefixo "data:audio/ogg;base64,..." — remove.
      const cleanBase64 = data.base64.replace(/^data:[^;]+;base64,/, '')
      return {
        buffer: Buffer.from(cleanBase64, 'base64'),
        mimeType,
        filename: data.fileName || 'media.ogg',
      }
    }

    // Formato 2 (atual): URL do arquivo ja decodificado no servidor da UazAPI.
    if (data.fileURL) {
      // SSRF: a URL vem do provedor, mas confinamos ao MESMO host da instancia
      // pra um api_url adulterado no banco nao virar leitura arbitraria.
      let fileUrl: URL
      try {
        fileUrl = new URL(data.fileURL)
      } catch {
        throw new Error('UazAPI download: fileURL invalido')
      }
      if (fileUrl.protocol !== 'https:' || fileUrl.origin !== this.apiUrl) {
        throw new Error(`UazAPI download: fileURL fora do host da instancia (${fileUrl.origin})`)
      }

      const fileRes = await fetch(fileUrl.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      })
      if (!fileRes.ok) {
        throw new Error(`UazAPI download: fileURL HTTP ${fileRes.status}`)
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer())
      if (buffer.length === 0) {
        throw new Error('UazAPI download: fileURL devolveu arquivo vazio')
      }
      // Preserva a extensao real (.mp3, .ogg...) — o Whisper usa isso.
      const nomeDaUrl = fileUrl.pathname.split('/').pop() || ''
      return {
        buffer,
        mimeType,
        filename: data.fileName || (nomeDaUrl.includes('.') ? nomeDaUrl : 'media.ogg'),
      }
    }

    throw new Error(
      `UazAPI download: resposta sem base64 nem fileURL (chaves: ${Object.keys(data).join(',')})`,
    )
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
      // UazAPI as vezes retorna { error: true, message: "..." } — pegar boolean
      // aqui salvava a string "true" no banco (bug encontrado 13/jul). Extrai
      // texto do error so se for string, senao cai pra message ou HTTP.
      const errorText =
        typeof data?.error === 'string' && data.error.length > 0
          ? data.error
          : typeof data?.message === 'string' && data.message.length > 0
            ? data.message
            : `HTTP ${res.status}`
      return {
        success: false,
        provider_response: data,
        error: errorText,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro de conexão UazAPI',
      }
    }
  }
}
