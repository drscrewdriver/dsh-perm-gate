/**
 * Risk-category verdict protocol for dsh-perm-gate's `llmAssist` strategy.
 *
 * Layers on the same custom OpenAI-compatible endpoint as `classifier.ts` and
 * asks the LLM to grade ONE tool call as either safe or risky with a category:
 *
 *   safe                      → the gate may auto-allow the ask
 *   risky:<hard category>     → deletion / credential / remote / system / bulk —
 *                               auto-deny: the operation is clearly dangerous,
 *                               no popup or human review needed
 *   risky:neutral             → no hard-risk signal but not clearly safe; the
 *                               verdict-learning path may auto-allow after
 *                               enough human confirmations
 *   unresolved                → transport failure, timeout, or a protocol
 *                               violation — the caller must keep the ask
 *                               (fail-closed) and must NOT learn from it
 *
 * The protocol, prompt wording, and parser are this repo's own; the design
 * (hard categories vs. a neutral confirm-count zone) follows the approach
 * demonstrated by dsh-approval-gate.
 */
import { chatCompletion, withLlmRetry, type ClassifierConfig } from './classifier.js'

/** Risk categories the LLM may report for a risky verdict. */
export type RiskCategory = 'deletion' | 'credential' | 'remote' | 'system' | 'bulk' | 'neutral'

/**
 * Categories that always route to the human seam regardless of learning state
 * or any later LLM opinion. Order-stable for prompts and event payloads.
 */
export const HARD_RISK_CATEGORIES: readonly RiskCategory[] = ['deletion', 'credential', 'remote', 'system', 'bulk']

const RISK_CATEGORIES: readonly RiskCategory[] = [...HARD_RISK_CATEGORIES, 'neutral']

/** Whether a category must never be auto-allowed. Unknown categories are hard too (fail-closed). */
export function isHardRisk(category: string): boolean {
  if ((HARD_RISK_CATEGORIES as readonly string[]).includes(category)) return true
  // An unknown category means the verdict is unreliable — treat it as hard.
  return !(RISK_CATEGORIES as readonly string[]).includes(category)
}

/**
 * A graded verdict for one tool call. `unresolved` covers every failure mode —
 * the caller must treat it exactly like "no classifier": keep the ask, learn nothing.
 */
export type RiskVerdict =
  | { kind: 'safe'; reason?: string }
  | { kind: 'risky'; category: RiskCategory; reason?: string }
  | { kind: 'unresolved' }

/** The bounded call graded by {@link classifyRisk}. */
export interface RiskRequest {
  readonly tool: string
  readonly args: unknown
  /** The deterministic reason the call reached the LLM-assist seam. */
  readonly reason: string
}

const RISK_SYSTEM_PROMPT = [
  'You are the risk grader inside a permission gate for a coding agent.',
  'You receive one tool call (tool name, arguments, and the deterministic reason it needs human-grade review).',
  'Grade whether executing it could cause irreversible damage or touch sensitive resources.',
  '',
  'Reply with ONLY one JSON object and nothing else:',
  '  {"risk":"safe","reason":"short"}',
  '  {"risk":"risky","category":"<category>","reason":"short"}',
  '',
  'category must be exactly one of:',
  '  deletion  — deletes or overwrites data that cannot be regenerated (IMPORTANT: see exclusion rules below)',
  '  credential — creates/modifies/exposes credentials, keys, tokens, auth config',
  '  remote    — WRITES to or MODIFIES remote systems (git push, git deploy, kubectl apply, terraform apply, production database writes, messaging, billing, publishing). Must have a write/modify/delete effect on the remote side.',
  '  system    — system-level paths or configuration (/etc, /usr, boot items), shutdown/reboot',
  '  bulk      — mass overwrite of many files, formatting, dd-style irreversible writes',
  '  neutral   — none of the above clearly applies (ordinary edits outside the obvious scope, or you are unsure but see no hard-risk sign)',
  '',
  'Rules:',
  '- safe is only for reversible, in-scope operations that touch no sensitive resource.',
  '- When unsure between safe and neutral, answer neutral; never guess safe.',
  '- Judge the operation content, not merely its location.',
  '',
  'DELETION exclusion rules (these override the deletion category):',
  '- Cleanup of temporary files, build outputs, or failed clone directories is SAFE — even if using rm/rmdir/Remove-Item. Look for temp paths: paths containing "temp", "tmp", "test-clone", "node_modules", ".cache", "dist", "build", or numbered/timestamped directories.',
  '- Removal of session-local artifacts (files the session itself created) is SAFE.',
  '- rm -rf on node_modules, .next, __pycache__, .pytest_cache, .git, dist, build is SAFE — these are always regenerable.',
  '- Deletion inside the workspace that targets non-existent or already-empty paths is SAFE (idempotent cleanup).',
  '- Only flag as deletion when the target is: (a) user data with no backup, (b) configuration files, (c) database records, (d) files outside the workspace that were not created by this session, or (e) a destructive rm -rf on a directory containing unique, irreplaceable content.',
  '',
  'READ-ONLY remote operations are safe: git fetch, git pull, git clone, git log, git diff, git status, git show, npm install (read-only), pip install (read-only), apt-get update, curl/wget (read, no write flag).',
  '- Operations that only READ from remote systems without modifying them are safe, even if they involve network traffic.',
  '- Only flag as remote when the operation WRITES, DEPLOYS, PUSHES, or DELETES on the remote side.',
].join('\n')

