# Rules File Format (`permissions` YAML)

> **Authority**: the dimension list below is byte-for-byte identical to `VALID_KEYS` in
> `src/rule.ts:181`. A change to either must be mirrored; `test/rule.spec.ts` and
> `test/rule-dims.spec.ts` are the runtime guards.
> Applies to `dsh-perm-gate` **2.4.1** (DSH ≥ 0.1.2-alpha.1).

---

## 1. Location and loading

| Item | Description |
|---|---|
| Default path | `<dataDir>/rules.yml` (`dataDir` resolved by `config.resolveDataDir`, default `$DSH_HOME/perm-gate/`) |
| Explicit | `config.rulesFile` |
| Rule chain | Multi-file chains supported (`rulesChain` / `searchUp` / `fallbackPath` / `badFilePolicy` / `maxRules`) — see `src/rule-chain.ts` |
| Hot reload | `src/watch.ts` (chokidar) watches the effective files and recompiles the whole chain after a debounce |
| Parse failure | **fail loud** — invalid rules raise, they never silently stand the gate down |

---

## 2. Top level

```yaml
defaultAction: ask        # optional; used when nothing matches. Default: ask
deny:                     # action partitions (arrays)
  - <rule entry>
allow:
  - <rule entry>
ask:
  - <rule entry>
```

**The action IS the partition**: entries carry no `action` field (if present it must agree with its
partition). Evaluation order is fixed: **deny → allow → ask → defaultAction**, first match wins
(deny wins over allow). The keyword blacklist runs ahead of `deny`.

`defaultAction` accepts `allow` | `ask` | `deny` (default `ask`).

---

## 3. Entry fields (`VALID_KEYS`)

```
tools · command · args · paths · params · absent · agents · when · argv · network · branch
action · reason · enabled
```

| Field | Type | Purpose |
|---|---|---|
| `tools` | string / string[] | Tool-name glob |
| `command` | string / string[] | Command word, with `word#recursive` / `word#force` suffixes |
| `args` | string / string[] | Argument token scan |
| `paths` | string / string[] | Workspace-relative path glob |
| `params` | mapping | Parameter key → value glob list |
| `absent` | string / string[] | Parameter keys that must NOT be present |
| `agents` | string / string[] | `main` / `subagent` / `preset:<name>` |
| `when` | mapping | Environment and platform conditions |
| `argv` | mapping | Extra argv patterns (`pipeline`) |
| `network` | mapping | Domain / IP / port / scheme |
| `branch` | mapping | Git branch / remote / protected branch (git commands only) |
| `action` | `allow`\|`ask`\|`deny` | Optional; must agree with its partition |
| `reason` | string | Human-readable rationale (lands in events and the UI) |
| `enabled` | boolean | `false` skips the entry |

**Across dimensions = AND**: every dimension present in one entry must be satisfied.
**Within a dimension = OR**: any single pattern in the list suffices (`params` / `when` /
`network` use AND across their sub-keys — see below).

---

## 4. Dimension semantics

### 4.1 `tools` — tool name
```yaml
- tools: [shell, pwsh, bash]
```
Glob match. OR within the list.

### 4.2 `command` — command word
```yaml
- command: [rm#recursive, rm#force]
```
Words come from argv decomposition (`src/shell.ts`). The `#recursive` / `#force` suffixes
require the corresponding semantics. OR within the list.

### 4.3 `args` — argument tokens
```yaml
- args: ["--force", "-rf"]
```
Scans the decomposed token set. **⚠ Semantics are OR**: any single token matching any single
pattern matches. It can **not** require "`push` and `--force` together", and it can not tell
`git push --force origin main` from `git checkout --force main` — use `params` (or the future
`branch` dimension) when you need that discrimination.

### 4.4 `paths` — paths
```yaml
- paths: ["src/**", "!src/vendor/**"]
```
Workspace-relative globs; `!` negates. OR within the list.

### 4.5 `params` — key-targeted matching (**AND over keys**)
```yaml
- params:
    command: ["*--force*", "!*--dry-run*"]
    flags.mode: ["production"]
```
- Each key's **actual value** must match **at least one** pattern of that key (OR within the list)
- **Every listed key must be satisfied** (AND across keys)
- A single `!`-prefixed pattern negates (the value must NOT match the remainder)
- An empty pattern list only requires the key to exist (any value)

This is the main tool for compound conditions — the AND cases `args` can not express.

### 4.6 `absent` — keys must be missing (AND)
```yaml
- absent: [dry_run, force]
```
Every listed parameter key must be absent.

### 4.7 `agents` — agent identity
```yaml
- agents: ["main", "preset:reviewer"]
```
Valid values: `main`, `subagent`, `preset:<name>` (case-insensitive); anything else fails at parse
time. Candidates come from session headers via `src/agent-identity.ts`. OR within the list.

### 4.8 `when` — environment and platform (AND)
```yaml
- when:
    env:
      NODE_ENV: ["production"]
      CI: ["true", "1"]
    platform: [linux, win32]
```
- `env`: key → allowed values (**OR within a list**, **AND across keys**)
- `platform`: Node.js `process.platform` values
- `nodeVersion`: reserved, not yet evaluated

### 4.9 `argv` — extra argv patterns
```yaml
- argv:
    pipeline: ["curl*|sh", "wget*|bash"]
```
`pipeline` matches the **whole pipeline string**: each simple command's **full argv**
(command word + args + redirect targets) joined by `|`, so `curl https://x.sh | sh`
yields `curl https://x.sh|sh`.

