/**
 * PermGateRuntime: the host-facing gate. Holds a compiled ruleset, a
 * session-scoped grant registry, and an audit mirror. `apply` (index.ts) wires
 * it onto the `tools/pre-execute` waterfall.
 *
 * It is constructed either by the cordis `apply` (from config) or directly in
 * tests with a plain ruleset, so the whole decision path is exercised without a
 * live harness.
 */
import { readFileSync } from 'node:fs'
import { makeEntry, MemoryAuditMirror, type AuditEntry, type AuditOutcome, type DecisionSource } from './audit.js'
import { resolvePermissiveStrategies, type PermGateConfig, type PermissiveStrategies } from './config.js'
import { classifyWithLLM, type ClassifierConfig, type ClassifyRequest, type ClassifyVerdict } from './classifier.js'
import { appendAllowCommand, listAllowCommands, replaceAllowCommands } from './allowlist.js'
import { decide, type FinalDecision, type GrantResolver } from './engine.js'
import { decideRules, type ToolCallContext } from './evaluate.js'
import { canonicalizeCall, GrantRegistry } from './grant.js'
import { ArtifactRegistry } from './path.js'
import { compileDocument, documentHash, parsePermissionsDocument, type CompiledRuleset } from './rule.js'

export interface PreToolDecisionLike {
  kind: 'deny' | 'ask'
  reason: string
}

export interface ToolExecutionLike {
  readonly name: string
  readonly arguments: Record<string, unknown>
  readonly commandText?: string
  readonly cwd?: string
  readonly sessionId?: string
  readonly parentAuthorized?: boolean
  readonly signal?: AbortSignal
}

export interface PermGateRuntimeOptions extends PermGateConfig {
  readonly onRulesChanged?: (ruleset: CompiledRuleset) => void
  readonly now?: () => number
  /**
   * Optional llm-assist classifier used by the Permissive `llmAssist` strategy.
   * Returns 'allow'/'deny' to decide, 'ask' (or omitting this hook) to fall
   * back to the human seam — always fail-closed on uncertainty/failure.
   */
  readonly classify?: (exec: ToolExecutionLike) => CallDecision
  /**
   * Optional live source of the Permissive tier (e.g. a DSH settings namespace).
   * When unset, the static `permissive` / `permissiveStrategies` options apply.
   */
  readonly readPermissive?: () => PermissiveState
  /**
   * Optional live source of the llmAssist classifier setup. When unset, the
   * static `classifierEndpoint` / `classifierModel` / `classifierApiKey`
   * options apply.
   */
  readonly readClassifyConfig?: () => ClassifierConfig
}

export type CallDecision = 'allow' | 'deny' | 'ask'

/** The effective Permissive tier state read per tool call. */
export interface PermissiveState {
  readonly enabled: boolean
  readonly strategies: PermissiveStrategies
}

export class PermGateRuntime {
  private ruleset: CompiledRuleset
  private readonly grants: GrantRegistry
  private readonly artifacts = new ArtifactRegistry()
  private readonly audit = new MemoryAuditMirror()
  private readonly cache = new Map<string, CompiledRuleset>() // hash -> compiled
  private readonly permissiveEnabled: boolean
  private readonly strategies: PermissiveStrategies
  private readonly classify?: (exec: ToolExecutionLike) => CallDecision

  constructor(private readonly options: PermGateRuntimeOptions = {}) {
    this.grants = new GrantRegistry('__session__', options.now)
    this.permissiveEnabled = options.permissive ?? false
    this.strategies = resolvePermissiveStrategies(options.permissiveStrategies)
    this.classify = options.classify
    this.ruleset = this.compileInline(options)
  }

