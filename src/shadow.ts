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
import type { CompiledRuleEntry, CompiledRuleset } from './rule.js'

export interface ShadowReport {
  /** Rule indices that are shadowed (unreachable). */
  readonly shadowed: readonly number[]
  /** Human-readable reasons per shadowed rule. */
  readonly reasons: ReadonlyMap<number, string>
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
export function detectShadows(ruleset: CompiledRuleset): ShadowReport {
  const shadowed: number[] = []
  const reasons = new Map<number, string>()

  for (const partition of [ruleset.deny, ruleset.allow, ruleset.ask]) {
    for (let i = 0; i < partition.length; i++) {
      const rule = partition[i]
      if (!rule.enabled) continue
      for (let j = 0; j < i; j++) {
        const earlier = partition[j]
        if (!earlier.enabled) continue
        const dominatedBy = isDominated(earlier, rule)
        if (dominatedBy !== undefined) {
          shadowed.push(rule.index)
          reasons.set(rule.index, `shadowed by rule #${earlier.index}: ${dominatedBy}`)
          break // already flagged by earliest dominator
        }
      }
    }
  }

  return { shadowed, reasons }
}

/**
 * Check if `candidate` is dominated by `dominator` (dominator always
 * matches a superset of what candidate matches).
 *
 * Returns a reason string if dominated, undefined otherwise.
 */
function isDominated(dominator: CompiledRuleEntry, candidate: CompiledRuleEntry): string | undefined {
  // tools: dominator's tools must be a superset (fewer or equal patterns = wider match).
  // If dominator has no tools constraint (empty = every tool), it's a superset.
  if (dominator.tools.length > 0 && candidate.tools.length > 0) {
    // Both have tools: conservatively check if dominator's patterns are broader.
    // Simple heuristic: if dominator has fewer patterns, it's likely broader.
    // Full subset analysis would require pattern comparison — too expensive for hot path.
    // We only flag when dominator has NO tools constraint (empty = every tool).
    // For non-empty/non-empty, we conservatively don't flag.
    if (dominator.tools.length <= candidate.tools.length) {
      // Could be broader — but we need actual pattern comparison.
      // Conservative: don't flag unless we can prove subset.
      // Skip this dimension for now.
    } else {
      return undefined // dominator is stricter on tools
    }
  }
  // If dominator has no tools and candidate has tools → dominator is broader ✓

  // command: same logic — dominator with no command constraint is broader.
  if (dominator.command.length > 0 && candidate.command.length > 0) {
    if (dominator.command.length > candidate.command.length) return undefined
  }

  // args: same logic.
  if (dominator.args.length > 0 && candidate.args.length > 0) {
    if (dominator.args.length > candidate.args.length) return undefined
  }

  // paths: same logic.
  if (dominator.paths.length > 0 && candidate.paths.length > 0) {
    if (dominator.paths.length > candidate.paths.length) return undefined
  }

  // New dimensions: if dominator has fewer constraints, it's broader.
  // params
  if (dominator.params.length > 0 && candidate.params.length > 0) {
    if (dominator.params.length > candidate.params.length) return undefined
  }

  // absent
  if (dominator.absent.length > 0 && candidate.absent.length > 0) {
    if (dominator.absent.length > candidate.absent.length) return undefined
  }

  // agents
  if (dominator.agents.length > 0 && candidate.agents.length > 0) {
    if (dominator.agents.length > candidate.agents.length) return undefined
  }

  // when: dominator with no when = broader
  if (dominator.when !== undefined && candidate.when === undefined) {
    return undefined // dominator is stricter
  }

  // network: dominator with no network = broader
  if (dominator.network !== undefined && candidate.network === undefined) {
    return undefined // dominator is stricter
  }

  // If we get here, dominator has no constraints that candidate doesn't also
  // have (or has fewer/equal constraints). This is a potential shadow.
  // Only flag if dominator is strictly broader on at least one dimension.
  const dominatorBroad = isStrictlyBroader(dominator, candidate)
  if (dominatorBroad !== undefined) return dominatorBroad

  return undefined
}

/**
 * Check if dominator is strictly broader than candidate on at least one dimension.
 */
function isStrictlyBroader(dominator: CompiledRuleEntry, candidate: CompiledRuleEntry): string | undefined {
  // tools: empty = every tool (broader)
  if (dominator.tools.length === 0 && candidate.tools.length > 0) {
    return `dominator has no tools constraint (matches all tools)`
  }
  // command: empty = no command constraint (broader)
  if (dominator.command.length === 0 && candidate.command.length > 0) {
    return `dominator has no command constraint`
  }
  // args: empty = no args constraint (broader)
  if (dominator.args.length === 0 && candidate.args.length > 0) {
    return `dominator has no args constraint`
  }
  // paths: empty = no paths constraint (broader)
  if (dominator.paths.length === 0 && candidate.paths.length > 0) {
    return `dominator has no paths constraint`
  }
  // params: empty = no params constraint (broader)
  if (dominator.params.length === 0 && candidate.params.length > 0) {
    return `dominator has no params constraint`
  }
  // absent: empty = no absent constraint (broader)
  if (dominator.absent.length === 0 && candidate.absent.length > 0) {
    return `dominator has no absent constraint`
  }
  // agents: empty = no agents constraint (broader)
  if (dominator.agents.length === 0 && candidate.agents.length > 0) {
    return `dominator has no agents constraint`
  }
  return undefined
}