**⚠ The `|` in a pattern is a literal**, so `curl|sh` only matches the argument-less
adjacent form; covering the common form with arguments requires `curl*|sh`.
(Historical defect: the match string was built from the command word alone, so
`curl|sh` matched the harmless `curl|sh` while the genuinely dangerous
`curl https://x.sh | sh` did not match at all.)

### 4.10 `network` — network targets (AND across sub-dimensions)
```yaml
- network:
    domains: ["*.internal.corp", "github.com"]
    ips: ["10.0.0.0/8", "192.168.1.1"]
    ports: ["443", "8000-9000"]
    schemes: [https, http]
```
- Every **present** sub-dimension must match (AND); inside a sub-dimension, OR
- `domains` supports globs; `ips` supports CIDR; `ports` supports ranges; `schemes` are protocol names

The network dimension acts on two seams: the static URL-candidate check in `tools/pre-execute`,
and the loopback proxy that intercepts real egress traffic (`network.enabled` is **false by
default** — opt-in).

### 4.11 `branch` — git branch / remote / protected branch (AND across sub-dimensions)

```yaml
- command: [git]
  args: [push]
  branch:
    target: [main, master, "release*"]
    remote: [origin]
    shared: true
```

| Sub-field | Semantics |
|---|---|
| `target` | Branch-name glob (`*` **crosses** `/`, so `release*` matches `release/1.0`) |
| `remote` | Remote-name glob |
| `shared` | Require the target branch to be a **protected** branch |

**Why this dimension exists**: `args` is OR-over-tokens (§4.3). It can ask "does `--force`
appear?" but never "does `--force` appear **on a push to a protected branch**?". The decisive
case is telling two commands with identical tokens apart:

- `git push --force origin main` → dangerous, must match
- `git checkout --force main` → routine, must **not** match

Candidates come from the shared command classifier (`src/command-dispatcher.ts` +
`src/parsers/git.ts`), so `refspec` forms (`HEAD:main`) are already split, a remote name is
never mistaken for a branch name, and flags are normalized.

**Three boundaries worth knowing**:

1. **Git commands only.** A non-git command (`rm -rf`, `npm install`, …) satisfies no `branch`
   sub-dimension, so a rule that names a branch simply does not match it (and never throws) —
   those commands are covered by the write-path layer and the blacklist.
2. **`shared` is static.** It comes from the parser's protected-branch list
   (`PROTECTED_BRANCHES` in `src/parsers/git.ts`: `main` / `master` / `production` / `release` /
   `stable`). It does **not** run `git branch -r --contains` — that would put a subprocess on the
   decision path. Note `shared` and `target` are independent sub-dimensions: with
   `target: ["release*"]`, `release/1.0` satisfies `target` but not `shared` (the protected list
   matches exactly).
3. **AND across sub-dimensions, OR within each**; any one of several simple commands
   (pipeline / `&&`) may satisfy it.

---

## 5. Complete example

```yaml
defaultAction: ask

deny:
  # Credential material in a command (P0 hard-deny also backs this up)
  - tools: [shell, pwsh]
    params:
      command: ["*AWS_SECRET*", "*PRIVATE KEY*"]
    reason: "credential material in command"

  # Download-and-execute via a pipe
  - argv:
      pipeline: ["curl*|sh", "wget*|bash"]
    reason: "piped download-and-execute"

  # Push to a protected branch (the distinction `args` can not make:
  # the same tokens on a checkout do not match)
  - command: [git]
    args: [push]
    branch:
      target: [main, master, "release*"]
      shared: true
    reason: "push to a protected branch"

  # Forced recursive delete in production
  - command: [rm#recursive, rm#force]
    when:
      env:
        NODE_ENV: ["production"]
    reason: "recursive force delete in production"

allow:
  # Common read-only queries
  - tools: [read, grep, glob]
    reason: "read-only workspace queries"

  # Common dev hosts
  - network:
      domains: [github.com, "*.githubusercontent.com"]
      schemes: [https]
    reason: "common dev hosts"

ask:
  # Push needs confirmation (note: args is OR, so this only requires `push` to appear)
  - command: [git]
    args: ["push"]
    reason: "git push requires confirmation"
```

The same sample ships with the package: `examples/permissions.example.yaml`.

---

## 6. Pairing with the CLI dry-run

Dry-run before you go live:

```powershell
# List the compiled rules (default action, rule count, permissive-strategy snapshot)
dsh-perm-gate --rules permissions.yaml --list

# Evaluate one call (--args is JSON; short values can be inlined)
dsh-perm-gate --rules permissions.yaml --tool read --args "{\"file_path\":\"src/index.ts\"}"
```

The output is JSON: `decision` (`allow` / `ask` / `deny`), `reason`, `audited`.

**Two gotchas worth knowing**:

1. **The blacklist fires before your rules.** The `deny-keyword` layer runs ahead of the `deny:`
   partition, so preset words like `rm -rf` or `push --force` are vetoed before your rules are
   consulted — a `deny-keyword:` prefix in the dry-run output means that layer decided, not your rule.
2. **Long quoted arguments get re-parsed by PowerShell** (you may see
   `--args must be valid JSON`). Safe options: write the JSON to a file and pass
   `--args (Get-Content -Raw args.json)`, or lean on the dimension coverage in
   `test/rule-dims.spec.ts` and `test/evaluate.spec.ts`.

The CLI and the runtime share one decision engine (`evaluate.ts` + `engine.ts`), so its output is
the real verdict.
