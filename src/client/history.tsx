/**
 * Approval-history view — the `conversation.view` face of dsh-perm-gate,
 * following the session-scoped review-page pattern demonstrated by
 * dsh-approval-gate: a timeline of every gate decision in the current
 * conversation, newest first, refreshed by polling.
 *
 * Beyond the decision timeline this view owns the review data plane: a snapshot
 * inventory bar (with session/all clearing), per-event file chips, and a diff
 * overlay that shows the pre-change vs current content of one file and can send
 * a revert instruction back into the conversation.
 *
 * Data source: the host's `GET /api/dsh-perm-gate/events?sessionId=` feed (the
 * same JSONL the notice strip consumes) plus the diff / revert / snapshot
 * routes. Everything is best-effort: no session id or any fetch failure renders
 * the empty / error state. No @deepseek-ai value imports.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  clearSnapshots,
  clockTime,
  fetchDiff,
  fetchEvents,
  fetchSnapshotStats,
  fmtBytes,
  presentation,
  resolveSessionId,
  sendRevert,
  VERDICT_LABELS,
  type DiffHunk,
  type DiffResponse,
  type FeedSlotsProps,
  type GateEvent,
  type SnapshotStats,
} from './feed.ts'
import type { PermissiveKey } from './locales.ts'

const POLL_MS = 5_000

/** Tag text per event kind, keyed into the plugin dictionary. */
const TAG_KEYS = {
  auto: 'history.tag.auto',
  ask: 'history.tag.ask',
  deny: 'history.tag.deny',
  learned: 'history.tag.learned',
  'manual-approved': 'history.tag.manualApproved',
  'manual-rejected': 'history.tag.manualRejected',
  'manual-cancelled': 'history.tag.manualCancelled',
} as const satisfies Record<GateEvent['kind'], PermissiveKey>

/** Full props: locale seat + the session-id carriers the slot delivers. */
export type HistoryViewProps = PropsLocale<'dsh-perm-gate'> & FeedSlotsProps

/** The file name alone (chips show the basename, like the reference page). */
function basename(p: string): string {
  const seg = p.split(/[\\/]/)
  return seg[seg.length - 1] ?? p
}

function glyphOf(kind: GateEvent['kind']): { char: string; color: string } {
  const style = presentation(kind)
  switch (kind) {
    case 'deny':
    case 'manual-rejected':
      return { char: '✕', color: style.color }
    case 'ask':
      return { char: '◔', color: style.color }
    case 'manual-cancelled':
      return { char: '—', color: style.color }
    default:
      return { char: '✓', color: style.color }
  }
}

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary)',
}

const barButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: '26px',
  color: 'var(--dsw-alias-label-primary)',
  cursor: 'pointer',
  font: 'inherit',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  borderRadius: '13px',
  padding: '0 12px',
  fontSize: '12px',
  lineHeight: '24px',
}

/** The snapshot inventory bar: usage plus session/all clearing. */
function SnapshotBar(props: {
  t: HistoryViewProps['t']
  stats: SnapshotStats | null
  sessionId: string | null
  onCleared: () => void
}): JSX.Element {
  const { t, stats, sessionId, onCleared } = props
  const busy = stats === null || stats.count === 0
  const clear = (mode: 'session' | 'all'): void => {
    const confirmed = window.confirm(
      mode === 'all' ? t('history.clearAllConfirm') : t('history.clearSessionConfirm'),
    )
    if (!confirmed) return
    void clearSnapshots(mode === 'session' ? sessionId : null).then(() => { onCleared() })
  }
  return (
    <div style={barStyle}>
      <span>
        {`${t('history.snapshots')} `}
        <b style={{ color: 'var(--dsw-alias-label-secondary)', fontWeight: 500 }}>
          {stats === null ? '…' : `${fmtBytes(stats.bytes)} · ${stats.count}`}
        </b>
      </span>
      <span style={{ flex: '1 1 auto' }} />
      <button
        type="button"
        title={t('history.clearSessionTitle')}
        disabled={busy}
        onClick={() => { clear('session') }}
        style={{ ...barButtonStyle, opacity: busy ? 0.4 : 1 }}
      >
        {t('history.clearSession')}
      </button>
      <button
        type="button"
        title={t('history.clearAllTitle')}
        disabled={busy}
        onClick={() => { clear('all') }}
        style={{ ...barButtonStyle, opacity: busy ? 0.4 : 1, color: 'var(--dsw-alias-state-error-primary)' }}
      >
        {t('history.clearAll')}
      </button>
    </div>
  )
}

