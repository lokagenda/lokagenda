'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const statuses = [
  { value: 'all', label: 'Todos' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Inadimplente' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
]

export function SubscriptionFilter({ current }: { current: string }) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <Button
          key={s.value}
          variant={current === s.value ? 'primary' : 'outline'}
          size="sm"
          onClick={() =>
            router.push(
              s.value === 'all'
                ? '/admin/assinaturas'
                : `/admin/assinaturas?status=${s.value}`
            )
          }
        >
          {s.label}
        </Button>
      ))}
    </div>
  )
}
