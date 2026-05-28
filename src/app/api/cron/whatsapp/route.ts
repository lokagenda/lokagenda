import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTemplateMessage } from '@/lib/whatsapp-api/sender'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function daysUntil(dateStr: string, today: Date): string {
  const target = new Date(dateStr)
  target.setUTCHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return String(Math.max(diff, 0))
}

export async function GET(request: NextRequest) {
  // Verify authorization
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Helper dates
  const addDays = (d: Date, n: number) => {
    const r = new Date(d)
    r.setUTCDate(r.getUTCDate() + n)
    return r.toISOString().split('T')[0]
  }

  const plus3 = addDays(today, 3)
  const plus1 = addDays(today, 1)
  const minus1 = addDays(today, -1)
  const minus3 = addDays(today, -3)

  // Auto-expira trials vencidos: sem isto o status fica 'trial' pra sempre e as
  // mensagens de pós-trial ("não renovou") e os filtros de reativação nunca casam.
  // Só toca trials (planos pagos são gerenciados pelo webhook do MercadoPago).
  await admin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null)
    .lt('trial_ends_at', `${todayStr}T00:00:00Z`)

  // Define queries: [templateSlug, query builder]
  type SubRow = {
    company_id: string
    trial_ends_at: string | null
    current_period_end: string | null
    companies: { name: string; phone: string | null } | null
  }

  const queries: Array<{
    slug: string
    fetch: () => Promise<SubRow[]>
  }> = [
    {
      slug: 'trial_3_days',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .eq('status', 'trial')
          .gte('trial_ends_at', `${plus3}T00:00:00Z`)
          .lte('trial_ends_at', `${plus3}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      slug: 'trial_1_day',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .eq('status', 'trial')
          .gte('trial_ends_at', `${plus1}T00:00:00Z`)
          .lte('trial_ends_at', `${plus1}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      slug: 'trial_expired',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .in('status', ['trial', 'expired'])
          .gte('trial_ends_at', `${minus1}T00:00:00Z`)
          .lte('trial_ends_at', `${minus1}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      // 3 dias após o fim do trial (status já 'expired'/'cancelled'). Janela
      // separada do trial_expired (minus1) para não disparar duas msgs no mesmo dia.
      slug: 'trial_not_renewed',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .in('status', ['expired', 'cancelled'])
          .not('trial_ends_at', 'is', null)
          .gte('trial_ends_at', `${minus3}T00:00:00Z`)
          .lte('trial_ends_at', `${minus3}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      slug: 'plan_3_days',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .eq('status', 'active')
          .gte('current_period_end', `${plus3}T00:00:00Z`)
          .lte('current_period_end', `${plus3}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      slug: 'plan_expires_today',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .eq('status', 'active')
          .gte('current_period_end', `${todayStr}T00:00:00Z`)
          .lte('current_period_end', `${todayStr}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
    {
      slug: 'plan_not_renewed',
      fetch: async () => {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id, trial_ends_at, current_period_end, companies(name, phone)')
          .in('status', ['expired', 'cancelled', 'past_due'])
          .gte('current_period_end', `${minus1}T00:00:00Z`)
          .lte('current_period_end', `${minus1}T23:59:59Z`)
        return (data || []) as unknown as SubRow[]
      },
    },
  ]

  let messagesSent = 0
  let messagesFailed = 0

  for (const { slug, fetch } of queries) {
    try {
      const rows = await fetch()

      for (const row of rows) {
        try {
          const company = row.companies
          if (!company?.phone) continue

          // Deduplication: check if already sent today
          const { data: existing } = await admin
            .from('whatsapp_message_log')
            .select('id')
            .eq('company_id', row.company_id)
            .eq('template_slug', slug)
            .gte('created_at', `${todayStr}T00:00:00Z`)
            .lte('created_at', `${todayStr}T23:59:59Z`)
            .limit(1)

          if (existing && existing.length > 0) continue

          const dateField = row.trial_ends_at || row.current_period_end || ''
          const variables: Record<string, string> = {
            nome_empresa: company.name,
            data_validade: dateField ? formatDate(dateField) : '',
            dias_restantes: dateField ? daysUntil(dateField, today) : '0',
          }

          const sent = await sendTemplateMessage(slug, company.phone, variables, row.company_id)
          if (sent) messagesSent++
          else messagesFailed++
        } catch {
          messagesFailed++
        }
      }
    } catch {
      messagesFailed++
    }
  }

  return NextResponse.json({ success: true, messages_sent: messagesSent, messages_failed: messagesFailed })
}
