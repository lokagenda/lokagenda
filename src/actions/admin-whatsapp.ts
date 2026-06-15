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

/**
 * Resolve a URL pública do app pra registrar como webhook na Z-API. Lê de envs
 * server-side em vez de headers (Host header é manipulável — SSRF).
 */
function resolveAppBaseUrl(): { url: string } | { error: string } {
  const candidates = [
    process.env.WEBHOOK_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  ]
  for (const c of candidates) {
    if (!c) continue
    try {
      const parsed = new URL(c)
      if (parsed.protocol === 'https:' || parsed.hostname === 'localhost') {
        return { url: parsed.origin }
      }
    } catch {
      // ignora env inválida
    }
  }
  return {
    error: 'Configure WEBHOOK_BASE_URL=https://www.lokagenda.com.br nas envs da Vercel.',
  }
}

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
 * Lê o estado de `notifySentByMe` do NOSSO banco (snapshot local).
 * A Z-API não expõe um endpoint GET pra essa flag — confiamos no que gravamos
 * quando o super admin clicou "Ativar".
 */
export async function getZApiNotifyOnSendStatus(): Promise<
  { enabled: boolean } | { error: string }
> {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_config')
    .select('notify_sent_by_me_enabled')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[zapi-onsend] read flag', error)
    return { error: error.message }
  }
  return { enabled: data?.notify_sent_by_me_enabled === true }
}

/**
 * Ativa `notifySentByMe` via `POST {base}/webhook/update-all` (endpoint
 * documentado na Z-API). Esse endpoint aceita `value` (URL) + `notifySentByMe`,
 * configurando todos os webhooks (on-receive, on-send, status) pra mesma URL e
 * ativando a flag. Após sucesso, marca `whatsapp_config.notify_sent_by_me_enabled`
 * no nosso banco pra o status local refletir.
 */
export async function setupZApiNotifyOnSend(): Promise<
  { ok: true; webhookUrl: string } | { error: string }
> {
  await requireSuperAdmin()
  const baseRes = resolveAppBaseUrl()
  if ('error' in baseRes) return baseRes
  const webhookUrl = `${baseRes.url}/api/whatsapp/inbound`

  const zapi = await getActiveZApi()
  if ('error' in zapi) return zapi

  try {
    const res = await fetch(`${zapi.base}/webhook/update-all`, {
      method: 'POST',
      headers: zapi.headers,
      body: JSON.stringify({ value: webhookUrl, notifySentByMe: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[zapi-onsend] update-all', res.status, body.slice(0, 200))
      return { error: `Z-API respondeu ${res.status}: ${body.slice(0, 200)}` }
    }

    // Persiste o snapshot local.
    const admin = createAdminClient()
    const { error: updErr } = await admin
      .from('whatsapp_config')
      .update({ notify_sent_by_me_enabled: true, updated_at: new Date().toISOString() })
      .eq('active', true)
    if (updErr) {
      console.error('[zapi-onsend] persist flag', updErr)
      // A Z-API já foi configurada — só perdemos o snapshot local. Não bloqueia.
    }
    return { ok: true, webhookUrl }
  } catch (err) {
    console.error('[zapi-onsend] update-all exception', err)
    return { error: err instanceof Error ? err.message : 'Erro ao configurar Z-API.' }
  }
}
