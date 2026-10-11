/**
 * The grading rules shared by every grader in this plugin.
 *
 * `classifier.ts` and `risk.ts` are two protocols over the same transport, and
 * their rule text was duplicated between them with different wording — one said
 * "clearly safe" and "exfiltration-adjacent", the other carried the reversible
 * exclusion list. A call could therefore be graded against two different
 * standards depending on which path asked, which is how a local read
 * (`cat .env`) ends up denied by one grader and allowed by the other.
 *
 * This module holds the rules once. Both protocols prepend their own output
 * shape (three-way verdict vs safe/risky + category) and append these.
 *
 * It stays dependency-free so it can be imported from either half.
 */
/**
 * The substantive grading rules, in the order both graders should present them.
 *
 * Kept deliberately terse and measured: grading latency is prefill-dominated, and
 * the first draft of these rules cost +42ms of p50 (gate: <= +20ms). What the
 * runtime now enforces deterministically is not repeated here — the opaque-payload
 * veto in `runtime.ts` refuses `safe` even when the grader grants it, so prose
 * begging the model not to guess safe would only cost tokens. Rules below stay
 * only where they change a judgement the code cannot make.
 *
 * Redundant restatements were merged once the whole prompt was re-measured at
 * +36ms: the deletion list is one line instead of four, the read-only remote rule
 * is one line instead of three. Same judgements, fewer tokens to read.
 */
export declare const GRADER_RULES: readonly string[];
/** Join the shared rules into prompt text. */
export declare function graderRulesText(): string;
