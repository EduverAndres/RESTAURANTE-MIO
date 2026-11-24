// What each important event says, as an in-app notification (which is also
// sent as a web push). Pure. Push texts that already existed live in
// lib/push/messages.ts and are reused through `fromPush`, so one event never
// reads two different ways.
import type { PushPayload } from '@/lib/push/messages'
import type {
  NotificationKind,
  NotificationMessage,
} from '@/lib/notifications/vocabulary'

/** A notification plus the push tag that collapses repeats on a device. */
export interface OutgoingNotification extends NotificationMessage {
  tag: string
}

/** Wraps an existing push payload as a notification of `kind`. */
export function fromPush(
  kind: NotificationKind,
  payload: PushPayload,
): OutgoingNotification {
  return {
    kind,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  }
}

// ---------------------------------------------------------------------------
// To admins: something waits for a decision
// ---------------------------------------------------------------------------

export function adRequestedNotification(input: {
  storeName: string
  placement: string
  dates: string
}): OutgoingNotification {
  return {
    kind: 'ad_requested',
    title: 'Nueva solicitud de publicidad',
    body: `${input.storeName} quiere aparecer en ${input.placement}, ${input.dates}. Revísala para aprobarla.`,
    url: '/admin/publicidad',
    tag: 'ad-requested',
  }
}

export function companyRegisteredNotification(input: {
  companyName: string
}): OutgoingNotification {
  return {
    kind: 'company_registered',
    title: 'Nueva empresa por aprobar',
    body: `${input.companyName} creó su cuenta de empresa. Fija su cupo y apruébala.`,
    url: '/admin/companies',
    tag: 'company-registered',
  }
}

export function courierSubmittedNotification(input: {
  courierName: string
  again: boolean
}): OutgoingNotification {
  return {
    kind: 'courier_submitted',
    title: input.again
      ? 'Un domiciliario actualizó su perfil'
      : 'Nuevo domiciliario por revisar',
    body: input.again
      ? `${input.courierName} cambió su vehículo o documento y vuelve a revisión.`
      : `${input.courierName} envió su perfil con sus documentos.`,
    url: '/admin/domiciliarios',
    tag: 'courier-submitted',
  }
}

export function storeRegisteredNotification(input: {
  storeName: string
}): OutgoingNotification {
  return {
    kind: 'store_registered',
    title: 'Nueva tienda por activar',
    body: `${input.storeName} creó su tienda y espera la activación.`,
    url: '/admin/stores',
    tag: 'store-registered',
  }
}

// ---------------------------------------------------------------------------
// To store owners
// ---------------------------------------------------------------------------

export function adStatusNotification(input: {
  change: 'paused' | 'resumed' | 'ended'
  placement: string
}): OutgoingNotification {
  const titles = {
    paused: 'Tu campaña quedó en pausa',
    resumed: 'Tu campaña volvió a mostrarse',
    ended: 'Tu campaña terminó',
  } as const
  const bodies = {
    paused: `${input.placement}: mientras esté en pausa no se muestra ni se cobra.`,
    resumed: `${input.placement}: ya se muestra de nuevo como «Patrocinado».`,
    ended: `${input.placement}: dejó de mostrarse. Puedes solicitar otra cuando quieras.`,
  } as const
  return {
    kind: 'ad_reviewed',
    title: titles[input.change],
    body: bodies[input.change],
    url: '/dashboard/publicidad',
    tag: 'ad-campaign-review',
  }
}

export function storeReviewedNotification(input: {
  storeName: string
  status: 'active' | 'suspended' | 'pending'
}): OutgoingNotification {
  return {
    kind: 'store_reviewed',
    title:
      input.status === 'active'
        ? '¡Tu tienda ya está activa!'
        : input.status === 'suspended'
          ? 'Tu tienda fue suspendida'
          : 'Tu tienda volvió a revisión',
    body:
      input.status === 'active'
        ? `${input.storeName} ya aparece en Cerquita y puede recibir pedidos.`
        : input.status === 'suspended'
          ? `${input.storeName} no recibe pedidos por ahora. Escríbenos para revisarlo.`
          : `${input.storeName} está en revisión.`,
    url: '/dashboard',
    tag: 'store-review',
  }
}

export function payoutNotification(input: {
  stage: 'generated' | 'paid'
  periodLabel: string
  amountLabel: string
  owes: boolean
}): OutgoingNotification {
  return {
    kind: 'payout',
    title:
      input.stage === 'paid'
        ? 'Liquidación pagada'
        : 'Nueva liquidación disponible',
    body:
      input.stage === 'paid'
        ? `Te transferimos ${input.amountLabel} del periodo ${input.periodLabel}.`
        : input.owes
          ? `Periodo ${input.periodLabel}: tienes un saldo de ${input.amountLabel} con Cerquita.`
          : `Periodo ${input.periodLabel}: te transferimos ${input.amountLabel}.`,
    url: '/dashboard/payouts',
    tag: 'payout',
  }
}

// ---------------------------------------------------------------------------
// To couriers
// ---------------------------------------------------------------------------

export function courierPayoutNotification(input: {
  stage: 'generated' | 'paid' | 'deposit'
  amountLabel: string
}): OutgoingNotification {
  const titles = {
    generated: 'Nueva liquidación de tus entregas',
    paid: 'Te pagamos tu liquidación',
    deposit: 'Registramos tu consignación',
  } as const
  const bodies = {
    generated: `Revisa el detalle en Ganancias: ${input.amountLabel}.`,
    paid: `Te transferimos ${input.amountLabel}.`,
    deposit: `Abonamos ${input.amountLabel} a tu saldo de efectivo.`,
  } as const
  return {
    kind: 'courier_payout',
    title: titles[input.stage],
    body: bodies[input.stage],
    url: '/courier/ganancias',
    tag: 'courier-payout',
  }
}

// ---------------------------------------------------------------------------
// To company admins
// ---------------------------------------------------------------------------

export function companyMemberJoinedNotification(input: {
  memberName: string
  companyName: string
}): OutgoingNotification {
  return {
    kind: 'company_member_joined',
    title: 'Alguien se unió a tu empresa',
    body: `${input.memberName} ya pide con la cuenta de ${input.companyName}.`,
    url: '/empresa/equipo',
    tag: 'company-member-joined',
  }
}

export function companyStatementNotification(input: {
  periodLabel: string
  amountLabel: string
  dueLabel: string
}): OutgoingNotification {
  return {
    kind: 'company_statement',
    title: 'Nuevo estado de cuenta',
    body: `${input.periodLabel}: ${input.amountLabel}, vence el ${input.dueLabel}.`,
    url: '/empresa/estados-de-cuenta',
    tag: 'company-statement',
  }
}
