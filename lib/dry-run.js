/**
 * Rule dry-run: evaluate one would-be tool call against a rules file and report
 * the verdict in a shape both the CLI and the settings-card "rule test" panel can
 * use.
 *
 * The evaluator itself lives in {@link PermGateRuntime}; this module only owns
 * the standalone construction (no session, no audit feed, no event log, no
 * persistence paths) and the reporting shape. Nothing here writes to disk or to
 * the live gate — the runtime it builds is thrown away when the call returns.
 *
 * Two verdicts are reported, and they are not the same thing:
 *
 * - `verdict` is the *effective* result of the whole chain the live gate runs
 *   (P0 hard-deny → P1 grant → P2 rules → P3 classifier → P4 ask), minus the
 *   session-scoped state a dry-run has none of. This is what the user sees.
 * - `ruleLayer` is what the `permissions` chain decides *on its own*. Only this
 *   layer can name a rule, so `ruleIndex` belongs to it. A P0 hard-deny or a
 *   preset deny-keyword fires before it and reports no index; when the two
 *   differ, that difference is the answer, not an error.
 */
import { resolve } from 'node:path';
import { PermGateRuntime } from './runtime.js';
/**
 * The eleven match dimensions, in the order `docs/rules-format.md` documents
 * them. Used purely for reporting which dimensions a matched rule constrains.
 */
const DIMENSION_KEYS = [
    'tools',
    'command',
    'args',
    'paths',
    'params',
    'absent',
    'agents',
    'when',
    'argv',
    'network',
    'branch',
];
/**
 * Build the standalone runtime a dry-run evaluates against. Exported because
 * `--list` needs the loaded ruleset without deciding anything.
 */
export function createDryRunRuntime(options = {}) {
    return new PermGateRuntime({
        rulesFile: options.rulesFile,
        cwd: options.cwd,
        caseInsensitivePaths: true,
        permissive: options.permissive || undefined,
    });
}
/** Which of the eleven dimensions this rule actually constrains. */
function constrainedDimensions(source) {
    return DIMENSION_KEYS.filter((key) => isConstrained(source[key]));
}
/**
 * A dimension constrains when it carries at least one condition. Every shape the
 * parser produces is covered: pattern lists, key→value maps, condition objects.
 */
function isConstrained(value) {
    if (value === undefined || value === null)
        return false;
    if (Array.isArray(value))
        return value.length > 0;
    if (typeof value === 'object')
        return Object.keys(value).length > 0;
    return true;
}
/** Evaluate one call against a rules file and report the verdict. */
export function runDryRun(input, runtime) {
    const rulesFile = input.rulesFile ? resolve(input.rulesFile) : undefined;
    const gate = runtime ?? createDryRunRuntime({ rulesFile, permissive: input.permissive, cwd: input.cwd });
    const exec = {
        name: input.tool,
        arguments: input.args ?? {},
        cwd: input.cwd ? resolve(input.cwd) : process.cwd(),
    };
    // The effective verdict first, then the rule layer's own. Order matters only
    // for `audited`, which counts what the deciding call appended.
    const decision = gate.decideExecution(exec);
    const layer = gate.explainRules(exec);
    const source = layer.rule?.source;
    return {
        tool: input.tool,
        rulesFile,
        verdict: decision === undefined ? 'allow' : decision.kind,
        reason: decision?.reason ?? '(default/passthrough)',
        audited: gate.auditEntries.length,
        defaultAction: layer.defaultAction,
        ruleCount: gate.ruleCount(),
        permissive: gate.permissive,
        ruleLayer: {
            action: layer.action,
            reason: layer.reason,
            ruleIndex: layer.ruleIndex,
            matchedDimensions: source === undefined ? [] : constrainedDimensions(source),
            source,
        },
    };
}
