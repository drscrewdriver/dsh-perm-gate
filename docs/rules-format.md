# 规则文件格式规范（`permissions` YAML）

> **权威性**：本文件的维度清单与 `src/rule.ts:181` 的 `VALID_KEYS` **逐字一致**。
> 两者任一变更必须同步；`test/rule.spec.ts` 与 `test/rule-dims.spec.ts` 是运行时护栏。
> 适用版本：`dsh-perm-gate` **2.4.1**（DSH ≥ 0.1.2-alpha.1）。

---

## 1. 文件位置与加载

| 项 | 说明 |
|---|---|
| 默认路径 | `<dataDir>/rules.yml`（`dataDir` 由 `config.resolveDataDir` 解析，默认 `$DSH_HOME/perm-gate/`） |
| 显式指定 | `config.rulesFile` |
| 规则链 | 支持多文件链（`rulesChain` / `searchUp` / `fallbackPath` / `badFilePolicy` / `maxRules`），见 `src/rule-chain.ts` |
| 热重载 | 由 `src/watch.ts`（chokidar）监听生效规则文件，防抖后链级重编译 |
| 解析失败 | **fail loud**——规则非法直接报错，绝不静默停用门控 |

---

## 2. 顶层结构

```yaml
defaultAction: ask        # 可选；无任何规则命中时的动作。缺省 = ask
deny:                     # 动作分区（数组）
  - <规则条目>
allow:
  - <规则条目>
ask:
  - <规则条目>
```

**动作即分区**：条目本身不带 action 字段（写了必须与所在分区一致）。求值顺序固定为
**deny → allow → ask → defaultAction**，首次匹配胜出（deny wins over allow）。
黑名单关键词层排在 deny 之前。

`defaultAction` 取值：`allow` | `ask` | `deny`（缺省 `ask`）。

---

## 3. 规则条目可用字段（`VALID_KEYS`）

```
tools · command · args · paths · params · absent · agents · when · argv · network · branch
action · reason · enabled
```

| 字段 | 类型 | 作用 |
|---|---|---|
| `tools` | 字符串 / 字符串数组 | 工具名 glob |
| `command` | 字符串 / 字符串数组 | 命令词，支持 `word#recursive` / `word#force` 后缀 |
| `args` | 字符串 / 字符串数组 | 参数 token 扫描 |
| `paths` | 字符串 / 字符串数组 | 工作区相对路径 glob |
| `params` | 映射 | 参数键 → 值 glob 列表 |
| `absent` | 字符串 / 字符串数组 | 必须**不存在**的参数键 |
| `agents` | 字符串 / 字符串数组 | `main` / `subagent` / `preset:<name>` |
| `when` | 映射 | 环境与平台条件 |
| `argv` | 映射 | 额外 argv 模式（`pipeline`） |
| `network` | 映射 | 域名 / IP / 端口 / scheme |
| `branch` | 映射 | git 分支 / 远程 / 保护分支（仅对 git 命令生效） |
| `action` | `allow`\|`ask`\|`deny` | 可选；写了必须与所在分区一致 |
| `reason` | 字符串 | 人类可读理由（进入事件与 UI） |
| `enabled` | 布尔 | 设 `false` 则跳过该条目 |

**跨维度逻辑 = AND**：一条规则内出现的**多个维度必须全部满足**；
**维度内 = OR**：某个维度的列表里任一模式命中即可（`params`/`when`/`network` 的子键为 AND，见各节）。

---

## 4. 逐维语义

### 4.1 `tools` — 工具名
```yaml
- tools: [shell, pwsh, bash]
```
Glob 匹配工具名。列表内 OR。

### 4.2 `command` — 命令词
```yaml
- command: [rm#recursive, rm#force]
```
命令词来自 argv 分解（`src/shell.ts`）。后缀 `#recursive` / `#force` 分别要求递归 / 强制语义。
列表内 OR。

