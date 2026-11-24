'use client'

import { PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Opens the browser's print dialog (or "Guardar como PDF"). */
export function PrintButton({
  label = 'Imprimir o guardar PDF',
}: {
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="rounded-pill h-11 print:hidden"
    >
      <PrinterIcon aria-hidden="true" />
      {label}
    </Button>
  )
}