/** One diff line row (marker + line numbers + text). */
function DiffRow({ line }: { line: DiffHunk['lines'][number] }): JSX.Element {
  const isAdd = line.type === 'add'
  const isDel = line.type === 'del'
  const background = isAdd
    ? 'var(--dsw-alias-state-success-tertiary)'
    : isDel
      ? 'var(--dsw-alias-interactive-bg-hover-danger)'
      : 'transparent'
  const color = isDel
    ? 'var(--dsw-alias-state-error-primary)'
    : isAdd
      ? 'var(--dsw-alias-label-primary)'
      : 'var(--dsw-alias-label-secondary)'
  const aNo = line.aNo === undefined ? '' : String(line.aNo)
  const bNo = line.bNo === undefined ? '' : String(line.bNo)
  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        gap: '8px',
        padding: '1px 8px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        minWidth: 0,
        background,
        color,
      }}
    >
      <span aria-hidden style={{ flex: '0 0 auto', width: '16px', userSelect: 'none' }}>
        {isAdd ? '+' : isDel ? '-' : ' '}
      </span>
      <span
        style={{
          flex: '0 0 auto',
          width: '60px',
          color: 'var(--dsw-alias-label-caption)',
          textAlign: 'right',
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {aNo}
        {aNo !== '' && bNo !== '' ? ' ' : ''}
        {bNo}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>{line.text}</span>
    </div>
  )
}

/** The file-change overlay: before/after diff plus the revert action. */
function DiffPanel(props: {
  t: HistoryViewProps['t']
  sessionId: string | null
  eventId: number
  path: string
  onClose: () => void
}): JSX.Element {
  const { t, sessionId, eventId, path, onClose } = props
  const [data, setData] = useState<DiffResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revertMsg, setRevertMsg] = useState<string | null>(null)
  const [revertOk, setRevertOk] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [revertDone, setRevertDone] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    setRevertDone(false)
    setRevertMsg(null)
    fetchDiff(eventId, path)
      .then((res) => { if (alive) setData(res) })
      .catch((e: unknown) => {
        if (alive) setError(`${t('history.diffLoadFail')}${String((e as Error)?.message ?? e)}`)
      })
    return () => { alive = false }
  }, [eventId, path, t])

  const doRevert = (): void => {
    // One revert instruction per event: the same event must never be delivered twice.
    if (reverting || revertDone || sessionId === null) return
    setReverting(true)
    setRevertMsg(null)
    void sendRevert(sessionId, eventId).then((res) => {
      if (res.ok) {
        setRevertMsg(t('history.diffRevertSent'))
        setRevertOk(true)
        setRevertDone(true)
      } else {
        setRevertMsg(`${t('history.diffRevertFail')}${res.error ?? ''}`)
        setRevertOk(false)
      }
      setReverting(false)
    })
  }

  const stats = data?.stats
  const body: JSX.Element = error !== null
    ? <div style={diffEmptyStyle}>{error}</div>
    : data === null
      ? <div style={diffEmptyStyle}>{t('history.diffLoading')}</div>
      : data.hunks.length === 0
        ? <div style={diffEmptyStyle}>{t('history.diffEmpty')}</div>
        : (
            <div style={diffBodyStyle}>
              {data.hunks.map((hunk, hi) => (
                <div key={`hunk-${hi}`}>
                  {hunk.hiddenBefore > 0
                    ? (
                        <div style={hunkSepStyle}>
                          {t('history.diffHidden').replace('%n', String(hunk.hiddenBefore))}
                        </div>
                      )
                    : null}
                  {hunk.lines.map((line, li) => (
                    <DiffRow key={`l-${hi}-${li}`} line={line} />
                  ))}
                </div>
              ))}
            </div>
          )

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={panelStyle}>
        <div style={panelHeadStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: '1 1 auto', fontSize: '14px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }}>
              {t('history.diffTitle')}
            </span>
            <button type="button" aria-label={t('history.diffClose')} title={t('history.diffClose')} onClick={onClose} style={closeStyle}>
              ✕
            </button>
          </div>
          <div style={{ fontSize: '12px', lineHeight: '18px', fontFamily: 'var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-tertiary)', wordBreak: 'break-all' }}>
            {path}
          </div>
          {stats === undefined
            ? null
            : (
                <div style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }}>
                  {t('history.diffStats')
                    .replace('%a', String(stats.added))
                    .replace('%r', String(stats.removed))
                    .replace('%c', String(stats.contextLines))}
                  {data !== null && !data.afterExists ? t('history.diffGone') : ''}
                </div>
              )}
        </div>
        {body}
        <div style={panelFootStyle}>
          {revertMsg === null
            ? null
            : (
                <span style={{ marginRight: 'auto', fontSize: '12px', color: revertOk ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' }}>
                  {revertMsg}
                </span>
              )}
          <button
            type="button"
            onClick={doRevert}
            disabled={reverting || revertDone || sessionId === null}
            style={{
              ...barButtonStyle,
              border: 'none',
              background: 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary))',
              color: 'var(--dsw-alias-label-primary-foreground, #fff)',
              opacity: reverting || revertDone ? 0.5 : 1,
            }}
          >
            {reverting ? t('history.diffReverting') : revertDone ? t('history.diffRevertDone') : t('history.diffRevert')}
          </button>
          <button type="button" onClick={onClose} style={barButtonStyle}>
            {t('history.diffClose')}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 900,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--dsw-alias-bg-mask-1, rgba(0,0,0,0.35))',
}

const panelStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: 'min(760px, calc(100vw - 48px))',
  maxHeight: 'min(720px, calc(100vh - 48px))',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1))',
  border: '1px solid var(--dsw-alias-border-l1)',
  borderRadius: '16px',
  overflow: 'hidden',
}

const panelHeadStyle: CSSProperties = {
  boxSizing: 'border-box',
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '12px 14px',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}

const panelFootStyle: CSSProperties = {
  boxSizing: 'border-box',
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'flex-end',
  padding: '10px 14px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}

const diffBodyStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--ds-font-family-code, monospace)',
  fontSize: '12px',
  lineHeight: '19px',
}

const diffEmptyStyle: CSSProperties = {
  flex: '1 1 auto',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '13px',
  lineHeight: '20px',
  padding: '16px',
  textAlign: 'center',
}

const hunkSepStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '11px',
  lineHeight: '16px',
  padding: '2px 8px',
  margin: '2px 0',
  borderTop: '1px solid var(--dsw-alias-border-l1)',
  borderBottom: '1px solid var(--dsw-alias-border-l1)',
  userSelect: 'none',
}

const closeStyle: CSSProperties = {
  flex: '0 0 auto',
  width: '24px',
  height: '24px',
  border: 'none',
  borderRadius: '999px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  cursor: 'pointer',
}