### 4.3 `args` — 参数 token
```yaml
- args: ["--force", "-rf"]
```
对分解后的 token 集合做扫描。**⚠ 语义为 OR**：任意一个 token 匹配任意一个模式即命中。
它**无法**要求「`push` 与 `--force` 同时存在」，也无法区分
`git push --force origin main` 与 `git checkout --force main`——需要这种区分时用 `params` 或（未来的）`branch` 维度。

### 4.4 `paths` — 路径
```yaml
- paths: ["src/**", "!src/vendor/**"]
```
工作区相对路径 glob；`!` 前缀取反。列表内 OR。

### 4.5 `params` — 键定向匹配（**AND over keys**）
```yaml
- params:
    command: ["*--force*", "!*--dry-run*"]
    flags.mode: ["production"]
```
- 每个键的**实际值**必须匹配该键模式列表中的**至少一个**（列表内 OR）
- **所有列出的键都必须满足**（键之间 AND）
- 单个 `!` 前缀模式 = 取反（值必须**不**匹配其余部分）
- 空模式列表 = 该键只需存在（任意值）

这是表达复合条件的主要手段（`args` 做不到的 AND 需求在这里做）。

### 4.6 `absent` — 键必须缺失（AND）
```yaml
- absent: [dry_run, force]
```
所列参数键必须**全部不存在**。

### 4.7 `agents` — 代理身份
```yaml
- agents: ["main", "preset:reviewer"]
```
合法取值：`main`、`subagent`、`preset:<name>`（大小写不敏感）。非法值解析期报错。
候选集由 `src/agent-identity.ts` 从会话 header 提取。列表内 OR。

### 4.8 `when` — 环境与平台（AND）
```yaml
- when:
    env:
      NODE_ENV: ["production"]
      CI: ["true", "1"]
    platform: [linux, win32]
```
- `env`：键 → 允许值列表（**列表内 OR**，**键之间 AND**）
- `platform`：Node.js `process.platform` 取值
- `nodeVersion`：保留字段（尚未参与判定）

### 4.9 `argv` — 额外 argv 模式
```yaml
- argv:
    pipeline: ["curl*|sh", "wget*|bash"]
```
`pipeline` 匹配**整条管道字符串**：各简单命令的**完整 argv**（命令词 + 参数 + 重定向目标）以 `|` 连接，
例如 `curl https://x.sh | sh` 的匹配串是 `curl https://x.sh|sh`。

**⚠ 模式里的 `|` 是字面量**，所以 `curl|sh` 只匹配参数恰好为空的紧邻形式；要覆盖带参数的常见写法必须写
`curl*|sh`。（历史缺陷：匹配串曾只取命令词，`curl|sh` 因此对上的是无害的 `curl|sh`，而真正危险的
`curl https://x.sh | sh` 反而匹配不到。）

### 4.10 `network` — 网络目标（子维度 AND）
```yaml
- network:
    domains: ["*.internal.corp", "github.com"]
    ips: ["10.0.0.0/8", "192.168.1.1"]
    ports: ["443", "8000-9000"]
    schemes: [https, http]
```
- 出现的**每个子维度都必须匹配**（子维度之间 AND）；每个子维度内部 OR
- `domains` 支持 glob；`ips` 支持 CIDR；`ports` 支持区间；`schemes` 为协议名

网络维度有两个生效面：`tools/pre-execute` 的静态 URL 候选检查，以及回环代理拦截真实出站流量
（`network.enabled` **默认 false**，opt-in）。

### 4.11 `branch` — git 分支 / 远程 / 保护分支（子维度 AND）

```yaml
- command: [git]
  args: [push]
  branch:
    target: [main, master, "release*"]
    remote: [origin]
    shared: true
```

| 子字段 | 语义 |
|---|---|
| `target` | 分支名 glob（`*` **跨** `/`，所以 `release*` 能匹配 `release/1.0`） |
| `remote` | 远程名 glob |
| `shared` | 要求目标分支是**保护分支** |

**为什么需要这个维度**：`args` 是 OR 语义（§4.3），它能问「`--force` 出现了吗」，但永远问不出
「`--force` 是否用在**推送到保护分支**上」。决定性用例是区分两条 token 完全相同的命令：

