'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      if (error === 'auth_callback_error') {
        toast.error('O link de redefinição expirou. Solicite um novo em "Esqueceu?"')
      }
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha inválidos.'
        : error.message
      )
      setLoading(false)
      return
    }

    toast.success('Login realizado com sucesso!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bem-vindo de volta
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Acesse sua conta para gerenciar suas locações
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
          >
            E-mail
          </label>
          <div className="group relative">
            <Mail className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 pl-11 pr-4 text-[14px] text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
            >
              Senha
            </label>
            <Link
              href="/esqueci-senha"
              className="text-[12px] text-blue-600 dark:text-blue-400/70 transition hover:text-blue-500 dark:hover:text-blue-300"
            >
              Esqueceu?
            </Link>
          </div>
          <div className="group relative">
            <Lock className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 pl-11 pr-11 text-[14px] text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition hover:text-zinc-500 dark:hover:text-zinc-400"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-[14px] font-semibold text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_4px_28px_-4px_rgba(37,99,235,0.6)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {/* Button shine effect */}
          <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Entrar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[12px] text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">ou</span>
        </div>
      </div>

      <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500">
        Não tem uma conta?{' '}
        <Link
          href="/register"
          className="font-medium text-amber-600 dark:text-amber-400/80 transition hover:text-amber-500 dark:hover:text-amber-300"
        >
          Criar conta
        </Link>
      </p>
    </div>
  )
}
