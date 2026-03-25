'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

interface AdminSearchFormProps {
  placeholder?: string
  defaultValue?: string
  action: string
}

export function AdminSearchForm({ placeholder, defaultValue = '', action }: AdminSearchFormProps) {
  const [query, setQuery] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => {
      const params = query ? `?q=${encodeURIComponent(query)}` : ''
      router.push(`${action}${params}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="max-w-md flex-1">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        Buscar
      </Button>
    </form>
  )
}
