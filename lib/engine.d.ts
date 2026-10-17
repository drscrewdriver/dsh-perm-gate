import { type Decision, type ToolCallContext } from './evaluate.js';
export type EngineStage = 'hard-deny' | 'grant' | 'rule' | 'default' | 'ask' | 'classifier';
/** The built-in read-only / internal classification, for diagnostics and docs. */
export declare const AUTO_ALLOW_TOOLS: ReadonlySet<string>;
/**
 * The document-body keys the screens skip live in `scan-text.ts`, shared with the
 * deny-keyword layer so the two cannot drift. Re-exported here because this was their
 * published home.
 */
export { CONTENT_ARG_KEYS } from './scan-text.js';
/**
 * Deterministic P0 hard-deny reason, or undefined when the call may proceed to
 * later stages.
 */
export declare function hardDenyReason(ctx: ToolCallContext): string | undefined;
export interface GrantResolver {
    (tool: string, args: Record<string, unknown>): 'allow' | 'no-match';
}
export interface FinalDecision extends Decision {
    readonly stage: EngineStage;
}
/** Pure P0–P2 + P4 decision; P3 handled by the caller before falling back to ask. */
export declare function decide(ctx: ToolCallContext, ruleset: {
    decide: (c: ToolCallContext) => Decision;
}, grants: GrantResolver, 
/** Extra tool names the user classified as safe (`autoAllowTools`). */
autoAllowExtra?: ReadonlySet<string>): FinalDecision;
