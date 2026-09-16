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
export type AuditOutcome = 'allow' | 'deny' | 'ask' | 'delegated';
export type DecisionSource = 'hard-deny' | 'deny-keyword' | 'grant' | 'rule' | 'default' | 'ask' | 'classifier' | 'permissive';
export interface AuditEntry {
    readonly kind: 'permissionGate/decision';
    readonly marker: 'ignorable';
    readonly callId: string;
    readonly tool: string;
    readonly outcome: AuditOutcome;
    readonly source: DecisionSource;
    readonly reason: string;
    readonly at: number;
}
export interface AuditSink {
    append(entry: AuditEntry): {
        markerSupported: boolean;
    };
}
/** The on-disk/on-host append contract a DSH session `append` should honor. */
export declare class MemoryAuditMirror implements AuditSink {
    readonly entries: AuditEntry[];
    append(entry: AuditEntry): {
        markerSupported: boolean;
    };
    count(kind?: AuditOutcome): number;
}
/** The invariant pairing the model-visible reason with its recorded event. */
export declare function assertInvariant(visible: {
    callId: string;
} | undefined, entry: AuditEntry): boolean;
/**
 * Detect whether a host honors the `ignorable` marker before the first append,
 * by probing the append surface's return value.
 */
export declare function probeHost(append: (entry: AuditEntry) => unknown): boolean;
export declare function makeEntry(input: Omit<AuditEntry, 'kind' | 'marker'>): AuditEntry;
