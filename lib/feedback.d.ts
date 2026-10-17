/**
 * Deterministic review opinion for a blocked tool call — no LLM.
 *
 * Modeled on cc-safety-net's block message (`BLOCKED + Reason + Rule + intent
 * instruction`): when the gate refuses a call, the main LLM should get a structured
 * note telling it *why*, *which rule/layer* fired, and *what to do instead*, so it
 * stays on task instead of retrying a variant. perm-gate already has the raw
 * material — every preset entry tags its reason `[deny-rule:<id>]` and states a
 * safer alternative in prose, and the deterministic layers emit `[hard-deny]`/
 * `no rule matched` reasons — this module folds that into one classified opinion.
 *
 * Kept dependency-free and pure so it can be unit-tested and reused by both the
 * node decision path and any UI.
 */
/** The five dispositions, mirroring cc-safety-net's intent taxonomy. */
export type ReviewIntent = 'hard_stop' | 'use_alternative' | 'scope_down' | 'manual_only' | 'stop_and_explain';
/** Per-intent guidance to the agent, zh + en (the opinion is fed to the main LLM). */
export declare const INTENT_ADVICE: Readonly<Record<ReviewIntent, {
    readonly zh: string;
    readonly en: string;
}>>;
/** Extract the `[deny-rule:<id>]` tag, a gate-danger tag (YOLO / degraded review), or P0. */
export declare function ruleIdOf(reason: string): string | undefined;
/**
 * Classify a block reason into an intent. Ordered from the most specific signal to
 * a conservative default; the phrasing of preset-rule reasons drives the match.
 */
export declare function intentForDeny(reason: string): ReviewIntent;
/**
 * The structured opinion for one blocked call. `command` must already be redacted by
 * the caller. Returns the classified intent plus a single line suitable for the
 * `工具审核意见: "<text>"` wrapper the listener delivers to the session.
 */
export declare function composeReviewOpinion(input: {
    readonly command: string;
    readonly reason: string;
    readonly locale?: 'zh' | 'en';
}): {
    readonly intent: ReviewIntent;
    readonly text: string;
};
