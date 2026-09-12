'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { GeolocationPublisherState } from '@/components/courier/use-geolocation-publisher'
import { cn } from '@/lib/utils'

interface OnlineSwitchProps {
  online: boolean
  state: GeolocationPublisherState
  onChange: (online: boolean) => void
}

const STATE_COPY: Record<GeolocationPublisherState, string> = {
  idle: 'Activa el interruptor para recibir pedidos y compartir tu ubicación.',
  watching: 'Compartiendo tu ubicación con los clientes de tus entregas.',
  denied:
    'Permiso de ubicación denegado. Revísalo en los ajustes del navegador.',
  unsupported: 'Este dispositivo no permite compartir la ubicación.',
  insecure:
    'El navegador bloquea la ubicación en conexiones sin https. Abre la app desde una dirección segura.',
  timeout: 'La ubicación está tardando demasiado. Seguimos intentando.',
  error: 'Sin señal de ubicación por ahora. Seguimos intentando.',
}

export function OnlineSwitch({ online, state, onChange }: OnlineSwitchProps) {
  const live = online && state === 'watching'
  return (
    <div className="rounded-card border-border bg-card shadow-soft flex items-center justify-between gap-4 border px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label
          htmlFor="courier-online"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2.5 rounded-full',
              live ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
            )}
          />
          {online ? 'En línea' : 'Desconectado'}
        </Label>
        <p className="text-muted-foreground text-xs">
          {online ? STATE_COPY[state] : STATE_COPY.idle}
        </p>
      </div>
      <Switch
        id="courier-online"
        checked={online}
        onCheckedChange={onChange}
        aria-label="En línea"
      />
    </div>
  )
}
