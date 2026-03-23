import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

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
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
