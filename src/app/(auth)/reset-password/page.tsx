'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Senha alterada com sucesso!')
    router.push('/login')
  }

  const inputClass = "w-full rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 pl-11 pr-11 text-[14px] text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-500/30"

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nova senha
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Escolha uma senha segura para sua conta
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Nova senha
          </label>
          <div className="group relative">
            <Lock className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
            <input
              id="password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caracteres"
              required minLength={6} className={inputClass}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition hover:text-zinc-500 dark:hover:text-zinc-400" tabIndex={-1}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Confirmar nova senha
          </label>
          <div className="group relative">
            <Lock className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
            <input
              id="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir senha"
              required minLength={6} className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-[14px] font-semibold text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_4px_28px_-4px_rgba(37,99,235,0.6)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Redefinir senha
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </p>
    </div>
  )
}
