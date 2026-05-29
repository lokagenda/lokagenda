'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp-api/sender'

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

// ── Reactivation Templates ────────────────────────────────

const REACTIVATION_TEMPLATES = [
  {
    slug: 'react_trial_parado',
    name: 'Reativacao - Trial parado',
    content:
      'Oi {{nome}}, tudo bem? 😊\n\nVi que você criou conta no LokAgenda mas ainda não começou a usar. Posso te ajudar a configurar? Em 5 minutos deixo tudo rodando: produtos, contrato e primeiro orçamento.\n\nMe chama aqui! 👊',
  },
  {
    slug: 'react_trial_expirado',
    name: 'Reativacao - Trial expirado',
    content:
      'Oi {{nome}}, seu teste do LokAgenda terminou 😬\n\nQue tal voltar com um desconto especial? Use o cupom {{cupom}} e ganhe desconto no primeiro mês.\n\nQuer continuar? Me chama!',
  },
  {
    slug: 'react_cancelado',
    name: 'Reativacao - Cancelado',
    content:
      'Oi {{nome}}, senti sua falta no LokAgenda! 💙\n\nSe quiser voltar, tenho uma condição especial pra ti com o cupom {{cupom}}. Me chama que te ajudo a reativar.',
  },
] as const

/** Lista de slugs usados pelo módulo de reativação (útil para a UI). */
export const REACTIVATION_TEMPLATE_SLUGS = REACTIVATION_TEMPLATES.map((t) => t.slug)

/**
 * Cria/atualiza (idempotente, por slug) os 3 templates padrão de reativação.
 */
export async function seedReactivationTemplates() {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const now = new Date().toISOString()
    const { error } = await admin
      .from('whatsapp_templates')
      .upsert(
        REACTIVATION_TEMPLATES.map((t) => ({
          slug: t.slug,
          name: t.name,
          content: t.content,
          active: true,
          updated_at: now,
        })),
        { onConflict: 'slug' }
      )

    if (error) throw new Error(error.message)
    return { created: REACTIVATION_TEMPLATES.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar templates'
    console.error('[reativacao] seedReactivationTemplates:', err)
    return { error: msg }
  }
}

/**
 * Lista apenas os templates de reativação (para popular o seletor da UI).
 */
