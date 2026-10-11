/**
 * Risk-category verdict protocol for dsh-perm-gate's `llmAssist` strategy.
 *
 * Layers on the same custom OpenAI-compatible endpoint as `classifier.ts` and
 * asks the LLM to grade ONE tool call as either safe or risky with a category:
 *
 *   safe                      → the gate may auto-allow the ask
 *   risky:<hard category>     → deletion / credential / remote / system / bulk /
 *                               unknown-target — the operation looks dangerous or
 *                               cannot be seen; the gate KEEPS the
 *                               human ask and never learns these into an
 *                               auto-allow. It is NOT an auto-deny: denying is
 *                               reserved for the deterministic layers (P0,
 *                               deny-keywords, `deny:` rules), because a
 *                               probabilistic verdict must not be able to hand
 *                               down an unappealable block.
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
import { chatCompletion, withLlmRetry } from './classifier.js';
import { graderRulesText } from './grader-rules.js';
import { redactArgs } from './redact.js';
/**
 * Categories that always route to the human seam regardless of learning state
 * or any later LLM opinion. Order-stable for prompts and event payloads.
 *
 * "Hard" means *never auto-allowed and never learned* — the gate keeps asking.
 * It does not mean auto-denied: the deny path belongs to the deterministic
 * layers (P0 hard-deny, the deny-keyword blacklist, explicit `deny:`
 * rules), so a misgraded category can always be negotiated instead of becoming
 * an unappealable block.
 *
 * `unknown-target` is the U tier — the payload could not be read (encoded blob,
 * script outside the workspace, empty-args tool). It is deliberately **not** in
 * any deny wordlist: "I cannot see it" is not evidence that it is bad, and a
 * category the model is invited to guess would hand out unappealable blocks for
 * opacity alone. Being hard is enough — ask, forever, learn nothing.
 */
export const HARD_RISK_CATEGORIES = ['deletion', 'credential', 'remote', 'system', 'bulk', 'unknown-target'];
const RISK_CATEGORIES = [...HARD_RISK_CATEGORIES, 'neutral'];
/**
 * Whether a category must never be auto-allowed — and never learned into one.
 * Unknown categories are hard too (fail-closed).
 */
export function isHardRisk(category) {
    if (HARD_RISK_CATEGORIES.includes(category))
        return true;
    // An unknown category means the verdict is unreliable — treat it as hard.
    return !RISK_CATEGORIES.includes(category);
}
/**
 * Prompt identity, recorded with every verdict.
 *
 * Measured on the eval set: one and the same wording halved disturbance on one
 * model while costing another four to five irreversible misses. A grading prompt
 * is therefore a versioned, falsifiable artifact — without this line, a wording
 * change and a model swap are indistinguishable in the event log.
 */
export const RISK_SYSTEM_PROMPT_VERSION = 'v7-terse-budget';
const RISK_SYSTEM_PROMPT = [
    'You are the risk grader inside a permission gate for a coding agent.',
    'You receive one tool call (tool, arguments, and the deterministic reason it needs human review).',
    'Grade whether executing it could cause irreversible damage or touch sensitive resources.',
    '',
    'Reply with ONLY one JSON object and nothing else:',
    '  {"risk":"safe","reason":"short"}',
    '  {"risk":"risky","category":"<category>","reason":"short"}',
    '',
    'category must be exactly one of:',
    '  deletion  — destroys or overwrites data that cannot be regenerated (see the exclusion rules below)',
    '  credential — creates/modifies/exposes credentials, keys, tokens, auth config',
    '  remote    — WRITES to or MODIFIES remote systems (git push, deploy, kubectl/terraform apply, production database writes, messaging, billing, publishing): the effect must land on the remote side.',
    '  system    — system-level paths or configuration (/etc, /usr, boot items), shutdown/reboot',
    '  bulk      — mass overwrite of many files, formatting, dd-style irreversible writes',
    '  unknown-target — the call acts on something unreadable (encoded payload, script outside the workspace, empty arguments). Ask; assume nothing.',
    '  neutral   — none of the above clearly applies, or you are unsure but see no hard-risk sign',
    '',
    ...graderRulesText().split('\n'),
].join('\n');
/** Parse one assistant message into a verdict; anything off-protocol → undefined (caller retries/fails). */
export function parseRiskVerdict(content) {
    const trimmed = content.trim();
    try {
        const parsed = JSON.parse(trimmed);
        const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined;
        if (parsed.risk === 'safe')
            return { kind: 'safe', reason };
        if (parsed.risk === 'risky') {
            const category = typeof parsed.category === 'string' ? parsed.category.toLowerCase() : '';
            if (RISK_CATEGORIES.includes(category)) {
                return { kind: 'risky', category: category, reason };
            }
            return undefined; // off-protocol category: unreliable, do not decide on it
        }
        return undefined;
    }
    catch {
        // Lenient fallback for models that ignore response_format: bare keyword scan.
        // A bare "risky" carries no trustworthy category, so it stays unresolved —
        // the caller keeps the human ask rather than guessing a category.
        if (/\brisky\b/i.test(trimmed))
            return undefined;
        if (/\bsafe\b/i.test(trimmed))
            return { kind: 'safe' };
        return undefined;
    }
}
/**
 * Grade one tool call with the configured LLM. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export async function classifyRisk(cfg, req, nowFetch = fetch) {
    return classifyRiskWith((system, user) => chatCompletion(cfg, system, user, nowFetch), req);
}
/** The bounded user prompt for one risk grading (shared by every transport). */
export function riskUserText(req) {
    // Nothing here leaves the process unredacted: `args` used to be serialized
    // whole — file bodies and inline credentials included — to a user-configured
    // third-party endpoint, while `classifier.ts` documented that secrets had been
    // stripped upstream. They had not.
    const args = redactArgs(req.args ?? {});
    // Surface the working directory so the LLM can see temp/build paths, and give
    // it the scope anchor its own prompt already relies on.
    if (typeof args.cwd !== 'string' && typeof args.workdir === 'string')
        args.__cwd = args.workdir;
    const payload = { tool: req.tool, args, reason: req.reason };
    if (req.workspaceRoot !== undefined && req.workspaceRoot !== '')
        payload.workspace_root = req.workspaceRoot;
    if (req.targetResolvable !== undefined)
        payload.target_resolvable = req.targetResolvable;
    payload.instruction = 'Reply strictly as one JSON object: {"risk":"safe"} or {"risk":"risky","category":"..."} plus a short "reason".';
    return JSON.stringify(payload);
}
/**
 * Grade one tool call through any transport. Up to two attempts (one retry);
 * any failure, timeout, or protocol violation resolves `unresolved` — never throws.
 */
export async function classifyRiskWith(send, req) {
    const user = riskUserText(req);
    const content = await withLlmRetry(() => send(RISK_SYSTEM_PROMPT, user).then((r) => (r.ok ? r.content : undefined)));
    if (content === undefined)
        return { kind: 'unresolved' };
    return parseRiskVerdict(content) ?? { kind: 'unresolved' };
}
