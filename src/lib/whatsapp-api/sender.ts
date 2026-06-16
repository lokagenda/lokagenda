import { createAdminClient } from '@/lib/supabase/admin'
import type { WhatsAppProviderClient, WhatsAppConfig } from './types'
import { EvolutionApiClient } from './providers/evolution-api'
import { ZApiClient } from './providers/z-api'
import { TwilioClient } from './providers/twilio'
import { MetaCloudClient } from './providers/meta-cloud'
import { UazapiClient } from './providers/uazapi'

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function createProviderClient(config: WhatsAppConfig): WhatsAppProviderClient {
  switch (config.provider) {
    case 'evolution_api':
      return new EvolutionApiClient(config)
    case 'z_api':
      return new ZApiClient(config)
    case 'twilio':
      return new TwilioClient(config)
    case 'meta_cloud':
      return new MetaCloudClient(config)
    case 'uazapi':
      return new UazapiClient(config)
    default:
      throw new Error(`Provedor não suportado: ${config.provider}`)
  }
}

export async function getWhatsAppClient(): Promise<WhatsAppProviderClient | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  if (error || !data) return null

  try {
    return createProviderClient(data as WhatsAppConfig)
  } catch {
    return null
  }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  options?: { companyId?: string; templateSlug?: string }
): Promise<boolean> {
  const admin = createAdminClient()
  const normalizedPhone = normalizePhone(phone)

  // Log entry (pending)
  const { data: logEntry } = await admin
    .from('whatsapp_message_log')
    .insert({
      company_id: options?.companyId || null,
      template_slug: options?.templateSlug || null,
      phone: normalizedPhone,
      message,
      status: 'pending',
    })
    .select('id')
    .single()

  try {
    const client = await getWhatsAppClient()
    if (!client) {
      if (logEntry) {
        await admin
          .from('whatsapp_message_log')
          .update({ status: 'failed', error_message: 'Nenhum provedor WhatsApp configurado' })
          .eq('id', logEntry.id)
      }
      return false
    }

    // Phone is already normalized - providers receive it directly
    const result = await client.sendMessage(normalizedPhone, message)

    if (logEntry) {
      await admin
        .from('whatsapp_message_log')
        .update({
          status: result.success ? 'sent' : 'failed',
          provider_response: result.provider_response || null,
          error_message: result.error || null,
        })
        .eq('id', logEntry.id)
    }

    return result.success
  } catch (err: any) {
    if (logEntry) {
      try {
        await admin
          .from('whatsapp_message_log')
          .update({ status: 'failed', error_message: err.message || 'Erro inesperado' })
          .eq('id', logEntry.id)
      } catch { /* ignore log update failure */ }
    }
    return false
  }
}

export async function sendTemplateMessage(
  templateSlug: string,
  phone: string,
  variables: Record<string, string>,
  companyId?: string
): Promise<boolean> {
  const admin = createAdminClient()

  const { data: template } = await admin
    .from('whatsapp_templates')
    .select('content, active')
    .eq('slug', templateSlug)
    .single()

  if (!template || !template.active) return false

  let message = template.content
  for (const [key, value] of Object.entries(variables)) {
    message = message.replaceAll(`{{${key}}}`, value)
  }

  return sendWhatsAppMessage(phone, message, { companyId, templateSlug })
}
