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
import type { CompiledRuleEntry, CompiledRuleset } from './rule.js'
import { compileCidr, compilePortSpec, compileDomainPattern } from './compiler.js'

// ─── Types ─────────────────────────────────────────────────────────────────

/** The three network policy modes. */
export type NetworkMode = 'deny-all' | 'whitelist' | 'allow-all'

/** Closed mode list for runtime normalization. */
export const NETWORK_MODES: readonly NetworkMode[] = ['deny-all', 'whitelist', 'allow-all']

/** The official file-sandbox presets the mode maps onto. */
export type SandboxModeName = 'read-only' | 'workspace-write' | 'danger-full-access'

/** How a whitelist-mode unlisted target is handled. */
export type UnlistedAction = 'ask' | 'deny'

/** A parsed network target for one connection/URL. */
export interface NetworkTarget {
  readonly host: string
  readonly port?: number
  readonly scheme?: string
  /** Resolved IP addresses (populated after DNS lookup). */
  readonly ips: readonly string[]
}

/** One network decision: a rule hit or the mode-default fallback. */
export interface NetworkDecision {
  readonly action: 'allow' | 'deny' | 'ask'
  /** Whether a rule (true) or the mode default (false) produced the decision. */
  readonly matched: boolean
  readonly mode: NetworkMode
  readonly ruleIndex?: number
  readonly rule?: CompiledRuleEntry
  /** Source file path for audit attribution. */
  readonly source?: string
}

/** Proxy-layer evaluation options. */
export interface NetworkDecisionOptions {
  readonly mode: NetworkMode
  readonly unlisted: UnlistedAction
  /** `allow` short-circuits loopback targets before rules; `policy` evaluates them normally. */
  readonly loopback: 'allow' | 'policy'
}

// ─── Mode mapping ──────────────────────────────────────────────────────────

/**
 * Map one official sandbox preset onto its network mode.
 * `read-only` → deny-all, `workspace-write` → whitelist,
 * `danger-full-access` → allow-all. Unknown → fallback.
 */
export function networkModeForSandbox(sandbox: string | undefined, fallback: NetworkMode): NetworkMode {
  switch (sandbox) {
    case 'read-only': return 'deny-all'
    case 'workspace-write': return 'whitelist'
    case 'danger-full-access': return 'allow-all'
    default: return fallback
  }
}

/** The default decision a mode yields for an unmatched target. */
export function defaultDecision(mode: NetworkMode, unlisted: UnlistedAction): NetworkDecision {
  switch (mode) {
    case 'deny-all':
      return { action: 'deny', matched: false, mode }
    case 'whitelist':
      return { action: unlisted, matched: false, mode }
    case 'allow-all':
      return { action: 'allow', matched: false, mode }
  }
}

// ─── Target matching ───────────────────────────────────────────────────────

/**
 * Evaluate the network policy for one target against a compiled ruleset.
 * First-match wins across deny → allow → ask partitions (deny-first).
 *
 * Proxy-layer tool attribution: shell subprocess connections carry
 * `bash`/`pwsh` identity; rules scoped to other tools never fire.
 * Agent identity is unknown at the proxy → agent-scoped rules fail-closed.
 */
export function decideNetworkTarget(
  ruleset: CompiledRuleset,
  target: NetworkTarget,
  options: NetworkDecisionOptions,
): NetworkDecision {
  if (options.loopback === 'allow' && isLoopbackTarget(target)) {
    return { action: 'allow', matched: false, mode: options.mode }
  }

  // Scan deny → allow → ask (deny-first).
  for (const partition of [ruleset.deny, ruleset.allow, ruleset.ask]) {
    for (const rule of partition) {
      if (!rule.enabled) continue
      if (rule.network === undefined) continue
      if (!matchToolsProxy(rule)) continue
      if (!targetMatchesNetwork(target, rule.network)) continue
      return {
        action: rule.action,
        matched: true,
        mode: options.mode,
        ruleIndex: rule.index,
        rule,
      }
    }
  }
  return defaultDecision(options.mode, options.unlisted)
}

