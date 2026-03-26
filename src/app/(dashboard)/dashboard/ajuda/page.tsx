'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { MessageCircle, PlayCircle } from 'lucide-react'

interface Video {
  id: string
  title: string
  description: string | null
  youtube_id: string
}

export default function AjudaPage() {
  const [videos, setVideos] = useState<Video[]>([])

  useEffect(() => {
    async function loadVideos() {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('help_videos')
        .select('id, title, description, youtube_id')
        .eq('active', true)
        .order('position', { ascending: true })
      setVideos(data || [])
    }
    loadVideos()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Central de Ajuda</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Tire suas dúvidas e aprenda a usar o sistema</p>
      </div>

      {/* Suporte WhatsApp */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <MessageCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Falar com Suporte</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Precisa de ajuda? Fale diretamente com nosso suporte pelo WhatsApp.
          </p>
          <a
            href="https://wa.me/5516991773037?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20LokAgenda"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp
          </a>
        </CardContent>
      </Card>

      {/* Tutoriais em Vídeo */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">Tutoriais em Vídeo</h2>
        {videos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <PlayCircle className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">Em breve</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Vídeos tutoriais estarão disponíveis aqui em breve.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <a
                key={video.id}
                href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="overflow-hidden transition hover:shadow-lg">
                  <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                    <img
                      src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                      <PlayCircle className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{video.title}</h3>
                    {video.description && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{video.description}</p>
                    )}
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
