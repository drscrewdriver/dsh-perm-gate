/** The on-disk/on-host append contract a DSH session `append` should honor. */
export class MemoryAuditMirror {
    entries = [];
    append(entry) {
        this.entries.push(entry);
        return { markerSupported: true };
    }
    count(kind) {
        return kind === undefined ? this.entries.length : this.entries.filter((e) => e.outcome === kind).length;
    }
}
/** The invariant pairing the model-visible reason with its recorded event. */
export function assertInvariant(visible, entry) {
    // The visible reason must carry the same callId that was logged; otherwise a
    // model-visible decision could exist with no audit trace.
    return visible === undefined || visible.callId === entry.callId;
}
/**
 * Detect whether a host honors the `ignorable` marker before the first append,
 * by probing the append surface's return value.
 */
export function probeHost(append) {
    try {
        const probe = append({ kind: 'permissionGate/decision', marker: 'ignorable', callId: '__probe__', tool: '__probe__', outcome: 'ask', source: 'ask', reason: 'probe', at: Date.now() });
        const boxed = probe;
        return boxed.markerSupported !== false;
    }
    catch {
        return false;
    }
}
export function makeEntry(input) {
    return { kind: 'permissionGate/decision', marker: 'ignorable', ...input };
}
