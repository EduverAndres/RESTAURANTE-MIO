'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

/** Destructive confirmation used by the menu manager before any delete. */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Sí, eliminar',
  onConfirm,
  onOpenChange,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-pill">Volver</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-pill bg-destructive hover:bg-destructive/90 text-white"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
