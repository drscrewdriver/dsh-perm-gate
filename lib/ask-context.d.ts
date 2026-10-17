/** Reversibility tier — the axis the human and the safety metric both care about. */
export type Reversibility = 
/** irreversible damage (data destroyed, credential left the machine) */
'I'
/** unknown-target: the payload cannot be inspected, so harm cannot be ruled out */
 | 'U'
/** has an external side effect but is recoverable (push, PR, global config) */
 | 'C'
/** reversible or read-only (list, diff, build, local commit, workspace edit) */
 | 'R';
/** What the call is aimed at. */
export type TargetKind = 'read' | 'write' | 'delete' | 'remote-write' | 'exec-external' | 'unknown';
/**
 * One script body handed to the reviewers, as the runtime read it. Structural here so
 * this module keeps its dependency-free contract (the fs half lives in `script-review.ts`).
 */
export interface ScriptContentIn {
    readonly ref: string;
    readonly path: string;
    readonly body: string;
    readonly truncated: boolean;
    readonly unreadable?: string;
}
/** The session's three tier knobs, folded out of the durable session log. */
export interface SessionKnobs {
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
}
/** Input to {@link buildAskContext}; every field optional except `tool`. */
export interface AskContextSource {
    readonly tool: string;
    readonly args?: Record<string, unknown>;
    readonly commandText?: string;
    readonly cwd?: string;
    /** The workspace root the prompt's scope rules keep assuming but never had. */
    readonly workspaceRoot?: string;
    readonly knobs?: SessionKnobs;
    readonly files?: readonly string[];
    /** The deterministic layer's own conclusion, kept for the human, not the grader. */
    readonly ruleReason?: string;
    /**
     * The scripts this call runs, with the body the reviewer is given. Read by the node
     * runtime (`script-review.ts`) — this module stays filesystem-free, so the text
     * arrives pre-fetched. Absent means either no script is named or review is off.
     */
    readonly scriptContents?: readonly ScriptContentIn[];
    /**
     * True when *every* script the call names was read, i.e. what will execute is now
     * visible. That is what lifts a script run out of the opaque/`U` tier: the reviewer
     * is no longer judging a filename. One unreadable script keeps the opacity.
     */
    readonly scriptsCovered?: boolean;
    /** Correlation key, mixed into the event digest. */
    readonly callId?: string;
    /** Per-session salt so `inputDigest` cannot be dictionary-reversed or joined across sessions. */
    readonly salt?: string;
    /** Injected hash (sha256 hex on the node half) to keep crypto out of this module. */
    readonly hash?: (text: string) => string;
}
/** The frozen context. */
export interface AskContext extends AskContextSource {
    readonly targetKind: TargetKind;
    readonly targetResolvable: boolean;
    readonly reversibility: Reversibility;
    /** Whether the act is unrecoverable, judged by the shared `irreversible.ts`. */
    readonly irreversible: boolean;
    /**
     * Unrecoverable data loss that is nonetheless **not** a hard-deny: the human
     * decides, but no grader may clear it and no confirmations may learn it away.
     * `docker volume rm` is the archetype — routine maintenance, unrecoverable.
     */
    readonly unlearnable: boolean;
    /** Read-only commands that need no human attention at all. */
    readonly readOnly: boolean;
}
/**
 * Freeze one call into an {@link AskContext}. Pure and side-effect free: it reads
 * what it is handed and never touches the filesystem or the network, so the three
 * projections cannot disagree about what they were built from.
 */
export declare function buildAskContext(source: AskContextSource): AskContext;
/** What the risk grader is allowed to see. */
export interface GraderPayload {
    readonly tool: string;
    readonly args: unknown;
    readonly reason: string;
    readonly target_resolvable: boolean;
    readonly workspace_root?: string;
    /**
     * The bodies of the scripts this call runs, redacted like any other egress text.
     * Without them the grader judges a filename and can say `safe` about code it never
     * saw; with them the answer is about what will execute.
     */
    readonly script_contents?: readonly GraderScript[];
}
/** One attached script, as it leaves the host. */
export interface GraderScript {
    readonly ref: string;
    readonly path: string;
    /** Absent when `unreadable` names why there is no body. */
    readonly body?: string;
    readonly truncated?: boolean;
    readonly unreadable?: string;
}
/** Budget for one script body on the wire: a real script, one round-trip. */
export declare const GRADER_SCRIPT_BODY_CHARS = 20000;
/**
 * Project for egress to the grader. Tier knobs and the rule layer's own verdict
 * are stripped by design — see the module comment.
 */
export declare function toGraderPayload(ctx: AskContext): GraderPayload;
/** What the human approving this call should be shown. */
export interface HumanCard {
    readonly tool: string;
    readonly command: string;
    readonly files: readonly string[];
    /** Total file count, so the card can say "and N more" instead of lying by omission. */
    readonly fileCount: number;
    readonly reversibility: Reversibility;
    readonly targetKind: TargetKind;
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
    readonly reason: string;
}
/** Project for the approval popup (already redacted; never raw args). */
export declare function toHumanCard(ctx: AskContext, maxFiles?: number): HumanCard;
/**
 * A one-line summary for the human who must decide.
 *
 * The host renders an approval request from its `reason` string and nothing
 * else, so until `approval.request` can carry structured fields this is the only
 * channel that reaches a human. Built from language-neutral enum tokens
 * (`tier=C`, `payload=opaque`) rather than prose: prose would need nine
 * translations per batch, and a host renderer can localize the tokens later
 * without a format change.
 */
