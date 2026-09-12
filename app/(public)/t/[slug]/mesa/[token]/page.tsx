import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Storefront } from '@/app/(public)/t/[slug]/storefront'
import { fetchTableByToken } from '@/lib/tables/server'

export const dynamic = 'force-dynamic'

interface TablePageProps {
  params: Promise<{ slug: string; token: string }>
}

export async function generateMetadata({
  params,
}: TablePageProps): Promise<Metadata> {
  const { slug, token } = await params
  const resolved = await fetchTableByToken(slug, token)
  if (!resolved) return { title: 'Mesa no encontrada' }
  return {
    title: `${resolved.store.name} · Mesa ${resolved.table.number}`,
    description: `Pide desde la mesa ${resolved.table.number} de ${resolved.store.name}.`,
  }
}

/** Public entry point of a table QR code: the storefront tagged with the table. */
export default async function TablePage({ params }: TablePageProps) {
  const { slug, token } = await params
  const resolved = await fetchTableByToken(slug, token)
  if (!resolved) notFound()

  return (
    <Storefront
      store={resolved.store}
      table={{ number: resolved.table.number, token: resolved.table.token }}
    />
  )
}