/** Parse one assistant message into a verdict; anything off-protocol → undefined (caller retries/fails). */
export function parseRiskVerdict(content: string): RiskVerdict | undefined {
  const trimmed = content.trim()
  try {
    const parsed = JSON.parse(trimmed) as { risk?: unknown; category?: unknown; reason?: unknown }
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined
    if (parsed.risk === 'safe') return { kind: 'safe', reason }
    if (parsed.risk === 'risky') {
      const category = typeof parsed.category === 'string' ? parsed.category.toLowerCase() : ''
      if ((RISK_CATEGORIES as readonly string[]).includes(category)) {
        return { kind: 'risky', category: category as RiskCategory, reason }
      }
      return undefined // off-protocol category: unreliable, do not decide on it
    }
    return undefined
  } catch {
    // Lenient fallback for models that ignore response_format: bare keyword scan.
    // A bare "risky" carries no trustworthy category, so it stays unresolved —
    // the caller keeps the human ask rather than guessing a category.
    if (/\brisky\b/i.test(trimmed)) return undefined
    if (/\bsafe\b/i.test(trimmed)) return { kind: 'safe' }
    return undefined
  }
}

/**
 * Grade one tool call with the configured LLM. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export async function classifyRisk(
  cfg: ClassifierConfig,
  req: RiskRequest,
  nowFetch: typeof fetch = fetch,
): Promise<RiskVerdict> {
  return classifyRiskWith((system, user) => chatCompletion(cfg, system, user, nowFetch), req)
}

/** A transport-agnostic completion: system+user prompt → assistant text. */
export type RiskSend = (system: string, user: string) => Promise<{ ok: true; content: string } | { ok: false }>

/** The bounded user prompt for one risk grading (shared by every transport). */
export function riskUserText(req: RiskRequest): string {
  // Enrich the prompt with full path context so the LLM can judge
  // whether a deletion targets a temporary/build artifact vs real data.
  const raw = req.args ?? {}
  const argsRecord = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const enriched: Record<string, unknown> = { ...argsRecord }
  // Surface the working directory if present (helps LLM see temp paths).
  if (typeof enriched.cwd === 'string' && enriched.cwd !== '') {
    enriched.__cwd = enriched.cwd
  }
  if (typeof enriched.workdir === 'string' && enriched.workdir !== '') {
    enriched.__cwd = enriched.workdir
  }
  return JSON.stringify({
    tool: req.tool,
    args: enriched,
    reason: req.reason,
    instruction: 'Reply strictly as one JSON object: {"risk":"safe"} or {"risk":"risky","category":"..."} plus a short "reason".',
  })
}

/**
 * Grade one tool call through any transport. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export async function classifyRiskWith(send: RiskSend, req: RiskRequest): Promise<RiskVerdict> {
  const user = riskUserText(req)
  const content = await withLlmRetry(() => send(RISK_SYSTEM_PROMPT, user).then((r) => (r.ok ? r.content : undefined)))
  if (content === undefined) return { kind: 'unresolved' }
  return parseRiskVerdict(content) ?? { kind: 'unresolved' }
}
