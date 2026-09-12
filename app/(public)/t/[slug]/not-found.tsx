import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function StoreNotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState
        title="No encontramos esta tienda"
        description="Puede que el enlace esté mal escrito o que el restaurante aún no esté activo en la plataforma."
        action={
          <Button asChild className="rounded-pill">
            <Link href="/#restaurantes">Ver restaurantes disponibles</Link>
          </Button>
        }
      />
    </div>
  )
}
