'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'lokagenda_popup_date'

interface PopupBanner {
  id: string
  image_url: string
  link_url: string | null
}

export function DailyPopup() {
  const [banner, setBanner] = useState<PopupBanner | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const lastShown = localStorage.getItem(STORAGE_KEY)

    if (lastShown === today) return

    async function fetchRandomBanner() {
      const supabase = createClient()

      const { data } = await supabase
        .from('banners')
        .select('id, image_url, link_url')
        .eq('active', true)
        .eq('type', 'popup')

      if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length)
        setBanner(data[randomIndex])
        setOpen(true)
      }
    }

    fetchRandomBanner()
  }, [])

  const handleClose = () => {
    setOpen(false)
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(STORAGE_KEY, today)
  }

  const handleLearnMore = () => {
    if (banner?.link_url) {
      window.open(banner.link_url, '_blank', 'noopener,noreferrer')
    }
    handleClose()
  }

  if (!open || !banner) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Banner image */}
        <img
          src={banner.image_url}
          alt="Promoção"
          className="w-full object-cover"
          style={{ maxHeight: '400px' }}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Fechar
          </Button>
          {banner.link_url && (
            <Button variant="primary" size="sm" onClick={handleLearnMore}>
              Saiba mais
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
