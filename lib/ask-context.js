/**
 * AskContext — one frozen view of a tool call, projected three ways.
 *
 * Before this module, the same facts were derived three times, differently:
 * `trackAsk` snapshotted files for the review page, `recordEvent` re-derived
 * them for the feed, and the risk grader got `tool` + raw `args` + the rule
 * reason and nothing else. That is how an approval popup ended up showing one
 * opaque sentence while the model that judged the call never saw the workspace
 * root its own prompt kept referring to.
 *
 * One object, built at the decision entry point, then three projections with
 * deliberately different trust boundaries:
 *
 * - `toGraderPayload` — leaves the host (user-configured endpoint). Redacted,
 *   bounded, and carrying only what helps judge: plus `workspace_root` (the
 *   prompt's "inside the workspace" rule is unenforceable without it) and
 *   `target_resolvable`. It gets **no tier knobs on purpose**: feeding
 *   `approval_policy` / `permission_preset` makes the model echo the rule layer
 *   instead of judging independently (measured: disturbance 67.1% -> 87.8%), and
 *   `ruleReason` already carries that layer's conclusion.
 * - `toHumanCard` — for the human who must decide in seconds: the redacted
 *   command, the files, the reversibility tier, and the knobs (a human *should*
 *   see "you are in danger-full-access with approval=never").
 * - `toEventFields` — for post-hoc attribution: a salted digest plus the knobs,
 *   never the raw args.
 *
 * Dependency-light by intent: the hash is injected so this module stays free of
 * `node:crypto` and remains importable from the browser half.
 */
import { redactArgs, redactCommandText } from './redact.js';
import { irreversibleReason, neverClearReason } from './irreversible.js';
import { executableVariants, normalizeCommandText } from './command-normalize.js';
/** Verbs that only look. */
const READ_ONLY = /^(?:ls|dir|Get-ChildItem|Get-Content|Get-Item|cat|head|tail|less|more|stat|test|Test-Path|Select-String|Get-Command|Get-Process|Get-Member|where|which|whoami|hostname|pwd|cd|echo|Write-Output|findstr|(?:git|svn)\s+(?:status|log|diff|show|blame|branch|remote|config\s+--get))\b/i;
/**
 * Pipe stages that reshape output without producing any.
 *
 * Read-only used to be judged as "a known read verb **and no pipe anywhere**", so
 * `Get-ChildItem -Force | Select-Object Name` — the single most common shape in a
 * PowerShell agent session — was reported to the human as `target=write`. That is
 * not a harmless label: the card is what a person reads before deciding, and a
 * listing that claims to write trains them to ignore the card.
 *
 * A mis-split inside a quoted pattern can only make this **stricter** (an unknown
 * head is not read-only), which is the safe direction.
 */
const PIPE_FILTER = /^(?:Select-Object|Where-Object|Sort-Object|Group-Object|Measure-Object|Format-Table|Format-List|Format-Wide|Out-String|Out-Host|Out-Default|Tee-Object|ForEach-Object|foreach|select|sort|uniq|cut|tr|wc|head|tail|grep)$/i;
/** Heads that write, run, or send — a pipeline containing one is not read-only. */
const WRITING_HEAD = /^(?:Set-Content|Add-Content|Out-File|Out-Null|New-Item|Set-Item|Remove-Item|Clear-Content|Move-Item|Rename-Item|Copy-Item|Install-Module|Start-Process|Stop-Process|Invoke-Expression|Invoke-Command|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|curl|wget|scp|rsync|nc|ncat|ssh|rm|mv|cp|dd|tee|sed|awk|npm|pnpm|yarn|pip|pip3|python|node|npx|dotnet|go|cargo|make|docker|kubectl|git|svn|reg|diskpart|format|cipher|vssadmin|taskkill|New-ScheduledTask|Set-MpPreference)$/i;
/** Recoverable external side effect. */
const RECOVERABLE_EXTERNAL = /\b(git\s+push|gh\s+pr\s+create|gh\s+api\b|--method\s+POST|npm\s+publish|docker\s+push|kubectl\s+apply|terraform\s+apply|git\s+push\s+--force|config\s+--global|config\s+--system|sslVerify\s+false|GIT_SSL_NO_VERIFY|ServerCertificateValidationCallback|Stop-Process|taskkill|docker\s+system\s+prune|git\s+clean\s+-[a-z]*x|icacls|reg\s+(?:add|delete))\b/i;
/*
 * Irreversibility is deliberately **not** defined in this file. It lives in
 * `irreversible.ts`, shared with P0, so a call cannot be graded `I` here while the
 * deny layer has never heard of it — the divergence that left `Optimize-VHD` with
 * no rule and no model hard-denial.
 */