export function HistoryView({ t, ...props }: HistoryViewProps): JSX.Element | null {
  const sessionId = resolveSessionId(props)
  const [events, setEvents] = useState<GateEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<SnapshotStats | null>(null)
  const [diffOpen, setDiffOpen] = useState<{ eventId: number; path: string } | null>(null)

  useEffect(() => {
    setEvents(null)
    setError(null)
    setStats(null)
    let alive = true
    // Full refetch per tick (the reference's approach): the feed is small and
    // this keeps the view self-healing around missed polls.
    const load = (): void => {
      void fetchSnapshotStats(sessionId).then((next) => { if (alive) setStats(next) })
      if (sessionId === null) {
        setEvents([])
        return
      }
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

  /** Whether one event has a snapshot covering this file (chip is clickable). */
  const hasSnapshot = (ev: GateEvent, file: string): boolean => {
    const paths = stats?.files[String(ev.id)]
    if (paths === undefined || paths.length === 0) return false
    const base = basename(file)
    return paths.some((p) => p === file || basename(p) === base)
  }

  return (
    <div style={{ boxSizing: 'border-box', maxWidth: '720px', margin: '0 auto', padding: '8px 4px' }}>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>{t('history.title')}</div>
        <div style={{ marginTop: '2px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-primary) !important' }}>{t('history.subtitle')}</div>
      </div>
      <SnapshotBar
        t={t}
        stats={stats}
        sessionId={sessionId}
        onCleared={() => { void fetchSnapshotStats(sessionId).then(setStats) }}
      />
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
                  const mark = glyphOf(ev.kind)
                  const verdict = ev.verdict === undefined ? '' : (VERDICT_LABELS[ev.verdict] ?? ev.verdict)
                  const files = ev.files ?? []
                  // One chip per distinct basename (a decision may name the same
                  // file both absolutely and relatively).
                  const chips: string[] = []
                  const seenBase = new Set<string>()
                  for (const f of files) {
                    const base = basename(f)
                    if (base === '' || seenBase.has(base)) continue
                    seenBase.add(base)
                    chips.push(f)
                  }
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', padding: '6px 10px', borderRadius: '8px', background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))' }}>
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
                          {verdict === ''
                            ? null
                            : (
                                <span style={{ fontSize: '11px', lineHeight: '18px', padding: '0 6px', borderRadius: '9px', color: 'var(--dsw-alias-label-tertiary)', border: '1px solid var(--dsw-alias-border-l2)' }}>
                                  {verdict}
                                </span>
                              )}
                          {ev.risk === undefined || ev.risk === ''
                            ? null
                            : (
                                <span style={{ fontSize: '11px', lineHeight: '18px', padding: '0 6px', borderRadius: '9px', color: 'var(--dsw-alias-label-tertiary)', border: '1px solid var(--dsw-alias-border-l2)' }}>
                                  {ev.risk}
                                </span>
                              )}
                          {ev.kind === 'manual-approved' && ev.learningCount !== undefined && ev.threshold !== undefined
                            ? (
                                <span style={{ fontSize: '11px', lineHeight: '18px', padding: '0 6px', borderRadius: '9px', color: 'var(--dsw-alias-state-warn-label)', border: '1px solid var(--dsw-alias-border-l2)' }}>
                                  {t('history.learnedProgress').replace('%n', String(ev.learningCount)).replace('%t', String(ev.threshold))}
                                </span>
                              )
                            : null}
                          <span style={{ marginLeft: 'auto', flex: '0 0 auto', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }}>{clockTime(ev.ts)}</span>
                        </div>
                        <div style={{ marginTop: '2px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, inherit)', overflowWrap: 'anywhere' }}>
                          {ev.justification ?? ev.reason}
                        </div>
                        {chips.length === 0
                          ? null
                          : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {chips.map((file) => {
                                  const clickable = hasSnapshot(ev, file)
                                  return (
                                    <span
                                      key={file}
                                      title={clickable ? t('history.diffChipTitle') : file}
                                      role={clickable ? 'button' : undefined}
                                      onClick={clickable ? () => { setDiffOpen({ eventId: ev.id, path: file }) } : undefined}
                                      style={{
                                        boxSizing: 'border-box',
                                        maxWidth: '260px',
                                        height: '20px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0 7px',
                                        borderRadius: '5px',
                                        font: '11px/18px var(--ds-font-family-code, monospace)',
                                        border: `1px solid ${clickable ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l1)'}`,
                                        color: clickable ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-label-secondary)',
                                        background: 'var(--dsw-alias-bg-layer-1, transparent)',
                                        cursor: clickable ? 'pointer' : 'default',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {basename(file)}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
      {diffOpen === null
        ? null
        : (
            <DiffPanel
              t={t}
              sessionId={sessionId}
              eventId={diffOpen.eventId}
              path={diffOpen.path}
              onClose={() => { setDiffOpen(null) }}
            />
          )}
    </div>
  )
}
