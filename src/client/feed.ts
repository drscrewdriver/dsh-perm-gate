/**
 * Shared decision-feed plumbing for the browser half: the event shape served by
 * the host's `GET /api/dsh-perm-gate/events` route, the polling fetch, the
 * session-id resolution from slot props, the per-kind presentation used by both
 * the notice strip and the approval-history view, and the review-page API calls
 * (snapshot stats / clear, file diff, revert).
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
  /**
   * `stand-down` is not a decision: it says the gate is inactive in this
   * session's permission preset, so this call was settled by the tier, not by
   * the gate. `VERDICT_LABELS['stand-down']` and `presentation()` carry the
   * user-facing wording; it is always sticky.
   */
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned' | 'manual-approved' | 'manual-rejected' | 'manual-cancelled' | 'stand-down'
  readonly risk?: string
  readonly reason: string
  /** Decision-path label (rule / grant / hard-deny / llm-safe …). */
  readonly verdict?: string
  /** The model's stated intent. */
  readonly justification?: string
  /** Sandbox mode involved, when known. */
  readonly mode?: string
  /** Risk category name (deletion / credential / neutral …). */
  readonly category?: string
  /** Files the decision concerns. */
  readonly files?: readonly string[]
  /** Human confirmations so far for the learned key (manual-approve events). */
  readonly learningCount?: number
  /** Confirmations required before that key auto-allows (manual-approve events). */
  readonly threshold?: number
}

/**
 * The session-id carriers a slot occupant may receive. A `conversation.view`
 * entry gets the standard props at the top level (`sessionId` / `useSessions`,
 * and whatever its `inject` returned); older/other slots nest them under
 * `slotsProps`. Both shapes are probed.
 */
export interface FeedSlotsProps {
  readonly sessionId?: unknown
  readonly useSessions?: SessionSelectorHook
  readonly slotsProps?: {
    readonly sessionId?: unknown
    readonly useSessions?: SessionSelectorHook
  }
}

/** The DSH session-list selector hook delivered in slot props. */
export type SessionSelectorHook = (selector: (state: { current?: unknown }) => unknown) => unknown

