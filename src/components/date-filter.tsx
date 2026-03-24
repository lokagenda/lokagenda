'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function DateFilter({ paramName, label, defaultValue }: { paramName: string; label: string; defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <input
        type="date"
        defaultValue={defaultValue || ''}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString())
          if (e.target.value) {
            params.set(paramName, e.target.value)
          } else {
            params.delete(paramName)
          }
          params.delete('page')
          router.push(`?${params.toString()}`)
        }}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </div>
  )
}
