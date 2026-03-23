'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  async function handleResend() {
    if (!email) {
      toast.error('Informe seu e-mail para reenviar.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Link reenviado!')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-7">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
          <CheckCircle2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Verifique seu e-mail
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Enviamos um link de verificação. Clique nele para ativar sua conta.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50 p-4">
        <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-[12px] text-blue-600 dark:text-blue-400">
          Não recebeu? Verifique a pasta de spam ou reenvie abaixo.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="resendEmail" className="block text-[12px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            E-mail para reenvio
          </label>
          <div className="group relative">
            <Mail className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
            <input
              id="resendEmail" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com"
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 pl-11 pr-4 text-[14px] text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-500/30"
            />
          </div>
        </div>

        <button
          type="button" onClick={handleResend} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 py-3 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Reenviar link
            </>
          )}
        </button>
      </div>

      <p className="text-center text-[13px] text-zinc-400 dark:text-zinc-500">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </p>
    </div>
  )
}
