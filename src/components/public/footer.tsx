import Link from 'next/link'
import Image from 'next/image'

export function PublicFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="LokAgenda" width={32} height={32} className="rounded-lg dark:hidden" />
              <Image src="/logo-white.png" alt="LokAgenda" width={32} height={32} className="hidden rounded-lg dark:block" />
              <span className="text-lg font-bold text-primary">LokAgenda</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Sistema completo para empresas de locação de brinquedos e equipamentos para festas e eventos.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Links</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#funcionalidades" className="text-sm text-zinc-500 transition-colors hover:text-primary dark:text-zinc-400">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#precos" className="text-sm text-zinc-500 transition-colors hover:text-primary dark:text-zinc-400">
                  Preços
                </a>
              </li>
              <li>
                <Link href="/login" className="text-sm text-zinc-500 transition-colors hover:text-primary dark:text-zinc-400">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-zinc-500 transition-colors hover:text-primary dark:text-zinc-400">
                  Cadastro
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contato</h4>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-zinc-500 dark:text-zinc-400">contato@lokagenda.com.br</li>
              <li>
                <a
                  href="https://wa.me/5516991773037"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-500 transition-colors hover:text-primary dark:text-zinc-400"
                >
                  (16) 99177-3037 (WhatsApp)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            &copy; 2026 LokAgenda. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
