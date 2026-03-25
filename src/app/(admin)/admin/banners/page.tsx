import { listGlobalBanners } from '@/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BannerActions, CreateBannerButton } from '@/components/admin/banner-actions'

export default async function AdminBannersPage() {
  const banners = await listGlobalBanners()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Banners Globais
        </h2>
        <CreateBannerButton />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(banners || []).map((banner) => (
          <Card key={banner.id}>
            <CardContent className="p-4">
              <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.image_url}
                  alt="Banner"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={banner.active ? 'success' : 'neutral'}>
                    {banner.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Badge variant="info">{banner.type === 'popup' ? 'Pop-up' : 'Banner'}</Badge>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Posicao: {banner.position}
                  </span>
                </div>
                <BannerActions banner={banner} />
              </div>
              {banner.link_url && (
                <p className="mt-2 truncate text-xs text-zinc-400">{banner.link_url}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {(!banners || banners.length === 0) && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum banner global encontrado.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
