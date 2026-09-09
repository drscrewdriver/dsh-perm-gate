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
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchEvents, presentation, resolveSessionId, type FeedSlotsProps, type GateEvent } from './feed.ts'

const POLL_MS = 2_000
const AUTO_HIDE_MS = 4_000

/** Full props: the locale seat + the session-id carriers the slot delivers. */
export type NoticeStripProps = PropsLocale<'dsh-perm-gate'> & FeedSlotsProps

/** Localized tag for a manual terminal state; other kinds keep their short tag. */
function manualTagKey(kind: GateEvent['kind']): 'history.tag.manualApproved' | 'history.tag.manualRejected' | 'history.tag.manualCancelled' | null {
  if (kind === 'manual-approved') return 'history.tag.manualApproved'
  if (kind === 'manual-rejected') return 'history.tag.manualRejected'
  if (kind === 'manual-cancelled') return 'history.tag.manualCancelled'
  return null
}

export function NoticeStrip({ t, ...props }: NoticeStripProps): JSX.Element | null {
  const sessionId = resolveSessionId(props)
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
  const manualKey = manualTagKey(notice.kind)
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
        {manualKey === null ? style.tag : t(manualKey)}
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
