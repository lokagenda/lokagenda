import { createAdminClient } from '@/lib/supabase/admin'
import type { WhatsAppProviderClient, WhatsAppConfig, WhatsAppPurpose } from './types'
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

// Re-export: o tipo mora em ./types (modulo puro) pra UI client poder importar.
export type { WhatsAppPurpose } from './types'

/**
 * Busca o client da instancia WhatsApp certa por proposito.
 * - 'marketing': campanhas, follow-up, reactivate-leads/queue (numero novo, chip separado)
 * - 'transactional' (default): lembretes de vencimento, plan_activated, Nick
 *   atendendo cliente, notificacoes institucionais (numero principal do Leo)
 *
 * Fallback: se nao acha config pro purpose pedido, tenta a outra (defensivo
 * pra sistemas em transicao ou config recem-criada). Isso permite que uma
 * feature nova nao caia se so uma das duas instancias estiver configurada.
 */
export async function getWhatsAppClient(
  purpose: WhatsAppPurpose = 'transactional',
): Promise<WhatsAppProviderClient | null> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .eq('purpose', purpose)
    .limit(1)
    .maybeSingle()

  if (data) {
    try {
      return createProviderClient(data as WhatsAppConfig)
    } catch {
      return null
    }
  }

  // Fallback: pega qualquer config ativa se a especifica nao existe.
  //
  // Fica RUIDOSO de proposito. Este fallback silencioso mascarou por 2 dias o
  // marketing saindo pelo numero transacional (05/ago). Nao vira erro duro
  // porque campaigns/route.ts marca campaign_queue.status='failed' PERMANENTE
  // quando o envio retorna false — falhar aqui trocaria "manda pelo numero
  // errado" por "destroi a fila em silencio".
  const { data: fallback } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id, purpose')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!fallback) {
    console.error(`[whatsapp] nenhuma config ativa — purpose=${purpose} nao pode ser atendido`)
    return null
  }

  console.error(
    `[whatsapp] FALLBACK: purpose=${purpose} nao configurado, usando purpose=` +
      `${(fallback as { purpose?: string }).purpose ?? 'desconhecido'}`,
  )

  try {
    return createProviderClient(fallback as WhatsAppConfig)
  } catch {
    return null
  }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  options?: { companyId?: string; templateSlug?: string; purpose?: WhatsAppPurpose }
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
    const client = await getWhatsAppClient(options?.purpose ?? 'transactional')
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
  companyId?: string,
  purpose: WhatsAppPurpose = 'transactional'
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

  return sendWhatsAppMessage(phone, message, { companyId, templateSlug, purpose })
}
