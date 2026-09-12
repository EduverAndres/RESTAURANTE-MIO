'use client'

import { useRouter } from 'next/navigation'
import { StoreAssetUploader } from '@/components/dashboard/store/store-asset-uploader'

interface StoreAssetsCardProps {
  storeId: string
  logoUrl: string | null
  coverUrl: string | null
}

export function StoreAssetsCard({
  storeId,
  logoUrl,
  coverUrl,
}: StoreAssetsCardProps) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <section
      aria-labelledby="store-assets-title"
      className="rounded-card border-border bg-card shadow-soft space-y-5 border p-5"
    >
      <h2
        id="store-assets-title"
        className="font-display text-xl font-semibold"
      >
        Imágenes
      </h2>
      <StoreAssetUploader
        storeId={storeId}
        kind="logo"
        currentUrl={logoUrl}
        onUploaded={refresh}
      />
      <StoreAssetUploader
        storeId={storeId}
        kind="cover"
        currentUrl={coverUrl}
        onUploaded={refresh}
      />
    </section>
  )
}
