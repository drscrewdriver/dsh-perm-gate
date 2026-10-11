/**
 * Risk-category verdict protocol for dsh-perm-gate's `llmAssist` strategy.
 *
 * Layers on the same custom OpenAI-compatible endpoint as `classifier.ts` and
 * asks the LLM to grade ONE tool call as either safe or risky with a category:
 *
 *   safe                      → the gate may auto-allow the ask
 *   risky:<hard category>     → deletion / credential / remote / system / bulk /
 *                               unknown-target — the operation looks dangerous or
 *                               cannot be seen; the gate KEEPS the
 *                               human ask and never learns these into an
 *                               auto-allow. It is NOT an auto-deny: denying is
 *                               reserved for the deterministic layers (P0,
 *                               deny-keywords, `deny:` rules), because a
 *                               probabilistic verdict must not be able to hand
 *                               down an unappealable block.
 *   risky:neutral             → no hard-risk signal but not clearly safe; the
 *                               verdict-learning path may auto-allow after
 *                               enough human confirmations
 *   unresolved                → transport failure, timeout, or a protocol
 *                               violation — the caller must keep the ask
 *                               (fail-closed) and must NOT learn from it
 *
 * The protocol, prompt wording, and parser are this repo's own; the design
 * (hard categories vs. a neutral confirm-count zone) follows the approach
 * demonstrated by dsh-approval-gate.
 */
import { type ClassifierConfig } from './classifier.js';
/** Risk categories the LLM may report for a risky verdict. */
export type RiskCategory = 'deletion' | 'credential' | 'remote' | 'system' | 'bulk' | 'unknown-target' | 'neutral';
/**
 * Categories that always route to the human seam regardless of learning state
 * or any later LLM opinion. Order-stable for prompts and event payloads.
 *
 * "Hard" means *never auto-allowed and never learned* — the gate keeps asking.
 * It does not mean auto-denied: the deny path belongs to the deterministic
 * layers (P0 hard-deny, the deny-keyword blacklist, explicit `deny:`
 * rules), so a misgraded category can always be negotiated instead of becoming
 * an unappealable block.
 *
 * `unknown-target` is the U tier — the payload could not be read (encoded blob,
 * script outside the workspace, empty-args tool). It is deliberately **not** in
 * any deny wordlist: "I cannot see it" is not evidence that it is bad, and a
 * category the model is invited to guess would hand out unappealable blocks for
 * opacity alone. Being hard is enough — ask, forever, learn nothing.
 */
export declare const HARD_RISK_CATEGORIES: readonly RiskCategory[];
/**
 * Whether a category must never be auto-allowed — and never learned into one.
 * Unknown categories are hard too (fail-closed).
 */
export declare function isHardRisk(category: string): boolean;
/**
 * A graded verdict for one tool call. `unresolved` covers every failure mode —
 * the caller must treat it exactly like "no classifier": keep the ask, learn nothing.
 */
export type RiskVerdict = {
    kind: 'safe';
    reason?: string;
} | {
    kind: 'risky';
    category: RiskCategory;
    reason?: string;
} | {
    kind: 'unresolved';
};
/**
 * The bounded call graded by {@link classifyRisk}.
 *
 * `args` may be passed raw: {@link riskUserText} redacts and bounds it before it
 * leaves the process. The two scope fields exist because the prompt's own rules
 * ("deletion inside the workspace is SAFE") were previously unenforceable — the
 * grader was told to use a scope it was never given.
 */
export interface RiskRequest {
    readonly tool: string;
    readonly args: unknown;
    /** The deterministic reason the call reached the LLM-assist seam. */
    readonly reason: string;
    /** Workspace root, so "inside the workspace" means something to the grader. */
    readonly workspaceRoot?: string;
    /** False for an encoded or unreadable payload: the U tier, never grade it safe. */
    readonly targetResolvable?: boolean;
}
/**
 * Prompt identity, recorded with every verdict.
 *
 * Measured on the eval set: one and the same wording halved disturbance on one
 * model while costing another four to five irreversible misses. A grading prompt
 * is therefore a versioned, falsifiable artifact — without this line, a wording
 * change and a model swap are indistinguishable in the event log.
 */
export declare const RISK_SYSTEM_PROMPT_VERSION = "v7-terse-budget";
/** Parse one assistant message into a verdict; anything off-protocol → undefined (caller retries/fails). */
export declare function parseRiskVerdict(content: string): RiskVerdict | undefined;
/**
 * Grade one tool call with the configured LLM. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export declare function classifyRisk(cfg: ClassifierConfig, req: RiskRequest, nowFetch?: typeof fetch): Promise<RiskVerdict>;
/** A transport-agnostic completion: system+user prompt → assistant text. */
export type RiskSend = (system: string, user: string) => Promise<{
    ok: true;
    content: string;
} | {
    ok: false;
}>;
/** The bounded user prompt for one risk grading (shared by every transport). */
export declare function riskUserText(req: RiskRequest): string;
/**
 * Grade one tool call through any transport. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export declare function classifyRiskWith(send: RiskSend, req: RiskRequest): Promise<RiskVerdict>;