  private compileInline(options: PermGateRuntimeOptions): CompiledRuleset {
    const text = options.rulesFile !== undefined ? readFileSafe(options.rulesFile) : ''
    const empty: CompiledRuleset = {
      defaultAction: options.defaultAction ?? 'ask',
      deny: [], allow: [], ask: [],
      caseInsensitivePaths: options.caseInsensitivePaths ?? true,
    }
    if (text === '') return empty
    const hash = documentHash(text)
    const hit = this.cache.get(hash)
    if (hit !== undefined) return hit
    const doc = parsePermissionsDocument(text)
    const compiled = compileDocument(doc, {
      maxGlobStars: 2,
      caseInsensitivePaths: options.caseInsensitivePaths ?? true,
    })
    this.cache.set(hash, compiled)
    return compiled
  }

  /** Reload rules from disk (HMR); on failure keeps the previous rules. */
  reload(): boolean {
    try {
      const next = this.compileInline(this.options)
      this.ruleset = next
      this.options.onRulesChanged?.(next)
      return true
    } catch {
      return false // keep previous rules; never crash the host
    }
  }

  get auditEntries(): readonly AuditEntry[] {
    return this.audit.entries
  }

  grantCount(): number {
    return this.grants.size
  }

  get defaultAction(): string {
    return this.ruleset.defaultAction
  }

  ruleCount(): number {
    return this.ruleset.deny.length + this.ruleset.allow.length + this.ruleset.ask.length
  }

  /** Whether the independent Permissive tier is active (single front switch). */
  get permissive(): boolean {
    return this.permissiveEnabled
  }

  /** Backend approval strategy booleans active when Permissive is on. */
  get permissiveStrategies(): Readonly<PermissiveStrategies> {
    return this.strategies
  }

  artifactCount(): number {
    return this.artifacts.snapshot()
  }

  private ctxFor(exec: ToolExecutionLike): ToolCallContext {
    return {
      tool: exec.name,
      args: exec.arguments ?? {},
      commandText:
        exec.commandText ?? (typeof exec.arguments.command === 'string' ? exec.arguments.command : undefined),
      cwd: exec.cwd ?? process.cwd(),
      caseInsensitive: this.options.caseInsensitivePaths ?? true,
      dshHome: this.options.dshHome,
    }
  }

  /**
   * Decide one tool call. Returns a decision to veto (`deny`/`ask`) or
   * undefined to delegate via `next()` (allow / passthrough). Always records an
   * audit entry. Grant consumption happens inside {@link decide}; a call that
   * targets a different fingerprint than any minted grant no-ops.
   */
  decideExecution(exec: ToolExecutionLike): PreToolDecisionLike | undefined {
    const ctx = this.ctxFor(exec)
    const callId = randomId()
    const grantResolver: GrantResolver = (tool, args) => {
      if (exec.parentAuthorized === false) return 'no-match'
      return this.grants.decide(tool, args)
    }

    const raw = decide(ctx, { decide: (c) => decideRules(this.ruleset, c) }, grantResolver)
    const permissive = this.options.readPermissive
      ? this.options.readPermissive()
      : { enabled: this.permissiveEnabled, strategies: this.strategies }
    const decision = this.applyPermissive(raw, exec, permissive)

    let outcome: AuditOutcome
    let source: DecisionSource
    switch (decision.stage) {
      case 'hard-deny':
        outcome = 'deny'
        source = 'hard-deny'
        break
      case 'grant':
        outcome = 'allow'
        source = 'grant'
        break
      case 'rule':
        outcome = decision.action === 'ask' ? 'ask' : decision.action
        source = 'rule'
        break
      case 'classifier':
        outcome = decision.action
        source = 'classifier'
        break
      case 'default':
      case 'ask':
        outcome = decision.action
        source = decision.reason.startsWith('permissive') ? 'permissive' : 'default'
        break
    }
    this.audit.append(makeEntry({ callId, tool: exec.name, outcome, source, reason: decision.reason, at: Date.now() }))

    if (decision.action === 'deny') return { kind: 'deny', reason: decision.reason }
    if (decision.action === 'ask') return { kind: 'ask', reason: decision.reason }
    return undefined
  }

