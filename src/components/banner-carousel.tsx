'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Banner {
  id: string
  image_url: string
  link_url: string | null
  position: number
}

interface BannerCarouselProps {
  companyId?: string
}

export function BannerCarousel({ companyId }: BannerCarouselProps) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [current, setCurrent] = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    async function fetchBanners() {
      const supabase = createClient()

      let query = supabase
        .from('banners')
        .select('id, image_url, link_url, position')
        .eq('active', true)
        .order('position', { ascending: true })

      if (companyId) {
        // Fetch company-specific + global banners
        query = query.or(`company_id.eq.${companyId},is_global.eq.true`)
      } else {
        query = query.eq('is_global', true)
      }

      const { data } = await query
      if (data && data.length > 0) {
        setBanners(data)
      }
    }

    fetchBanners()
  }, [companyId])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length)
  }, [banners.length])

  // Auto-rotation every 5 seconds
  useEffect(() => {
    if (banners.length <= 1 || hovered) return
    const interval = setInterval(next, 5000)
    return () => clearInterval(interval)
  }, [banners.length, hovered, next])

  if (banners.length === 0) return null

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => (
          <div key={banner.id} className="w-full shrink-0">
            {banner.link_url ? (
              <a
                href={banner.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={banner.image_url}
                  alt="Banner"
                  className="h-48 w-full object-cover sm:h-56 md:h-64 lg:h-72"
                />
              </a>
            ) : (
              <img
                src={banner.image_url}
                alt="Banner"
                className="h-48 w-full object-cover sm:h-56 md:h-64 lg:h-72"
              />
            )}
          </div>
        ))}
      </div>

      {/* Arrows (show on hover, only if multiple banners) */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className={`absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === current
                  ? 'w-6 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Ir para banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
