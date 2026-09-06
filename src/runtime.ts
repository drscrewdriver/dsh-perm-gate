/**
 * PermGateRuntime: the host-facing gate. Holds a compiled ruleset, a
 * session-scoped grant registry, an audit mirror, the verdict-learning store,
 * and the event feed. `apply` (index.ts) wires it onto the `tools/pre-execute`
 * waterfall and settles learning on `tools/result`.
 *
 * It is constructed either by the cordis `apply` (from config) or directly in
 * tests with a plain ruleset, so the whole decision path is exercised without a
 * live harness.
 */
import { readFileSync } from 'node:fs'
import { makeEntry, MemoryAuditMirror, type AuditEntry, type AuditOutcome, type DecisionSource } from './audit.js'
import { resolvePermissiveStrategies, type PermGateConfig, type PermissiveStrategies } from './config.js'
import type { ClassifierConfig } from './classifier.js'
import { appendAllowCommand, listAllowCommands, replaceAllowCommands } from './allowlist.js'
import { decide, type FinalDecision, type GrantResolver } from './engine.js'
import { EventLog } from './events.js'
import { decideRules, type ToolCallContext } from './evaluate.js'
import { canonicalizeCall, GrantRegistry } from './grant.js'
import { learnKey, operationFingerprint, RiskLearning } from './learning.js'
import { ArtifactRegistry } from './path.js'
import { classifyRisk, type RiskRequest, type RiskVerdict } from './risk.js'
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
   * Test/direct-use injection replacing the HTTP risk grader. Return
   * `unresolved` (or omit this hook) to stay on the human seam — fail-closed.
   */
  readonly riskHook?: (req: RiskRequest) => Promise<RiskVerdict>
  /** Optional live source of the Permissive tier (e.g. a DSH settings namespace). */
  readonly readPermissive?: () => PermissiveState
  /** Optional live source of the llmAssist classifier setup. */
  readonly readClassifyConfig?: () => ClassifierConfig
  /**
   * Optional live source of the verdict-learning state. When unset, the static
   * `riskLearning` / `riskThreshold` options apply.
   */
  readonly readRiskLearning?: () => RiskLearningState
  /** Persistence path for verdict learning; `undefined` keeps it in memory. */
  readonly learningFile?: string
  /** Persistence path for the decision-event feed; `undefined` disables it. */
  readonly eventsFile?: string
}

export type CallDecision = 'allow' | 'deny' | 'ask'

/** The effective Permissive tier state read per tool call. */
export interface PermissiveState {
  readonly enabled: boolean
  readonly strategies: PermissiveStrategies
}

/** The effective verdict-learning state read per decision. */
export interface RiskLearningState {
  readonly enabled: boolean
  readonly threshold: number
}

/** Upper bound on in-flight learning candidates awaiting `tools/result`. */
const PENDING_CAP = 100

export class PermGateRuntime {
  private ruleset: CompiledRuleset
  private readonly grants: GrantRegistry
  private readonly artifacts = new ArtifactRegistry()
  private readonly audit = new MemoryAuditMirror()
  private readonly cache = new Map<string, CompiledRuleset>() // hash -> compiled
  private readonly permissiveEnabled: boolean
  private readonly strategies: PermissiveStrategies
  private readonly learning: RiskLearning
  private readonly events?: EventLog
  /** Learning candidates awaiting human approval + execution (call fingerprint → candidate). */
  private readonly pending = new Map<string, { key: string; fp: string; ctx: string }>()

