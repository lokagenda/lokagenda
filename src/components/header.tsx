'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, User, KeyRound, Eye, EyeOff, Loader2, Pencil, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { updateMyProfileName } from '@/actions/company'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

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
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Modal de editar perfil (nome)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Modal de troca de senha
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

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

  function openProfileModal() {
    setProfileName(userName === 'Usuário' ? '' : userName)
    setProfileModalOpen(true)
    setDropdownOpen(false)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await updateMyProfileName(profileName)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Nome atualizado!')
      setProfileModalOpen(false)
      router.refresh()
    } finally {
      setSavingProfile(false)
    }
  }

  function openPasswordModal() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswords(false)
    setPasswordModalOpen(true)
    setDropdownOpen(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    setSavingPassword(true)
    const supabase = createClient()

    // Pega o email da sessão atual pra reverificar a senha atual antes de trocar.
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) {
      toast.error('Sessão expirada. Faça login novamente.')
      setSavingPassword(false)
      return
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInErr) {
      toast.error('Senha atual incorreta.')
      setSavingPassword(false)
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) {
      toast.error(updateErr.message)
      setSavingPassword(false)
      return
    }

    toast.success('Senha alterada com sucesso!')
    setPasswordModalOpen(false)
    setSavingPassword(false)
  }

  const pwdInputClass =
    'w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50'

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
        <NotificationBell />
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
          <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{userName}</p>
            </div>
            <button
              onClick={openProfileModal}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" />
              Editar perfil
            </button>
            <button
              onClick={openPasswordModal}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <KeyRound className="h-4 w-4" />
              Alterar senha
            </button>
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

      {/* Modal de editar perfil (nome) */}
      <Modal open={profileModalOpen} onClose={() => !savingProfile && setProfileModalOpen(false)} title="Editar perfil">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Nome</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Seu nome"
                required
                maxLength={80}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              É o nome que aparece no &quot;Bem-vindo de volta&quot; do painel.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setProfileModalOpen(false)} disabled={savingProfile}>
              Cancelar
            </Button>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de alterar senha */}
      <Modal open={passwordModalOpen} onClose={() => !savingPassword && setPasswordModalOpen(false)} title="Alterar senha">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Senha atual</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                required
                className={pwdInputClass}
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Nova senha</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 caracteres"
                required
                minLength={6}
                className={pwdInputClass}
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                tabIndex={-1}
                aria-label="Mostrar/ocultar senhas"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Confirmar nova senha</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetir nova senha"
                required
                minLength={6}
                className={pwdInputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPasswordModalOpen(false)} disabled={savingPassword}>
              Cancelar
            </Button>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </header>
  )
}
