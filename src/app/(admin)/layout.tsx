import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Image,
  Users,
  ScrollText,
  ArrowLeft,
  Shield,
} from 'lucide-react'

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Empresas', href: '/admin/empresas', icon: Building2 },
  { label: 'Planos', href: '/admin/planos', icon: CreditCard },
  { label: 'Assinaturas', href: '/admin/assinaturas', icon: Receipt },
  { label: 'Contratos', href: '/admin/contratos', icon: ScrollText },
  { label: 'Banners', href: '/admin/banners', icon: Image },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const userName = profile?.full_name || user.email?.split('@')[0] || 'Admin'

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-6 dark:border-zinc-800">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Admin LokAgenda
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            {userName}
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao sistema
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        <header className="flex h-16 items-center border-b border-zinc-200 bg-white px-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Painel Administrativo
          </h1>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