  constructor(private readonly options: PermGateRuntimeOptions = {}) {
    this.grants = new GrantRegistry('__session__', options.now)
    this.permissiveEnabled = options.permissive ?? false
    this.strategies = resolvePermissiveStrategies(options.permissiveStrategies)
    this.learning = new RiskLearning(options.learningFile, {
      threshold: () => this.liveRiskLearning().threshold,
      now: options.now,
    })
    this.events = options.eventsFile !== undefined ? new EventLog(options.eventsFile, options.now) : undefined
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

  /** The decision-event feed (undefined when event recording is disabled). */
  get eventLog(): EventLog | undefined {
    return this.events
  }

  /** Learning candidates currently awaiting settlement (diagnostics/tests). */
  pendingCount(): number {
    return this.pending.size
  }

  /** Deep read-only view of the learning state (diagnostics/tests). */
  learningSnapshot(): ReturnType<RiskLearning['snapshot']> {
    return this.learning.snapshot()
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

  private liveRiskLearning(): RiskLearningState {
    const read = this.options.readRiskLearning
    if (read !== undefined) return read()
    return { enabled: this.options.riskLearning ?? false, threshold: this.options.riskThreshold ?? 3 }
  }

  private livePermissive(): PermissiveState {
    return this.options.readPermissive !== undefined
      ? this.options.readPermissive()
      : { enabled: this.permissiveEnabled, strategies: this.strategies }
  }

  private recordEvent(exec: ToolExecutionLike, kind: 'auto' | 'ask' | 'deny' | 'learned', reason: string, risk?: string): void {
    this.events?.append({ sessionId: exec.sessionId, tool: exec.name, kind, risk, reason })
  }

  /**
   * Decide one tool call. Returns a decision to veto (`deny`/`ask`) or
   * undefined to delegate via `next()` (allow / passthrough). Always records an
   * audit entry and a decision event. Grant consumption happens inside
   * {@link decide}; a call that targets a different fingerprint than any minted
   * grant no-ops. An `ask` verdict may afterwards be refined by
   * {@link refineAsk} (LLM risk grading + verdict learning) before it reaches
   * the human seam.
   */
  decideExecution(exec: ToolExecutionLike): PreToolDecisionLike | undefined {
    const ctx = this.ctxFor(exec)
    const callId = randomId()
    const grantResolver: GrantResolver = (tool, args) => {
      if (exec.parentAuthorized === false) return 'no-match'
      return this.grants.decide(tool, args)
    }

    const raw = decide(ctx, { decide: (c) => decideRules(this.ruleset, c) }, grantResolver)
    const decision = this.applyPermissive(raw)

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
    this.recordEvent(exec, outcome === 'allow' ? 'auto' : outcome === 'deny' ? 'deny' : 'ask', decision.reason)

    if (decision.action === 'deny') return { kind: 'deny', reason: decision.reason }
    if (decision.action === 'ask') return { kind: 'ask', reason: decision.reason }
    return undefined
  }

  /**
   * Apply the Permissive tier to a raw decision. Hard-deny and minted-grant
   * outcomes are never touched (fail-closed). `alwaysConfirm` escalates a
   * rule-allow to `ask` — which the caller may then refine via
   * {@link refineAsk}. `trustAutoAllow` is the baseline middle-tier auto-allow
   * and needs no modulation here; llmAssist refinement lives in
   * {@link refineAsk} because it is asynchronous.
   */
  private applyPermissive(raw: FinalDecision): FinalDecision {
    const permissive = this.livePermissive()
    if (!permissive.enabled) return raw
    const { strategies: str } = permissive
    if (str.alwaysConfirm && raw.action === 'allow' && raw.stage === 'rule') {
      return { action: 'ask', reason: 'permissive always-confirm escalated rule-allow to ask', stage: 'default', ruleIndex: raw.ruleIndex }
    }
    return raw
  }

  /**
   * Refine an `ask` decision with the configured LLM risk grader
   * (`llmAssist` strategy). Returns `undefined` to allow (delegate via
   * `next()`), or the decision to keep vetoing with. Every uncertainty path —
   * strategy off, no classifier setup, transport failure, off-protocol output —
   * keeps the original ask (fail-closed). Only a `neutral` risk under an
   * enabled learning store registers a pending candidate; its confirmation is
   * settled by {@link settleExecution} when the call actually executes.
   */
  async refineAsk(exec: ToolExecutionLike, decision: PreToolDecisionLike): Promise<PreToolDecisionLike | undefined> {
    const permissive = this.livePermissive()
    if (!permissive.enabled || !permissive.strategies.llmAssist) return decision
    if (decision.kind !== 'ask') return decision

    // One live read of the classifier setup. Without a fully configured custom
    // endpoint the ask goes straight to the human seam (fail-closed) — unless a
    // risk hook is injected (tests / direct embedding replace the HTTP grader).
    const cfg = this.options.readClassifyConfig?.()
    if (this.options.riskHook === undefined
      && (cfg?.endpoint === undefined || cfg?.endpoint === '' || cfg?.model === undefined || cfg?.model === '')) {
      return decision
    }

    const req: RiskRequest = { tool: exec.name, args: exec.arguments ?? {}, reason: decision.reason }
    const risk = this.options.riskHook !== undefined
      ? await this.options.riskHook(req)
      : await classifyRisk(cfg ?? {}, req)

    if (risk.kind === 'safe') {
      const reason = `llm-assist risk: safe${risk.reason === undefined ? '' : ` (${risk.reason})`}`
      this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }))
      this.recordEvent(exec, 'auto', reason, 'safe')
      return undefined
    }

    if (risk.kind === 'risky') {
      if (risk.category !== 'neutral') {
        // Hard category (or an off-protocol one, graded hard): always the human
        // seam — never auto-allowed, never learned.
        const reason = `${decision.reason} [llm-assist risky:${risk.category} → human]`
        return { kind: 'ask', reason }
      }

      const learning = this.liveRiskLearning()
      const key = learnKey(exec.name, risk.category)
      const fp = operationFingerprint(exec.name, exec.arguments ?? {}, exec.commandText)
      if (learning.enabled && this.learning.shouldAutoAllow(key, fp)) {
        const reason = `llm-assist learned allow (${key}, ${fp})`
        this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }))
        this.recordEvent(exec, 'auto', reason, risk.category)
        return undefined
      }
      if (learning.enabled) {
        if (this.pending.size >= PENDING_CAP) {
          const oldest = this.pending.keys().next()
          if (!oldest.done) this.pending.delete(oldest.value)
        }
        this.pending.set(canonicalizeCall(exec.name, exec.arguments ?? {}), { key, fp, ctx: decision.reason })
      }
      return { kind: 'ask', reason: `${decision.reason} [llm-assist risky:neutral]` }
    }

    // unresolved: keep the ask, learn nothing.
    return decision
  }

  /**
   * Settle a learning candidate after the call finished (`tools/result`).
   * A result arriving for a registered pending candidate means the human
   * approved it and it actually executed — record one confirmation.
   */
  settleExecution(exec: ToolExecutionLike): void {
    const callKey = canonicalizeCall(exec.name, exec.arguments ?? {})
    const candidate = this.pending.get(callKey)
    if (candidate === undefined) return
    this.pending.delete(callKey)
    if (!this.liveRiskLearning().enabled) return
    this.learning.confirm(candidate.key, candidate.fp, candidate.ctx)
    this.recordEvent(exec, 'learned', `confirmed ${candidate.key} (${candidate.fp})`, 'neutral')
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
