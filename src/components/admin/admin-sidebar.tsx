'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Image,
  Users,
  ScrollText,
  PlayCircle,
  ArrowLeft,
  Shield,
  Menu,
  X,
  Package,
  MessageCircle,
  Ticket,
  RefreshCw,
  Rocket,
  UsersRound,
} from 'lucide-react'

const sidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Empresas', href: '/admin/empresas', icon: Building2 },
  { label: 'Planos', href: '/admin/planos', icon: CreditCard },
  { label: 'Assinaturas', href: '/admin/assinaturas', icon: Receipt },
  { label: 'Cupons', href: '/admin/cupons', icon: Ticket },
  { label: 'Contratos', href: '/admin/contratos', icon: ScrollText },
  { label: 'Vídeos', href: '/admin/videos', icon: PlayCircle },
  { label: 'Dados Demo', href: '/admin/demo-dados', icon: Package },
  { label: 'WhatsApp', href: '/admin/whatsapp', icon: MessageCircle },
  { label: 'Reativação', href: '/admin/reativacao', icon: RefreshCw },
  { label: 'Marketing', href: '/admin/marketing', icon: Rocket },
  { label: 'Grupos', href: '/admin/grupos', icon: UsersRound },
  { label: 'Banners', href: '/admin/banners', icon: Image },
  { label: 'Usuários', href: '/admin/usuarios', icon: Users },
]

interface AdminSidebarProps {
  userName: string
}

export function AdminSidebar({ userName }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Admin LokAgenda
        </span>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {sidebarItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-2 px-3 text-xs text-zinc-500 dark:text-zinc-400">
          {userName}
        </div>
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao sistema
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-zinc-900 p-2 text-white shadow-lg dark:bg-zinc-800 lg:hidden"
        aria-label="Abrir menu admin"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-zinc-200 transition-transform duration-200 ease-in-out dark:border-zinc-800 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-zinc-200 dark:border-zinc-800 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64">
        {sidebarContent}
      </aside>
    </>
  )
}
