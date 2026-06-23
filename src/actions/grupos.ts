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
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.company_id) {
    throw new Error('Perfil ou empresa não encontrados')
  }

  // Grupos usam o Z-API global (numero do dono): somente super_admin.
  if (profile.role !== 'super_admin') {
    throw new Error('Acesso restrito ao administrador')
  }

  return profile.company_id
}

export interface WhatsAppGroup {
  id: string
  name: string
}

/** Config ativa normalizada — funciona com Z-API ou UazAPI. */
type ActiveCfg =
  | { provider: 'z_api'; apiUrl: string; apiKey: string; instanceId: string; clientToken: string | null }
  | { provider: 'uazapi'; apiUrl: string; apiKey: string }

async function getActiveWhatsAppConfig(): Promise<ActiveCfg | null> {
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  if (!config || !config.api_url || !config.api_key) return null
  const apiUrl = config.api_url.replace(/\/$/, '')

  if (config.provider === 'z_api') {
    if (!config.instance_id) return null
    return {
      provider: 'z_api',
      apiUrl,
      apiKey: config.api_key,
      instanceId: config.instance_id,
      clientToken: (config.phone_number_id as string | null) ?? null,
    }
  }
  if (config.provider === 'uazapi') {
    return { provider: 'uazapi', apiUrl, apiKey: config.api_key }
  }
  return null
}

/** Converte ID de grupo entre formatos. UazAPI quer "<id>@g.us"; Z-API aceita
 *  "<id>-group" ou JID puro. */
function toUazapiGroupJid(groupId: string): string {
  if (groupId.endsWith('@g.us')) return groupId
  if (groupId.endsWith('-group')) return groupId.replace(/-group$/, '') + '@g.us'
  if (groupId.includes('@')) return groupId
  return groupId + '@g.us'
}

/**
 * Lista os grupos de WhatsApp da instância ativa (Z-API ou UazAPI).
 *
 * Z-API: GET /groups paginado.
 * UazAPI: POST /group/list — retorna {groups: [{JID, Name, Participants[], ...}]}
 * já com participantes inline. Uma única chamada.
 */
export async function listWhatsAppGroups(): Promise<{
  groups: WhatsAppGroup[]
  error?: string
}> {
  await getCompanyId()
  const cfg = await getActiveWhatsAppConfig()
  if (!cfg) return { groups: [], error: 'Provedor WhatsApp não configurado (esperado z_api ou uazapi).' }

  if (cfg.provider === 'uazapi') {
    try {
      const res = await fetch(`${cfg.apiUrl}/group/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: cfg.apiKey },
        body: JSON.stringify({ limit: 500 }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data?.error || data?.message || `HTTP ${res.status}`
        return { groups: [], error: `Erro ao buscar grupos (UazAPI): ${msg}` }
      }
      const rawList: Array<Record<string, unknown>> = Array.isArray(data?.groups) ? data.groups : []
      const all: WhatsAppGroup[] = []
      const seen = new Set<string>()
      for (const g of rawList) {
        const id = String(g.JID || '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        all.push({ id, name: String(g.Name || id) })
      }
      // Sort por nome pra UI ficar legivel
      all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      return { groups: all }
    } catch (err) {
      return { groups: [], error: err instanceof Error ? err.message : 'Erro de conexão UazAPI.' }
    }
  }

  // Z-API: paginação obrigatória
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken

  const pageSize = 100
  const all: WhatsAppGroup[] = []
  const seen = new Set<string>()

  try {
    for (let page = 1; page <= 50; page++) {
      const response = await fetch(
        `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/groups?page=${page}&pageSize=${pageSize}`,
        { method: 'GET', headers, signal: AbortSignal.timeout(15000) }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (page === 1) {
          const message = (data && (data.error || data.message)) || `Erro HTTP ${response.status}`
          return { groups: [], error: `Erro ao buscar grupos: ${message}` }
        }
        break
      }

      const rawList: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : (data?.groups as Record<string, unknown>[]) || []

      if (rawList.length === 0) break

      for (const g of rawList) {
        const id = String(g?.phone || g?.id || g?.group_id || g?.wid || '')
        const isGroup = g?.isGroup === true || id.includes('-group') || id.includes('-')
        if (!id || seen.has(id) || !isGroup) continue
        seen.add(id)
        all.push({ id, name: String(g?.name || g?.subject || g?.title || id) })
      }

      if (rawList.length < pageSize) break
    }

    return { groups: all }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro de conexão ao buscar grupos.'
    return { groups: all.length ? all : [], error: all.length ? undefined : message }
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

  const cfg = await getActiveWhatsAppConfig()
  if (!cfg) return { success: false, error: 'Provedor WhatsApp não configurado.' }

  const admin = createAdminClient()
  // Registro de log (pending)
  const { data: logEntry } = await admin
    .from('whatsapp_message_log')
    .insert({ company_id: companyId, phone: id, message: text, status: 'pending' })
    .select('id')
    .single()

  try {
    let response: Response
    if (cfg.provider === 'uazapi') {
      const number = toUazapiGroupJid(id)
      response = await fetch(`${cfg.apiUrl}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: cfg.apiKey },
        body: JSON.stringify({ number, text }),
        signal: AbortSignal.timeout(15000),
      })
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken
      response = await fetch(
        `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/send-text`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: id, message: text }),
          signal: AbortSignal.timeout(15000),
        }
      )
    }

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