export declare function humanCardLine(ctx: AskContext, maxFiles?: number): string;
/**
 * Why this call has no answer yet, in words a person who does not know this
 * codebase can read. The tokens (`tier=C target=write`) were never a decision aid:
 * they name the gate's internals, not the user's exposure, and a mislabelled one
 * (`target=write` on a directory listing) teaches people to stop reading the card.
 *
 * Keys are stable machine identifiers so the client panel can localize them later;
 * the popup gets `zh`/`en` text because the host resolves `displayReason` by UI
 * locale and falls back to `en` for the other seven languages.
 */
export declare const DOUBT_COPY: {
    readonly 'no-rule': {
        readonly zh: "没有规则覆盖这次调用，按默认策略交给人 — 这不表示它危险";
        readonly en: "no rule covers this call, so the default is to ask — that does not mean it is dangerous";
    };
    readonly opaque: {
        readonly zh: "命令载荷读不懂（编码过 / 工作区外的脚本 / 认不出程序名），规则层无法定位目标";
        readonly en: "the payload cannot be read (encoded, a script outside the workspace, or no recognisable program), so no rule can locate its target";
    };
    readonly irreversible: {
        readonly zh: "规则判定不可逆：跑完无法撤回";
        readonly en: "a rule says this is irreversible: it cannot be undone once run";
    };
    readonly 'never-learn': {
        readonly zh: "这类确认不会沉淀，下次同样的操作还会再问";
        readonly en: "this answer will not be learned; the same call will ask again next time";
    };
    readonly delete: {
        readonly zh: "会删除内容";
        readonly en: "it deletes content";
    };
    readonly 'remote-write': {
        readonly zh: "会产生对外可见的副作用（推送 / 发布 / 写请求），撤回需要额外手动操作";
        readonly en: "it has an externally visible effect (push / publish / write request); undoing it takes extra manual steps";
    };
    readonly 'exec-external': {
        readonly zh: "会执行工作区之外的代码，本次调用无法静态看清它做什么";
        readonly en: "it runs code from outside the workspace, which this call cannot inspect";
    };
    readonly 'script-attached': {
        readonly zh: "它要跑的脚本正文已读出来、随本次审查附上（模型看到的和你看到的是同一份）";
        readonly en: "the script it runs was read and attached to this review — the model and you see the same text";
    };
    readonly 'script-unreadable': {
        readonly zh: "脚本正文没读到（缺失/过大/二进制），没有人看见真正要执行的代码";
        readonly en: "a script body could not be read (missing, over budget, or binary) — nobody has seen the code that will run";
    };
    readonly 'outside-paths': {
        readonly zh: "涉及工作区之外的路径";
        readonly en: "it touches paths outside the workspace";
    };
    readonly 'model-flagged': {
        readonly zh: "风险模型认为可疑（它只能升级，不能放行）";
        readonly en: "the risk model flagged it (it can only escalate, never clear)";
    };
    readonly write: {
        readonly zh: "会写入或修改文件";
        readonly en: "it writes or modifies files";
    };
};
export type DoubtKind = keyof typeof DOUBT_COPY;
/**
 * The machine keys behind "why am I being asked". Derived, never passed in: the
 * caller cannot forget to add a doubt, and a doubt cannot contradict the facts.
 */
export declare function askDoubtKinds(ctx: AskContext, extra?: {
    readonly modelFlagged?: boolean;
}): DoubtKind[];
/**
 * The card a human decides from, as three prose clauses with **no command in them**.
 *
 * The command does not belong here. The host's approval panel renders the pending
 * tool call's command in its own monospace block (ui-chat registers
 * `conversation.approval.detail` → `ApprovalCommand`, styled `.command`), while the
 * resolved `displayReason` goes into `.headline`, a plain div with no
 * `white-space: pre-line` — so any `\n` in it collapses and a command embedded in
 * prose ends up buried mid-sentence. Keeping the two in their own channels is what
 * makes the popup readable.
 *
 * The event still carries the command separately (`humanCommand`) because the
 * review list has no host-provided command block next to it.
 */
export declare function humanBrief(ctx: AskContext, lang: 'zh' | 'en', kinds?: ("write" | "delete" | "remote-write" | "exec-external" | "never-learn" | "no-rule" | "opaque" | "irreversible" | "script-attached" | "script-unreadable" | "outside-paths" | "model-flagged")[]): string;
/** The redacted command alone, for the channels that have nowhere else to show it. */
export declare function humanCommand(ctx: AskContext): string;
/** What goes on the durable event, for later attribution. */
export interface EventFields {
    readonly inputDigest?: string;
    readonly cwd?: string;
    readonly permissionPreset?: string;
    readonly sandboxMode?: string;
    readonly approvalPolicy?: string;
    /** The machine keys of "why it asked", so the panel can localize them. */
    readonly doubtKinds?: readonly DoubtKind[];
    /** The English form of the card the human decided from (audit language). */
    readonly humanBrief?: string;
    /** The redacted command on its own, so the review list can show it as code. */
    readonly humanCommand?: string;
}
/**
 * Project for the event log: a salted digest (raw args never land on disk) plus
 * the knobs, so a reviewer can reconstruct *why* the gate saw what it saw.
 * Emits no digest when no hash is injected rather than falling back to an
 * unsalted one — that would be dictionary-reversible across sessions.
 */
export declare function toEventFields(ctx: AskContext): EventFields;
/**
 * Fold the three durable tier knobs out of a session event log (last wins).
 * `preset.ts` folds only `permission/preset`; the other two ride the same log.
 * Tolerant of every host line: an unknown shape yields `undefined`, never a
 * wrong value.
 */
export declare function foldSessionKnobs(events: readonly {
    type?: string;
    data?: Record<string, unknown>;
}[] | undefined): SessionKnobs;
