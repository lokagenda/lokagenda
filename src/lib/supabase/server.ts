import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase do servidor, UM por requisicao, com getUser() deduplicado.
 *
 * Por que: cada pagina do dashboard conferia o login varias vezes (layout,
 * pagina, helpers das actions), e cada conferencia e uma ida ao servidor de
 * Auth — que usa no maximo 10 conexoes com o banco. No pico de sexta 11/09
 * foram 544 chamadas de getUser em 25 min; formou fila, login levando ate
 * 264s, e o projeto travou por 2h20 ate um restart.
 *
 * Como:
 * - `cache()` do React devolve o MESMO cliente para todas as chamadas dentro
 *   de uma requisicao. O escopo e por requisicao — a doc do Next e explicita:
 *   "Each request gets its own memoization scope with no sharing between
 *   requests" — entao nao ha vazamento de sessao entre usuarios. Fora de um
 *   escopo de render (ex.: Route Handler), o cache simplesmente nao
 *   deduplica, e o comportamento fica igual ao de antes.
 * - getUser() sem argumento reaproveita a primeira chamada em andamento.
 *   getUser(jwt) — validar um token especifico — nunca e reaproveitado.
 * - Qualquer metodo que muda a sessao (signIn, signOut, updateUser...) zera o
 *   reaproveitamento antes e depois de rodar, pra nunca devolver usuario velho.
 */

const MUTADORES_DE_SESSAO = [
  "signUp",
  "signInWithPassword",
  "signInWithOtp",
  "signInWithOAuth",
  "signInWithIdToken",
  "signInAnonymously",
  "signOut",
  "verifyOtp",
  "exchangeCodeForSession",
  "updateUser",
  "setSession",
  "refreshSession",
  "reauthenticate",
] as const;

async function criarClient() {
  const cookieStore = await cookies();

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const auth = client.auth;
  const getUserOriginal = auth.getUser.bind(auth);
  let emAndamento: ReturnType<typeof auth.getUser> | null = null;

  auth.getUser = ((jwt?: string) => {
    if (jwt) return getUserOriginal(jwt);
    if (!emAndamento) emAndamento = getUserOriginal();
    return emAndamento;
  }) as typeof auth.getUser;

  const authMetodos = auth as unknown as Record<string, unknown>;
  for (const nome of MUTADORES_DE_SESSAO) {
    const original = authMetodos[nome];
    if (typeof original !== "function") continue;
    authMetodos[nome] = (...args: unknown[]) => {
      emAndamento = null;
      return Promise.resolve(
        (original as (...a: unknown[]) => unknown).apply(auth, args)
      ).finally(() => {
        emAndamento = null;
      });
    };
  }

  return client;
}

export const createClient = cache(criarClient);
