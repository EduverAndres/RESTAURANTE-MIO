// Connection state for the shared realtime layer. Pure: the provider feeds it
// the raw strings Supabase reports from `channel.subscribe((status) => …)` and
// renders whatever comes back.

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Maps a Supabase channel status to the three states the UI cares about.
 * Anything that is not a confirmed subscription or a confirmed drop is still
 * in flight, so it reads as `connecting`.
 */
export function statusFromChannel(raw: string): RealtimeStatus {
  switch (raw) {
    case 'SUBSCRIBED':
      return 'connected'
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT':
    case 'CLOSED':
      return 'disconnected'
    default:
      return 'connecting'
  }
}

/**
 * True only when a channel that had dropped is live again — the moment where
 * events were missed and the screen must be backfilled. The first successful
 * subscribe is deliberately excluded: the page was just server-rendered.
 */
export function shouldResync(
  previous: RealtimeStatus,
  next: RealtimeStatus,
): boolean {
  return previous === 'disconnected' && next === 'connected'
}

/**
 * Worst-of across every open channel, so one dead subscription is never hidden
 * behind healthy ones. With nothing open there is nothing to report yet.
 */
export function aggregateStatus(
  statuses: Iterable<RealtimeStatus>,
): RealtimeStatus {
  let seen = false
  let connecting = false
  for (const status of statuses) {
    seen = true
    if (status === 'disconnected') return 'disconnected'
    if (status === 'connecting') connecting = true
  }
  if (!seen) return 'connecting'
  return connecting ? 'connecting' : 'connected'
}
