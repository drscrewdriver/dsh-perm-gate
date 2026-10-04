export type LoopbackExemptResult = {
    readonly status: 'exempt' | 'already-exempt';
} | {
    readonly status: 'failed';
    readonly message: string;
} | {
    readonly status: 'unsupported';
    readonly message: string;
};
/**
 * Ensure the container SID is on the machine's loopback-exempt list.
 *
 * `elevate` (default false): when true and the non-elevated add is denied, one
 * UAC elevation prompt is offered via PowerShell Start-Process -Verb RunAs.
 */
export declare function ensureLoopbackExempt(sid: string, options?: {
    elevate?: boolean;
}): Promise<LoopbackExemptResult>;
