'use client'

import {
  LoaderCircleIcon,
  LocateFixedIcon,
  MapPinIcon,
  SearchIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useVisitorLocation } from '@/hooks/use-visitor-location'
import { BOGOTA_CENTER, type LatLng } from '@/lib/geo'
import {
  reverseGeocode,
  searchAddress,
  type GeocodeResult,
} from '@/lib/geocoding'
import type { VisitorLocation } from '@/lib/location'
import { cn } from '@/lib/utils'

interface AddressPickerProps {
  initial: VisitorLocation | null
  className?: string
}

export function AddressPicker({ initial, className }: AddressPickerProps) {
  const { location, setLocation, locate } = useVisitorLocation(initial)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [pin, setPin] = useState<LatLng>(location ?? BOGOTA_CENTER)
  const [label, setLabel] = useState(location?.label ?? '')
  const [pending, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setPin(location ?? BOGOTA_CENTER)
      setLabel(location?.label ?? '')
      setQuery('')
      setResults([])
    }
  }, [open, location])

  useEffect(() => {
    abortRef.current?.abort()
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(
          await searchAddress(query, { signal: controller.signal, near: pin }),
        )
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
    // `pin` only biases the search; retriggering on every drag is undesirable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function choose(result: GeocodeResult) {
    setPin({ lat: result.lat, lng: result.lng })
    setLabel(result.line1)
    setResults([])
    setQuery(result.line1)
  }

  async function handlePin(point: LatLng) {
    setPin(point)
    const place = await reverseGeocode(point).catch(() => null)
    if (place) setLabel(place.line1)
  }

  function useMyLocation() {
    startTransition(async () => {
      try {
        const point = await locate()
        await handlePin(point)
        toast.success('Ubicación detectada.')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'No pudimos ubicarte.',
        )
      }
    })
  }

  function confirm() {
    setLocation({ ...pin, label: label || 'Ubicación en el mapa' })
    setOpen(false)
    toast.success('Mostrando restaurantes cerca de ti.')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'rounded-pill bg-card shadow-soft ring-foreground/10 hover:bg-muted inline-flex max-w-full items-center gap-2 px-3.5 py-2 text-sm ring-1 transition-colors',
            className,
          )}
        >
          <MapPinIcon
            aria-hidden="true"
            className="text-primary size-4 shrink-0"
          />
          <span className="truncate">
            {location?.label ? location.label : 'Elige tu ubicación'}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-card max-w-lg p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-display text-2xl">
            ¿Dónde estás?
          </DialogTitle>
          <DialogDescription>
            Busca tu dirección o mueve el marcador. Usamos tu ubicación para
            mostrarte lo que puede llegar hasta ti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Calle 93 # 12-20, Bogotá"
              aria-label="Buscar dirección"
              autoComplete="street-address"
              className="rounded-control h-11 pl-9"
            />
            {searching ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
              />
            ) : null}
            {results.length > 0 ? (
              <ul
                role="listbox"
                className="rounded-control border-border bg-popover shadow-lift absolute z-20 mt-1 max-h-56 w-full overflow-auto border p-1"
              >
                {results.map((result) => (
                  <li key={`${result.lat},${result.lng}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => choose(result)}
                      className="rounded-control hover:bg-muted w-full px-3 py-2 text-left text-sm"
                    >
                      <span className="block font-medium">{result.line1}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {result.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-card ring-foreground/10 overflow-hidden ring-1">
            <LocationMapLazy
              center={pin}
              zoom={15}
              pin={pin}
              onPinChange={handlePin}
              className="h-64 w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground min-w-0 flex-1 truncate">
              {label || 'Toca el mapa para fijar el punto exacto.'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={useMyLocation}
              disabled={pending}
              className="rounded-pill"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : (
                <LocateFixedIcon aria-hidden="true" />
              )}
              Usar mi ubicación
            </Button>
          </div>
        </div>

        <div className="border-border flex justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            className="rounded-pill"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" className="rounded-pill" onClick={confirm}>
            Confirmar ubicación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
