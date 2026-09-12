import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function TableNotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState
        title="Este código QR ya no es válido"
        description="Puede que el restaurante haya renovado sus códigos. Pide ayuda a quien te atiende o escanea el QR de nuevo."
        action={
          <Button asChild className="rounded-pill">
            <Link href="/#restaurantes">Ver restaurantes disponibles</Link>
          </Button>
        }
      />
    </div>
  )
}