// ── Envio de mídia (imagem/vídeo) para grupo ──────────────────────────────

export async function sendMediaToGroup(
  groupId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  const companyId = await getCompanyId()
  const id = groupId?.trim()
  if (!id) return { success: false, error: 'Grupo inválido.' }
  if (!mediaUrl) return { success: false, error: 'Mídia inválida.' }

  const cfg = await getActiveWhatsAppConfig()
  if (!cfg) return { success: false, error: 'Provedor WhatsApp não configurado.' }

  const admin = createAdminClient()
  const { data: logEntry } = await admin
    .from('whatsapp_message_log')
    .insert({ company_id: companyId, phone: id, message: caption || `[${mediaType}]`, status: 'pending' })
    .select('id')
    .single()

  try {
    let response: Response
    if (cfg.provider === 'uazapi') {
      response = await fetch(`${cfg.apiUrl}/send/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: cfg.apiKey },
        body: JSON.stringify({
          number: toUazapiGroupJid(id),
          type: mediaType,
          file: mediaUrl,
          text: caption || '',
        }),
        signal: AbortSignal.timeout(20000),
      })
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken
      const endpoint = mediaType === 'video' ? 'send-video' : 'send-image'
      const body =
        mediaType === 'video'
          ? { phone: id, video: mediaUrl, caption: caption || '' }
          : { phone: id, image: mediaUrl, caption: caption || '' }
      response = await fetch(
        `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/${endpoint}`,
        { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }
      )
    }
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
      return { success: false, error: data?.error || data?.message || `HTTP ${response.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao enviar mídia.' }
  }
}

// ── Upload de mídia para o Storage ────────────────────────────────────────

export async function uploadGroupMedia(formData: FormData): Promise<{ url?: string; type?: 'image' | 'video'; error?: string }> {
  await getCompanyId()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Selecione um arquivo.' }
  // Limite acompanha o body limit do server action no next.config (25MB).
  if (file.size > 25 * 1024 * 1024) {
    return { error: 'Arquivo muito grande (limite 25MB). Compacte o vídeo (ex.: HandBrake) ou use uma imagem.' }
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')
  if (!isVideo && !isImage) return { error: 'Envie uma imagem ou vídeo.' }

  const admin = createAdminClient()
  const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
  const fileName = `${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('group-media')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (uploadError) return { error: `Erro ao enviar arquivo: ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('group-media').getPublicUrl(fileName)
  return { url: publicUrl, type: isVideo ? 'video' : 'image' }
}

// ── Mensagens agendadas para grupos ───────────────────────────────────────

export interface ScheduledGroupMessage {
  id: string
  group_id: string
  group_name: string | null
  content: string | null
  media_url: string | null
  media_type: string | null
  scheduled_at: string
  status: string
  recurrence: string
  sent_at: string | null
  error: string | null
}

/**
 * O input <datetime-local> manda "YYYY-MM-DDTHH:mm" sem timezone. O server da
 * Vercel roda em UTC, então `new Date(str)` interpretava esse horário como UTC,
 * fazendo o agendado para "13:31 BRT" virar "13:31Z" = "10:31 BRT" no banco —
 * e o cron disparava 3h adiantado. Esta função trata a string como BRT (UTC-3)
 * e devolve o ISO em UTC correto.
 */
function parseBrtToUtcIso(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return new Date(s).toISOString()
  const [, Y, M, D, h, min] = m
  return new Date(Date.UTC(+Y, +M - 1, +D, +h + 3, +min)).toISOString()
}

export async function scheduleGroupMessage(data: {
  group_id?: string
  group_ids?: string[]
  group_name?: string
  content?: string
  media_url?: string
  media_type?: string
  scheduled_at: string
  recurrence?: 'once' | 'daily' | 'weekly'
  interval_minutes?: number
}): Promise<{ success?: boolean; scheduled?: number; error?: string }> {
  const companyId = await getCompanyId()
  const supabase = await createClient()

  const targetIds = (data.group_ids && data.group_ids.length > 0)
    ? data.group_ids
    : (data.group_id ? [data.group_id] : [])

  if (targetIds.length === 0) return { error: 'Selecione pelo menos um grupo.' }
  if (!data.content?.trim() && !data.media_url) return { error: 'Escreva uma mensagem ou anexe uma mídia.' }
  if (!data.scheduled_at) return { error: 'Defina a data e hora do envio.' }

  const baseUtcMs = new Date(parseBrtToUtcIso(data.scheduled_at)).getTime()
  const intervalMs = Math.max(0, (data.interval_minutes ?? 0)) * 60 * 1000

  const rows = targetIds.map((groupId, i) => ({
    company_id: companyId,
    group_id: groupId,
    // Quando vem do "agendar em vários grupos", mantemos o group_name genérico
    // (cada linha já tem o group_id certo; o nome só popula se vier um único).
    group_name: targetIds.length === 1 ? (data.group_name || null) : null,
    content: data.content?.trim() || null,
    media_url: data.media_url || null,
    media_type: data.media_type || null,
    scheduled_at: new Date(baseUtcMs + i * intervalMs).toISOString(),
    status: 'pending',
    recurrence: data.recurrence || 'once',
  }))

  const { error } = await supabase.from('group_scheduled_messages').insert(rows)
  if (error) return { error: `Erro ao agendar: ${error.message}` }
  return { success: true, scheduled: rows.length }
}

export async function listScheduledGroupMessages(): Promise<ScheduledGroupMessage[]> {
  await getCompanyId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('group_scheduled_messages')
    .select('id, group_id, group_name, content, media_url, media_type, scheduled_at, status, recurrence, sent_at, error')
    .order('scheduled_at', { ascending: false })

  if (error) throw new Error(`Erro ao listar agendamentos: ${error.message}`)
  return (data ?? []) as ScheduledGroupMessage[]
}

export async function deleteScheduledGroupMessage(id: string): Promise<{ success?: boolean; error?: string }> {
  await getCompanyId()
  const supabase = await createClient()
  const { error } = await supabase.from('group_scheduled_messages').delete().eq('id', id)
  if (error) return { error: `Erro ao excluir agendamento: ${error.message}` }
  return { success: true }
}

/**
 * Apaga várias mensagens agendadas de uma vez. Em lotes pra não estourar a URL
 * do PostgREST quando o usuário seleciona muitos.
 */
export async function deleteScheduledGroupMessages(ids: string[]): Promise<{ success?: boolean; deleted?: number; error?: string }> {
  if (!ids?.length) return { success: true, deleted: 0 }
  await getCompanyId()
  const supabase = await createClient()
  const CHUNK = 150
  let deleted = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { error } = await supabase.from('group_scheduled_messages').delete().in('id', slice)
    if (error) return { error: `Erro ao excluir agendamentos (${deleted} já apagados): ${error.message}`, deleted }
    deleted += slice.length
  }
  return { success: true, deleted }
}

/**
 * Edita uma mensagem agendada (só faz sentido enquanto status='pending'). Aceita
 * conteúdo, horário e recorrência. Não muda grupo nem mídia — pra esses, melhor
 * apagar e criar nova.
 */
export async function updateScheduledGroupMessage(
  id: string,
  data: { content?: string; scheduled_at?: string; recurrence?: 'once' | 'daily' | 'weekly' },
): Promise<{ success?: boolean; error?: string }> {
  await getCompanyId()
  const supabase = await createClient()

  const update: Record<string, unknown> = {}
  if (data.content !== undefined) update.content = data.content.trim() || null
  if (data.recurrence !== undefined) update.recurrence = data.recurrence
  if (data.scheduled_at) {
    // Reusa o mesmo parser BRT→UTC do scheduleGroupMessage pra não introduzir
    // o velho bug de timezone na edição.
    update.scheduled_at = parseBrtToUtcIso(data.scheduled_at)
  }

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await supabase
    .from('group_scheduled_messages')
    .update(update)
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: `Erro ao atualizar agendamento: ${error.message}` }
  return { success: true }
}

// ── Captação de contatos de um grupo ──────────────────────────────────────

/**
 * Busca os participantes do grupo na Z-API + tenta mapear telefone → nome a
 * partir da agenda. Retornado em forma usável tanto pela captação quanto pelo
 * export CSV.
 */
async function fetchGroupParticipantsWithNames(
  cfg: ActiveCfg,
  groupId: string
): Promise<{ phones: string[]; nameMap: Map<string, string>; rawCount: number; metaKeys: string[]; error?: string }> {
  if (cfg.provider === 'uazapi') {
    // UazAPI: /group/list ja retorna Participants[] inline. Busca todos
    // grupos e filtra o JID alvo. Mais barato que pedir info de 1 grupo.
    const targetJid = toUazapiGroupJid(groupId)
    try {
      const res = await fetch(`${cfg.apiUrl}/group/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: cfg.apiKey },
        body: JSON.stringify({ limit: 500 }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return { phones: [], nameMap: new Map(), rawCount: 0, metaKeys: [], error: data?.error || data?.message || `HTTP ${res.status}` }
      }
      type UazParticipant = { JID?: string; PhoneNumber?: string; LID?: string; DisplayName?: string; IsAdmin?: boolean }
      type UazGroup = { JID?: string; Name?: string; Participants?: UazParticipant[] }
      const groups: UazGroup[] = Array.isArray(data?.groups) ? data.groups : []
      const target = groups.find((g) => g.JID === targetJid)
      if (!target) {
        return { phones: [], nameMap: new Map(), rawCount: 0, metaKeys: ['Participants','Name','JID'], error: 'Grupo não encontrado na instância UazAPI.' }
      }
      const participants: UazParticipant[] = Array.isArray(target.Participants) ? target.Participants : []
      const rawCount = participants.length
      const phones = Array.from(
        new Set(
          participants
            .map((p) => String(p.PhoneNumber || '').split('@')[0].replace(/\D/g, ''))
            .filter((p) => p.length >= 10),
        ),
      )
      const nameMap = new Map<string, string>()
      for (const p of participants) {
        const ph = String(p.PhoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (ph && p.DisplayName) nameMap.set(ph, String(p.DisplayName))
      }
      console.log('[captureGroup/uazapi]', { groupId, targetJid, rawCount, uniquePhones: phones.length })
      return { phones, nameMap, rawCount, metaKeys: ['Participants','Name','JID'] }
    } catch (err) {
      return { phones: [], nameMap: new Map(), rawCount: 0, metaKeys: [], error: err instanceof Error ? err.message : 'Erro UazAPI ao buscar participantes.' }
    }
  }

  // Z-API: group-metadata + contacts (lógica original)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken

  let participants: { phone?: string }[] = []
  let metaKeys: string[] = []
  try {
    const response = await fetch(
      `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/group-metadata/${encodeURIComponent(groupId)}`,
      { method: 'GET', headers, signal: AbortSignal.timeout(20000) }
    )
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('[captureGroup] erro Z-API group-metadata', response.status, data)
      return { phones: [], nameMap: new Map(), rawCount: 0, metaKeys: [], error: data?.error || data?.message || `Erro HTTP ${response.status}` }
    }
    metaKeys = data && typeof data === 'object' ? Object.keys(data) : []
    participants = Array.isArray(data?.participants) ? data.participants : []
  } catch (err) {
    return { phones: [], nameMap: new Map(), rawCount: 0, metaKeys: [], error: err instanceof Error ? err.message : 'Erro ao buscar participantes.' }
  }

  const rawCount = participants.length
  const phones = Array.from(
    new Set(
      participants
        .map((p) => String(p.phone || '').replace(/\D/g, ''))
        .filter((p) => p.length >= 10),
    ),
  )

  const nameMap = new Map<string, string>()
  try {
    for (let page = 1; page <= 30; page++) {
      const res = await fetch(
        `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/contacts?page=${page}&pageSize=200`,
        { method: 'GET', headers, signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) break
      const list = await res.json().catch(() => null)
      const arr: Record<string, unknown>[] = Array.isArray(list) ? list : []
      if (arr.length === 0) break
      for (const c of arr) {
        const ph = String(c?.phone || '').replace(/\D/g, '')
        const nm = (c?.name || c?.short || c?.vname || c?.notify || '') as string
        if (ph && nm) nameMap.set(ph, String(nm))
      }
      if (arr.length < 200) break
    }
  } catch {
    // segue sem nomes
  }

  return { phones, nameMap, rawCount, metaKeys }
}

export async function captureGroupContacts(
  groupId: string
): Promise<{ imported?: number; total?: number; rawCount?: number; existingCount?: number; error?: string }> {
  const companyId = await getCompanyId()
  const id = groupId?.trim()
  if (!id) return { error: 'Grupo inválido.' }

  const cfg = await getActiveWhatsAppConfig()
  if (!cfg) return { error: 'Provedor WhatsApp não configurado.' }

  const { phones, nameMap, rawCount, error: fetchError } = await fetchGroupParticipantsWithNames(cfg, id)
  if (fetchError) return { error: fetchError }
  const total = phones.length
  if (total === 0) return { imported: 0, total: 0, rawCount }

  const admin = createAdminClient()

  // Quais já existem (evita duplicar). Em lotes: grupos grandes têm centenas de
  // membros, e um .in() gigante estoura o tamanho da URL do PostgREST (400).
  const existingSet = new Set<string>()
  const CHUNK = 150
  for (let i = 0; i < phones.length; i += CHUNK) {
    const slice = phones.slice(i, i + CHUNK)
    const { data: existing } = await admin
      .from('campaign_contacts')
      .select('phone')
      .eq('company_id', companyId)
      .in('phone', slice)
    for (const c of existing ?? []) existingSet.add(c.phone)
  }
  const toInsert = phones
    .filter((p) => !existingSet.has(p))
    .map((phone) => ({
      company_id: companyId,
      phone,
      name: nameMap.get(phone) || null,
      source: 'grupo',
      status: 'lead' as const,
    }))

  console.log('[captureGroup] resumo pré-insert', {
    groupId: id,
    rawCount,
    uniqueAfterDedup: total,
    existing: existingSet.size,
    toInsert: toInsert.length,
  })

  if (toInsert.length === 0) return { imported: 0, total, rawCount, existingCount: existingSet.size }

  // Insert em lotes: PostgREST/Supabase pode aplicar limites internos a payloads
  // muito grandes (já vimos importações travarem em ~1000 contatos). Lotes de
  // 200 mantêm tudo dentro de margem segura e ainda permitem retomada parcial.
  const INSERT_CHUNK = 200
  let insertedCount = 0
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const slice = toInsert.slice(i, i + INSERT_CHUNK)
    const { error } = await admin.from('campaign_contacts').insert(slice)
    if (error) {
      console.error('[captureGroup] erro no insert', { insertedCount, error })
      return { error: `Erro ao salvar contatos (${insertedCount} já salvos): ${error.message}`, imported: insertedCount, total, rawCount, existingCount: existingSet.size }
    }
    insertedCount += slice.length
  }

  console.log('[captureGroup] insert concluído', { insertedCount })
  return { imported: insertedCount, total, rawCount, existingCount: existingSet.size }
}

// ── Export CSV (não salva no DB) ───────────────────────────────────────────

/**
 * Captura os participantes do grupo e retorna como CSV pronto pra baixar no
 * Excel — sem passar pelo DB. Útil quando o grupo é maior do que o tamanho
 * que vale salvar como contatos (Léo pediu como alternativa à captação direta).
 *
 * CSV usa `;` como separador (compatível com Excel BR) e inclui BOM UTF-8 pra
 * acentos não saírem corrompidos.
 */
export async function exportGroupContactsCsv(
  groupId: string
): Promise<{ csv?: string; total?: number; error?: string }> {
  await getCompanyId()
  const id = groupId?.trim()
  if (!id) return { error: 'Grupo inválido.' }

  const cfg = await getActiveWhatsAppConfig()
  if (!cfg) return { error: 'Provedor WhatsApp não configurado.' }

  const { phones, nameMap, error: fetchError } = await fetchGroupParticipantsWithNames(cfg, id)
  if (fetchError) return { error: fetchError }
  if (phones.length === 0) return { csv: '﻿telefone;nome\n', total: 0 }

  // Escape básico de CSV: aspas duplas dobradas + envolve em aspas se houver
  // separador, aspas ou quebra de linha.
  const esc = (v: string) => {
    if (!v) return ''
    if (/[";\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }

  // Telefone tem 12-13 dígitos: o Excel "ajuda" abrindo como número e mostra em
  // notação científica (5,51E+12). Truque clássico: cada célula vira a fórmula
  // ="55..." → o Excel avalia, devolve string, e exibe os dígitos completos.
  // No CSV, isso fica como "=""55..."" " (aspas dobradas pelo escape padrão).
  const phoneCell = (phone: string) => phone ? `"=""${phone}"""` : ''

  const rows = phones.map((phone) => `${phoneCell(phone)};${esc(nameMap.get(phone) || '')}`)
  const csv = '﻿telefone;nome\n' + rows.join('\n') + '\n'

  return { csv, total: phones.length }
}
