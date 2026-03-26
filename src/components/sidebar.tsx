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
  Search,
  ScrollText,
  Building2,
  CreditCard,
  Megaphone,
  HelpCircle,
  LogOut,
  X,
  Menu,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  companyName: string
  companyLogoUrl?: string | null
  role?: string
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Produtos', href: '/dashboard/produtos', icon: Package },
  { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
  { name: 'Orçamentos', href: '/dashboard/orcamentos', icon: FileText },
  { name: 'Locações', href: '/dashboard/locacoes', icon: Calendar },
  { name: 'Disponibilidade', href: '/dashboard/disponibilidade', icon: Search },
  { name: 'Contratos', href: '/dashboard/contratos', icon: ScrollText },
  { name: 'Empresa', href: '/dashboard/empresa', icon: Building2 },
  { name: 'Assinatura', href: '/dashboard/assinatura', icon: CreditCard },
  { name: 'Banners', href: '/dashboard/banners', icon: Megaphone },
  { name: 'Ajuda', href: '/dashboard/ajuda', icon: HelpCircle },
]

export function Sidebar({ companyName, companyLogoUrl, role }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNavigation = navigation.filter((item) => {
    if (item.name === 'Banners' && role !== 'super_admin') return false
    return true
  })

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
    <div className="flex h-full flex-col bg-gradient-to-b from-zinc-900 to-zinc-950">
      {/* Brand header */}
      <div className="relative flex flex-col items-center border-b border-white/5 px-4 pb-3 pt-5">
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 text-zinc-500 hover:text-white lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Image
          src="/logo.png"
          alt="LokAgenda"
          width={120}
          height={120}
          className="h-20 w-20 object-contain"
        />
        <span className="mt-1 text-[12px] font-medium text-zinc-500 truncate max-w-full text-center">{companyName}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-0.5">
          {filteredNavigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                <span className="flex-1">{item.name}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 text-white/50" />}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/5 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-300"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
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
