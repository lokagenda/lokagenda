import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const publicRoutes = ['/', '/login', '/register', '/auth/callback']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// O proxy NAO roda em prefetch do <Link>. Cada pagina do dashboard mostra 15
// links no menu, e cada link visivel disparava um prefetch que passava por
// aqui e chamava auth.getUser() — ida ao servidor de Auth, que tem so 10
// conexoes com o banco. No pico de sexta 11/09 isso somou a maior parte das
// 544 chamadas de getUser em 25 min que travaram o projeto por 2h20.
//
// E seguro: sem loading.tsx no projeto, o prefetch de rota dinamica quase nao
// pre-carrega nada (a doc: "down to the nearest loading.js"). O layout do
// dashboard confere o login de novo e redireciona quem nao estiver logado, e
// a sessao continua sendo renovada nas navegacoes de verdade.
//
// Nao da pra filtrar dentro da funcao: o Next remove o header
// next-router-prefetch de request.headers no Proxy. O matcher e o caminho
// documentado (docs/.../file-conventions/proxy.md).
export const config = {
  matcher: [
    {
      source: '/dashboard/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source: '/login',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source: '/register',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
