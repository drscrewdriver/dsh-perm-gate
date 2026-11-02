/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import { type SessionSender } from './events.js';
import { PermGateRuntime, type PreToolDecisionLike, type ToolExecutionLike } from './runtime.js';
export declare const name = "dsh-perm-gate";
/**
 * The `tools` service drives `tools/pre-execute`/`tools/result` (dsh-tools).
 * `webServer` hosts the plugin's HTTP routes; `llm` + `agentDefaultModel` back
 * the `host` llmAssist receiver — all supplied by the dsh runtime through the
 * loader inject (the same pattern dsh-approval-gate demonstrates; probing via
 * `ctx.get` does not cross the plugin's isolated context).
 */
export declare const inject: string[];
export { Config };
/** Runtime settings namespace: `permissive` + `permissiveStrategies` (editable in the UI). */
export declare const PERMISSIVE_NAMESPACE = "dsh-perm-gate";
/**
 * The `source.kind` the gate stamps on its own block opinions.
 *
 * The host's vocabulary is explicit about this: `source.kind === 'user'` (with an
 * `rpcId`) means *a human typed it*, and `ui-trajectory` / `ui-chat` render any
 * other kind as injected **context**, not as a queued user input. The host's own
 * notices use the same convention (`user-approval`, `policy`, `time-context`…).
 * A gate note is the gate talking, so it must not borrow the human's identity —
 * otherwise the waiting area lists it as a message the person can plan, reorder
 * or resend.
 */
export declare const BLOCK_NOTE_SOURCE_KIND = "perm-gate";
/**
 * Deliver the gate's block opinion into the running turn.
 *
 * The opinion is model-facing context, not user input, so this uses the host's
 * injection lane (`agent.inject`: same `next-step` band as steering, but the
 * note waits for the next pre-step instead of waking a driver) and stamps
 * {@link BLOCK_NOTE_SOURCE_KIND} on it. The role stays `user` — that is the only
 * role a model reads as an instruction — but the source says who really spoke.
 *
 * Falls back to {@link buildSessionSender}'s steering lane when no live agent is
 * reachable (a hosted runtime that only exposes the typert gateway): the note
 * then arrives as a steer, which the UI may show as a pending message — worse,
 * but never a dropped block reason.
 */
export declare function buildBlockNoteSender(get: (name: string) => unknown): SessionSender;
/**
 * Deliver a message into a conversation. A DSH user message content must be a
 * block array — a bare string is rendered per character by the GUI — and two
 * channels are tried in order: the typert gateway, then the live agent's own
 * inbox method.
 *
 * `mode` picks the lane, and the lanes are physically different queues:
 *
 * - `queue` → `agent.followup` → **next-turn**: a new user turn. That is the
 *   lane for an instruction the person means to type (the review page's
 *   "撤销此改动"), and it shares the queue the user's own input waits in.
 * - `steer` → `agent.steer` → **next-step**: lands beside the tool result that
 *   is about to be delivered, inside the *running* turn. That is the lane for
 *   the gate's own block opinion — it must not cost the user a turn, must not
 *   look like something they typed, and must reach the model at the very next
 *   step boundary rather than after the turn ends.
 */
export declare function buildSessionSender(get: (name: string) => unknown, mode?: 'queue' | 'steer'): SessionSender;
/**
 * Build the `approval/request` listener (exported for tests).
 *
 * Two jobs, in this order:
 *
 * 1. **Answer an escalation the gate already decided.** A sandbox escalation is
 *    raised by `approveEscalation` from *inside* a shell/filesystem tool body —
 *    after `tools/pre-execute` settled — so the gate's own allow never reaches it
 *    and a call it auto-allowed would still prompt the human for the privilege
 *    widening. {@link PermGateRuntime.answerEscalation} returns `allowed-once` for
 *    exactly that case (the Permissive tier on, `trustEscalation` on, a positively
 *    cleared `callId` with a matching tool, a recognized escalation reason and
 *    target mode) and `undefined` for every other request, which then delegates
 *    unchanged.
 * 2. **Record the terminal outcome** of an ask the gate did raise. This is
 *    best-effort: a throw here would be normalized by the approval service to
 *    `unavailable` — a rejection on the human's behalf.
 */
export declare function makeApprovalAnswerer(runtime: Pick<PermGateRuntime, 'settleAskOutcome' | 'answerEscalation'>): (req: unknown, next: () => Promise<unknown>) => Promise<unknown>;
/**
 * Build the `tools/pre-execute` waterfall listener (exported for tests).
 *
 * The llmAssist refinement is awaited **before** the decision leaves the
 * waterfall. An ask that has been returned to the host is already on its way to
 * the approval answerers, and DSH offers no API to retract it — the request's
 * own `signal` can only settle it `cancelled` — so a `safe` verdict learned
 * afterwards could be *recorded* but never acted on: the human still had to
 * click. Grading here is what turns `safe` into a real auto-allow and keeps the
 * prompt for the genuinely uncertain verdicts only (`risky:neutral`,
 * `unresolved`, transport failure). The wait is bounded by the classifier's own
 * `riskTimeoutMs` (default 20 s), and a grader failure keeps the original ask
 * (fail-closed).
 */
export declare function makePreExecuteListener(runtime: Pick<PermGateRuntime, 'decideExecution' | 'refineAsk' | 'beginShellExecution'> & Partial<Pick<PermGateRuntime, 'sandboxRewrite' | 'unattendedModeOf' | 'resolveYolo' | 'resolveSafetyNet'>>, feedback?: (exec: ToolExecutionLike, decision: PreToolDecisionLike) => void): (exec: ToolExecutionLike, next: () => Promise<unknown>) => Promise<unknown>;
export declare function apply(ctx: Context, config?: Record<string, unknown>): PermGateRuntime;
