'use client'

import { LoaderCircleIcon, PlusIcon, PrinterIcon, RowsIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createTable, createTablesFromRange } from '@/app/dashboard/tables/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TablesToolbarProps {
  nextNumber: number
  hasTables: boolean
}

export function TablesToolbar({ nextNumber, hasTables }: TablesToolbarProps) {
  const router = useRouter()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [range, setRange] = useState('')
  const [pending, startTransition] = useTransition()

  function addOne() {
    startTransition(async () => {
      const result = await createTable()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Mesa ${result.number} creada.`)
      router.refresh()
    })
  }

  function addRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createTablesFromRange(range)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const skipped =
        result.skipped > 0 ? ` (${result.skipped} ya existían)` : ''
      toast.success(`${result.created} mesas creadas${skipped}.`)
      setBulkOpen(false)
      setRange('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="rounded-pill"
        disabled={pending}
        onClick={addOne}
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : (
          <PlusIcon aria-hidden="true" />
        )}
        Agregar mesa {nextNumber}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="rounded-pill"
        disabled={pending}
        onClick={() => setBulkOpen(true)}
      >
        <RowsIcon aria-hidden="true" />
        Agregar varias
      </Button>
      {hasTables ? (
        <Button asChild variant="outline" className="rounded-pill">
          <Link href="/dashboard/tables/print">
            <PrinterIcon aria-hidden="true" />
            Imprimir
          </Link>
        </Button>
      ) : null}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="rounded-card max-w-md">
          <form onSubmit={addRange} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                Agregar varias mesas
              </DialogTitle>
              <DialogDescription>
                Escribe un rango o una lista de números. Las mesas que ya
                existen se conservan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="table-range">Números de mesa</Label>
              <Input
                id="table-range"
                value={range}
                placeholder="1-12 o 1,2,5-8"
                autoFocus
                onChange={(event) => setRange(event.target.value)}
                className="rounded-control h-11"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="rounded-pill"
                onClick={() => setBulkOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-pill" disabled={pending}>
                {pending ? (
                  <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
                ) : null}
                Crear mesas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
