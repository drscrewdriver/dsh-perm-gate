/**
 * Agent identity extraction for the `agents` rule dimension.
 *
 * Given a tool execution context, produces zero or more identity candidates
 * that the `agents` dimension can match against. Candidates are produced
 * in priority order: most-specific first.
 *
 * Identity model:
 *   - `main`          — the primary (top-level) agent session
 *   - `subagent`      — a delegated child agent (parentAuthorized present)
 *   - `preset:<name>` — running under a named permission preset
 *
 * When no identity can be determined, an empty array is returned and the
 * `agents` dimension in rules fail-closes (no match → rule skipped).
 */

/**
 * The subset of ToolExecutionLike we need. Defined as a permissive interface
 * to avoid a circular import with runtime.ts. Uses `unknown` for event types
 * since we only need to read `.type`/`.kind` and `.preset`/`.tier` properties.
 */
export interface ExecutionLike {
  readonly parentAuthorized?: boolean
  readonly agent?: {
    readonly sessionId?: string
    readonly session?: {
      readonly id?: string
      readonly events?: readonly unknown[]
      readonly snapshotEvents?: () => readonly unknown[]
      readonly ownEvents?: () => readonly unknown[]
    }
  }
}

/**
 * Extract agent identity candidates from a tool execution context.
 *
 * Returns a deduplicated list of identity strings. The `agents` rule
 * dimension matches if ANY candidate matches ANY entry in the rule's
 * `agents` list.
 *
 * @returns candidates in priority order, e.g. `['preset:permissive', 'subagent']`
 *          or `['main']`. Empty array = undecidable → agents rules fail-close.
 */
export function extractAgentCandidates(exec: ExecutionLike): string[] {
  const candidates: string[] = []

  // 1. Preset name — most specific identity.
  const preset = presetFromEvents(exec)
  if (preset !== undefined) {
    candidates.push(`preset:${preset}`)
  }

  // 2. Main vs subagent — determined by parentAuthorized presence.
  if (exec.parentAuthorized !== undefined) {
    // parentAuthorized is present → this is a child/subagent.
    candidates.push('subagent')
  } else {
    // parentAuthorized absent → assume main agent.
    candidates.push('main')
  }

  return candidates
}

/**
 * Derive the current permission preset name from the session event log.
 *
 * The event log is append-only; the last `preset-switch` or `tier-select`
 * event carries the current preset. Returns undefined when the log is
 * unavailable or no preset event exists.
 */
function presetFromEvents(exec: ExecutionLike): string | undefined {
  const events = eventsOf(exec)
  if (events === undefined) return undefined

  // Walk backwards to find the most recent preset/tier event.
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (typeof ev !== 'object' || ev === null) continue
    const rec = ev as Record<string, unknown>
    const type = rec.type ?? rec.kind
    if (typeof type !== 'string') continue
    if (type === 'preset-switch' || type === 'tier-select') {
      const value = rec.preset ?? rec.tier ?? rec.value
      if (typeof value === 'string' && value !== '') return value
    }
  }
  return undefined
}

/**
 * Read the session event log from a ToolExecutionLike, handling both
 * DSH 0.1.1 (plain array) and 0.1.2+ (function accessors) shapes.
 */
function eventsOf(exec: ExecutionLike): readonly unknown[] | undefined {
  const session = exec.agent?.session
  if (session === undefined) return undefined
  if (typeof session.snapshotEvents === 'function') {
    try { return session.snapshotEvents() } catch { /* ignore */ }
  }
  if (typeof session.ownEvents === 'function') {
    try { return session.ownEvents() } catch { /* ignore */ }
  }
  if (Array.isArray(session.events)) return session.events
  return undefined
}
