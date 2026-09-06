/**
 * Approval-history view — the `conversation.view` face of dsh-perm-gate,
 * following the session-scoped review-page pattern demonstrated by
 * dsh-approval-gate: a timeline of every gate decision in the current
 * conversation, newest first, refreshed by polling.
 *
 * Data source: the host's `GET /api/dsh-perm-gate/events?sessionId=` feed (the
 * same JSONL the notice strip consumes); no extra host state. Everything is
 * best-effort: no session id or any fetch failure renders the empty / error
 * state. No @deepseek-ai value imports.
 */
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchEvents, formatTime, presentation, resolveSessionId, type FeedSlotsProps, type GateEvent } from './feed.ts'

const POLL_MS = 5_000

/** Tag text per event kind, keyed into the plugin dictionary. */
const TAG_KEYS = {
  auto: 'history.tag.auto',
  ask: 'history.tag.ask',
  deny: 'history.tag.deny',
  learned: 'history.tag.learned',
} as const satisfies Record<GateEvent['kind'], `history.tag.${GateEvent['kind']}`>

/** Full props: locale seat + the slot props carrying the conversation id. */
export type HistoryViewProps = PropsLocale<'dsh-perm-gate'> & { slotsProps?: FeedSlotsProps }

export function HistoryView({ t, slotsProps }: HistoryViewProps): JSX.Element | null {
  const sessionId = resolveSessionId(slotsProps)
  const [events, setEvents] = useState<GateEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEvents(null)
    setError(null)
    if (sessionId === null) {
      setEvents([])
      return
    }
    let alive = true
    // Full refetch per tick (approval-gate's approach): the feed is small and
    // this keeps the view self-healing around missed polls.
    const load = (): void => {
      fetchEvents(sessionId, 0)
        .then((loaded) => {
          if (!alive) return
          setEvents([...loaded].sort((a, b) => b.id - a.id))
          setError(null)
        })
        .catch((e: unknown) => {
          if (!alive) return
          setError(String((e as Error)?.message ?? e))
        })
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [sessionId])

  const glyph = (kind: GateEvent['kind']): { char: string; color: string } => {
    const style = presentation(kind)
    switch (kind) {
      case 'deny':
        return { char: '✕', color: style.color }
      case 'ask':
        return { char: '◔', color: style.color }
      default:
        return { char: '✓', color: style.color }
    }
  }

  return (
    <div style={{ boxSizing: 'border-box', maxWidth: '720px', margin: '0 auto', padding: '8px 4px' }}>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>{t('history.title')}</div>
        <div style={{ marginTop: '2px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('history.subtitle')}</div>
      </div>
      {events === null
        ? (
            <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' }}>
              {error === null ? t('history.loading') : `${t('history.error')}${error}`}
            </div>
          )
        : events.length === 0
          ? (
              <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' }}>
                {error === null ? t('history.empty') : `${t('history.error')}${error}`}
              </div>
            )
          : (
              <div>
                {events.map((ev) => {
                  const style = presentation(ev.kind)
                  const mark = glyph(ev.kind)
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', width: '20px' }}>
                        <span
                          aria-hidden
                          style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            lineHeight: '18px',
                            borderRadius: '999px',
                            border: `1px solid ${mark.color}`,
                            color: mark.color,
                          }}
                        >
                          {mark.char}
                        </span>
                        <span aria-hidden style={{ flex: '1 1 auto', width: '1px', minHeight: '10px', background: 'var(--dsw-alias-border-l2, rgba(127,127,127,0.3))' }} />
                      </div>
                      <div style={{ flex: '1 1 auto', minWidth: 0, paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <code style={{ font: '600 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>{ev.tool}</code>
                          <span
                            style={{
                              fontSize: '11px',
                              lineHeight: '18px',
                              padding: '0 8px',
                              borderRadius: '9px',
                              color: style.color,
                              background: style.bg,
                              fontWeight: 600,
                            }}
                          >
                            {t(TAG_KEYS[ev.kind])}
                          </span>
                          {ev.risk !== undefined && ev.risk !== ''
                            ? (
                                <span style={{ fontSize: '11px', lineHeight: '18px', padding: '0 6px', borderRadius: '9px', color: 'var(--dsw-alias-label-tertiary)', border: '1px solid var(--dsw-alias-border-l2)' }}>
                                  {ev.risk}
                                </span>
                              )
                            : null}
                          <span style={{ marginLeft: 'auto', flex: '0 0 auto', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }}>{formatTime(ev.ts)}</span>
                        </div>
                        <div style={{ marginTop: '2px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, inherit)', overflowWrap: 'anywhere' }}>
                          {ev.reason}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
    </div>
  )
}
