/**
 * Shadow detection for dsh-perm-gate rule chains.
 *
 * A rule is "shadowed" when an earlier rule in the same action partition
 * always matches the same (or a superset of) tool calls, making the later
 * rule unreachable. Shadowed rules are dead weight — they can never fire
 * and may confuse users who think they are effective.
 *
 * This module performs a structural (conservative) shadow check. It does NOT
 * do full semantic analysis — it flags potential shadows based on pattern
 * structure, not on actual runtime argument values.
 */
import type { CompiledRuleset } from './rule.js';
export interface ShadowReport {
    /** Rule indices that are shadowed (unreachable). */
    readonly shadowed: readonly number[];
    /** Human-readable reasons per shadowed rule. */
    readonly reasons: ReadonlyMap<number, string>;
}
/**
 * Detect shadowed rules within a compiled ruleset.
 *
 * For each action partition (deny, allow, ask), check if any rule is
 * dominated by an earlier rule in the same partition. A rule is dominated
 * when:
 *   1. Its tools pattern is a subset (or equal) of an earlier rule's tools
 *   2. Its command pattern is a subset (or equal)
 *   3. Its args/paths dimensions are subsets
 *   4. Its new dimensions (params/absent/agents/when/network) are subsets
 *
 * This is conservative: it only flags rules that are DEFINITELY unreachable,
 * not rules that MIGHT be unreachable under certain argument combinations.
 */
export declare function detectShadows(ruleset: CompiledRuleset): ShadowReport;
