/**
 * Audit for dsh-perm-gate: a typed, ignorable-marked event log plus the
 * invariant that whatever is model-visible (the reason text surfaced into the
 * tool result) is ALSO recorded with the same `callId`/`outcome`.
 *
 * The `ignorable` marker is what lets hosts treat these events as log-only,
 * never re-injected into the model context. Hosts that predate the marker
 * (return value of the append proves it) make the runtime degrade to an
 * in-memory mirror instead of failing.
 */
export type AuditOutcome = 'allow' | 'deny' | 'ask' | 'delegated'
export type DecisionSource = 'hard-deny' | 'deny-keyword' | 'grant' | 'rule' | 'default' | 'ask' | 'classifier' | 'permissive'

export interface AuditEntry {
  readonly kind: 'permissionGate/decision'
  readonly marker: 'ignorable'
  readonly callId: string
  readonly tool: string
  readonly outcome: AuditOutcome
  readonly source: DecisionSource
  readonly reason: string
  readonly at: number
}

export interface AuditSink {
  append(entry: AuditEntry): { markerSupported: boolean }
}

/** The on-disk/on-host append contract a DSH session `append` should honor. */
export class MemoryAuditMirror implements AuditSink {
  readonly entries: AuditEntry[] = []
  append(entry: AuditEntry): { markerSupported: boolean } {
    this.entries.push(entry)
    return { markerSupported: true }
  }
  count(kind?: AuditOutcome): number {
    return kind === undefined ? this.entries.length : this.entries.filter((e) => e.outcome === kind).length
  }
}

/** The invariant pairing the model-visible reason with its recorded event. */
export function assertInvariant(visible: { callId: string } | undefined, entry: AuditEntry): boolean {
  // The visible reason must carry the same callId that was logged; otherwise a
  // model-visible decision could exist with no audit trace.
  return visible === undefined || visible.callId === entry.callId
}

/**
 * Detect whether a host honors the `ignorable` marker before the first append,
 * by probing the append surface's return value.
 */
export function probeHost(append: (entry: AuditEntry) => unknown): boolean {
  try {
    const probe = append({ kind: 'permissionGate/decision', marker: 'ignorable', callId: '__probe__', tool: '__probe__', outcome: 'ask', source: 'ask', reason: 'probe', at: Date.now() })
    const boxed = probe as { markerSupported?: unknown }
    return boxed.markerSupported !== false
  } catch {
    return false
  }
}

export function makeEntry(input: Omit<AuditEntry, 'kind' | 'marker'>): AuditEntry {
  return { kind: 'permissionGate/decision', marker: 'ignorable', ...input }
}