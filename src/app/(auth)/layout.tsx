import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-100 p-4 dark:bg-zinc-950">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Gradient orbs - dark */}
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-amber-900/10 blur-[100px]" />
      </div>

      {/* Gradient orbs - light */}
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[400px] w-[400px] rounded-full bg-blue-200/40 blur-[100px]" />
        <div className="absolute -bottom-[5%] -right-[5%] h-[300px] w-[300px] rounded-full bg-amber-200/30 blur-[80px]" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/15" />
            <Link href="/">
              <Image
                src="/logo.png"
                alt="LokAgenda"
                width={300}
                height={300}
                className="relative h-[160px] w-[160px] drop-shadow-2xl"
                priority
              />
            </Link>
          </div>
        </div>

        {/* Form container */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-2xl">
          {/* Top accent line */}
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

          <div className="p-8 sm:p-10">
            {children}
          </div>
        </div>

        {/* Bottom branding */}
        <p className="mt-8 text-center text-[11px] tracking-wider text-zinc-400 dark:text-zinc-600">
          LOKAGENDA &middot; GESTÃO DE LOCAÇÕES
        </p>
      </div>
    </div>
  )
}
