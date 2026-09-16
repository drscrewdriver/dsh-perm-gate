# Baseline Snapshot: feat/capability-absorption

> Captured at T0.3/T0.4 on 2026-09-15
>
> **为什么这份快照留在仓库里**：下面那 30 个测试文件是能力吸收（6 维度 / 网络执行面 / 热重载）
> 落地**之前**的既有覆盖，充当回归护栏——新增行为**不得**靠修改它们来适配。
> 原位置 `.agents/baseline-snapshot.md` 未入库（`.agents/` 是仓库惯例的本地目录），
> 2026-09-17 迁到 `docs/` 以便随包分发、可追溯。
> 注意：仓库当前已有 **40** 个测试文件；本列表是**护栏基线**，不是当前全量清单。

## Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| typecheck | ✅ 0 errors | After pre-existing fix commit |
| test | ✅ 278/278 | 30 spec files |
| build | ✅ tsc + tsdown | client.js 99.95 kB |
| lint | ✅ 0 errors | — |

## Pre-existing Fixes (committed)

- `src/risk.ts:137-138` — cast `req.args` to `Record<string, unknown>` (was `{}`)
- `src/runtime.ts:26` — add `import { decomposeShellCommand } from './shell.js'`

## Test File List (30 files, DO NOT modify to accommodate new behavior)

1. audit.spec.ts
2. auto-allow-tools.spec.ts
3. compiler.spec.ts
4. custom-llm.spec.ts
5. data-home.spec.ts
6. deny-keywords.spec.ts
7. deny-keywords-scope.spec.ts
8. engine.spec.ts
9. evaluate.spec.ts
10. events.spec.ts
11. feature.spec.ts
12. grant.spec.ts
13. host-llm.spec.ts
14. learning.spec.ts
15. manual-approval.spec.ts
16. patch-presets.spec.ts
17. permissive.spec.ts
18. pre-execute.spec.ts
19. preset-scope.spec.ts
20. review.spec.ts
21. risk.spec.ts
22. rule.spec.ts
23. runtime.spec.ts
24. runtime-risk.spec.ts
25. sediment.spec.ts
26. session-resolution.spec.ts
27. session-sweep.spec.ts
28. session-sweep-apply.spec.ts
29. shell.spec.ts
30. write-path.spec.ts
