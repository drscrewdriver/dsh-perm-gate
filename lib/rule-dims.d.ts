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
    readonly key: string;
    /** Value glob patterns; `!` prefix = negation. Empty list = key must exist (any value). */
    readonly patterns: readonly string[];
    /** Whether this condition is a negation (derived from `!` prefix on the sole pattern). */
    readonly negated: boolean;
}
/**
 * Parsed `params` dimension: a list of key→value conditions evaluated as AND.
 */
export type ParamsDimension = readonly ParamCondition[];
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
export declare function parseParamsDimension(raw: unknown, at: string): ParamsDimension;
/**
 * Parsed `absent` dimension: parameter keys that must NOT be present
 * in the tool call arguments. AND semantics — all listed keys must be absent.
 */
export type AbsentDimension = readonly string[];
/**
 * Parse the `absent` field: a list of parameter key names that must be absent.
 */
export declare function parseAbsentDimension(raw: unknown, at: string): AbsentDimension;
/**
 * Parsed `agents` dimension: identity candidates the rule applies to.
 * Supported values: `main`, `subagent`, `preset:<name>`.
 * Empty = this rule does not constrain on agent identity.
 */
export type AgentsDimension = readonly string[];
/**
 * Parse the `agents` field: a list of agent identity patterns.
 */
export declare function parseAgentsDimension(raw: unknown, at: string): AgentsDimension;
/**
 * Parsed `when` dimension: environment and platform conditions.
 * All conditions are AND — every listed condition must be satisfied.
 */
export interface WhenDimension {
    /** Required environment variable values. Key = env var name, value = allowed values (OR). */
    readonly env?: Readonly<Record<string, readonly string[]>>;
    /** Required platform(s). Values are Node.js `process.platform` strings. */
    readonly platform?: readonly string[];
    /** Required Node.js version range (semver-like). Reserved for future use. */
    readonly nodeVersion?: string;
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
export declare function parseWhenDimension(raw: unknown, at: string): WhenDimension | undefined;
/**
 * Parsed `argv` dimension: extra argv patterns not covered by command/args.
 * Currently supports `pipeline` patterns (pipe chains like `curl|sh`).
 */
export interface ArgvDimension {
    /** Pipeline patterns: match the full command pipeline string. */
    readonly pipeline?: readonly string[];
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
export declare function parseArgvDimension(raw: unknown, at: string): ArgvDimension | undefined;
/**
 * Parsed `network` dimension: domain / IP / port / scheme matching.
 * All sub-dimensions are AND — every listed sub-dimension must match.
 * Within a sub-dimension, entries are OR.
 */
export interface NetworkDimension {
    /** Domain patterns (glob-capable, e.g. `*.internal.corp`). */
    readonly domains?: readonly string[];
    /** IP/CIDR patterns (e.g. `10.0.0.0/8`, `192.168.1.1`). */
    readonly ips?: readonly string[];
    /** Port patterns (e.g. `443`, `8000-9000`). */
    readonly ports?: readonly string[];
    /** URL schemes (e.g. `https`, `http`). */
    readonly schemes?: readonly string[];
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
export declare function parseNetworkDimension(raw: unknown, at: string): NetworkDimension | undefined;
/**
 * Parsed `branch` dimension: git branch / remote / shared-branch matching.
 *
 * Sub-dimensions are AND — every present sub-dimension must match. Within a
 * sub-dimension, entries are OR.
 *
 * The candidates come from `dispatchCommand` (see `src/command-dispatcher.ts`)
 * over each decomposed simple command, so `refspec` forms (`HEAD:main`) are
 * already split and a remote name is never mistaken for a branch name.
 *
 * `shared` is **static**: it reflects the parser's protected-branch rule
 * (`PROTECTED_BRANCHES` in `src/parsers/git.ts`: main / master / production /
 * release / stable). It does **not** run git to discover whether a branch is
 * genuinely shared — that would put a subprocess on the decision path.
 */
export interface BranchDimension {
    /** Branch-name globs (e.g. `main`, `release*`). */
    readonly target?: readonly string[];
    /** Remote-name globs (e.g. `origin`, `upstream`). */
    readonly remote?: readonly string[];
    /** Require the command to target a protected branch. */
    readonly shared?: boolean;
}
/**
 * Parse the `branch` field: branch / remote / protected-branch matching.
 *
 * Format:
 * ```yaml
 * branch:
 *   target: [main, "release*"]
 *   remote: [origin]
 *   shared: true
 * ```
 */
export declare function parseBranchDimension(raw: unknown, at: string): BranchDimension | undefined;