- `git push --force origin main` → 危险，应命中
- `git checkout --force main` → 日常操作，**不**应命中

候选来自统一的命令分类器（`src/command-dispatcher.ts` + `src/parsers/git.ts`），因此
refspec 形式（`HEAD:main`）已被拆解、远程名不会被误当成分支名、标志位也已归一。

**三条必须知道的边界**：

1. **只对 git 命令生效**。非 git 命令（`rm -rf`、`npm install`…）不满足任何 `branch` 子维度，
   因此带 `branch` 的规则对它们**不匹配**（不会抛错）——这类命令由写路径层与黑名单层负责。
2. **`shared` 是静态判定**，来自解析器的保护分支清单
   （`src/parsers/git.ts` 的 `PROTECTED_BRANCHES`：`main` / `master` / `production` / `release` / `stable`）。
   它**不会**执行 `git branch -r --contains` 之类查询——那会把子进程放上门控决策路径。
   注意 `shared` 与 `target` 是**并列且各自独立**的子维度：写了 `target: ["release*"]` 时
   `release/1.0` 满足 `target`，但不满足 `shared`（保护清单是精确匹配）。
3. **子维度之间 AND，各自内部 OR**；多个简单命令（管道/`&&`）任一满足即可。

---

## 5. 完整示例

```yaml
defaultAction: ask

deny:
  # 凭据材料外泄（P0 层另有硬拒绝兜底）
  - tools: [shell, pwsh]
    params:
      command: ["*AWS_SECRET*", "*PRIVATE KEY*"]
    reason: "credential material in command"

  # 管道下载即执行
  - argv:
      pipeline: ["curl*|sh", "wget*|bash"]
    reason: "piped download-and-execute"

  # 推送到保护分支（args 做不到的区分：同一批 token 的 checkout 不命中）
  - command: [git]
    args: [push]
    branch:
      target: [main, master, "release*"]
      shared: true
    reason: "push to a protected branch"

  # 生产环境下的强制删除
  - command: [rm#recursive, rm#force]
    when:
      env:
        NODE_ENV: ["production"]
    reason: "recursive force delete in production"

allow:
  # 常见只读查询
  - tools: [read, grep, glob]
    reason: "read-only workspace queries"

  # 常见开发域名
  - network:
      domains: [github.com, "*.githubusercontent.com"]
      schemes: [https]
    reason: "common dev hosts"

ask:
  # 推送需确认（注意：args 是 OR，这里只要求出现 push）
  - command: [git]
    args: ["push"]
    reason: "git push requires confirmation"
```

同一份示例也随包分发：`examples/permissions.example.yaml`。

---

## 6. 与 CLI dry-run 配合

改完规则**先干跑再上线**：

```powershell
# 列出已编译规则（默认 ask 分区、规则条数、permissive 策略快照）
dsh-perm-gate --rules permissions.yaml --list

# 判定一次调用（--args 是 JSON；参数较短时直接内联）
dsh-perm-gate --rules permissions.yaml --tool read --args "{\"file_path\":\"src/index.ts\"}"
```

输出为 JSON：`decision`（`allow` / `ask` / `deny`）、`reason`、`audited`。

**两个必须知道的坑**：

1. **黑名单先于规则命中**。`deny-keyword` 层跑在 `deny:` 分区之前，
   `rm -rf` / `push --force` 这类预设词会在你的规则之前就把调用拦下——
   dry-run 输出里的 `deny-keyword:` 前缀就是它在起作用，不是你的规则。
2. **带引号的长参数在 PowerShell 下会被二次解析**（可能报 `--args must be valid JSON`）。
   稳妥做法：写进临时文件后用 `--args (Get-Content -Raw args.json)`，
   或直接依赖 `test/rule-dims.spec.ts` 与 `test/evaluate.spec.ts` 的维度覆盖。

CLI 与运行时共用同一判定引擎（`evaluate.ts` + `engine.ts`），输出即真实裁决。
