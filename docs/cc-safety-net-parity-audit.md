# cc-safety-net parity audit — S7（2026-11-22）

范围：S1–S5 落地后（v5.5.6–v5.5.10），对 cc-safety-net 剩余判断项的三项审计与一项附带发现。方法：编译后 lib 上的实测探针 + 源码推演，全部结论可复现（探针脚本存工作区 `.tmp-snet-bench/probe-ps-pipeline.mjs`）。

## A. PowerShell 管道喂删表达力探针（cc `powershell.remove-item-pipeline-dynamic-target`）

**实测结论：现行词汇（params / argv / command+args）在双星上限下无法表达。**

- 目标形状 `Get-ChildItem . -Recurse | Remove-Item -Force`——decomposer 把管道拆成独立 simple command，`remove-item#recursive` 需要 `-Recurse` 旗标，管道喂的 `-Force` 版本不命中任何行 → 现状漏。
- params 原始串形状 `*|*remove-item*` 被 `compileGlob` 拒：**3 个 unbounded star run（前导 + `|` 后 + 尾）> maxStars=2**（实测 PatternError）。任何「中间锚定」的子串形状都要前导星+尾星=2，再加一个锚就爆——这是编译器的结构性边界，不是调参问题。
- 粗形状 `*remove-item*`（2 run）可编译，但 FP 面 = **全部** Remove-Item 调用（`Remove-Item build.log` 这类单文件清理），打扰面不可接受。
- argv 维度拿不到「输入来自管道」的数据流语义；`remove-item -force*` 形状区分不了管道喂与直接跑。

**裁决**：不建表行。精确解是引擎级——decomposer 管道数据流跟踪，「Remove-Item 无显式目标参数（输入来自管道）」即 opaque-target → ask，与本 gate 既有的 `rm.recursive-force-dynamic-target`（`$var` → ask）裁决同构。列为后续引擎段候选。

## B. `network.upload-remote` 重叠审计（curl/wget 非回环上传）

**裁决：不进预设表；登记为 P3 grader 判据增强项。**

- cc 的形状：strict fail_closed——curl/wget 带 body/上传且任一 URL 非回环即拦（预执行、opt-in strict 档）。
- gate 代理面：`NetworkTarget` 只有 host/port/scheme/ips——**无 method/body 语义**，上传行为在连接层不可见；network 维度只能拦特定目标，拦不了「上传行为」。
- gate 预执行面：形状上可行（argv 收 `-T /--upload-file/--data-binary/--form` + network 任一候选命中）——但 FP 面 = **全部带 body 的 curl**（npm publish 的 API 调用、webhook、CI 上报全是常态）。cc 用 opt-in strict 档把这个 FP 交给选择开关；gate 的等价物是 ask 行——而有人值守档上 P3 LLM grader 本来就在 ask 之前做语义分类（「备份外发陌生域」vs「npm publish API」），比静态形状判得更准。
- 结论：静态行只会把 grader 的活干得更粗。归 grader 提示词层（一条上传外发判据），不归规则层。

## C. interpreter 词表 FP 实测（S6 撤回记录；cc `interpreter.dangerous-command` / issue #368）

**实测结论：词表层收 `shutil.rmtree` 不可行，S6 按计划纪律撤回，无发版。**

- 命中面验证通过：`python -c "import shutil; shutil.rmtree('/work/cache')"` 与裸参数形态（`note: "run shutil.rmtree on the target"`）都被 deny-keyword 层命中。
- 但同一机制下 `grep -R "shutil.rmtree" src/`（正当的代码审阅/修复动作）**同样命中 deny**——词边界判定无法区分「执行上下文」（-c 参数里作为语句出现）与「引用上下文」（作为被搜索的字符串字面量出现）。`os.system`/`subprocess` 有海量正当用法，更不可收（R6 论据实测成立）。
- cc 无此 FP 的原因：它把 -c 代码喂回破坏性匹配器做**语义解析**（且 11 月还在补 shutil.rmtree/sed/tar/flock 形态），不是词表。
- 残余风险归属：interpreter one-liner 破坏面继续由 LLM grader（有人值守档）与 defaultAction ask 兜底；`test/deny-keywords.spec.ts` 保留一个 gap 文档测试作为回归镜，防止后来者重蹈词表覆辙。
- 后续段候选：引擎级 interpreter-argument 语义屏（解析 `-c/-e` 参数 → 内嵌破坏性调用喂回既有破坏性判定），与 A 项同属引擎段。

## D. 附带发现：代理层 `parseUrlTarget` 的 IPv6 括号主机

WHATWG URL 的 `hostname` 对 IPv6 主机**带方括号**返回（`http://[fd00:ec2::254]/` → `'[fd00:ec2::254]'`）。S1 的 `network-extract.ts` 已在提取器侧剥括号归一化，但**代理层共用同一个 `parseUrlTarget`（`src/network.ts:230`）**：host 带括号 → `isIpLiteral` 判假 → 目标落成 domain → 预设行 `ips` 字面量（`fd00:ec2::254`）永不匹配。影响面：代理面对 **bracketed-IPv6 形式的 metadata URL** 的拦截失效（IPv4 直连形态不受影响——那才是主流攻击形态）。

**修复建议**（一行，走后续 patch 段）：`parseUrlTarget` 内 `const host = u.hostname.replace(/^\[|\]$/g, '')`，与提取器同款归一化；补一条 bracketed-IPv6 的代理面单测。

## S1–S5 交付账目

| 段 | 版本 | commit | tag | npm latest | 水位 |
|---|---|---|---|---|---|
| S1 云元数据双面闭环 | 5.5.6 | 0be667b | v5.5.6 | ✓ | v2 |
| S2 SSH 私钥变体 | 5.5.7 | 64b6a6d | v5.5.7 | ✓ | v3 |
| S3 敏感扩展名族 | 5.5.8 | 7e9aa0e | v5.5.8 | ✓ | v4 |
| S4 凭据库扩张 | 5.5.9 | 114d4dc | v5.5.9 | ✓ | v5 |
| S5 unshare 用户命名空间 | 5.5.10 | 4bd0138 | v5.5.10 | ✓ | v6 |

每段交付链均走完：双清单 bump → CHANGELOG → typecheck → vitest 全量 → build → `verify-package` V1-V4+V6a+V6b（V5 发布前跳过/发布后对账为同字节期望态）→ commit → tag → push（含 tags）→ `npm publish --registry=https://registry.npmjs.org` → `npm view`/registry 直连复核 latest 指向。

## 后续段候选（本审计产出，未经裁决不启动）

1. **引擎段**：管道数据流跟踪（A）+ interpreter 参数语义屏（C）——一次解构器工程可同场。
2. **patch 段**：`parseUrlTarget` IPv6 括号归一化（D，一行 + 单测）。
3. **grader 段**：P3 提示词增加上传外发判据（B）。
