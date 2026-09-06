/**
 * Shared decision-feed plumbing for the browser half: the event shape served by
 * the host's `GET /api/dsh-perm-gate/events` route, the polling fetch, the
 * session-id resolution from slot props, and the per-kind presentation used by
 * both the notice strip and the approval-history view.
 *
 * Everything is best-effort and dependency-free beyond react hooks living in
 * the components; no @deepseek-ai value imports (bundle purity).
 */

/** One event as delivered by the host route (see src/events.ts). */
export interface GateEvent {
  readonly id: number
  readonly ts: string
  readonly sessionId: string
  readonly tool: string
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned'
  readonly risk?: string
  readonly reason: string
}

/** Slot props carrying the current conversation id (best effort). */
export interface FeedSlotsProps {
  readonly sessionId?: unknown
  readonly useSessions?: (selector: (state: { current?: unknown }) => { current?: unknown }) => { current?: unknown }
}

/** Fetch decision events for one session; `since > 0` returns only newer ones. */
export async function fetchEvents(sessionId: string, since: number): Promise<GateEvent[]> {
  const query = `/api/dsh-perm-gate/events?sessionId=${encodeURIComponent(sessionId)}${since > 0 ? `&since=${since}` : ''}`
  const res = await fetch(query, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { events?: unknown }
  return Array.isArray(body.events) ? (body.events as GateEvent[]) : []
}

/** Resolve the current session id from the slot props; null when unavailable. */
export function resolveSessionId(props: FeedSlotsProps | undefined): string | null {
  const direct = props?.sessionId
  if (typeof direct === 'string' && direct !== '') return direct
  try {
    if (typeof props?.useSessions === 'function') {
      const state = props.useSessions((s) => s)
      if (typeof state?.current === 'string' && state.current !== '') return state.current
    }
  } catch {
    // fall through
  }
  return null
}

/** Presentation per event kind: accent color, background wash, and tag. */
export function presentation(kind: GateEvent['kind']): { color: string; bg: string; tag: string; sticky: boolean } {
  switch (kind) {
    case 'deny':
      return { color: 'var(--dsw-alias-state-error-primary, #c0392b)', bg: 'var(--dsw-alias-interactive-bg-hover-danger, rgba(192,57,43,0.08))', tag: 'DENY', sticky: false }
    case 'ask':
      return { color: 'var(--dsw-alias-state-warn-label, #b9770e)', bg: 'var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.08))', tag: 'ASK', sticky: true }
    case 'learned':
      return { color: 'var(--dsw-alias-state-success-primary, #1e8449)', bg: 'var(--dsw-alias-state-success-tertiary, rgba(30,132,73,0.08))', tag: 'LEARNED', sticky: false }
    default:
      return { color: 'var(--dsw-alias-state-success-primary, #1e8449)', bg: 'var(--dsw-alias-state-success-tertiary, rgba(30,132,73,0.08))', tag: 'ALLOW', sticky: false }
  }
}

/** Compact wall-clock rendering of an ISO timestamp. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