/**
 * Tool-scope check for proxy traffic: shell subprocess connections carry
 * `bash`/`pwsh` identity. Rules scoped to other tools never fire at proxy.
 */
function matchToolsProxy(rule: CompiledRuleEntry): boolean {
  if (rule.tools.length === 0) return true
  // Match if any tool pattern matches 'bash' or 'pwsh'.
  return rule.tools.some((t) => t.re.test('bash') || t.re.test('pwsh'))
}

/**
 * Check if a network target matches a rule's network dimension.
 * All present sub-dimensions must match (AND); within a sub-dimension, entries are OR.
 */
function targetMatchesNetwork(target: NetworkTarget, network: { domains?: readonly string[]; ips?: readonly string[]; ports?: readonly string[]; schemes?: readonly string[] }): boolean {
  // domains
  if (network.domains !== undefined && network.domains.length > 0) {
    const matchers = network.domains.map((d) => compileDomainPattern(d))
    if (!matchers.some((m) => m.re.test(target.host))) return false
  }
  // ips
  if (network.ips !== undefined && network.ips.length > 0) {
    const allIps = [...target.ips]
    if (target.host !== undefined) allIps.push(target.host)
    const cidrs = network.ips.filter((s) => s.includes('/'))
    const literals = network.ips.filter((s) => !s.includes('/'))
    const ipMatch = allIps.some((ip) =>
      literals.includes(ip) || cidrs.some((c) => {
        try { return compileCidr(c)(ip) } catch { return false }
      })
    )
    if (!ipMatch) return false
  }
  // ports
  if (network.ports !== undefined && network.ports.length > 0) {
    if (target.port === undefined) return false
    const matchers = network.ports.map((p) => {
      try { return compilePortSpec(p) } catch { return (_: number) => false }
    })
    if (!matchers.some((m) => m(target.port!))) return false
  }
  // schemes
  if (network.schemes !== undefined && network.schemes.length > 0) {
    if (target.scheme === undefined) return false
    if (!network.schemes.includes(target.scheme)) return false
  }
  return true
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Whether a target addresses the loopback range. */
export function isLoopbackTarget(target: NetworkTarget): boolean {
  const host = target.host
  if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (parts === null) return false
  return parts.slice(1).every((o) => Number(o) <= 255) && parts[1] === '127'
}

/** Whether a string is an IP literal (v4 or v6). */
export function isIpLiteral(host: string): boolean {
  return /^[\d.:a-fA-F]+$/.test(host) && (host.includes(':') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host))
}

/**
 * Parse a URL string into a NetworkTarget.
 * Returns undefined for malformed URLs.
 */
export function parseUrlTarget(url: string): NetworkTarget | undefined {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/\.+$/, '')
    if (host.length === 0) return undefined
    const port = u.port !== '' ? Number(u.port) : (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : undefined)
    return {
      host,
      port: port !== undefined && Number.isFinite(port) ? port : undefined,
      scheme: u.protocol.replace(/:$/, ''),
      ips: isIpLiteral(host) ? [host] : [],
    }
  } catch {
    return undefined
  }
}

/**
 * The short structured message a blocked proxy connection receives.
 * `ask` at proxy layer degrades to block + audit (no session context).
 */
export function blockMessage(decision: NetworkDecision): string {
  const reason = decision.rule?.reason ?? ''
  if (decision.matched) {
    const rulePart = decision.ruleIndex !== undefined ? ` by rule ${decision.ruleIndex + 1}` : ''
    if (decision.action === 'ask') {
      return `[network: blocked pending approval${rulePart}] ${reason}\n(subprocess connections cannot ride the interactive approval seam — ask your user or add an allow rule for this target)`
    }
    return `[network: denied${rulePart}] ${reason}`
  }
  switch (decision.mode) {
    case 'deny-all':
      return '[network: denied] network mode deny-all (read-only sandbox preset): only whitelisted targets are reachable'
    case 'whitelist':
      return decision.action === 'ask'
        ? '[network: blocked pending approval] whitelist mode: the target is not matched by an allow rule'
        : '[network: denied] whitelist mode: the target is not matched by an allow rule'
    case 'allow-all':
      return '[network: denied]'
  }
}
