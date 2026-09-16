/**
 * Risk-category verdict protocol for dsh-perm-gate's `llmAssist` strategy.
 *
 * Layers on the same custom OpenAI-compatible endpoint as `classifier.ts` and
 * asks the LLM to grade ONE tool call as either safe or risky with a category:
 *
 *   safe                      → the gate may auto-allow the ask
 *   risky:<hard category>     → deletion / credential / remote / system / bulk —
 *                               auto-deny: the operation is clearly dangerous,
 *                               no popup or human review needed
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
export type RiskCategory = 'deletion' | 'credential' | 'remote' | 'system' | 'bulk' | 'neutral';
/**
 * Categories that always route to the human seam regardless of learning state
 * or any later LLM opinion. Order-stable for prompts and event payloads.
 */
export declare const HARD_RISK_CATEGORIES: readonly RiskCategory[];
/** Whether a category must never be auto-allowed. Unknown categories are hard too (fail-closed). */
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
/** The bounded call graded by {@link classifyRisk}. */
export interface RiskRequest {
    readonly tool: string;
    readonly args: unknown;
    /** The deterministic reason the call reached the LLM-assist seam. */
    readonly reason: string;
}
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