export async function listReactivationTemplates() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('whatsapp_templates')
    .select('id, slug, name, content, active')
    .in('slug', REACTIVATION_TEMPLATES.map((t) => t.slug))
    .order('slug', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// ── Reactivation Targets ──────────────────────────────────

export type ReactivationFilter =
  | 'trial_parado'
  | 'trial_expirado'
  | 'cancelado'
  | 'all'

export interface ReactivationTarget {
  companyId: string
  name: string
  phone: string | null
  hasPhone: boolean
  ownerEmail: string | null
  status: string | null
  trialEndsAt: string | null
  createdAt: string
  daysSinceSignup: number
}

interface CompanyWithSubs {
  id: string
  name: string
  phone: string | null
  created_at: string
  profiles?: { id: string; role: string }[] | null
  subscriptions?: {
    status: string
    trial_ends_at: string | null
    created_at: string
  }[] | null
}

/**
 * Seleciona a assinatura mais recente da empresa.
 */
function latestSubscription(company: CompanyWithSubs) {
  const subs = company.subscriptions || []
  if (subs.length === 0) return null
  return [...subs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

/**
 * Verifica se a assinatura mais recente bate com o filtro de reativação.
 */
function matchesFilter(
  sub: { status: string; trial_ends_at: string | null } | null,
  filter: ReactivationFilter
): boolean {
  const now = Date.now()

  switch (filter) {
    case 'trial_parado':
      return (
        sub?.status === 'trial' &&
        !!sub.trial_ends_at &&
        new Date(sub.trial_ends_at).getTime() > now
      )
    case 'trial_expirado':
      return (
        sub?.status === 'expired' ||
        (sub?.status === 'trial' &&
          !!sub.trial_ends_at &&
          new Date(sub.trial_ends_at).getTime() <= now)
      )
    case 'cancelado':
      return sub?.status === 'cancelled'
    case 'all':
      // Qualquer empresa que não esteja com assinatura ativa.
      return sub?.status !== 'active'
    default:
      return false
  }
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Lista empresas-alvo para reativação conforme o filtro, com email do
 * proprietário (via auth admin), status, trial e dias desde o cadastro.
 */
export async function listReactivationTargets(filter: ReactivationFilter) {
  try {
    return await listReactivationTargetsInner(filter)
  } catch (err) {
    // Nunca propaga o erro genérico de Server Components: loga (aparece nos logs
    // do Vercel) e devolve o motivo real para a UI exibir.
    const msg = err instanceof Error ? err.message : 'Erro ao carregar empresas'
    console.error('[reativacao] listReactivationTargets:', err)
    return { targets: [] as ReactivationTarget[], total: 0, sendableCount: 0, error: msg }
  }
}

async function listReactivationTargetsInner(filter: ReactivationFilter) {
  await requireSuperAdmin()
  const admin = createAdminClient()

  // Sem EMBEDS do PostgREST: buscamos companies, subscriptions e profiles em
  // queries simples e cruzamos no JS. Embeds (companies->profiles->subscriptions)
  // são frágeis após migrations (cache de relacionamento do PostgREST pode ficar
  // stale e responder 400), então evitamos por robustez.
  const { data: companiesData, error: companiesError } = await admin
    .from('companies')
    .select('id, name, phone, created_at')
    .order('created_at', { ascending: false })

  if (companiesError) throw new Error(companiesError.message)

  const { data: subsData, error: subsError } = await admin
    .from('subscriptions')
    .select('company_id, status, trial_ends_at, created_at')

  if (subsError) throw new Error(subsError.message)

  const { data: ownersData } = await admin
    .from('profiles')
    .select('id, company_id')
    .eq('role', 'owner')

  // Agrupa subscriptions por empresa e mapeia owner por empresa.
  const subsByCompany = new Map<string, { status: string; trial_ends_at: string | null; created_at: string }[]>()
  for (const s of subsData ?? []) {
    const arr = subsByCompany.get(s.company_id) ?? []
    arr.push({ status: s.status, trial_ends_at: s.trial_ends_at, created_at: s.created_at })
    subsByCompany.set(s.company_id, arr)
  }
  const ownerByCompany = new Map<string, string>()
  for (const o of ownersData ?? []) {
    if (o.company_id && !ownerByCompany.has(o.company_id)) ownerByCompany.set(o.company_id, o.id)
  }

  const companies = (companiesData ?? []).map((c) => ({
    ...c,
    subscriptions: subsByCompany.get(c.id) ?? [],
  })) as unknown as CompanyWithSubs[]

  const matched = companies
    .map((company) => ({ company, sub: latestSubscription(company) }))
    .filter(({ sub }) => matchesFilter(sub, filter))

  // Busca os emails dos proprietários de uma vez só (auth.users) e monta um mapa.
  // Evita N chamadas sequenciais a getUserById (lento e propenso a timeout no
  // serverless) — mesmo padrão usado em listUsers() de admin.ts. Tolerante a falha.
  const emailMap = new Map<string, string>()
  try {
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of authUsers?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email)
    }
  } catch {
    // Sem emails: segue sem quebrar a página.
  }

  const targets: ReactivationTarget[] = matched.map(({ company, sub }) => {
    const ownerId = ownerByCompany.get(company.id)
    const ownerEmail = ownerId ? emailMap.get(ownerId) ?? null : null
    const phone = company.phone?.trim() || null

    return {
      companyId: company.id,
      name: company.name,
      phone,
      hasPhone: !!phone,
      ownerEmail,
      status: sub?.status ?? null,
      trialEndsAt: sub?.trial_ends_at ?? null,
      createdAt: company.created_at,
      daysSinceSignup: daysSince(company.created_at),
    }
  })

  const sendableCount = targets.filter((t) => t.hasPhone).length

  return { targets, total: targets.length, sendableCount }
}

// ── Batch Send ────────────────────────────────────────────

/**
 * Envia o template de reativação para as empresas selecionadas (em lote,
 * com pequeno intervalo entre envios). Empresas sem telefone são puladas.
 */
export async function sendReactivationBatch(
  companyIds: string[],
  templateSlug: string
): Promise<{ sent: number; failed: number; skipped: number } | { error: string }> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    await requireSuperAdmin()
    admin = createAdminClient()
  } catch (err) {
    console.error('[reativacao] sendReactivationBatch auth:', err)
    return { error: err instanceof Error ? err.message : 'Não autorizado' }
  }

  if (!companyIds.length) {
    return { sent: 0, failed: 0, skipped: 0 }
  }

  if (!REACTIVATION_TEMPLATE_SLUGS.includes(templateSlug as never)) {
    return { error: 'Template de reativação inválido' }
  }

  const { data, error } = await admin
    .from('companies')
    .select('id, name, phone')
    .in('id', companyIds)

  if (error) return { error: error.message }

  const companies = data || []
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const company of companies) {
    const phone = company.phone?.trim()
    if (!phone) {
      skipped++
      continue
    }

    try {
      const ok = await sendTemplateMessage(
        templateSlug,
        phone,
        { nome: company.name, cupom: 'VOLTAR50' },
        company.id
      )
      if (ok) sent++
      else failed++
    } catch {
      failed++
    }

    // Pequeno intervalo entre envios para não saturar o provedor.
    await new Promise((r) => setTimeout(r, 1500))
  }

  // Empresas selecionadas que não existem mais também contam como puladas.
  skipped += companyIds.length - companies.length

  return { sent, failed, skipped }
}
