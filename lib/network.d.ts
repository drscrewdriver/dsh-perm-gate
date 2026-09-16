/**
 * Pure network-policy orchestration for dsh-perm-gate.
 *
 * Shared by the `tools/pre-execute` gate (URL candidate static check) and
 * the local HTTP/CONNECT proxy (real subprocess traffic). Three policy modes
 * mapped onto DSH sandbox presets, first-match evaluation over the loaded
 * CompiledRuleset, and mode-default fallback decision. No I/O, no process
 * state — unit-testable and replayable.
 *
 * Network is a **parallel execution surface** (NOT a P-layer): it shares the
 * same CompiledRuleset / verdict vocabulary as the P0–P4 chain but does not
 * enter the prefix numbering. The proxy layer has no session context, so
 * `ask` decisions degrade to block + audit.
 */
import type { CompiledRuleEntry, CompiledRuleset } from './rule.js';
/** The three network policy modes. */
export type NetworkMode = 'deny-all' | 'whitelist' | 'allow-all';
/** Closed mode list for runtime normalization. */
export declare const NETWORK_MODES: readonly NetworkMode[];
/** The official file-sandbox presets the mode maps onto. */
export type SandboxModeName = 'read-only' | 'workspace-write' | 'danger-full-access';
/** How a whitelist-mode unlisted target is handled. */
export type UnlistedAction = 'ask' | 'deny';
/**
 * How traffic with **no in-flight shell attribution** is handled.
 *
 * - `'allow'` (default) — pass through unreviewed. Such traffic is not a shell
 *   subprocess: it is DSH's own client (a built-in network tool, the LLM
 *   transport). The proxy is a *subprocess* policy surface, so reviewing the
 *   host's own traffic risks the host blocking itself — a far worse failure
 *   than a missed block. This is what keeps the built-in network tools working.
 * - `'deny'` — review it like any other connection. Stricter, but if a
 *   built-in client ever honors the proxy environment (e.g. Node 24+ with
 *   `NODE_USE_ENV_PROXY=1`), DSH's own calls would be blocked and the harness
 *   would stop working.
 */
export type UnattributedAction = 'allow' | 'deny';
/** A parsed network target for one connection/URL. */
export interface NetworkTarget {
    readonly host: string;
    readonly port?: number;
    readonly scheme?: string;
    /** Resolved IP addresses (populated after DNS lookup). */
    readonly ips: readonly string[];
}
/** One network decision: a rule hit or the mode-default fallback. */
export interface NetworkDecision {
    readonly action: 'allow' | 'deny' | 'ask';
    /** Whether a rule (true) or the mode default (false) produced the decision. */
    readonly matched: boolean;
    readonly mode: NetworkMode;
    readonly ruleIndex?: number;
    readonly rule?: CompiledRuleEntry;
    /** Source file path for audit attribution. */
    readonly source?: string;
    /** True when the connection carried no shell attribution and was exempted. */
    readonly unattributed?: true;
}
/** Proxy-layer evaluation options. */
export interface NetworkDecisionOptions {
    readonly mode: NetworkMode;
    readonly unlisted: UnlistedAction;
    /** `allow` short-circuits loopback targets before rules; `policy` evaluates them normally. */
    readonly loopback: 'allow' | 'policy';
    /**
     * Whether an in-flight shell execution can be attributed to this
     * connection. `false` means the connection did not come from a subprocess
     * the gate is tracking. Omitted = treat as attributed (pre-change behavior).
     */
    readonly attributed?: boolean;
    /** Handling for unattributed traffic. Default `'allow'`. */
    readonly unattributed?: UnattributedAction;
}
/**
 * Map one official sandbox preset onto its network mode.
 * `read-only` → deny-all, `workspace-write` → whitelist,
 * `danger-full-access` → allow-all. Unknown → fallback.
 */
export declare function networkModeForSandbox(sandbox: string | undefined, fallback: NetworkMode): NetworkMode;
/** The default decision a mode yields for an unmatched target. */
export declare function defaultDecision(mode: NetworkMode, unlisted: UnlistedAction): NetworkDecision;
/**
 * Evaluate the network policy for one target against a compiled ruleset.
 * First-match wins across deny → allow → ask partitions (deny-first).
 *
 * Proxy-layer tool attribution: shell subprocess connections carry
 * `bash`/`pwsh` identity; rules scoped to other tools never fire.
 * Agent identity is unknown at the proxy → agent-scoped rules fail-closed.
 *
 * **Unattributed traffic is exempt by default.** A connection that cannot be
 * tied to an in-flight shell execution did not come from a subprocess the gate
 * manages — it is DSH's own client. Reviewing it would let the host block
 * itself, so it passes through (see {@link UnattributedAction}).
 */
export declare function decideNetworkTarget(ruleset: CompiledRuleset, target: NetworkTarget, options: NetworkDecisionOptions): NetworkDecision;
/** Whether a target addresses the loopback range. */
export declare function isLoopbackTarget(target: NetworkTarget): boolean;
/** Whether a string is an IP literal (v4 or v6). */
export declare function isIpLiteral(host: string): boolean;
/**
 * Parse a URL string into a NetworkTarget.
 * Returns undefined for malformed URLs.
 */
export declare function parseUrlTarget(url: string): NetworkTarget | undefined;
/**
 * The short structured message a blocked proxy connection receives.
 * `ask` at proxy layer degrades to block + audit (no session context).
 */
export declare function blockMessage(decision: NetworkDecision): string;
