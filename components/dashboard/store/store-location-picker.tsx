'use client'

import { LoaderCircleIcon, LocateFixedIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVisitorLocation } from '@/hooks/use-visitor-location'
import type { LatLng } from '@/lib/geo'
import {
  reverseGeocode,
  searchAddress,
  type GeocodeResult,
} from '@/lib/geocoding'

interface StoreLocationPickerProps {
  pin: LatLng
  onPinChange: (point: LatLng) => void
  /** Called when a search result or reverse geocode yields a street line. */
  onAddressSuggested?: (line1: string) => void
}

/** Map with a draggable pin plus address search, for the store location. */
export function StoreLocationPicker({
  pin,
  onPinChange,
  onAddressSuggested,
}: StoreLocationPickerProps) {
  const { locate } = useVisitorLocation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [locating, startLocating] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      try {
        setResults(
          await searchAddress(query, { signal: controller.signal, near: pin }),
        )
      } catch {
        // Aborted or network error: keep the previous list.
      }
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function movePin(point: LatLng) {
    onPinChange(point)
    const place = await reverseGeocode(point).catch(() => null)
    if (place) onAddressSuggested?.(place.line1)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar el local en el mapa"
          aria-label="Buscar dirección en el mapa"
          className="rounded-control h-11 pl-9"
        />
        {results.length > 0 ? (
          <ul
            role="listbox"
            className="rounded-control border-border bg-popover shadow-lift absolute z-20 mt-1 max-h-48 w-full overflow-auto border p-1"
          >
            {results.map((result) => (
              <li key={`${result.lat},${result.lng}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onPinChange({ lat: result.lat, lng: result.lng })
                    onAddressSuggested?.(result.line1)
                    setResults([])
                    setQuery('')
                  }}
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
          zoom={16}
          pin={pin}
          onPinChange={movePin}
          className="h-64 w-full"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Arrastra el pin o toca el mapa para ubicar la entrada del local.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-pill shrink-0"
          disabled={locating}
          onClick={() =>
            startLocating(async () => {
              try {
                await movePin(await locate())
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'No pudimos ubicarte.',
                )
              }
            })
          }
        >
          {locating ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <LocateFixedIcon aria-hidden="true" />
          )}
          Usar mi ubicación
        </Button>
      </div>
    </div>
  )
}
