'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, Send } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/callback?type=recovery',
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Recuperar senha
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          {sent
            ? 'Verifique seu e-mail para o link de recuperação'
            : 'Informe seu e-mail para receber o link'}
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[13px] leading-relaxed text-emerald-600 dark:text-emerald-400">
              Link enviado para <span className="font-medium text-emerald-500 dark:text-emerald-400">{email}</span>
            </p>
          </div>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 text-center">
            Verifique também sua pasta de spam
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
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

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-[14px] font-semibold text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_4px_28px_-4px_rgba(37,99,235,0.6)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar link
              </>
            )}
          </button>
        </form>
      )}

      <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </p>
    </div>
  )
}
