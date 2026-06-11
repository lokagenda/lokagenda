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

// Slugs usados internamente. NÃO exportar: este arquivo é 'use server' e só pode
// exportar funções async — um export const (valor não-async) quebra o registro
// de TODAS as actions do módulo (rejeição no boundary com erro genérico).
const REACTIVATION_TEMPLATE_SLUGS = REACTIVATION_TEMPLATES.map((t) => t.slug)

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
export async function listReactivationTemplates(): Promise<{
  templates: { id: string; slug: string; name: string; content: string; active: boolean }[]
  error?: string
}> {
  try {
    await requireSuperAdmin()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('whatsapp_templates')
      .select('id, slug, name, content, active')
      .in('slug', REACTIVATION_TEMPLATES.map((t) => t.slug))
      .order('slug', { ascending: true })

    if (error) throw new Error(error.message)
    return { templates: data || [] }
  } catch (err) {
    console.error('[reativacao] listReactivationTemplates:', err)
    return { templates: [], error: err instanceof Error ? err.message : 'Erro ao carregar templates' }
  }
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

  // Agrupa subscriptions por empresa.
  const subsByCompany = new Map<string, { status: string; trial_ends_at: string | null; created_at: string }[]>()
  for (const s of subsData ?? []) {
    const arr = subsByCompany.get(s.company_id) ?? []
    arr.push({ status: s.status, trial_ends_at: s.trial_ends_at, created_at: s.created_at })
    subsByCompany.set(s.company_id, arr)
  }

  const companies = (companiesData ?? []).map((c) => ({
    ...c,
    subscriptions: subsByCompany.get(c.id) ?? [],
  })) as unknown as CompanyWithSubs[]

  const matched = companies
    .map((company) => ({ company, sub: latestSubscription(company) }))
    .filter(({ sub }) => matchesFilter(sub, filter))

  // NOTA: não buscamos mais o email do proprietário aqui. A chamada
  // admin.auth.admin.listUsers() era a única operação não-PostgREST e podia
  // travar/estourar o tempo da function (matando a action -> erro genérico).
  // O telefone é o que importa para o disparo; o email fica de fora por robustez.
  const targets: ReactivationTarget[] = matched.map(({ company, sub }) => {
    const phone = company.phone?.trim() || null

    return {
      companyId: company.id,
      name: company.name,
      phone,
      hasPhone: !!phone,
      ownerEmail: null,
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
 * Enfileira o template de reativação para as empresas selecionadas. NÃO envia
 * direto — só insere em `reactivation_queue`. O cron /api/cron/reactivate-queue
 * processa em lotes com intervalo anti-ban e respeita o limite de execução do
 * Vercel. Empresas sem telefone são puladas.
 *
 * Antes esta função usava `after()` pra mandar em background, mas o Vercel mata
 * a task em ~3min, perdendo envios em lotes grandes (98 viraram 13 sent).
 */
export async function sendReactivationBatch(
  companyIds: string[],
  templateSlug: string
): Promise<{ queued: number; skipped: number } | { error: string }> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    await requireSuperAdmin()
    admin = createAdminClient()
  } catch (err) {
    console.error('[reativacao] sendReactivationBatch auth:', err)
    return { error: err instanceof Error ? err.message : 'Não autorizado' }
  }

  if (!companyIds.length) {
    return { queued: 0, skipped: 0 }
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
  const toQueue = companies
    .filter((c) => c.phone?.trim())
    .map((c) => ({
      company_id: c.id,
      phone: c.phone!.trim(),
      company_name: c.name,
      template_slug: templateSlug,
      status: 'pending' as const,
    }))
  const skipped = companyIds.length - toQueue.length

  if (toQueue.length > 0) {
    // Insert em lotes pra não estourar o body do PostgREST com 1000+ items.
    const CHUNK = 200
    for (let i = 0; i < toQueue.length; i += CHUNK) {
      const slice = toQueue.slice(i, i + CHUNK)
      const { error: insertErr } = await admin.from('reactivation_queue').insert(slice)
      if (insertErr) {
        return { error: `Erro ao enfileirar (${i} já enfileirados): ${insertErr.message}` }
      }
    }
  }

  return { queued: toQueue.length, skipped }
}
