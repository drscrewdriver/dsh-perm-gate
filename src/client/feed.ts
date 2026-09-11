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
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned' | 'manual-approved' | 'manual-rejected' | 'manual-cancelled'
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
