'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getCompanyId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Não autorizado')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    throw new Error('Perfil ou empresa não encontrados')
  }

  return profile.company_id
}

export interface WhatsAppGroup {
  id: string
  name: string
}

/**
 * Lista os grupos de WhatsApp da instância Z-API global.
 *
 * Z-API: GET {api_url}/instances/{instance}/token/{token}/groups
 * O header `Client-Token` (armazenado em whatsapp_config.phone_number_id) é
 * exigido pela Z-API quando a conta tem o token de segurança ativado.
 */
export async function listWhatsAppGroups(): Promise<{
  groups: WhatsAppGroup[]
  error?: string
}> {
  // Garante que o usuário está autenticado em uma empresa.
  await getCompanyId()

  const admin = createAdminClient()
  const { data: config, error: configError } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  if (configError || !config) {
    return { groups: [], error: 'Nenhum provedor WhatsApp configurado.' }
  }

  if (config.provider !== 'z_api') {
    return { groups: [], error: 'A listagem de grupos só está disponível para a Z-API.' }
  }

  if (!config.api_url || !config.api_key || !config.instance_id) {
    return { groups: [], error: 'Configuração da Z-API incompleta.' }
  }

  const apiUrl = config.api_url.replace(/\/$/, '')
  const clientToken = config.phone_number_id

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (clientToken) {
      headers['Client-Token'] = clientToken
    }

    const response = await fetch(
      `${apiUrl}/instances/${config.instance_id}/token/${config.api_key}/groups`,
      {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (data && (data.error || data.message)) || `Erro HTTP ${response.status}`
      return { groups: [], error: `Erro ao buscar grupos: ${message}` }
    }

    // A Z-API retorna uma lista de grupos. Os campos podem variar conforme a
    // versão da API; normalizamos para { id, name }.
    const rawList: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data?.groups as Record<string, unknown>[]) || []

    const groups: WhatsAppGroup[] = rawList
      .map((g) => {
        const id = g?.phone || g?.id || g?.group_id || g?.wid || ''
        const name = g?.name || g?.subject || g?.title || id
        return { id: String(id), name: String(name) }
      })
      .filter((g) => g.id !== '')

    return { groups }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro de conexão ao buscar grupos.'
    return { groups: [], error: message }
  }
}

/**
 * Envia uma mensagem de texto para um grupo de WhatsApp.
 *
 * Na Z-API, o id do grupo é usado como "phone" no endpoint send-text.
 * NÃO reutilizamos `sendWhatsAppMessage` aqui porque ela chama `normalizePhone`,
 * que prefixaria "55" ao id do grupo e o corromperia. Em vez disso, enviamos
 * diretamente à Z-API com o id cru, e ainda registramos em whatsapp_message_log.
 */
export async function sendToGroup(
  groupId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const companyId = await getCompanyId()

  const id = groupId?.trim()
  const text = message?.trim()

  if (!id) {
    return { success: false, error: 'Grupo inválido.' }
  }

  if (!text) {
    return { success: false, error: 'A mensagem não pode estar vazia.' }
  }

  const admin = createAdminClient()
  const { data: config, error: configError } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  if (configError || !config) {
    return { success: false, error: 'Nenhum provedor WhatsApp configurado.' }
  }

  if (config.provider !== 'z_api' || !config.api_url || !config.api_key || !config.instance_id) {
    return { success: false, error: 'Envio para grupos só está disponível para a Z-API configurada.' }
  }

  const apiUrl = config.api_url.replace(/\/$/, '')
  const clientToken = config.phone_number_id

  // Registro de log (pending)
  const { data: logEntry } = await admin
    .from('whatsapp_message_log')
    .insert({ company_id: companyId, phone: id, message: text, status: 'pending' })
    .select('id')
    .single()

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientToken) {
      headers['Client-Token'] = clientToken
    }

    const response = await fetch(
      `${apiUrl}/instances/${config.instance_id}/token/${config.api_key}/send-text`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: id, message: text }),
        signal: AbortSignal.timeout(15000),
      }
    )

    const data = await response.json().catch(() => null)

    if (logEntry) {
      await admin
        .from('whatsapp_message_log')
        .update({
          status: response.ok ? 'sent' : 'failed',
          provider_response: data || null,
          error_message: response.ok ? null : data?.error || data?.message || `HTTP ${response.status}`,
        })
        .eq('id', logEntry.id)
    }

    if (!response.ok) {
      const message = data?.error || data?.message || `HTTP ${response.status}`
      return { success: false, error: `Não foi possível enviar a mensagem ao grupo: ${message}` }
    }

    return { success: true }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Erro de conexão ao enviar mensagem.'
    if (logEntry) {
      try {
        await admin
          .from('whatsapp_message_log')
          .update({ status: 'failed', error_message: errMessage })
          .eq('id', logEntry.id)
      } catch { /* ignore */ }
    }
    return { success: false, error: errMessage }
  }
}