  /**
   * Apply the Permissive tier to a raw decision. Hard-deny and minted-grant
   * outcomes are never touched (fail-closed). Strategies compose: `alwaysConfirm`
   * escalates a rule-allow to `ask`, then `llmAssist` may auto-decide the ask
   * (falling back to the human seam on 'ask'/no classifier). `trustAutoAllow` is
   * the baseline middle-tier auto-allow and needs no modulation here.
   */
  private applyPermissive(raw: FinalDecision, exec: ToolExecutionLike, permissive: PermissiveState): FinalDecision {
    if (!permissive.enabled) return raw
    const { strategies: str } = permissive
    let d = raw
    if (str.alwaysConfirm && d.action === 'allow' && d.stage === 'rule') {
      d = { action: 'ask', reason: 'permissive always-confirm escalated rule-allow to ask', stage: 'default', ruleIndex: d.ruleIndex }
    }
    if (str.llmAssist && d.action === 'ask') {
      const c = this.classify ? this.classify(exec) : 'ask'
      if (c === 'allow') d = { action: 'allow', reason: 'permissive llm-assist allowed', stage: 'classifier', ruleIndex: undefined }
      else if (c === 'deny') d = { action: 'deny', reason: 'permissive llm-assist denied', stage: 'classifier', ruleIndex: undefined }
      // 'ask' (or no classifier) falls back to the human seam — fail-closed.
    }
    return d
  }

  /** Mint a precise session grant bound to a canonical call fingerprint. */
  grant(exec: ToolExecutionLike, maxUses: number, ttlMs: number): void {
    const args = exec.arguments ?? {}
    this.grants.mint({
      tool: exec.name,
      fingerprint: canonicalizeCall(exec.name, args),
      decidedBy: 'human',
      parentAuthorized: exec.parentAuthorized !== false,
      ttlMs,
      maxUses,
    })
  }

  /**
   * Grant "repeat this call for the current session" (the always-confirm panel's
   * first extended allow button): mint a bounded session grant for the exact
   * call so an identical re-run this session passes without asking again.
   */
  approveRepeat(exec: ToolExecutionLike, maxUses = this.options.grantMaxUses ?? 3, ttlMs = this.options.grantTtlMs ?? 5 * 60_000): void {
    this.grant(exec, maxUses, ttlMs)
  }

  /**
   * Grant "allow every occurrence of this command" (the always-confirm panel's
   * second extended allow button): persist the command into the rules file's
   * `allow` whitelist and reload. Returns the reload result.
   */
  approveAllowEverywhere(commandWord: string, reason = 'permissive allow-everywhere'): boolean {
    if (!this.options.rulesFile) return false
    if (!appendAllowCommand(this.options.rulesFile, commandWord, reason)) return false
    return this.reload()
  }

  /** Read-only view of the current allow-list command patterns (whitelist). */
  allowlist(): readonly string[] {
    if (!this.options.rulesFile) return []
    return listAllowCommands(this.options.rulesFile)
  }

  /**
   * Replace the whitelist with exactly the given command patterns and reload.
   * Returns the reload result (false when no rulesFile or the write failed).
   */
  setAllowlist(patterns: readonly string[]): boolean {
    if (!this.options.rulesFile) return false
    if (!replaceAllowCommands(this.options.rulesFile, patterns)) return false
    return this.reload()
  }

  /**
   * Run the configured LLM-assist classifier over one call. Returns `ask` when
   * the classifier is not configured or fails (fail-closed to the human seam).
   */
  async classifyAsync(call: { tool: string; args: Record<string, unknown>; reason: string }): Promise<ClassifyVerdict> {
    const req: ClassifyRequest = { tool: call.tool, args: call.args ?? {}, reason: call.reason }
    const cfg = this.options.readClassifyConfig
      ? this.options.readClassifyConfig()
      : {
          endpoint: this.options.classifierEndpoint,
          model: this.options.classifierModel,
          apiKey: this.options.classifierApiKey,
        }
    return classifyWithLLM(cfg, req)
  }
}

function readFileSafe(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}