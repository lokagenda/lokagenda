/**
 * Cliente Groq Whisper — transcreve audio pra texto.
 *
 * Endpoint OpenAI-compativel: POST /openai/v1/audio/transcriptions
 * Modelo padrao: whisper-large-v3-turbo (multilingue, ~$0.04/hr, ~1-2s de
 * latencia num audio de 30s). Usa language='pt' pra melhorar precisao +
 * latencia no caso de voice notes de WhatsApp em pt-BR.
 *
 * Voice notes do WhatsApp vem como .ogg/opus — suportado direto.
 * Timeout 30s (voice note tipico <1min).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'
const TIMEOUT_MS = 30000

export function isTranscribeConfigured(): boolean {
  return !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 10
}

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

/**
 * Transcreve audio de qualquer formato aceito pelo Whisper (ogg, mp3, m4a,
 * wav, opus, webm, flac, mp4). Retorna { ok, text } ou { ok:false, error }.
 * NAO lanca — chamador nao precisa try/catch (retorna erro estruturado).
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  filename = 'audio.ogg',
): Promise<TranscribeResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY nao configurada' }
  if (!buffer || buffer.length === 0) return { ok: false, error: 'audio vazio' }
  // Groq free tier: 25MB. Voice notes WhatsApp raramente passam de 500KB.
  if (buffer.length > 24 * 1024 * 1024) {
    return { ok: false, error: `audio muito grande (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max 24MB)` }
  }

  try {
    const form = new FormData()
    // Blob preserva o buffer + mime — Groq detecta formato pelo header.
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename)
    form.append('model', GROQ_MODEL)
    form.append('language', 'pt')
    form.append('response_format', 'json')
    form.append('temperature', '0')

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // NAO setar Content-Type manual — o runtime preenche o boundary
        // multipart automaticamente. Setar quebra o request.
      },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const data = (await res.json().catch(() => null)) as
      | { text?: string; error?: { message?: string } }
      | null

    if (!res.ok) {
      const errMsg =
        (typeof data?.error?.message === 'string' && data.error.message) ||
        `Groq HTTP ${res.status}`
      return { ok: false, error: errMsg }
    }

    const text = data?.text?.trim() ?? ''
    if (!text) return { ok: false, error: 'transcricao vazia (audio sem fala reconhecivel)' }
    return { ok: true, text }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido na transcricao'
    return { ok: false, error: msg }
  }
}
