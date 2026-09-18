/**
 * Extended rule dimensions for dsh-perm-gate.
 *
 * These 6 dimensions extend the existing 4 (tools/command/args/paths) and are
 * parsed from each rule entry in the YAML permissions document. All types are
 * pure — no I/O — so parsing and validation are unit-testable.
 *
 * Dimensions:
 *   1. params   — key→value glob matching (AND over keys, `!` prefix negates)
 *   2. absent   — parameter keys that must NOT be present
 *   3. agents   — agent identity candidates (main/subagent/preset:<name>)
 *   4. when     — environment / platform conditions
 *   5. argv     — extra argv patterns (pipeline, etc.) not covered by command/args
 *   6. network  — domain / IP / port / scheme matching
 */

import { RuleError } from './rule.js'

// ─── params ────────────────────────────────────────────────────────────────

/**
 * One parameter match condition: a key name mapped to a list of value glob
 * patterns. The key's actual value must match at least one pattern (OR within
 * the list). All keys must match (AND across keys).
 *
 * A pattern prefixed with `!` is negated: the value must NOT match the
 * remainder of the pattern.
 */
export interface ParamCondition {
  /** The parameter key name (e.g. `command`, `flags.mode`). */
  readonly key: string
  /** Value glob patterns; `!` prefix = negation. Empty list = key must exist (any value). */
  readonly patterns: readonly string[]
  /** Whether this condition is a negation (derived from `!` prefix on the sole pattern). */
  readonly negated: boolean
}

/**
 * Parsed `params` dimension: a list of key→value conditions evaluated as AND.
 */
export type ParamsDimension = readonly ParamCondition[]

/**
 * Parse the `params` field from a rule entry.
 *
 * Format:
 * ```yaml
 * params:
 *   command: ["*--force*", "!*--dry-run*"]
 *   flags.mode: ["production"]
 * ```
 *
 * Each key maps to a string-or-list of value glob patterns.
 * A single `!`-prefixed pattern sets `negated: true`.
 */
export function parseParamsDimension(raw: unknown, at: string): ParamsDimension {
  if (raw === undefined || raw === null) return []
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RuleError(`${at}.params must be a mapping`)
  }
  const result: ParamCondition[] = []
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length === 0) throw new RuleError(`${at}.params has empty key`)
    const patterns = toStringList(val, `${at}.params.${key}`)
    const negated = patterns.length === 1 && patterns[0].startsWith('!')
    result.push({ key, patterns, negated })
  }
  return result
}

// ─── absent ────────────────────────────────────────────────────────────────

/**
 * Parsed `absent` dimension: parameter keys that must NOT be present
 * in the tool call arguments. AND semantics — all listed keys must be absent.
 */
export type AbsentDimension = readonly string[]

/**
 * Parse the `absent` field: a list of parameter key names that must be absent.
 */
export function parseAbsentDimension(raw: unknown, at: string): AbsentDimension {
  if (raw === undefined || raw === null) return []
  const list = toStringList(raw, `${at}.absent`)
  for (let i = 0; i < list.length; i++) {
    if (list[i].length === 0) throw new RuleError(`${at}.absent[${i}] must be a non-empty string`)
  }
  return list
}

// ─── agents ────────────────────────────────────────────────────────────────

/**
 * Parsed `agents` dimension: identity candidates the rule applies to.
 * Supported values: `main`, `subagent`, `preset:<name>`.
 * Empty = this rule does not constrain on agent identity.
 */
export type AgentsDimension = readonly string[]

const VALID_AGENT_PATTERNS = /^(?:main|subagent|preset:.+)$/i

/**
 * Parse the `agents` field: a list of agent identity patterns.
 */
export function parseAgentsDimension(raw: unknown, at: string): AgentsDimension {
  if (raw === undefined || raw === null) return []
  const list = toStringList(raw, `${at}.agents`)
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    if (v.length === 0) throw new RuleError(`${at}.agents[${i}] must be a non-empty string`)
    if (!VALID_AGENT_PATTERNS.test(v)) {
      throw new RuleError(`${at}.agents[${i}] must be "main", "subagent", or "preset:<name>"`)
    }
  }
  return list
}

// ─── when ──────────────────────────────────────────────────────────────────

/**
 * Parsed `when` dimension: environment and platform conditions.
 * All conditions are AND — every listed condition must be satisfied.
 */
export interface WhenDimension {
  /** Required environment variable values. Key = env var name, value = allowed values (OR). */
  readonly env?: Readonly<Record<string, readonly string[]>>
  /** Required platform(s). Values are Node.js `process.platform` strings. */
  readonly platform?: readonly string[]
  /** Required Node.js version range (semver-like). Reserved for future use. */
  readonly nodeVersion?: string
}

/**
 * Parse the `when` field: environment and platform conditions.
 *
 * Format:
 * ```yaml
 * when:
 *   env:
 *     NODE_ENV: ["production"]
 *     CI: ["true", "1"]
 *   platform: [linux, win32]
 * ```
 */
