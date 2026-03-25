import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { DailyPopup } from '@/components/daily-popup'
import { SubscriptionGate } from '@/components/subscription-gate'
import { isSubscriptionActive, getTrialDaysRemaining } from '@/lib/plans'
import type { Subscription } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch company data
  let company = null
  if (profile?.company_id) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()
    company = data
  }

  // Fetch subscription status
  let subscriptionStatus: 'none' | 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due' = 'none'
  let trialDaysRemaining = 0

  if (profile?.company_id) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (subscription) {
      const sub = subscription as Subscription
      if (isSubscriptionActive(sub)) {
        subscriptionStatus = sub.status as typeof subscriptionStatus
      } else if (sub.status === 'trial') {
        // Trial expirado
        subscriptionStatus = 'trial'
        trialDaysRemaining = 0
      } else {
        subscriptionStatus = sub.status as typeof subscriptionStatus
      }

      if (sub.status === 'trial') {
        trialDaysRemaining = getTrialDaysRemaining(sub)
      }
    }

    // Super admin bypassa verificação de assinatura
    if (profile.role === 'super_admin') {
      subscriptionStatus = 'active'
    }
  }

  const userName = profile?.full_name || user.email?.split('@')[0] || 'Usuário'
  const companyName = company?.name || 'Minha Empresa'

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        companyName={companyName}
        companyLogoUrl={company?.logo_url}
      />

      {/* Main content area offset by sidebar width on desktop */}
      <div className="lg:pl-64">
        <Header userName={userName} avatarUrl={profile?.avatar_url} />
        <SubscriptionGate
          status={subscriptionStatus}
          trialDaysRemaining={trialDaysRemaining}
        >
          <main className="p-6 lg:p-10">{children}</main>
        </SubscriptionGate>
      </div>

      <DailyPopup />
    </div>
  )
}
