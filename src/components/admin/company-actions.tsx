'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleCompanyStatus } from '@/actions/admin'
import toast from 'react-hot-toast'

interface CompanyActionsProps {
  companyId: string
  isSuspended: boolean
}

export function CompanyActions({ companyId, isSuspended }: CompanyActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleCompanyStatus(companyId, !isSuspended)
        toast.success(isSuspended ? 'Empresa reativada' : 'Empresa suspensa')
      } catch (err: any) {
        toast.error(err.message || 'Erro ao atualizar empresa')
      }
    })
  }

  return (
    <Button
      variant={isSuspended ? 'primary' : 'danger'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isSuspended ? 'Reativar' : 'Suspender'}
    </Button>
  )
}