/** Fetch decision events for one session; `since > 0` returns only newer ones. */
export async function fetchEvents(sessionId: string, since: number): Promise<GateEvent[]> {
  const query = `/api/dsh-perm-gate/events?sessionId=${encodeURIComponent(sessionId)}${since > 0 ? `&since=${since}` : ''}`
  const res = await fetch(query, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { events?: unknown }
  return Array.isArray(body.events) ? (body.events as GateEvent[]) : []
}

/** The host's push route (see src/events.ts); the browser half prefers it to polling. */
export const STREAM_ROUTE = '/api/dsh-perm-gate/stream'

/** Stream attempts before the route is written off as unsupported and polling takes over. */
const STREAM_RETRIES = 3
const STREAM_RETRY_MS = 3_000
/**
 * Degraded path only: a host predating the stream route still gets a servable
 * strip. Deliberately slower than the old 2 s tick — it now also pauses while
 * the tab is hidden, so a backgrounded page costs nothing.
 */
const FALLBACK_POLL_MS = 5_000

/** One delivery of the feed: either the connect-time replay, or decisions as they land. */
export interface GateFeedBatch {
  readonly events: readonly GateEvent[]
  /**
   * True for a connect-time catch-up batch (the stream's backlog, or the
   * fallback's first poll). Callers sync their cursor with it but must not
   * surface it — replaying a session's history as fresh notices is noise.
   */
  readonly backlog: boolean
}

/**
 * Follow one session's decision feed until the returned close is called.
 *
 * Prefers the host's `text/event-stream` route, which pushes each decision as
 * the gate appends it — no timer, no repeated re-read of the event log. When
 * the stream is unavailable (an older host, a proxy that buffers it) this
 * degrades to polling the JSON route, gated on page visibility.
 *
 * @param sessionId - the session whose decisions to follow.
 * @param getSince - cursor supplier, read at connect and on every fallback poll.
 * @param onBatch - receives the backlog, then live batches.
 * @returns the close: ends the stream and any fallback timer.
 */
export function followEvents(
  sessionId: string,
  getSince: () => number,
  onBatch: (batch: GateFeedBatch) => void,
): () => void {
  let closed = false
  let source: EventSource | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let retries = 0
  let polls = 0

  const stopPolling = (): void => {
    if (pollTimer === null) return
    clearInterval(pollTimer)
    pollTimer = null
  }

  const poll = (): void => {
    if (closed) return
    // A hidden tab does not need the strip kept warm; the next visible tick catches up.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const backlog = polls === 0
    polls += 1
    fetchEvents(sessionId, getSince())
      .then((events) => { if (!closed) onBatch({ events, backlog }) })
      .catch(() => {}) // route missing / transient failure: stay quiet
  }

  const startPolling = (): void => {
    if (closed || pollTimer !== null) return
    polls = 0
    poll()
    pollTimer = setInterval(poll, FALLBACK_POLL_MS)
  }

  const connect = (): void => {
    if (closed) return
    const query = `?sessionId=${encodeURIComponent(sessionId)}&since=${getSince()}`
    const next = new EventSource(`${STREAM_ROUTE}${query}`)
    source = next
    next.onopen = () => {
      retries = 0
      stopPolling()
    }
    next.onmessage = (message: MessageEvent<string>) => {
      try {
        const body = JSON.parse(message.data) as { events?: unknown; backlog?: unknown }
        if (Array.isArray(body.events)) {
          onBatch({ events: body.events as GateEvent[], backlog: body.backlog === true })
        }
      } catch {
        // an unreadable frame is dropped; the next decision still arrives
      }
    }
    next.onerror = () => {
      if (source === next) source = null
      next.close()
      if (closed) return
      retries += 1
      // The route may be missing or the connection may have dropped: poll meanwhile,
      // and retry the stream a bounded number of times before settling for polling.
      startPolling()
      if (retries <= STREAM_RETRIES) setTimeout(connect, STREAM_RETRY_MS)
    }
  }

  if (typeof EventSource === 'undefined') startPolling()
  else connect()

  return () => {
    closed = true
    source?.close()
    source = null
    stopPolling()
  }
}

/** Resolve the current session id from slot props (top level, nested, or hook). */
export function resolveSessionId(props: FeedSlotsProps | undefined): string | null {
  const direct = props?.sessionId
  if (typeof direct === 'string' && direct !== '') return direct
  const nested = props?.slotsProps
  if (typeof nested?.sessionId === 'string' && nested.sessionId !== '') return nested.sessionId
  for (const hook of [props?.useSessions, nested?.useSessions]) {
    if (typeof hook !== 'function') continue
    try {
      const state = hook((s) => s) as { current?: unknown } | undefined
      if (typeof state?.current === 'string' && state.current !== '') return state.current
    } catch {
      // fall through to the next carrier
    }
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
    case 'manual-approved':
      return { color: 'var(--dsw-alias-state-warn-label, #b9770e)', bg: 'var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.08))', tag: 'APPROVED', sticky: false }
    case 'manual-rejected':
      return { color: 'var(--dsw-alias-state-error-primary, #c0392b)', bg: 'var(--dsw-alias-interactive-bg-hover-danger, rgba(192,57,43,0.08))', tag: 'REJECTED', sticky: false }
    case 'manual-cancelled':
      return { color: 'var(--dsw-alias-label-secondary, #666)', bg: 'var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.08))', tag: 'CANCELLED', sticky: false }
    case 'stand-down':
      // Sticky on purpose: an inactive gate is a standing state, not an
      // incident. It must outlive the next auto-allow or it reads as noise.
      return { color: 'var(--dsw-alias-state-warn-label, #b9770e)', bg: 'var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.14))', tag: 'GATE OFF', sticky: true }
    default:
      return { color: 'var(--dsw-alias-state-success-primary, #1e8449)', bg: 'var(--dsw-alias-state-success-tertiary, rgba(30,132,73,0.08))', tag: 'ALLOW', sticky: false }
  }
}

/**
 * Decision-path labels shown beside an event's tool name. Kept alongside
 * `presentation` (not in the dictionary) because they name host-internal
 * decision sources; an unknown value falls through to its raw string.
 */
export const VERDICT_LABELS: Readonly<Record<string, string>> = {
  rule: '规则命中',
  grant: '会话授权',
  'hard-deny': '硬拒绝',
  'deny-keyword': '黑名单关键词',
  default: '默认策略',
  ask: '默认策略',
  permissive: '自动审查放行',
  classifier: 'LLM 裁决',
  'llm-safe': 'LLM 判定安全',
  'llm-learned': 'LLM 学习放行',
  'learned-sediment': '沉淀规则放行',
  'learned-confirm': '学习确认',
  'human-approved': '人工通过',
  'human-rejected': '人工拒绝',
  'human-cancelled': '人工取消',
  'no-approval-channel': '无审批通道',
  // The degrade that hides an ask: the tier declares `approval: ask`, but the
  // session was overridden to `never`, so the gate's ask became a passthrough.
  // Without this label the approvals history shows the raw event string — for
  // the one event that explains why a flagged call ran unreviewed.
  'preset-passthrough': '审批策略 never · 已放行',
  'stand-down': '门禁停用',
}

/** Compact wall-clock rendering of an ISO timestamp. */
export function clockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Human-readable byte size for the snapshot bar. */
export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** Snapshot inventory for the review page's bar and file-chip enablement. */
export interface SnapshotStats {
  readonly count: number
  readonly bytes: number
  /** Event ids that currently have a snapshot file. */
  readonly ids: readonly string[]
  /** eventId → absolute snapshot paths (file-level diff availability). */
  readonly files: Readonly<Record<string, readonly string[]>>
}

/** Load the snapshot inventory (optionally session-scoped); null on failure. */
export async function fetchSnapshotStats(sessionId: string | null): Promise<SnapshotStats | null> {
  const query = sessionId === null ? '' : `?sessionId=${encodeURIComponent(sessionId)}`
  const res = await fetch(`/api/dsh-perm-gate/snapshots-stats${query}`, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) return null
  const body = (await res.json()) as { ok?: unknown; count?: unknown; bytes?: unknown; ids?: unknown; files?: unknown }
  if (body.ok !== true) return null
  const files: Record<string, readonly string[]> = {}
  if (typeof body.files === 'object' && body.files !== null) {
    for (const [key, value] of Object.entries(body.files as Record<string, unknown>)) {
      if (Array.isArray(value)) files[key] = value.map(String)
    }
  }
  return {
    count: typeof body.count === 'number' ? body.count : 0,
    bytes: typeof body.bytes === 'number' ? body.bytes : 0,
    ids: Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : [],
    files,
  }
}

/** Drop snapshots: pass a session id for a session-scoped clear, null for all. */
export async function clearSnapshots(sessionId: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/dsh-perm-gate/snapshots-clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sessionId === null ? {} : { sessionId }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** One rendered diff line. */
export interface DiffLine {
  readonly type: 'same' | 'add' | 'del'
  readonly aNo?: number
  readonly bNo?: number
  readonly text: string
}

export interface DiffHunk {
  readonly hiddenBefore: number
  readonly lines: readonly DiffLine[]
}

/** The diff payload served by `GET /api/dsh-perm-gate/diff`. */
export interface DiffResponse {
  readonly hunks: readonly DiffHunk[]
  readonly stats: { readonly added: number; readonly removed: number; readonly contextLines: number }
  readonly afterExists: boolean
}

/** Load the before/after diff for one event's file; throws on failure. */
export async function fetchDiff(eventId: number, path: string): Promise<DiffResponse> {
  const res = await fetch(
    `/api/dsh-perm-gate/diff?eventId=${eventId}&path=${encodeURIComponent(path)}`,
    { headers: { 'cache-control': 'no-cache' } },
  )
  const body = (await res.json().catch(() => null)) as
    | { ok?: unknown; error?: unknown; hunks?: unknown; stats?: unknown; afterExists?: unknown }
    | null
  if (body === null || body.ok !== true) {
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`)
  }
  return {
    hunks: Array.isArray(body.hunks) ? (body.hunks as DiffHunk[]) : [],
    stats: (typeof body.stats === 'object' && body.stats !== null
      ? body.stats
      : { added: 0, removed: 0, contextLines: 0 }) as DiffResponse['stats'],
    afterExists: body.afterExists !== false,
  }
}

/** Deliver a revert instruction for one event into its conversation. */
export async function sendRevert(sessionId: string, eventId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/dsh-perm-gate/revert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, eventId }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null
    if (body !== null && body.ok === true) return { ok: true }
    return { ok: false, error: typeof body?.error === 'string' ? body.error : `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) }
  }
}
