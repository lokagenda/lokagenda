'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronDown, User } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'

interface HeaderProps {
  userName: string
  avatarUrl?: string | null
}

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/produtos': 'Produtos',
  '/dashboard/clientes': 'Clientes',
  '/dashboard/orcamentos': 'Orçamentos',
  '/dashboard/locacoes': 'Locações',
  '/dashboard/contratos': 'Contratos',
  '/dashboard/empresa': 'Empresa',
}

export function Header({ userName, avatarUrl }: HeaderProps) {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Determine the page title
  const pageTitle =
    routeTitles[pathname] ||
    Object.entries(routeTitles).find(([route]) => pathname.startsWith(route))?.[1] ||
    'Dashboard'

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 lg:px-8">
      {/* Left: page title (with left padding on mobile for hamburger) */}
      <div className="pl-12 lg:pl-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {pageTitle}
        </h1>
      </div>

      {/* Right: theme toggle + user dropdown */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`Avatar de ${userName}`}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              <User className="h-4 w-4" />
            </div>
          )}
          <span className="hidden font-medium text-zinc-700 dark:text-zinc-300 sm:inline">
            {userName}
          </span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{userName}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sair da conta
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  )
}
