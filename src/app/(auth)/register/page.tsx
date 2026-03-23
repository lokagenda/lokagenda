'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/actions/auth'
import toast from 'react-hot-toast'
import { ArrowRight, Mail, Lock, User, Building2, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    const result = await signUp(formData)

    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success('Conta criada! Verifique seu e-mail.')
    router.push('/verificar-email')
  }

  const inputClass = "w-full rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 pl-11 pr-4 text-[14px] text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-500/30"
  const labelClass = "block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
  const iconClass = "absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400"

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Criar sua conta
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Comece a gerenciar suas locações agora
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className={labelClass}>Nome completo</label>
          <div className="group relative">
            <User className={iconClass} />
            <input id="fullName" name="fullName" type="text" placeholder="Seu nome completo" required className={inputClass} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>E-mail</label>
          <div className="group relative">
            <Mail className={iconClass} />
            <input id="email" name="email" type="email" placeholder="seu@email.com" required className={inputClass} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="companyName" className={labelClass}>Nome da empresa</label>
          <div className="group relative">
            <Building2 className={iconClass} />
            <input id="companyName" name="companyName" type="text" placeholder="Nome da sua empresa" required className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>Senha</label>
            <div className="group relative">
              <Lock className={iconClass} />
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Min. 6 caracteres" required minLength={6} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className={labelClass}>Confirmar</label>
            <div className="group relative">
              <Lock className={iconClass} />
              <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Repetir senha" required minLength={6} className={inputClass} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition hover:text-zinc-500 dark:hover:text-zinc-400"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-2 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-[14px] font-semibold text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_4px_28px_-4px_rgba(37,99,235,0.6)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Criar conta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-amber-600 dark:text-amber-400/80 transition hover:text-amber-500 dark:hover:text-amber-300">
          Fazer login
        </Link>
      </p>
    </div>
  )
}