export function parseWhenDimension(raw: unknown, at: string): WhenDimension | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RuleError(`${at}.when must be a mapping`)
  }
  const obj = raw as Record<string, unknown>
  const env_: Record<string, string[]> | undefined = (() => {
    if (obj.env === undefined) return undefined
    if (typeof obj.env !== 'object' || Array.isArray(obj.env)) {
      throw new RuleError(`${at}.when.env must be a mapping`)
    }
    const e: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(obj.env as Record<string, unknown>)) {
      e[k] = toStringList(v, `${at}.when.env.${k}`)
    }
    return e
  })()
  const platform_ = obj.platform !== undefined ? toStringList(obj.platform, `${at}.when.platform`) : undefined
  const nodeVersion_ = obj.nodeVersion !== undefined
    ? (typeof obj.nodeVersion === 'string' && obj.nodeVersion.length > 0
        ? obj.nodeVersion
        : (() => { throw new RuleError(`${at}.when.nodeVersion must be a non-empty string`) })())
    : undefined

  if (env_ === undefined && platform_ === undefined && nodeVersion_ === undefined) return undefined
  const result: WhenDimension = {
    ...(env_ !== undefined && { env: env_ }),
    ...(platform_ !== undefined && { platform: platform_ }),
    ...(nodeVersion_ !== undefined && { nodeVersion: nodeVersion_ }),
  }
  return result
}

// ─── argv ──────────────────────────────────────────────────────────────────

/**
 * Parsed `argv` dimension: extra argv patterns not covered by command/args.
 * Currently supports `pipeline` patterns (pipe chains like `curl|sh`).
 */
export interface ArgvDimension {
  /** Pipeline patterns: match the full command pipeline string. */
  readonly pipeline?: readonly string[]
}

/**
 * Parse the `argv` field: extra argv patterns.
 *
 * Format:
 * ```yaml
 * argv:
 *   pipeline: ["curl|sh", "wget|bash"]
 * ```
 */
export function parseArgvDimension(raw: unknown, at: string): ArgvDimension | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RuleError(`${at}.argv must be a mapping`)
  }
  const obj = raw as Record<string, unknown>
  const pipeline_ = obj.pipeline !== undefined ? toStringList(obj.pipeline, `${at}.argv.pipeline`) : undefined
  if (pipeline_ === undefined) return undefined
  return { pipeline: pipeline_ }
}

// ─── network ───────────────────────────────────────────────────────────────

/**
 * Parsed `network` dimension: domain / IP / port / scheme matching.
 * All sub-dimensions are AND — every listed sub-dimension must match.
 * Within a sub-dimension, entries are OR.
 */
export interface NetworkDimension {
  /** Domain patterns (glob-capable, e.g. `*.internal.corp`). */
  readonly domains?: readonly string[]
  /** IP/CIDR patterns (e.g. `10.0.0.0/8`, `192.168.1.1`). */
  readonly ips?: readonly string[]
  /** Port patterns (e.g. `443`, `8000-9000`). */
  readonly ports?: readonly string[]
  /** URL schemes (e.g. `https`, `http`). */
  readonly schemes?: readonly string[]
}

/**
 * Parse the `network` field: domain / IP / port / scheme matching.
 *
 * Format:
 * ```yaml
 * network:
 *   domains: ["*.internal.corp", "github.com"]
 *   ips: ["10.0.0.0/8"]
 *   ports: ["443", "8000-9000"]
 *   schemes: [https]
 * ```
 */
export function parseNetworkDimension(raw: unknown, at: string): NetworkDimension | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RuleError(`${at}.network must be a mapping`)
  }
  const obj = raw as Record<string, unknown>
  const domains_ = obj.domains !== undefined ? toStringList(obj.domains, `${at}.network.domains`) : undefined
  const ips_ = obj.ips !== undefined ? toStringList(obj.ips, `${at}.network.ips`) : undefined
  const ports_ = obj.ports !== undefined ? toStringList(obj.ports, `${at}.network.ports`) : undefined
  const schemes_ = obj.schemes !== undefined ? toStringList(obj.schemes, `${at}.network.schemes`) : undefined
  if (domains_ === undefined && ips_ === undefined && ports_ === undefined && schemes_ === undefined) return undefined
  const result: NetworkDimension = {
    ...(domains_ !== undefined && { domains: domains_ }),
    ...(ips_ !== undefined && { ips: ips_ }),
    ...(ports_ !== undefined && { ports: ports_ }),
    ...(schemes_ !== undefined && { schemes: schemes_ }),
  }
  return result
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert an unknown value to a string list (string → [string], array → filtered). */
function toStringList(value: unknown, at: string): string[] {
  if (value === undefined || value === null) return []
  const list = typeof value === 'string' ? [value] : value
  if (!Array.isArray(list)) throw new RuleError(`${at} must be a string or list of strings`)
  const result: string[] = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (typeof item !== 'string' || item.length === 0) {
      throw new RuleError(`${at}[${i}] must be a non-empty string`)
    }
    result.push(item)
  }
  return result
}
