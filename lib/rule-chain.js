/**
 * Multi-file rule chain for dsh-perm-gate.
 *
 * Resolves and merges multiple YAML permissions documents into a single
 * `CompiledRuleset`. The chain follows a search-up strategy: starting from
 * the workspace cwd, walk up directory ancestors looking for the rules file,
 * then fall back to a configured path, then to an empty ruleset.
 *
 * Each file in the chain is independently compiled and cached by content hash.
 * Chain-level merge preserves the deny-first partitioned structure: all deny
 * entries from all files are concatenated (with source file tracking), then
 * all allow entries, then all ask entries.
 *
 * Error policy: `fail` (default) throws on any malformed file; `warn` logs
 * and skips the bad file, keeping the rest of the chain.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { parsePermissionsDocument, compileDocument, compileRuleEntry, documentHash } from './rule.js';
import { hashText } from './compiler.js';
/** Compile-cache entry: hash → compiled ruleset. */
const compileCache = new Map();
// ─── Chain resolution ──────────────────────────────────────────────────────
/**
 * Resolve the rule chain: find all applicable rules files and merge them.
 *
 * @param cwd - The workspace root directory.
 * @param config - Chain configuration.
 * @param opts - Compile options forwarded to each file's compiler.
 * @returns The merged compiled ruleset.
 */
export function resolveRuleChain(cwd, config, opts = {}) {
    const { rulesFile, searchUp = false, fallbackPath, badFilePolicy = 'fail', maxChainLength = 10, } = config;
    const entries = findChainEntries(cwd, rulesFile, searchUp, fallbackPath, maxChainLength);
    if (entries.length === 0) {
        // Empty chain: return a ruleset with no rules (defaultAction only).
        return {
            defaultAction: 'ask',
            deny: [],
            allow: [],
            ask: [],
            caseInsensitivePaths: opts.caseInsensitivePaths ?? false,
        };
    }
    // Merge all entries into a single ruleset.
    return mergeChain(entries, badFilePolicy, opts);
}
/**
 * Walk the chain and collect valid rules file entries.
 */
function findChainEntries(cwd, rulesFile, searchUp, fallbackPath, maxChainLength) {
    const entries = [];
    const seen = new Set();
    // 1. Start from cwd and optionally search up.
    const candidates = [];
    let dir = resolve(cwd);
    // Always check cwd first.
    candidates.push(join(dir, rulesFile));
    if (searchUp) {
        // Walk up ancestors until root.
        let prev = '';
        while (dir !== prev && candidates.length < maxChainLength) {
            candidates.push(join(dir, rulesFile));
            prev = dir;
            dir = dirname(dir);
        }
    }
    for (const candidate of candidates) {
        if (entries.length >= maxChainLength)
            break;
        const resolved = resolve(candidate);
        if (seen.has(resolved))
            continue;
        seen.add(resolved);
        if (!existsSafe(resolved))
            continue;
        const stat = statSafe(resolved);
        if (stat === undefined || !stat.isFile())
            continue;
        const entry = readEntry(resolved);
        if (entry !== undefined)
            entries.push(entry);
    }
    // 2. Fallback path.
    if (fallbackPath !== undefined && entries.length === 0) {
        const resolved = resolve(fallbackPath);
        if (!seen.has(resolved) && existsSafe(resolved)) {
            const entry = readEntry(resolved);
            if (entry !== undefined)
                entries.push(entry);
        }
    }
    return entries;
}
/**
 * Read and parse a single rules file into a ChainEntry.
 */
function readEntry(filePath) {
    try {
        const text = readFileSync(filePath, 'utf8');
        const hash = documentHash(text);
        const doc = parsePermissionsDocument(text);
        return { path: filePath, hash, doc };
    }
    catch {
        return undefined;
    }
}
/**
 * Merge a chain of entries into a single CompiledRuleset.
 * Each file's entries are sorted into deny/allow/ask partitions.
 * Chain-level order: deny (all files, in chain order) → allow → ask.
 */
function mergeChain(entries, badFilePolicy, opts) {
    // Collect entries per action, preserving chain order.
    const denyDocs = [];
    const allowDocs = [];
    const askDocs = [];
    for (const entry of entries) {
        try {
            // Compile to validate patterns (throws on malformed input).
            compileDocument(entry.doc, opts);
            // We use the raw doc lists for the merge (CompiledRuleset structure
            // expects flat lists with source tracking).
            denyDocs.push(entry.doc);
            allowDocs.push(entry.doc);
            askDocs.push(entry.doc);
        }
        catch (err) {
            if (badFilePolicy === 'fail')
                throw err;
            // warn: skip this file silently.
        }
    }
    // Flatten: deny entries from all files, then allow, then ask.
    // Index numbering is sequential across the entire chain.
    let index = 0;
    const deny = flattenEntries(denyDocs, 'deny', index, opts);
    index += deny.length;
    const allow = flattenEntries(allowDocs, 'allow', index, opts);
    index += allow.length;
    const ask = flattenEntries(askDocs, 'ask', index, opts);
    return {
        defaultAction: entries.length > 0 ? entries[0].doc.defaultAction : 'ask',
        deny,
        allow,
        ask,
        caseInsensitivePaths: opts.caseInsensitivePaths ?? false,
    };
}
/**
 * Flatten a list of PermissionDocs into a single list of CompiledRuleEntry
 * for a specific action partition.
 *
 * Every entry goes through `compileRuleEntry` — the exact compiler the
 * single-file path uses. Building entries by hand here previously left
 * `tools`/`command`/`args`/`paths` as empty arrays, and an empty dimension
 * means "no constraint", so EVERY entry matched EVERY call: the first deny
 * entry denied everything in its partition and the first allow entry allowed
 * everything before the `ask` partition was ever consulted.
 */
function flattenEntries(docs, action, startIndex, opts) {
    const result = [];
    let idx = startIndex;
    for (const doc of docs) {
        const list = action === 'deny' ? doc.deny : action === 'allow' ? doc.allow : doc.ask;
        for (const entry of list) {
            result.push(compileRuleEntry(entry, action, idx++, opts));
        }
    }
    return result;
}
// ─── Cache management ──────────────────────────────────────────────────────
/**
 * Get or create a compiled ruleset from the cache.
 * Returns the cached version if the hash matches; otherwise compiles fresh.
 */
export function cachedCompile(text, opts = {}) {
    const hash = hashText(text);
    const cached = compileCache.get(hash);
    if (cached !== undefined)
        return cached;
    const doc = parsePermissionsDocument(text);
    const compiled = compileDocument(doc, opts);
    compileCache.set(hash, compiled);
    return compiled;
}
/** Clear the compile cache (used in tests and on reload). */
export function clearCompileCache() {
    compileCache.clear();
}
/** Current compile cache size (diagnostics). */
export function compileCacheSize() {
    return compileCache.size;
}
// ─── Helpers ───────────────────────────────────────────────────────────────
function existsSafe(path) {
    try {
        return existsSync(path);
    }
    catch {
        return false;
    }
}
function statSafe(path) {
    try {
        return statSync(path);
    }
    catch {
        return undefined;
    }
}
