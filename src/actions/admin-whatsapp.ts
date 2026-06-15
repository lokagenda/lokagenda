'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp-api/sender'
import { revalidatePath } from 'next/cache'
import type { WhatsAppProvider } from '@/lib/whatsapp-api/types'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Nao autorizado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Acesso negado')
  return user
}

// ── WhatsApp Config ───────────────────────────────────────

export async function getWhatsAppConfig() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('active', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data || null
}

export async function saveWhatsAppConfig(configData: {
  provider: WhatsAppProvider
  api_url: string | null
  api_key: string | null
  instance_id: string | null
  phone_number_id: string | null
}) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  // Check if config already exists
  const { data: existing } = await admin
    .from('whatsapp_config')
    .select('id')
    .eq('active', true)
    .limit(1)
    .single()

  if (existing) {
    const { error } = await admin
      .from('whatsapp_config')
      .update({
        ...configData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('whatsapp_config')
      .insert({
        ...configData,
        active: true,
      })

    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/whatsapp')
}

export async function testWhatsAppConnection(phone: string) {
  await requireSuperAdmin()

  const success = await sendWhatsAppMessage(
    phone,
    'Teste de conexão LokAgenda ✅'
  )

  return { success }
}

// ── Templates ─────────────────────────────────────────────

export async function listWhatsAppTemplates() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_templates')
    .select('*')
    .order('slug', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateWhatsAppTemplate(
  id: string,
  templateData: { name?: string; content?: string; active?: boolean }
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('whatsapp_templates')
    .update({
      ...templateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/whatsapp')
}

// ── Message Logs ──────────────────────────────────────────

export async function listWhatsAppLogs(
  page: number = 1,
  filters?: { status?: string; dateFrom?: string; dateTo?: string }
) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const perPage = 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = admin
    .from('whatsapp_message_log')
    .select('*, companies:company_id(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status as 'pending' | 'sent' | 'failed' | 'delivered')
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00Z`)
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59Z`)
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    logs: data || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
    currentPage: page,
  }
}

// Z-API: liga/desliga o notifySentByMe (manual takeover).
// Sem essa flag, a Z-API não avisa quando o assinante manda mensagem do celular
// e o nosso `manual_takeovers` nunca é gravado — IA segue respondendo por cima.

type ZApiCtx = { base: string; headers: Record<string, string> }

async function getActiveZApi(): Promise<ZApiCtx | { error: string }> {
  const admin = createAdminClient()
  const { data: cfg } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (!cfg) return { error: 'WhatsApp não está configurado.' }
  if (cfg.provider !== 'z_api') return { error: 'Esta função é específica da Z-API.' }
  if (!cfg.api_url || !cfg.api_key || !cfg.instance_id) {
    return { error: 'Config Z-API incompleta (api_url/api_key/instance_id).' }
  }
  // Allowlist do host pra evitar SSRF via api_url editado no banco.
  let apiUrl: URL
  try {
    apiUrl = new URL(cfg.api_url)
  } catch {
    return { error: 'api_url inválido na config.' }
  }
  if (!/(^|\.)z-api\.io$/.test(apiUrl.hostname) || apiUrl.protocol !== 'https:') {
    return { error: 'api_url deve ser https://*.z-api.io.' }
  }
  const base = `${apiUrl.origin}/instances/${cfg.instance_id}/token/${cfg.api_key}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.phone_number_id) headers['Client-Token'] = cfg.phone_number_id
  return { base, headers }
}

/**
 * Lê a flag `notifySentByMe` da Z-API. Quando true, a Z-API envia `fromMe=true`
 * pro nosso /api/whatsapp/inbound toda vez que o assinante manda mensagem pelo
 * próprio celular. Sem isso, o manual_takeover_at nunca é gravado e a IA
 * continua respondendo por cima do humano.
 */
export async function getZApiNotifyOnSendStatus(): Promise<
  { enabled: boolean } | { error: string }
> {
  await requireSuperAdmin()
  const zapi = await getActiveZApi()
  if ('error' in zapi) return zapi
  try {
    const res = await fetch(`${zapi.base}/notification/notifySentByMe`, {
      method: 'GET',
      headers: zapi.headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[zapi-onsend] status', res.status, body.slice(0, 200))
      return { error: `Z-API respondeu ${res.status} ao consultar notifySentByMe.` }
    }
    const data = await res.json().catch(() => null) as { value?: boolean } | null
    return { enabled: data?.value === true }
  } catch (err) {
    console.error('[zapi-onsend] consulta', err)
    return { error: err instanceof Error ? err.message : 'Erro ao consultar Z-API.' }
  }
}

/**
 * Ativa `notifySentByMe` na Z-API. Após isso, mensagens que o assinante mandar
 * do celular chegam no nosso webhook com `fromMe=true` e disparam o manual
 * takeover (IA cala por 12h pra esse contato).
 */
export async function setupZApiNotifyOnSend(): Promise<
  { ok: true } | { error: string }
> {
  await requireSuperAdmin()
  const zapi = await getActiveZApi()
  if ('error' in zapi) return zapi
  try {
    const res = await fetch(`${zapi.base}/notification/notifySentByMe`, {
      method: 'PUT',
      headers: zapi.headers,
      body: JSON.stringify({ notifySentByMe: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[zapi-onsend] put', res.status, body.slice(0, 200))
      return { error: `Z-API respondeu ${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[zapi-onsend] put exception', err)
    return { error: err instanceof Error ? err.message : 'Erro ao configurar Z-API.' }
  }
}
