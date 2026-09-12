'use client'

import { LoaderCircleIcon, LocateFixedIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveAddress } from '@/app/(protected)/account/address-actions'
import { GeolocationNotice } from '@/components/map/geolocation-notice'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useVisitorLocation } from '@/hooks/use-visitor-location'
import { BOGOTA_CENTER, type LatLng } from '@/lib/geo'
import {
  GeolocationFailureError,
  type GeolocationFailure,
} from '@/lib/geo/geolocation-availability'
import {
  reverseGeocode,
  searchAddress,
  type GeocodeResult,
} from '@/lib/geocoding'
import type { Address } from '@/types/app'

interface AddressFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog edits this address instead of creating one. */
  address?: Address | null
  onSaved?: (address: Address) => void
}

export function AddressFormDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: AddressFormDialogProps) {
  const { location, locate, gpsSupport } = useVisitorLocation()
  const [label, setLabel] = useState('Casa')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [pin, setPin] = useState<LatLng>(BOGOTA_CENTER)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [gpsFailure, setGpsFailure] = useState<GeolocationFailure | null>(null)
  const [pending, startTransition] = useTransition()
  const [locating, startLocating] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  // Without a usable GPS the button is pointless; the notice explains why and
  // the manual search / draggable pin remain the way forward.
  const gpsBlocked = gpsSupport === 'unsupported' || gpsSupport === 'insecure'
  const gpsNotice = gpsBlocked ? gpsSupport : gpsFailure

  useEffect(() => {
    if (!open) return
    setGpsFailure(null)
    setLabel(address?.label ?? 'Casa')
    setLine1(address?.line1 ?? '')
    setLine2(address?.line2 ?? '')
    setIsDefault(address?.is_default ?? false)
    setPin(
      address && address.lat !== null && address.lng !== null
        ? { lat: Number(address.lat), lng: Number(address.lng) }
        : (location ?? BOGOTA_CENTER),
    )
    setQuery('')
    setResults([])
  }, [open, address, location])

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
    setPin(point)
    const place = await reverseGeocode(point).catch(() => null)
    if (place && !line1) setLine1(place.line1)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveAddress(
        {
          label,
          line1,
          line2,
          lat: pin.lat,
          lng: pin.lng,
          is_default: isDefault,
        },
        address?.id,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(address ? 'Dirección actualizada.' : 'Dirección guardada.')
      onSaved?.(result.address)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card max-w-lg p-0 sm:max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-display text-2xl">
              {address ? 'Editar dirección' : 'Nueva dirección'}
            </DialogTitle>
            <DialogDescription>
              Ubica el punto exacto en el mapa para que el domiciliario llegue
              sin llamar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="address-search">Buscar en el mapa</Label>
              <div className="relative">
                <SearchIcon
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                {/*
                  A combobox in behaviour, so it says so: without `role`,
                  `aria-expanded` and `aria-controls` the suggestion list
                  below simply did not exist for a screen reader.
                */}
                <Input
                  id="address-search"
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="address-search-results"
                  aria-autocomplete="list"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Calle 123 #45-67"
                  className="rounded-control h-11 pl-9"
                />
                {results.length > 0 ? (
                  <ul
                    id="address-search-results"
                    role="listbox"
                    aria-label="Resultados de la búsqueda"
                    className="rounded-control border-border bg-popover shadow-lift absolute z-20 mt-1 max-h-48 w-full overflow-auto border p-1"
                  >
                    {results.map((result) => (
                      <li key={`${result.lat},${result.lng}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setPin({ lat: result.lat, lng: result.lng })
                            setLine1(result.line1)
                            setResults([])
                            setQuery('')
                          }}
                          className="rounded-control hover:bg-muted w-full px-3 py-2 text-left text-sm"
                        >
                          <span className="block font-medium">
                            {result.line1}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {result.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="rounded-card ring-foreground/10 overflow-hidden ring-1">
              <LocationMapLazy
                center={pin}
                zoom={16}
                pin={pin}
                onPinChange={movePin}
                className="h-56 w-full"
              />
            </div>
            {gpsBlocked ? null : (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-pill"
                  disabled={locating}
                  onClick={() =>
                    startLocating(async () => {
                      try {
                        await movePin(await locate())
                        setGpsFailure(null)
                      } catch (error) {
                        if (error instanceof GeolocationFailureError) {
                          setGpsFailure(error.reason)
                          toast.error(error.message)
                          return
                        }
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
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  ) : (
                    <LocateFixedIcon aria-hidden="true" />
                  )}
                  Usar mi ubicación
                </Button>
              </div>
            )}

            {gpsNotice ? <GeolocationNotice reason={gpsNotice} /> : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-1.5">
                <Label htmlFor="address-label">Nombre</Label>
                <Input
                  id="address-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Casa, Oficina…"
                  maxLength={40}
                  required
                  className="rounded-control h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-line1">Dirección</Label>
                <Input
                  id="address-line1"
                  value={line1}
                  onChange={(event) => setLine1(event.target.value)}
                  placeholder="Calle 93 # 12-20"
                  autoComplete="street-address"
                  maxLength={120}
                  required
                  className="rounded-control h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-line2">
                Detalles{' '}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="address-line2"
                value={line2}
                onChange={(event) => setLine2(event.target.value)}
                placeholder="Apartamento 402, torre B, portería"
                maxLength={120}
                className="rounded-control h-11"
              />
            </div>
            <div className="rounded-control bg-muted/60 flex items-center justify-between px-3 py-2.5">
              <Label htmlFor="address-default" className="text-sm">
                Usar como dirección principal
              </Label>
              <Switch
                id="address-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>

          <div className="border-border flex justify-end gap-2 border-t px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="rounded-pill"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="rounded-pill">
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Guardar dirección
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
