/**
 * Durable allowlist (whitelist) writes for dsh-perm-gate.
 *
 * The "allow everywhere" approval action appends a matched command pattern to
 * the rules' `allow` list and reloads, so a human-approved command is
 * persistently whitelisted across sessions — not just granted once.
 *
 * Two storage backs, per the dual-source migration:
 * - **settings** (`appendAllowToSettings` / `replaceAllowInSettings`) — the
 *   `dsh-perm-gate-rules` namespace; the primary write path once the settings
 *   service is available.
 * - **rules file** (`appendAllowCommand` / `replaceAllowCommands`) — the legacy
 *   path, kept as the fallback when no settings scope is wired (and as the
 *   migration seed: the first settings write carries the file document along so
 *   file-defined deny/ask rules are not shadowed).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { isRulesConfigured } from './config.js';
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Accept both the bare rules form and the file's `permissions:`-wrapped form. */
function unwrapPermissions(seed) {
    if (!isRecord(seed))
        return {};
    return isRecord(seed['permissions']) ? seed['permissions'] : seed;
}
/** The file document a first write should migrate into the namespace, or bare defaults. */
function seedOrDefaults(seed) {
    const root = unwrapPermissions(seed);
    return {
        defaultAction: typeof root['defaultAction'] === 'string' ? root['defaultAction'] : 'ask',
        deny: Array.isArray(root['deny']) ? root['deny'] : [],
        allow: Array.isArray(root['allow']) ? root['allow'] : [],
        ask: Array.isArray(root['ask']) ? root['ask'] : [],
    };
}
function allowEntriesOf(section) {
    const allow = section['allow'];
    return Array.isArray(allow) ? allow : [];
}
function commandEntries(patterns, reason) {
    return patterns.map((pattern) => ({ command: [pattern], reason }));
}
/** The allow-list command patterns currently in the settings rules document (read-only). */
export function listAllowFromRulesDoc(doc) {
    const section = unwrapPermissions(doc);
    const out = [];
    for (const entry of allowEntriesOf(section)) {
        if (!isRecord(entry))
            continue;
        const command = entry['command'];
        if (typeof command === 'string') {
            out.push(command);
            continue;
        }
        if (!Array.isArray(command))
            continue;
        for (const c of command)
            if (typeof c === 'string')
                out.push(c);
    }
    return out;
}
/**
 * Append one command pattern as a new `allow` entry in the settings rules
 * namespace. When the namespace is still unconfigured (bare defaults) and a
 * file document is supplied, the namespace is seeded from it first — the
 * implicit migration — so the first settings write cannot shadow file-defined
 * deny/ask rules. Returns false when the scope rejects the write.
 */
export async function appendAllowToSettings(scope, pattern, reason = 'permissive allow-everywhere', seed) {
    try {
        const current = scope.get();
        const section = isRulesConfigured(current) && isRecord(current)
            ? { ...current }
            : seedOrDefaults(seed);
        const allow = allowEntriesOf(section);
        allow.push({ command: [pattern], reason });
        section['allow'] = allow;
        await scope.update(section);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Replace the settings rules namespace's `allow` whitelist with exactly the
 * given command patterns (one allow entry per pattern); empty clears it.
 * Other sections (deny / ask / defaultAction) are preserved — seeded from the
 * file document on the namespace's first write. Returns false when the scope
 * rejects the write.
 */
export async function replaceAllowInSettings(scope, patterns, reason = 'permissive allowlist', seed) {
    try {
        if (patterns === undefined)
            return false;
        const current = scope.get();
        const section = isRulesConfigured(current) && isRecord(current)
            ? { ...current }
            : seedOrDefaults(seed);
        section['allow'] = commandEntries(patterns, reason);
        await scope.update(section);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Append one command pattern as a new `allow` entry in the rules file.
 * Returns false (leaving the file untouched) on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param pattern - command word (glob) to whitelist, e.g. `git push`.
 * @param reason - human-readable reason recorded on the allow entry.
 */
export function appendAllowCommand(rulesFile, pattern, reason = 'permissive allow-everywhere') {
    try {
        const text = readFileSafe(rulesFile);
        const root = text === '' ? undefined : parse(text);
        const doc = root ?? {};
        const perms = doc['permissions'];
        const section = (perms === undefined ? doc : perms);
        if (typeof section !== 'object' || section === null || Array.isArray(section))
            return false;
        const allow = Array.isArray(section['allow']) ? section['allow'] : [];
        allow.push({ command: [pattern], reason });
        section['allow'] = allow;
        writeFileSync(rulesFile, stringify(doc), 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
/** The allow-list command patterns currently in the rules file (read-only). */
export function listAllowCommands(rulesFile) {
    try {
        const text = readFileSafe(rulesFile);
        if (text === '')
            return [];
        const root = parse(text);
        const perms = root['permissions'];
        const section = perms === undefined ? root : perms;
        const allow = Array.isArray(section['allow']) ? section['allow'] : [];
        const out = [];
        for (const entry of allow) {
            if (typeof entry !== 'object' || entry === null)
                continue;
            const command = entry['command'];
            if (!Array.isArray(command))
                continue;
            for (const c of command)
                if (typeof c === 'string')
                    out.push(c);
        }
        return out;
    }
    catch {
        return [];
    }
}
/**
 * Replace the rules file's `allow` whitelist with exactly the given command
 * patterns (one allow entry per pattern). Other sections (deny / ask /
 * defaultAction) are preserved. Returns false on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param patterns - exact command-pattern list to set; empty clears the whitelist.
 * @param reason - reason recorded on each generated allow entry.
 */
export function replaceAllowCommands(rulesFile, patterns, reason = 'permissive allowlist') {
    try {
        if (rulesFile === '')
            return false;
        const text = readFileSafe(rulesFile);
        const root = text === '' ? undefined : parse(text);
        const doc = root ?? {};
        const perms = doc['permissions'];
        const section = (perms === undefined ? doc : perms);
        if (typeof section !== 'object' || section === null || Array.isArray(section))
            return false;
        section['allow'] = patterns.map((pattern) => ({ command: [pattern], reason }));
        writeFileSync(rulesFile, stringify(doc), 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
function readFileSafe(p) {
    try {
        return readFileSync(p, 'utf8');
    }
    catch {
        return '';
    }
}
