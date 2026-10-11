/**
 * The single definition of "this act cannot be undone".
 *
 * Irreversibility was previously encoded twice — once as P0's wipe-utility list
 * in `engine.ts`, once as the `I` tier grading in `ask-context.ts`. Two copies of
 * one fact drift: the tier could call something irreversible while the deny layer
 * had never heard of it (exactly the state `Optimize-VHD` was in: no rule knew it,
 * no graded model hard-denied it). This module owns the knowledge; P0 uses it to
 * deny and the context uses it to label, so they cannot disagree.
 *
 * Shape constraint that keeps the sharing safe: every function here returns
 * `string | undefined` — a reason or "not mine to decide". It is structurally
 * incapable of producing an allow, so importing it cannot widen the gate.
 *
 * Callers that deny must pass only deterministic input: the command as received
 * plus **executed** decoded variants (`command-normalize.ts`), never a blob that
 * merely happens to decode to something alarming.
 */
import type { SimpleCommand } from './shell.js';
/** Storage-wipe utilities with no benign reading worth preserving. */
export declare const WIPE_UTILITIES: ReadonlySet<string>;
/**
 * Why one piece of text is irreversible, or undefined when it is not.
 *
 * `executed` gates the credential rule: a path quoted inside a commit message is
 * not a secret leaving the machine, while the same text run through `curl` is.
 *
 * `program` says the caller already knows the executable (it came from the shell
 * parser). When it is given, that name — not a position guess over text whose
 * quotes were stripped — decides which program is running, and `inline` carries
 * the script bodies of an interpreter (`bash -c "…"`), which really are nested
 * command lines and are still scanned by position.
 */
export declare function irreversibleReason(text: string, opts?: {
    readonly executed?: boolean;
    readonly program?: string;
    readonly inline?: readonly string[];
    readonly extraPrograms?: readonly string[];
}): string | undefined;
export declare function commandIrreversibleReason(cmd: SimpleCommand): string | undefined;
/**
 * Unrecoverable acts that are **not** P0 material: the call must be asked and
 * must never be cleared automatically or learned away, but the human keeps the
 * decision. Returns a reason or "not mine to decide" — the same shape constraint
 * as {@link irreversibleReason}, so no caller can turn it into an allow.
 *
 * Two families qualify. `docker volume rm` destroys data for good yet is routine
 * maintenance, so an unappealable deny is the wrong layer. The two exfil shapes
 * below are only *invisible to the per-segment deny layer* (a pipeline splits the
 * secret from the upload), which the whole-call view can see — and because the
 * same words in a commit message are ordinary text, they earn a permanent ask
 * rather than a permanent refusal.
 */
export declare function neverClearReason(text: string): string | undefined;
