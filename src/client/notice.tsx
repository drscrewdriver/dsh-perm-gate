/**
 * Gate decision notice strip — the `conversation.input.dock` face of
 * dsh-perm-gate (a simplified version of the review-feed pattern demonstrated
 * by dsh-approval-gate).
 *
 * Polls the host's `GET /api/dsh-perm-gate/events?sessionId=&since=` feed every
 * 2 s and shows the latest decision above the conversation input: auto-allows
 * (green) and denies (red) auto-dismiss after a few seconds; an ask (amber)
 * stays until the next event because it needs the human's attention.
 *
 * Everything is best-effort: no session id, a missing route, or any fetch
 * failure simply means "render nothing". No @deepseek-ai value imports.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

/** One event as delivered by the host route (see src/events.ts). */
interface GateEvent {
  readonly id: number
  readonly ts: string
  readonly sessionId: string
  readonly tool: string
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned'
  readonly risk?: string
  readonly reason: string
}

/** Slots props carrying the current conversation id (best effort). */
interface DockSlotsProps {
  readonly sessionId?: unknown
  readonly useSessions?: (selector: (state: { current?: unknown }) => { current?: unknown }) => { current?: unknown }
}

const POLL_MS = 2_000
const AUTO_HIDE_MS = 4_000

async function fetchEvents(sessionId: string, since: number): Promise<GateEvent[]> {
  const query = `/api/dsh-perm-gate/events?sessionId=${encodeURIComponent(sessionId)}${since > 0 ? `&since=${since}` : ''}`
  const res = await fetch(query, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { events?: unknown }
  return Array.isArray(body.events) ? (body.events as GateEvent[]) : []
}

/** Resolve the current session id from the slot props; null when unavailable. */
function resolveSessionId(props: DockSlotsProps | undefined): string | null {
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

/** Presentation per event kind: accent color, tag, and whether it auto-dismisses. */
function presentation(kind: GateEvent['kind']): { color: string; bg: string; tag: string; sticky: boolean } {
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

export function NoticeStrip({ slotsProps }: { slotsProps?: DockSlotsProps }): JSX.Element | null {
  const sessionId = resolveSessionId(slotsProps)
  const [notice, setNotice] = useState<GateEvent | null>(null)
  const sinceRef = useRef(0)
  const shownIdRef = useRef(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sinceRef.current = 0
    shownIdRef.current = 0
    setNotice(null)
    if (sessionId === null) return

    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    const startPolling = (): void => {
      if (!alive) return
      timer = setInterval(() => {
        fetchEvents(sessionId, sinceRef.current)
          .then((events) => {
            if (!alive || events.length === 0) return
            const last = events[events.length - 1]
            if (last === undefined || last.id <= shownIdRef.current) return
            shownIdRef.current = last.id
            sinceRef.current = last.id
            setNotice(last)
            if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
            if (!presentation(last.kind).sticky) {
              hideTimerRef.current = setTimeout(() => { setNotice(null) }, AUTO_HIDE_MS)
            }
          })
          .catch(() => {}) // route missing / transient failure: keep quiet
      }, POLL_MS)
    }

    // On session open, advance the cursor silently past history (no replay popups).
    fetchEvents(sessionId, 0)
      .then((events) => {
        if (!alive) return
        if (events.length > 0) {
          sinceRef.current = events[events.length - 1]?.id ?? 0
          shownIdRef.current = sinceRef.current
        }
        startPolling()
      })
      .catch(startPolling)

    return () => {
      alive = false
      if (timer !== null) clearInterval(timer)
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    }
  }, [sessionId])

  if (notice === null) return null
  const style = presentation(notice.kind)
  return (
    <div
      role="status"
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '0 auto 6px',
        maxWidth: '720px',
        border: `1px solid ${style.color}`,
        background: style.bg,
        borderRadius: '10px',
        padding: '5px 10px',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          fontSize: '11px',
          lineHeight: '18px',
          padding: '0 8px',
          borderRadius: '9px',
          color: style.color,
          fontWeight: 600,
        }}
      >
        {style.tag}
      </span>
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          color: 'var(--dsw-alias-label-secondary, inherit)',
        }}
      >
        <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary, inherit)' }}>{notice.tool}</code>
        {' — '}
        {notice.reason}
      </span>
      <button
        type="button"
        aria-label="dismiss"
        onClick={() => { setNotice(null) }}
        style={{
          flex: '0 0 auto',
          width: '22px',
          height: '22px',
          border: 'none',
          borderRadius: '999px',
          background: 'transparent',
          color: 'var(--dsw-alias-label-tertiary, inherit)',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}
