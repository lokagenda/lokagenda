export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout público e standalone: sem sidebar, sem autenticação.
  // O <html>/<body> já são fornecidos pelo layout raiz (src/app/layout.tsx).
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {children}
    </div>
  )
}
