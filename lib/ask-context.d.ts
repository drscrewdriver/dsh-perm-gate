/** Reversibility tier — the axis the human and the safety metric both care about. */
export type Reversibility = 
/** irreversible damage (data destroyed, credential left the machine) */
'I'
/** unknown-target: the payload cannot be inspected, so harm cannot be ruled out */
 | 'U'
/** has an external side effect but is recoverable (push, PR, global config) */
 | 'C'
/** reversible or read-only (list, diff, build, local commit, workspace edit) */
 | 'R';
/** What the call is aimed at. */
export type TargetKind = 'read' | 'write' | 'delete' | 'remote-write' | 'exec-external' | 'unknown';
/** The session's three tier knobs, folded out of the durable session log. */
export interface SessionKnobs {
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
}
/** Input to {@link buildAskContext}; every field optional except `tool`. */
export interface AskContextSource {
    readonly tool: string;
    readonly args?: Record<string, unknown>;
    readonly commandText?: string;
    readonly cwd?: string;
    /** The workspace root the prompt's scope rules keep assuming but never had. */
    readonly workspaceRoot?: string;
    readonly knobs?: SessionKnobs;
    readonly files?: readonly string[];
    /** The deterministic layer's own conclusion, kept for the human, not the grader. */
    readonly ruleReason?: string;
    /** Correlation key, mixed into the event digest. */
    readonly callId?: string;
    /** Per-session salt so `inputDigest` cannot be dictionary-reversed or joined across sessions. */
    readonly salt?: string;
    /** Injected hash (sha256 hex on the node half) to keep crypto out of this module. */
    readonly hash?: (text: string) => string;
}
/** The frozen context. */
export interface AskContext extends AskContextSource {
    readonly targetKind: TargetKind;
    readonly targetResolvable: boolean;
    readonly reversibility: Reversibility;
    /** Whether the act is unrecoverable, judged by the shared `irreversible.ts`. */
    readonly irreversible: boolean;
    /**
     * Unrecoverable data loss that is nonetheless **not** a hard-deny: the human
     * decides, but no grader may clear it and no confirmations may learn it away.
     * `docker volume rm` is the archetype — routine maintenance, unrecoverable.
     */
    readonly unlearnable: boolean;
    /** Read-only commands that need no human attention at all. */
    readonly readOnly: boolean;
}
/**
 * Freeze one call into an {@link AskContext}. Pure and side-effect free: it reads
 * what it is handed and never touches the filesystem or the network, so the three
 * projections cannot disagree about what they were built from.
 */
export declare function buildAskContext(source: AskContextSource): AskContext;
/** What the risk grader is allowed to see. */
export interface GraderPayload {
    readonly tool: string;
    readonly args: unknown;
    readonly reason: string;
    readonly target_resolvable: boolean;
    readonly workspace_root?: string;
}
/**
 * Project for egress to the grader. Tier knobs and the rule layer's own verdict
 * are stripped by design — see the module comment.
 */
export declare function toGraderPayload(ctx: AskContext): GraderPayload;
/** What the human approving this call should be shown. */
export interface HumanCard {
    readonly tool: string;
    readonly command: string;
    readonly files: readonly string[];
    /** Total file count, so the card can say "and N more" instead of lying by omission. */
    readonly fileCount: number;
    readonly reversibility: Reversibility;
    readonly targetKind: TargetKind;
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
    readonly reason: string;
}
/** Project for the approval popup (already redacted; never raw args). */
export declare function toHumanCard(ctx: AskContext, maxFiles?: number): HumanCard;
/**
 * A one-line summary for the human who must decide.
 *
 * The host renders an approval request from its `reason` string and nothing
 * else, so until `approval.request` can carry structured fields this is the only
 * channel that reaches a human. Built from language-neutral enum tokens
 * (`tier=C`, `payload=opaque`) rather than prose: prose would need nine
 * translations per batch, and a host renderer can localize the tokens later
 * without a format change.
 */
export declare function humanCardLine(ctx: AskContext, maxFiles?: number): string;
/** What goes on the durable event, for later attribution. */
export interface EventFields {
    readonly inputDigest?: string;
    readonly cwd?: string;
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
}
/**
 * Project for the event log: a salted digest (raw args never land on disk) plus
 * the knobs, so a reviewer can reconstruct *why* the gate saw what it saw.
 * Emits no digest when no hash is injected rather than falling back to an
 * unsalted one — that would be dictionary-reversible across sessions.
 */
export declare function toEventFields(ctx: AskContext): EventFields;
/**
 * Fold the three durable tier knobs out of a session event log (last wins).
 * `preset.ts` folds only `permission/preset`; the other two ride the same log.
 * Tolerant of every host line: an unknown shape yields `undefined`, never a
 * wrong value.
 */
export declare function foldSessionKnobs(events: readonly {
    type?: string;
    data?: Record<string, unknown>;
}[] | undefined): SessionKnobs;
