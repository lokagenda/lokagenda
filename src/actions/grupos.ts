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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken

  // O endpoint /groups da Z-API é PAGINADO (page/pageSize são obrigatórios).
  // Sem paginar, só vinha a primeira página — por isso "não apareciam todos".
  // Aqui percorremos todas as páginas até esvaziar.
  const pageSize = 100
  const all: WhatsAppGroup[] = []
  const seen = new Set<string>()

  try {
    for (let page = 1; page <= 50; page++) {
      const response = await fetch(
        `${apiUrl}/instances/${config.instance_id}/token/${config.api_key}/groups?page=${page}&pageSize=${pageSize}`,
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
        // Aceita tudo que for grupo (isGroup) ou cujo id tenha o sufixo -group.
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

/** Carrega a config ativa da Z-API (helper interno). */
async function getZApiConfig() {
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('whatsapp_config')
    .select('provider, api_url, api_key, instance_id, phone_number_id')
    .eq('active', true)
    .limit(1)
    .single()

  if (!config || config.provider !== 'z_api' || !config.api_url || !config.api_key || !config.instance_id) {
    return null
  }
  return {
    apiUrl: config.api_url.replace(/\/$/, ''),
    apiKey: config.api_key,
    instanceId: config.instance_id,
    clientToken: config.phone_number_id as string | null,
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

  const cfg = await getZApiConfig()
  if (!cfg) return { success: false, error: 'Envio só está disponível para a Z-API configurada.' }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken

  const endpoint = mediaType === 'video' ? 'send-video' : 'send-image'
  const body =
    mediaType === 'video'
      ? { phone: id, video: mediaUrl, caption: caption || '' }
      : { phone: id, image: mediaUrl, caption: caption || '' }

  const admin = createAdminClient()
  const { data: logEntry } = await admin
    .from('whatsapp_message_log')
    .insert({ company_id: companyId, phone: id, message: caption || `[${mediaType}]`, status: 'pending' })
    .select('id')
    .single()

  try {
    const response = await fetch(
      `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/${endpoint}`,
      { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }
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
  if (file.size > 16 * 1024 * 1024) return { error: 'O arquivo deve ter no máximo 16MB.' }

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

export async function scheduleGroupMessage(data: {
  group_id: string
  group_name?: string
  content?: string
  media_url?: string
  media_type?: string
  scheduled_at: string
  recurrence?: 'once' | 'daily' | 'weekly'
}): Promise<{ success?: boolean; error?: string }> {
  const companyId = await getCompanyId()
  const supabase = await createClient()

  if (!data.group_id) return { error: 'Selecione um grupo.' }
  if (!data.content?.trim() && !data.media_url) return { error: 'Escreva uma mensagem ou anexe uma mídia.' }
  if (!data.scheduled_at) return { error: 'Defina a data e hora do envio.' }

  const { error } = await supabase.from('group_scheduled_messages').insert({
    company_id: companyId,
    group_id: data.group_id,
    group_name: data.group_name || null,
    content: data.content?.trim() || null,
    media_url: data.media_url || null,
    media_type: data.media_type || null,
    scheduled_at: new Date(data.scheduled_at).toISOString(),
    status: 'pending',
    recurrence: data.recurrence || 'once',
  })

  if (error) return { error: `Erro ao agendar: ${error.message}` }
  return { success: true }
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

// ── Captação de contatos de um grupo ──────────────────────────────────────

/**
 * Busca os participantes do grupo na Z-API + tenta mapear telefone → nome a
 * partir da agenda. Retornado em forma usável tanto pela captação quanto pelo
 * export CSV.
 */
async function fetchGroupParticipantsWithNames(
  cfg: NonNullable<Awaited<ReturnType<typeof getZApiConfig>>>,
  groupId: string
): Promise<{ phones: string[]; nameMap: Map<string, string>; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken

  let participants: { phone?: string }[] = []
  try {
    const response = await fetch(
      `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.apiKey}/group-metadata/${encodeURIComponent(groupId)}`,
      { method: 'GET', headers, signal: AbortSignal.timeout(20000) }
    )
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return { phones: [], nameMap: new Map(), error: data?.error || data?.message || `Erro HTTP ${response.status}` }
    }
    participants = Array.isArray(data?.participants) ? data.participants : []
  } catch (err) {
    return { phones: [], nameMap: new Map(), error: err instanceof Error ? err.message : 'Erro ao buscar participantes.' }
  }

  const phones = Array.from(
    new Set(
      participants
        .map((p) => String(p.phone || '').replace(/\D/g, ''))
        .filter((p) => p.length >= 10)
    )
  )

  // Best-effort: busca a agenda de contatos do número (Z-API /contacts) para
  // mapear telefone -> nome. Só vem nome de quem está salvo na agenda; os demais
  // ficam sem nome (limitação da Z-API). Não bloqueia a captação se falhar.
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

  return { phones, nameMap }
}

export async function captureGroupContacts(
  groupId: string
): Promise<{ imported?: number; total?: number; error?: string }> {
  const companyId = await getCompanyId()
  const id = groupId?.trim()
  if (!id) return { error: 'Grupo inválido.' }

  const cfg = await getZApiConfig()
  if (!cfg) return { error: 'Captação só está disponível para a Z-API configurada.' }

  const { phones, nameMap, error: fetchError } = await fetchGroupParticipantsWithNames(cfg, id)
  if (fetchError) return { error: fetchError }
  const total = phones.length
  if (total === 0) return { imported: 0, total: 0 }

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

  if (toInsert.length === 0) return { imported: 0, total }

  // Insert em lotes: PostgREST/Supabase pode aplicar limites internos a payloads
  // muito grandes (já vimos importações travarem em ~1000 contatos). Lotes de
  // 200 mantêm tudo dentro de margem segura e ainda permitem retomada parcial.
  const INSERT_CHUNK = 200
  let insertedCount = 0
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const slice = toInsert.slice(i, i + INSERT_CHUNK)
    const { error } = await admin.from('campaign_contacts').insert(slice)
    if (error) {
      return { error: `Erro ao salvar contatos (${insertedCount} já salvos): ${error.message}`, imported: insertedCount, total }
    }
    insertedCount += slice.length
  }

  return { imported: insertedCount, total }
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

  const cfg = await getZApiConfig()
  if (!cfg) return { error: 'Captação só está disponível para a Z-API configurada.' }

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