/** Encoded or otherwise uninspectable payload. */
const OPAQUE = /(?:-EncodedCommand\s+[A-Za-z0-9+/=]{16,}|FromBase64String\s*\(|\[Convert\]::FromBase64|base64\s+(?:-d|--decode)|eval\s*\(\s*atob)/i;
/**
 * A command segment whose head cannot name an executable.
 *
 * `把测试数据库清了重新导数据，别问` and `把 C 盘没用的系统文件都删掉，腾出空间` are prose
 * *describing* an act. No rule can match them (no program, path or flag to reason
 * about) and no parser can decompose them, so a grader calling them "reversible
 * cleanup" gets the call auto-allowed — measured: 7 of the 52 irreversible cases
 * in the eval set are exactly this shape, and they clear even under a grader that
 * answers `safe` to everything. Prose belongs with the encoded blob and the unseen
 * script: an operation that was never named is not known work — ask, never learn.
 *
 * The test is per segment and looks at the **head token only** (where a program
 * sits), so real command shapes stay identifiable: `./deploy.sh`, `$env:X\tool.exe`,
 * `7z a out.7z`, `~/scripts/x.sh`. Residual: prose that starts with a path or a
 * tool name (`把 C:\Users 全删了`) still reads as an operation to this probe.
 */
function unnamedOperation(text) {
    const segs = text.split(/[;&|\n]+/);
    return !segs.some((seg) => {
        const tok = (seg.trim().replace(/^["'`]+/, '').split(/\s/)[0] ?? '').toLowerCase();
        if (tok === '')
            return false;
        if (/[a-z]/.test(tok) && tok.length >= 2)
            return true;
        return /^[.$~]/.test(tok) && /[a-z]/.test(tok);
    });
}
/** Absolute path outside the workspace. */
function outsideWorkspace(text, root) {
    if (root === undefined || root === '')
        return false;
    const norm = (p) => p.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
    const r = norm(root);
    const abs = text.match(/["']?([a-z]:[\\/][^\s"']{2,}|\/(?:home|root|etc|usr|var|opt|Users)\/[^\s"']{2,})/i);
    if (abs?.[1] === undefined)
        return false;
    return !norm(abs[1]).startsWith(r);
}
/**
 * Is a script this call runs **not** visible in the workspace?
 *
 * `#56` (`python E:\other\_extract.py`) is what the U tier exists for: the code
 * about to execute was never seen. A bare or workspace-relative name is not that
 * case — it is the project's own file. Reading every mention of `.sh` as opaque
 * would permanently forbid auto-allowing local script runs, which is a real cost:
 * measured here, `./deploy.sh --fast` came out `U`.
 */
function unseenScript(text, root) {
    const norm = (p) => p.toLowerCase().replace(/[\\/]+/g, '/').replace(/\/+$/, '');
    // The quote/pipe/paren characters are excluded from the capture on purpose: a
    // JSON-serialized argument would otherwise yield a ref like `"./deploy.sh`, and
    // the leading quote hides the workspace-relative prefix that makes it local.
    for (const raw of text.match(/([^\s"';|&()]*\.(?:py|mjs|js|sh))\b/gi) ?? []) {
        const p = norm(raw);
        const absolute = /^[a-z]:\//.test(p) || p.startsWith('/') || p.startsWith('~/') || p.startsWith('$') || p.startsWith('//');
        if (!absolute) {
            // Relative — `scripts/build.py`, `./deploy.sh`, a bare name. It resolves
            // inside wherever the call runs, which is the project's own file.
            continue;
        }
        if (root === undefined || root === '')
            return true; // cannot prove it is inside
        if (!p.startsWith(`${norm(root)}/`))
            return true;
    }
    return text.match(/(?:^|[\s"'`(])\.\.[\/][^\s"']*\.(?:py|mjs|js|sh)\b/i) !== null;
}
/**
 * The statements a script body actually contains, for the deterministic nets.
 *
 * Judging a whole file as one string is too coarse: `irreversible.ts` matches a delete
 * verb, a force flag and a home-variable *anywhere* in the text, and a 300-line build
 * script is full of all three in unrelated places (`cd "$HOME"` at the top,
 * `rm -rf ./node_modules` at the bottom). So the body is cut into statements (newline
 * and `;` are the shell separators) and each is judged on its own.
 *
 * But the incident shape is a **block**, and one line of it says nothing:
 * `for f in ~/.*; do` / `rm -rf "$f"` / `done`, or `if (Test-Path $home) {` on its own
 * line. So a line that *ends* in a continuation (`do`, `then`, `{`, `&&`, `;`, a
 * trailing backslash) is joined with the lines it hands off to, up to a small depth.
 * Joining is keyed on the continuation, not on a fixed window: an arbitrary two-line
 * window is exactly the collision the split avoids (`cd "$HOME"` followed by
 * `rm -rf ./build`).
 *
 * The cost of an over-match here is a human ask, never a silent deny: this feeds the
 * `I` tier, which the model cannot clear.
 */
const LINE_CONTINUATION = /(?:&\s*&\s*$|\|\s*\|\s*$|;\s*(?:do|then|fi|else)\s*$|[{}]\s*$|;\s*$|\\\s*$|\b(?:do|then|else|begin)\s*$)/;
function bodyStatements(bodies) {
    const out = [];
    for (const body of bodies) {
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            let group = lines[i] ?? '';
            // A block opener swallows the lines it governs (max 3 more), so a loop or an `if`
            // wrapping a destructive statement is judged as the one act it is.
            for (let j = 1; j <= 3 && i + j < lines.length && LINE_CONTINUATION.test(group); j += 1) {
                group = `${group}\n${lines[i + j] ?? ''}`;
            }
            for (const stmt of [group, ...group.split(/[;\n]+/)]) {
                if (stmt.trim() !== '')
                    out.push(stmt);
            }
            // The individual statements of the swallowed lines are still judged separately on
            // their own turn, so nothing is *only* seen as part of a block.
        }
    }
    return out;
}
/** Classify what the call targets, and whether its payload is inspectable. */
function inspect(source) {
    const text = (source.commandText ?? '').trim();
    const cmd = `${text} ${JSON.stringify(source.args ?? {})}`;
    // An encoded layer is judged on what it will actually run: `-EncodedCommand`
    // hiding `Remove-Item -Recurse -Force C:\` is irreversible even though the
    // visible text is opaque, and the human must see both facts.
    const decoded = executableVariants(normalizeCommandText(text));
    // A script run is judged on the file too: `bash ./clean-home.sh` is a filename, the
    // *body* is the operation. This is the clause that closes the incident the whole
    // feature exists for — a script that wipes the profile while the command line says
    // nothing dangerous, judged deterministically so no grader `safe` can clear it.
    const read = (source.scriptContents ?? []).filter((c) => c.unreadable === undefined && c.body !== '');
    const judged = [cmd, ...decoded, ...bodyStatements(read.map((c) => `${c.ref}\n${c.body}`))];
    const irreversible = judged.some((t) => irreversibleReason(t) !== undefined);
    const unlearnable = judged.some((t) => neverClearReason(t) !== undefined);
    if (cmd.trim() === '{}') {
        // A tool invoked with no arguments at all: nothing to read, nothing to trust.
        return { kind: 'unknown', resolvable: false, readOnly: false, irreversible, unlearnable };
    }
    // Read-only means every stage of the pipeline only looks: a known read verb at the
    // head of each segment, nothing but reshaping filters after the pipes, and no
    // redirect (`cat key > out.txt` is a copy, not a read).
    const readOnly = text !== '' && !/[<>]/.test(text) && (() => {
        const stages = text.split(/[;&|]+/).map((s) => s.trim()).filter((s) => s !== '');
        if (stages.length === 0)
            return false;
        return stages.every((stage, i) => {
            const head = (stage.replace(/^["'`]+/, '').split(/[\s/]+/)[0] ?? '');
            if (i === 0)
                return READ_ONLY.test(head);
            return PIPE_FILTER.test(head) && !WRITING_HEAD.test(head);
        });
    })();
    const first = text.split(/\s/)[0] ?? '';
    const runner = /\b(?:python|node|pwsh|powershell|bash|sh|zsh|npx|deno|ruby|perl)\b/i.test(cmd);
    // "Cannot see the script" is what the U tier existed for. Once every script the call
    // names has been read and attached, the reviewer *can* see it — so the call stops
    // being unknowable and becomes an ordinary graded call (whose body the nets have just
    // judged above). One unreadable file keeps the whole call opaque.
    const covered = source.scriptsCovered === true && read.length > 0;
    const execExternal = runner && !covered && (outsideWorkspace(cmd, source.workspaceRoot) || unseenScript(cmd, source.workspaceRoot));
    const unnamed = text !== '' && unnamedOperation(text);
    const opaque = OPAQUE.test(cmd) || execExternal;
    if (irreversible)
        return { kind: 'delete', resolvable: !opaque && !unnamed, readOnly: false, irreversible, unlearnable };
    if (opaque || unnamed) {
        return { kind: execExternal ? 'exec-external' : 'unknown', resolvable: false, readOnly: false, irreversible, unlearnable };
    }
    if (RECOVERABLE_EXTERNAL.test(cmd))
        return { kind: 'remote-write', resolvable: true, readOnly: false, irreversible, unlearnable };
    if (/\b(?:rm|del|Remove-Item|rmdir|Erase)\b/i.test(first))
        return { kind: 'delete', resolvable: true, readOnly: false, irreversible, unlearnable };
    if (readOnly)
        return { kind: 'read', resolvable: true, readOnly: true, irreversible, unlearnable };
    return { kind: 'write', resolvable: true, readOnly: false, irreversible, unlearnable };
}
/**
 * Grade reversibility from an inspection, never optimistically.
 *
 * Irreversible outranks opaque: the decoded consequence is known, so the human
 * gets `tier=I` together with `payload=opaque` rather than a vague `U`.
 *
 * `unlearnable` also grades `I`. The tier axis describes the *world* — data that
 * cannot be restored is I whether or not the gate is allowed to refuse outright;
 * which layer acts (deny, ask-forever, ask-and-learn) is a separate decision.
 * Reporting `tier=R` for `docker volume rm` would under-inform the human about
 * exactly the thing they are being asked to approve.
 */
function grade(seen) {
    if (seen.irreversible || seen.unlearnable)
        return 'I';
    if (!seen.resolvable)
        return 'U';
    if (seen.readOnly || seen.kind === 'read')
        return 'R';
    if (seen.kind === 'remote-write' || seen.kind === 'exec-external')
        return 'C';
    return 'R';
}
/**
 * Freeze one call into an {@link AskContext}. Pure and side-effect free: it reads
 * what it is handed and never touches the filesystem or the network, so the three
 * projections cannot disagree about what they were built from.
 */
export function buildAskContext(source) {
    const seen = inspect(source);
    // An unlearnable act destroys data whatever its verb looks like, so the human
    // card must not read `target=write` next to `tier=I`.
    const kind = seen.unlearnable && seen.kind !== 'delete' ? 'delete' : seen.kind;
    return {
        ...source,
        args: source.args ?? {},
        targetKind: kind,
        targetResolvable: seen.resolvable,
        readOnly: seen.readOnly,
        irreversible: seen.irreversible,
        unlearnable: seen.unlearnable,
        reversibility: grade(seen),
    };
}
/** Budget for one script body on the wire: a real script, one round-trip. */
export const GRADER_SCRIPT_BODY_CHARS = 20_000;
/**
 * Project for egress to the grader. Tier knobs and the rule layer's own verdict
 * are stripped by design — see the module comment.
 */
export function toGraderPayload(ctx) {
    const root = ctx.workspaceRoot;
    const scripts = (ctx.scriptContents ?? []).map((c) => ({
        ref: c.ref,
        path: c.path,
        ...(c.unreadable === undefined
            ? { body: redactCommandText(c.body, { maxChars: GRADER_SCRIPT_BODY_CHARS }), truncated: c.truncated }
            : { unreadable: c.unreadable }),
    }));
    return {
        tool: ctx.tool,
        args: redactArgs(ctx.args ?? {}),
        reason: ctx.ruleReason ?? '',
        target_resolvable: ctx.targetResolvable,
        ...(root === undefined || root === '' ? {} : { workspace_root: root }),
        ...(scripts.length === 0 ? {} : { script_contents: scripts }),
    };
}
/**
 * The line a human reads as "this is what will run".
 *
 * `commandText` is the host's display field and is frequently absent — the real
 * command lives in `arguments.command`. Falling back to it is what makes the popup
 * show the operation instead of only its classification (the B4 clause's first item).
 * Only command-shaped keys qualify: falling back to any string would put an `edit`
 * call's file body on the screen.
 */
function commandForDisplay(ctx) {
    const direct = ctx.commandText ?? '';
    if (direct.trim() !== '')
        return direct;
    const args = ctx.args ?? {};
    for (const key of ['command', 'cmd', 'script']) {
        const value = args[key];
        if (typeof value === 'string' && value.trim() !== '')
            return value;
    }
    return '';
}
/** Project for the approval popup (already redacted; never raw args). */
export function toHumanCard(ctx, maxFiles = 8) {
    const files = ctx.files ?? [];
    const k = ctx.knobs;
    return {
        tool: ctx.tool,
        command: redactCommandText(commandForDisplay(ctx)),
        files: files.slice(0, maxFiles),
        fileCount: files.length,
        reversibility: ctx.reversibility,
        targetKind: ctx.targetKind,
        reason: ctx.ruleReason ?? '',
        ...(k?.permissionPreset === undefined ? {} : { permissionPreset: k.permissionPreset }),
        ...(k?.sandboxMode === undefined ? {} : { sandboxMode: k.sandboxMode }),
        ...(k?.approvalPolicy === undefined ? {} : { approvalPolicy: k.approvalPolicy }),
    };
}
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
export function humanCardLine(ctx, maxFiles = 3) {
    const card = toHumanCard(ctx, maxFiles);
    const bits = [`tier=${card.reversibility}`, `target=${card.targetKind}`];
    if (!ctx.targetResolvable)
        bits.push('payload=opaque');
    if (ctx.unlearnable)
        bits.push('never-learn');
    const scripts = ctx.scriptContents ?? [];
    if (scripts.length > 0) {
        const unread = scripts.filter((c) => c.unreadable !== undefined).length;
        bits.push(unread === 0 ? `scripts=${scripts.length}:body-attached` : `scripts=${scripts.length}:unread=${unread}`);
    }
    if (card.fileCount > 0) {
        const shown = card.files.length;
        bits.push(shown < card.fileCount ? `files=${shown}/${card.fileCount}` : `files=${card.fileCount}`);
    }
    if (card.permissionPreset !== undefined)
        bits.push(`preset=${card.permissionPreset}`);
    if (card.approvalPolicy !== undefined)
        bits.push(`approval=${card.approvalPolicy}`);
    return bits.join(' ');
}
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
export const DOUBT_COPY = {
    'no-rule': {
        zh: '没有规则覆盖这次调用，按默认策略交给人 — 这不表示它危险',
        en: 'no rule covers this call, so the default is to ask — that does not mean it is dangerous',
    },
    'opaque': {
        zh: '命令载荷读不懂（编码过 / 工作区外的脚本 / 认不出程序名），规则层无法定位目标',
        en: 'the payload cannot be read (encoded, a script outside the workspace, or no recognisable program), so no rule can locate its target',
    },
    'irreversible': {
        zh: '规则判定不可逆：跑完无法撤回',
        en: 'a rule says this is irreversible: it cannot be undone once run',
    },
    'never-learn': {
        zh: '这类确认不会沉淀，下次同样的操作还会再问',
        en: 'this answer will not be learned; the same call will ask again next time',
    },
    'delete': {
        zh: '会删除内容',
        en: 'it deletes content',
    },
    'remote-write': {
        zh: '会产生对外可见的副作用（推送 / 发布 / 写请求），撤回需要额外手动操作',
        en: 'it has an externally visible effect (push / publish / write request); undoing it takes extra manual steps',
    },
    'exec-external': {
        zh: '会执行工作区之外的代码，本次调用无法静态看清它做什么',
        en: 'it runs code from outside the workspace, which this call cannot inspect',
    },
    'script-attached': {
        zh: '它要跑的脚本正文已读出来、随本次审查附上（模型看到的和你看到的是同一份）',
        en: 'the script it runs was read and attached to this review — the model and you see the same text',
    },
    'script-unreadable': {
        zh: '脚本正文没读到（缺失/过大/二进制），没有人看见真正要执行的代码',
        en: 'a script body could not be read (missing, over budget, or binary) — nobody has seen the code that will run',
    },
    'outside-paths': {
        zh: '涉及工作区之外的路径',
        en: 'it touches paths outside the workspace',
    },
    'model-flagged': {
        zh: '风险模型认为可疑（它只能升级，不能放行）',
        en: 'the risk model flagged it (it can only escalate, never clear)',
    },
    'write': {
        zh: '会写入或修改文件',
        en: 'it writes or modifies files',
    },
};
/** The cost of each button, per reversibility tier. */
const COST_COPY = {
    R: {
        zh: '允许 = 照常执行这一次；拒绝 = 只挡这一次调用，agent 还可以再问',
        en: 'allow = run this call as shown; deny = blocks only this call, the agent can ask again',
    },
    C: {
        zh: '允许 = 副作用对外可见，撤回要你自己手动做（删远端分支 / 回滚发布）；拒绝 = 只挡这一次调用',
        en: 'allow = the side effect becomes visible to others and you undo it by hand; deny = blocks only this call',
    },
    I: {
        zh: '允许 = **无法撤回**（数据 / 卷 / 影子副本没了就是没了）；拒绝 = 只挡这一次调用',
        en: 'allow = **cannot be undone** (the data / volume / shadow copies are gone); deny = blocks only this call',
    },
    U: {
        zh: '允许 = 后果无法预估（看不清要做什么）；拒绝 = 只挡这一次调用',
        en: 'allow = the blast radius is unknown (what it does cannot be read); deny = blocks only this call',
    },
};
/**
 * The machine keys behind "why am I being asked". Derived, never passed in: the
 * caller cannot forget to add a doubt, and a doubt cannot contradict the facts.
 */
export function askDoubtKinds(ctx, extra = {}) {
    const kinds = [];
    if (!ctx.targetResolvable)
        kinds.push('opaque');
    if (ctx.reversibility === 'I' || ctx.irreversible)
        kinds.push('irreversible');
    if (ctx.unlearnable)
        kinds.push('never-learn');
    switch (ctx.targetKind) {
        case 'delete':
            kinds.push('delete');
            break;
        case 'remote-write':
            kinds.push('remote-write');
            break;
        case 'exec-external':
            kinds.push('exec-external');
            break;
        case 'write':
            kinds.push('write');
            break;
        default: break;
    }
    if (extra.modelFlagged === true)
        kinds.push('model-flagged');
    // Whether the code that will run was actually looked at is a fact the human decides
    // with, and it is not implied by any other clause: an attached body means the
    // judgment covered it, an unreadable one means nothing ever will.
    const scripts = ctx.scriptContents ?? [];
    if (scripts.length > 0) {
        if (scripts.some((c) => c.unreadable !== undefined))
            kinds.push('script-unreadable');
        else
            kinds.push('script-attached');
    }
    if (ctx.ruleReason !== undefined && /no rule matched|default action/i.test(ctx.ruleReason))
        kinds.push('no-rule');
    const root = ctx.workspaceRoot;
    if (root !== undefined && (ctx.files ?? []).some((f) => f.startsWith('..') || (f.startsWith('/') && !f.startsWith(root))))
        kinds.push('outside-paths');
    // De-duplicated and capped: four clauses is already more than a person reads.
    return [...new Set(kinds)].slice(0, 4);
}
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
export function humanBrief(ctx, lang, kinds = askDoubtKinds(ctx)) {
    const card = toHumanCard(ctx);
    const joiner = lang === 'zh' ? '；' : '; ';
    const doubts = kinds.map((k) => DOUBT_COPY[k][lang]);
    const parts = [];
    parts.push(`${lang === 'zh' ? '疑点' : 'why it asks'}: ${doubts.length > 0 ? doubts.join(joiner) : (lang === 'zh' ? '规则层要求人工确认' : 'a rule asks a human')}`);
    const scope = [`${lang === 'zh' ? '目标' : 'target'}=${card.targetKind}`, `${lang === 'zh' ? '可逆性' : 'reversibility'}=${card.reversibility}`];
    if (card.fileCount > 0) {
        scope.push(lang === 'zh'
            ? `文件 ${card.fileCount} 个：${card.files.join(', ')}${card.files.length < card.fileCount ? ` 等${card.fileCount}个` : ''}`
            : `${card.fileCount} file(s): ${card.files.join(', ')}`);
    }
    parts.push(`${lang === 'zh' ? '影响面' : 'what it touches'}: ${scope.join(joiner)}`);
    parts.push(COST_COPY[card.reversibility][lang]);
    return parts.join('  ·  ');
}
/** The redacted command alone, for the channels that have nowhere else to show it. */
export function humanCommand(ctx) {
    return toHumanCard(ctx).command;
}
/** The salted pre-image of one event digest: knobs + redacted args, never raw. */
function digestBody(ctx) {
    const k = ctx.knobs;
    return JSON.stringify({
        tool: ctx.tool,
        args: redactArgs(ctx.args ?? {}),
        cwd: ctx.cwd ?? '',
        preset: k?.permissionPreset ?? '',
        sandbox: k?.sandboxMode ?? '',
        approval: k?.approvalPolicy ?? '',
    });
}
/**
 * Project for the event log: a salted digest (raw args never land on disk) plus
 * the knobs, so a reviewer can reconstruct *why* the gate saw what it saw.
 * Emits no digest when no hash is injected rather than falling back to an
 * unsalted one — that would be dictionary-reversible across sessions.
 */
export function toEventFields(ctx) {
    const k = ctx.knobs;
    const hash = ctx.hash;
    return {
        ...(k?.permissionPreset === undefined ? {} : { permissionPreset: k.permissionPreset }),
        ...(k?.sandboxMode === undefined ? {} : { sandboxMode: k.sandboxMode }),
        ...(k?.approvalPolicy === undefined ? {} : { approvalPolicy: k.approvalPolicy }),
        ...(ctx.cwd === undefined || ctx.cwd === '' ? {} : { cwd: ctx.cwd }),
        ...(ctx.targetKind === undefined ? {} : { doubtKinds: askDoubtKinds(ctx) }),
        humanBrief: humanBrief(ctx, 'en'),
        ...(humanCommand(ctx) === '' ? {} : { humanCommand: humanCommand(ctx) }),
        ...(typeof hash !== 'function'
            ? {}
            : { inputDigest: hash(`${ctx.salt ?? ''}\u0000${ctx.callId ?? ''}\u0000${digestBody(ctx)}`) }),
    };
}
/**
 * Fold the three durable tier knobs out of a session event log (last wins).
 * `preset.ts` folds only `permission/preset`; the other two ride the same log.
 * Tolerant of every host line: an unknown shape yields `undefined`, never a
 * wrong value.
 */
export function foldSessionKnobs(events) {
    const out = {};
    if (events === undefined)
        return out;
    for (const ev of events) {
        const data = ev?.data;
        if (typeof ev?.type !== 'string' || data === undefined)
            continue;
        const pick = (keys) => {
            for (const key of keys) {
                const v = data[key];
                if (typeof v === 'string' && v !== '')
                    return v;
            }
            return undefined;
        };
        if (ev.type === 'permission/preset')
            out.permissionPreset = pick(['preset']) ?? out.permissionPreset;
        else if (ev.type === 'sandbox/mode')
            out.sandboxMode = pick(['mode', 'sandboxMode']) ?? out.sandboxMode;
        else if (ev.type === 'approval/policy')
            out.approvalPolicy = pick(['policy', 'approvalPolicy']) ?? out.approvalPolicy;
    }
    return out;
}
