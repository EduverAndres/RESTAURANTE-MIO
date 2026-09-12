'use client'

import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button
      type="button"
      className="rounded-pill"
      onClick={() => window.print()}
    >
      <PrinterIcon aria-hidden="true" />
      Imprimir
    </Button>
  )
}
