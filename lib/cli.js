#!/usr/bin/env node
/**
 * dsh-perm-gate CLI — evaluate one tool call against a rules file (dry-run),
 * or print the loaded rules. Useful for testing rule files without a harness.
 *
 *   dsh-perm-gate --rules permissions.yaml --tool bash \
 *     --args '{"command":"rm -rf bin"}'
 *   dsh-perm-gate --rules permissions.yaml --list
 *   dsh-perm-gate --permissive --tool bash --args '{"command":"pnpm install"}'
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { createDryRunRuntime, runDryRun } from './dry-run.js';
function main() {
    const { values } = parseArgs({
        options: {
            rules: { type: 'string' },
            tool: { type: 'string' },
            args: { type: 'string' },
            cwd: { type: 'string' },
            list: { type: 'boolean', default: false },
            permissive: { type: 'boolean', default: false },
        },
    });
    const rulesFile = values.rules ? resolve(values.rules) : undefined;
    const runtime = createDryRunRuntime({ rulesFile, permissive: values.permissive });
    if (values.list) {
        process.stdout.write(JSON.stringify({
            rulesFile,
            defaultAction: runtime.defaultAction,
            ruleCount: runtime.ruleCount(),
            permissive: runtime.permissive,
            permissiveStrategies: runtime.permissiveStrategies,
        }, null, 2) + '\n');
        return;
    }
    const tool = values.tool;
    if (!tool) {
        process.stderr.write('usage: --tool <name> [--args <json>] [--rules <file>]\n');
        process.exitCode = 2;
        return;
    }
    let args;
    try {
        args = values.args ? JSON.parse(values.args) : {};
    }
    catch {
        process.stderr.write('--args must be valid JSON\n');
        process.exitCode = 2;
        return;
    }
    // `hostView` reproduces this command's historic output exactly: it reports the
    // host-facing decision path (whose `allow` is a bare passthrough with no
    // reason) and its audit count. The panel reports the pure policy verdict
    // instead, because a session-less caller must not inherit the session layers.
    const result = runDryRun({ tool, args, rulesFile, cwd: values.cwd, hostView: true }, runtime);
    const host = result.host;
    process.stdout.write(JSON.stringify({
        decision: host?.verdict ?? result.verdict,
        reason: host?.reason ?? result.reason,
        audited: host?.audited ?? 0,
    }, null, 2) + '\n');
}
main();
