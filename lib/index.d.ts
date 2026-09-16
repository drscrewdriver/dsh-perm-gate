/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import { PermGateRuntime, type ToolExecutionLike } from './runtime.js';
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
export declare function makePreExecuteListener(runtime: Pick<PermGateRuntime, 'decideExecution' | 'refineAsk' | 'beginShellExecution'>): (exec: ToolExecutionLike, next: () => Promise<unknown>) => Promise<unknown>;
export declare function apply(ctx: Context, config?: Record<string, unknown>): PermGateRuntime;
