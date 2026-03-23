'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Calendar,
  ScrollText,
  Building2,
  LogOut,
  X,
  Menu,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  companyName: string
  companyLogoUrl?: string | null
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Produtos', href: '/dashboard/produtos', icon: Package },
  { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
  { name: 'Orçamentos', href: '/dashboard/orcamentos', icon: FileText },
  { name: 'Locações', href: '/dashboard/locacoes', icon: Calendar },
  { name: 'Contratos', href: '/dashboard/contratos', icon: ScrollText },
  { name: 'Empresa', href: '/dashboard/empresa', icon: Building2 },
]

export function Sidebar({ companyName, companyLogoUrl }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-zinc-900 dark:bg-zinc-950">
      {/* LokAgenda branding */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-5">
        <Image
          src="/logo.png"
          alt="LokAgenda"
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg object-contain"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-amber-400 leading-tight">LokAgenda</span>
          <span className="text-xs text-zinc-400 truncate">{companyName}</span>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto text-zinc-400 hover:text-white lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-zinc-900 p-2 text-white shadow-lg lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64">
        {sidebarContent}
      </aside>
    </>
  )
}
