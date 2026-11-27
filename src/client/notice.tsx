/**
 * Gate decision notice strip — the `conversation.input.dock` face of
 * dsh-perm-gate (a simplified version of the review-feed pattern demonstrated
 * by dsh-approval-gate).
 *
 * Follows the host's decision feed (`GET /api/dsh-perm-gate/stream`, an SSE
 * push; see `followEvents` for the older-host polling fallback) and shows the
 * latest decision above the conversation input: auto-allows (green) and denies
 * (red) auto-dismiss after a few seconds; an ask (amber) stays until the next
 * event because it needs the human's attention.
 *
 * Everything is best-effort: no session id, a missing route, or any fetch
 * failure simply means "render nothing". No @deepseek-ai value imports.
 */
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { followEvents, presentation, resolveSessionId, type FeedSlotsProps, type GateEvent, type GateFeedBatch } from './feed.ts'
import { ATTENTION_DEFAULTS, acknowledge, escalateAsk, type AttentionConfig } from './attention.ts'
import type { PermissiveKey } from './locales.ts'

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
  // Both attention switches are read from the settings scope the slot injects;
  // an older host that does not deliver it keeps today's behaviour (toast on,
  // sound off), so nothing silently starts or stops ringing.
  const raw = (props as { settings?: { attentionToast?: boolean; attentionSound?: boolean; attentionMinGapMs?: number } }).settings
  const attention: AttentionConfig = {
    toast: raw?.attentionToast ?? ATTENTION_DEFAULTS.toast,
    sound: raw?.attentionSound ?? ATTENTION_DEFAULTS.sound,
    gapMs: raw?.attentionMinGapMs ?? ATTENTION_DEFAULTS.gapMs,
  }
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

    const onBatch = (batch: GateFeedBatch): void => {
      if (!alive || batch.events.length === 0) return
      const last = batch.events[batch.events.length - 1]
      if (last === undefined) return
      if (last.id > sinceRef.current) sinceRef.current = last.id
      // On session open the stream replays history: advance the cursor past it
      // silently, so switching sessions never pops a stale decision.
      if (batch.backlog) {
        shownIdRef.current = sinceRef.current
        return
      }
      if (last.id <= shownIdRef.current) return
      shownIdRef.current = last.id
      // An ask is the one event that needs the human OUT of the current view:
      // sound (or nothing at all) is what covers "the tab is in the background".
      if (last.kind === 'ask') escalateAsk({ config: attention, sessionId: sessionId ?? undefined })
      // The strip itself is switchable; allow/deny keep their own behaviour.
      if (last.kind === 'ask' && !attention.toast) {
        setNotice(null)
        return
      }
      setNotice(last)
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
      if (!presentation(last.kind).sticky) {
        hideTimerRef.current = setTimeout(() => { setNotice(null) }, AUTO_HIDE_MS)
      }
    }

    const close = followEvents(sessionId, () => sinceRef.current, onBatch)

    return () => {
      alive = false
      close()
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    }
  }, [sessionId])

  // Returning to the tab clears the debounce so the next ask is audible at
  // once, instead of being swallowed by a window that opened while hidden.
  useEffect(() => {
    const onVisible = (): void => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        acknowledge({ sessionId: sessionId ?? undefined })
      }
    }
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible) }
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
        {' \u2014 '}
        {notice.doubtKinds !== undefined && notice.doubtKinds.length > 0
          ? notice.doubtKinds.map((k) => t(`doubt.${k}` as PermissiveKey)).join(' \u00b7 ')
          : notice.reason}
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
