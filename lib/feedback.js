/**
 * Deterministic review opinion for a blocked tool call — no LLM.
 *
 * Modeled on cc-safety-net's block message (`BLOCKED + Reason + Rule + intent
 * instruction`): when the gate refuses a call, the main LLM should get a structured
 * note telling it *why*, *which rule/layer* fired, and *what to do instead*, so it
 * stays on task instead of retrying a variant. perm-gate already has the raw
 * material — every preset entry tags its reason `[deny-rule:<id>]` and states a
 * safer alternative in prose, and the deterministic layers emit `[hard-deny]`/
 * `no rule matched` reasons — this module folds that into one classified opinion.
 *
 * Kept dependency-free and pure so it can be unit-tested and reused by both the
 * node decision path and any UI.
 */
/** Per-intent guidance to the agent, zh + en (the opinion is fed to the main LLM). */
export const INTENT_ADVICE = {
    hard_stop: {
        zh: '不得重试或绕过此操作；跳过它，继续任务的其余部分。',
        en: 'Do not retry or bypass this operation; skip it and continue the rest of the task.',
    },
    use_alternative: {
        zh: '不要重试被拦的形式；按上面给出的更安全替代继续。',
        en: 'Do not retry the blocked form; continue with the safer alternative named above.',
    },
    scope_down: {
        zh: '请把目标收窄到明确必需的路径再重试；确需大范围操作则上报用户。',
        en: 'Retry with a narrower, explicitly-needed target; escalate to the user if a broad operation is truly required.',
    },
    manual_only: {
        zh: '此命令无法静态核验，请交由用户手动执行。',
        en: 'This command cannot be verified statically; ask the user to run it manually.',
    },
    stop_and_explain: {
        zh: '不要暴力尝试变体；简化或重组命令后再试，或上报此拦截。',
        en: 'Do not brute-force variants; simplify or restate the command, or report this block.',
    },
};
/** Extract the `[deny-rule:<id>]` tag, a gate-danger tag (YOLO / degraded review), or P0. */
export function ruleIdOf(reason) {
    const tag = /\[(deny-rule:[a-z0-9._-]+|(?:yolo|rules-fallback)-danger:[a-z0-9._-]+)\]/.exec(reason);
    if (tag?.[1] !== undefined)
        return tag[1];
    if (/\[hard-deny\]|hard-deny/i.test(reason))
        return 'hard-deny';
    return undefined;
}
/**
 * Classify a block reason into an intent. Ordered from the most specific signal to
 * a conservative default; the phrasing of preset-rule reasons drives the match.
 */
export function intentForDeny(reason) {
    const r = reason.toLowerCase();
    // unverifiable / opaque target, or an act that needs the user's own consent → a human runs it
    if (/opaque|cannot be (read|verified|analyzed)|unanalyz|encoded|unread|unresolv|non-literal|dynamic|substitution-assembled|verify the variable|explicit consent|needs? (the )?user/.test(r))
        return 'manual_only';
    // explicit safer alternative offered → use it
    if (/\buse\b|\bprefer\b|\bsafer\b|\binstead\b|\bstash\b|dry-?run|\bfirst\b|\bedit specific\b|narrower/.test(r))
        return 'use_alternative';
    // broad/target-set concerns → narrow it. A P0 `[hard-deny]` or an unattended block is
    // never merely "too broad": those carry an irreversibility the agent may not trade
    // away, so the scope signal must not downgrade them into a retry-with-narrower note.
    if (/targets? (a )?(directory|many|mass|whole|entire)|broad|everything|scope|wildcard|\.\*|recurse/.test(r) && !/never|unrecoverable|irreversib|hard-deny|yolo: block|rules-fallback: block/.test(r))
        return 'scope_down';
    // truly irreversible / protected stores / credential / a graded risk → hard stop
    if (/\bhard-deny\b|-danger:|irreversib|unrecoverable|cannot be (recovered|regenerated|undone)|wipe|destroy|credential|protected path|credential store|shadow|format|risk|delete shadows|force-overwrite|protected branch/.test(r))
        return 'hard_stop';
    return 'stop_and_explain';
}
/**
 * The structured opinion for one blocked call. `command` must already be redacted by
 * the caller. Returns the classified intent plus a single line suitable for the
 * `工具审核意见: "<text>"` wrapper the listener delivers to the session.
 */
export function composeReviewOpinion(input) {
    const intent = intentForDeny(input.reason);
    const rule = ruleIdOf(input.reason);
    const advice = INTENT_ADVICE[intent];
    const locale = input.locale ?? 'zh';
    const cleanReason = input.reason.replace(/\[(?:deny-rule:[a-z0-9._-]+|(?:yolo|rules-fallback)-danger:[a-z0-9._-]+|hard-deny)\]\s*/gi, '').replace(/\s*·.*$/, '').trim();
    const text = locale === 'zh'
        ? `已拦截。依据：${rule ?? '默认策略'}。原因：${cleanReason}。处置(${intent})：${advice.zh}`
        : `Blocked. Rule: ${rule ?? 'default policy'}. Reason: ${cleanReason}. Disposition(${intent}): ${advice.en}`;
    return { intent, text };
}
