# Plan: rules.yml → DSH Settings Namespace Migration

## Goal

Eliminate the external `rules.yml` file dependency by migrating rules into the DSH settings namespace (`dsh-perm-gate.rules`). This solves the cold-start directory problem at the root cause: settings are managed by the framework and loaded before any plugin `apply()` runs.

## Current Architecture

```
User edits rules.yml (or allowlist card writes to it)
  ↓
resolveRulesFile() → path string
  ↓
readFileSafe() → raw YAML text
  ↓
parsePermissionsDocument() → structured doc
  ↓
compileDocument() → CompiledRuleset
  ↓
PermGateRuntime.decide() → verdict
```

Read-only view:
```
GET /api/dsh-perm-gate/rules
  → readRulesView(rulesFile)
    → statSync + readFileSync + parse + compile
    → RulesView { path, exists, bytes, hash, raw, counts, error }
```

Write path (allowlist card):
```
appendAllowCommand() / replaceAllowCommands()
  → readFileSync → parse → mutate → stringify → writeFileSync
```

## Target Architecture

```
User edits via settings card (or API)
  ↓
settings.get('dsh-perm-gate.rules') → structured object (already parsed)
  ↓
compileDocument(rules) → CompiledRuleset
  ↓
PermGateRuntime.decide() → verdict
```

Read-only view:
```
GET /api/dsh-perm-gate/rules
  → settings.get('dsh-perm-gate.rules')
    → RulesView { source: 'settings', rules: {...}, counts, hash }
```

Write path (allowlist card):
```
settings.update({ rules: { allow: [...] } })
  → framework persists to settings.yaml
  → settings.watch() triggers reload
```

## Schema (config.ts)

```typescript
// New settings schema for rules
const RuleEntrySchema = z.object({
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  network: z.object({
    domains: z.array(z.string()),
  }).optional(),
  reason: z.string().default(''),
})

const RulesSchema = z.object({
  defaultAction: z.enum(['allow', 'deny', 'ask']).default('ask'),
  deny: z.array(RuleEntrySchema).default([]),
  allow: z.array(RuleEntrySchema).default([]),
  ask: z.array(RuleEntrySchema).default([]),
  network: z.object({
    domains: z.array(z.string()).default([]),
  }).optional(),
}).default({ defaultAction: 'ask', deny: [], allow: [] })
```

## Migration Steps

### Phase 1: Dual-Source (backward compatible)

1. **Add `rules` to settings schema** — new field in `dsh-perm-gate` namespace
2. **Runtime reads from settings first, falls back to file** — `settings.get('rules') ?? loadRulesFile()`
3. **Allowlist card writes to settings** — `settings.update({ rules: { allow: [...] } })`
4. **Rules view serves from settings** — `readRulesView()` reads from settings object, not file
5. **Module-level: still create dataDir** — belt-and-suspenders for the transition period

### Phase 2: File Deprecation

6. **Log deprecation warning** — when `rulesFile` is configured, warn that it's deprecated
7. **Import button** — UI can import existing `rules.yml` into settings
8. **Export button** — UI can export settings rules as YAML for version control

### Phase 3: File Removal

9. **Remove `rulesFile` config option** — no longer accepted
10. **Remove file I/O code** — `allowlist.ts`, `rules-view.ts` file operations
11. **Remove chokidar watcher** — settings has built-in `watch()`
12. **Remove dataDir bootstrap** — no longer needed

## How the Read-Only View Changes

### Before (file-based)

```json
{
  "path": "C:\\Users\\joshua\\.dsh\\perm-gate\\rules.yml",
  "exists": true,
  "bytes": 1513,
  "hash": "abc123...",
  "lines": 61,
  "raw": "permissions:\n  defaultAction: ask\n  deny:\n    ...",
  "truncated": false,
  "defaultAction": "ask",
  "counts": { "allow": 11, "deny": 1, "ask": 0 },
  "error": null
}
```

### After (settings-based)

```json
{
  "source": "settings",
  "defaultAction": "ask",
  "counts": { "allow": 11, "deny": 1, "ask": 0 },
  "hash": "abc123...",
  "rules": {
    "defaultAction": "ask",
    "deny": [
      { "tools": ["shell", "pwsh"], "command": ["rm#recursive"], "reason": "destructive" }
    ],
    "allow": [
      { "command": ["grep"], "reason": "permissive allowlist" }
    ],
    "network": {
      "domains": ["github.com", "registry.npmjs.org"]
    }
  }
}
```

**Key differences:**
- `path` / `exists` / `bytes` / `raw` / `truncated` → removed (no file)
- `source: 'settings'` → added (provenance)
- `rules` → the structured object (already parsed, not raw YAML)
- `counts` / `defaultAction` / `hash` → kept (useful for UI)

## How the Allowlist Write Path Changes

### Before (file-based)

```typescript
// appendAllowCommand reads YAML, mutates, writes back
appendAllowCommand(rulesFile, 'git push', 'permissive allow-everywhere')
// → readFileSync → parse → push → stringify → writeFileSync
```

### After (settings-based)

```typescript
// Direct settings update
const current = settings.get('dsh-perm-gate.rules')
const allow = [...(current.allow ?? []), { command: ['git push'], reason: 'permissive allow-everywhere' }]
settings.update({ rules: { ...current, allow } })
// → framework persists → settings.watch() triggers reload
```

## Files Changed

| File | Change |
|---|---|
| `src/config.ts` | Add `RulesSchema`, keep `resolveRulesFile` for backward compat |
| `src/index.ts` | Read from settings first, fall back to file; register settings schema |
| `src/runtime.ts` | Accept `rules` object directly (no file read) |
| `src/rules-view.ts` | Add `readRulesViewFromSettings()` |
| `src/allowlist.ts` | Add `appendAllowToSettings()`, `replaceAllowInSettings()` |
| `src/events.ts` | Update `registerRulesRoute` to use settings view |
| `src/watch.ts` | Remove chokidar watcher (settings has built-in watch) |

## Cold-Start Resilience (All Plugins)

The same pattern should be applied to other plugins that read files at startup:

| Plugin | Data | Risk | Fix |
|---|---|---|---|
| `dsh-perm-gate` | rules.yml | HIGH | Settings migration (this plan) |
| `dsh-search-index` | index files | MEDIUM | dataDir bootstrap + try/catch |
| `dsh-session-guard` | guard config | LOW | Already settings-backed |
| `dsh-prime-memory` | memory files | MEDIUM | dataDir bootstrap + try/catch |
| `dsh-context-compression` | config | LOW | Already settings-backed |

**Universal pattern:**
1. Module-level `ensureDataDir()` — belt
2. Read paths: `dataDirReady()` check → empty defaults if missing
3. Write paths: `ensureDataDir()` before first write
4. All file reads wrapped in try/catch with graceful fallback

## Testing

- [ ] Unit: `compileDocument` with settings-sourced rules (same as YAML-sourced)
- [ ] Unit: `readRulesViewFromSettings` returns correct `RulesView`
- [ ] Unit: `appendAllowToSettings` correctly mutates settings object
- [ ] Integration: settings card reads and displays rules
- [ ] Integration: allowlist card writes persist to settings
- [ ] Migration: existing `rules.yml` imports into settings correctly
- [ ] Cold start: plugin loads with empty settings (no rules configured)
