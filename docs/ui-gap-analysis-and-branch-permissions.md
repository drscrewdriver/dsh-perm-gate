# dsh-perm-gate UI 缺口分析与分支级权限可行性

> **日期**: 2026-09-16
> **状态**: 草案
> **相关讨论**: PerryLink dsh-auto-review 对比分析

---

## 一、现状：后端能力完整，前端 UI 缺失

### 后端已支持的完整 YAML 规则格式

`rules.yml` 支持 10 个维度的分层权限配置：

```yaml
permissions:
  deny:
    - tools: [shell, pwsh]
      command: [rm#recursive, rm#force]
      reason: "destructive system command"
    
    - args: ["--force"]
      level: deny
      reason: "Force flag detected"

  allow:
    - command: [grep, glob, read]
      reason: "permissive allowlist"
    
    - network:
        domains: [github.com, api.github.com]
      reason: "common dev hosts"

  ask:
    - command: [git]
      args: ["push"]
      reason: "Git push requires confirmation"
```

**VALID_KEYS**: `tools`, `command`, `args`, `paths`, `params`, `absent`, `agents`, `when`, `argv`, `network`, `action`, `reason`, `enabled`

### 前端 UI 面板实际暴露的内容

```
┌─────────────────────────────────────────────┐
│  自动审查 (permissive) 开关                  │
├─────────────────────────────────────────────┤
│  策略选项                                    │
│  ☑ trustAutoAllow                           │
│  ☐ alwaysConfirm                            │
│  ☐ llmAssist                                │
├─────────────────────────────────────────────┤
│  允许列表 (allowlist)                        │
│  [简单字符串列表，支持批量 textarea 编辑]     │
│  ⚠️ 只支持前缀匹配，不支持 YAML 分层规则     │
├─────────────────────────────────────────────┤
│  拒绝关键词 (denyKeywords)                  │
│  [同样只支持简单字符串列表]                   │
└─────────────────────────────────────────────┘
```

### 缺失的 UI 能力

| 功能 | 后端支持 | UI 支持 | 状态 |
|------|---------|---------|------|
| YAML 规则编辑器 | ✅ | ❌ | 需开发 |
| 维度选择器 (tools/command/args/network 等) | ✅ | ❌ | 需开发 |
| 规则级别选择 (deny/allow/ask) | ✅ | ❌ | 需开发 |
| 复合条件编辑 (AND/OR 逻辑) | ✅ | ❌ | 需开发 |
| 规则测试/预览 | ✅ (CLI dry-run) | ❌ | 需开发 |
| 规则导入/导出 | ❌ | ❌ | 需开发 |

---

## 二、UI 补全计划草案

### Phase 1: 最小可行方案 (MVP)

**目标**: 在 UI 中暴露完整的 YAML 规则编辑能力

#### 1.1 YAML 编辑器集成

- 集成 Monaco Editor 或 CodeMirror 支持 YAML 语法高亮
- 支持 `rules.yml` 文件的实时编辑和保存
- 添加 YAML 语法校验和错误提示
- 添加规则格式校验（维度名称、值类型等）

#### 1.2 规则模板系统

- 提供常用规则模板（git push、文件删除、网络访问等）
- 支持从模板快速创建规则
- 模板库可扩展

#### 1.3 规则测试功能

- 添加"测试规则"按钮
- 输入命令字符串，预览规则匹配结果
- 显示哪些维度匹配、哪些不匹配
- 复用 CLI dry-run 逻辑

### Phase 2: 可视化规则编辑器

**目标**: 提供图形化的规则创建界面，降低 YAML 编写门槛

#### 2.1 维度化规则编辑器

```
┌─────────────────────────────────────────────┐
│  新建规则                                    │
├─────────────────────────────────────────────┤
│  规则级别: [▼ deny]                         │
│  原因: [输入框]                              │
├─────────────────────────────────────────────┤
│  匹配条件 (AND 逻辑):                        │
│  [+ 添加条件]                                │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 维度: [▼ command]  模式: [git]      │    │
│  │ 删除                                  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 维度: [▼ args]  模式: [--force]     │    │
│  │ 删除                                  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 维度: [▼ network]  域名: [example.*] │    │
│  │ 删除                                  │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  [预览 YAML]  [保存规则]                     │
└─────────────────────────────────────────────┘
```

#### 2.2 规则分组管理

- 支持按用途分组（安全规则、工作流规则等）
- 支持规则启用/禁用开关
- 支持规则排序（优先级）

#### 2.3 规则冲突检测

- 检测规则间的冲突（deny vs allow）
- 提示规则冗余（被更宽泛的规则覆盖）
- 建议规则优化

### Phase 3: 高级功能

**目标**: 提供生产级规则管理能力

#### 3.1 规则版本控制

- 规则变更历史
- 支持回滚到历史版本
- 与 Git 集成（rules.yml 版本追踪）

#### 3.2 规则导入/导出

- 支持从其他 perm-gate 实例导入规则
- 支持导出规则包
- 支持从模板库导入

#### 3.3 规则审计日志

- 记录规则创建/修改/删除操作
- 记录规则匹配历史
- 支持审计日志查询

---

## 三、分支级权限可行性分析

### 当前 YAML 能否实现 git push 分支级权限？

#### 3.1 args 维度的匹配逻辑

```typescript
// evaluate.ts 第 76-81 行
// args dimension: any token matches any args glob.
if (rule.args.length > 0) {
  const tokens: string[] = []
  for (const cmd of commands) tokens.push(...cmd.args, ...cmd.redirects)
  tokens.push(...pathCands, ...urlCands)
  if (!tokens.some((tok) => rule.args.some((g) => g.re.test(tok)))) return false
}
```

**关键发现：args 是 OR 逻辑，不是 AND 逻辑。**

对于 `git push --force origin main`：
- tokens = [`push`, `--force`, `origin`, `main`]
- args 匹配规则：只要**任意一个 token** 匹配**任意一个 glob 模式**，规则就生效

#### 3.2 能做什么

```yaml
# ✅ 拦截所有带 --force 的命令（不管是不是 push）
- args: ["--force"]
  level: deny
  reason: "Force flag detected"

# ✅ 拦截所有涉及 main 分支的命令
- args: ["main"]
  level: deny
  reason: "Main branch target detected"

# ✅ 拦截所有 git push 命令
- command: [git]
  args: ["push"]
  level: confirm
  reason: "Git push requires confirmation"
```

#### 3.3 不能做什么

```yaml
# ❌ 精确匹配 "git push --force origin main" 这个复合操作
# 因为 args 是 OR 逻辑，无法要求多个 token 同时存在

# ❌ 区分 "git push --force origin main" 和 "git checkout --force main"
# 两者都有 --force 和 main，无法区分

# ❌ 动态判断分支是"个人"还是"共享"
# YAML 是静态 pattern，没有 git 查询能力

# ❌ 匹配分支模式（如 release/*、feature/*）
# args glob 不支持路径段匹配（segments=false）
```

#### 3.4 结论

| 能力 | 状态 | 说明 |
|------|------|------|
| 拦截 force push | ⚠️ 部分可行 | 只能匹配 `--force` token，无法限定是 push 操作 |
| 拦截特定分支 | ⚠️ 部分可行 | 只能硬编码分支名，无法判断共享属性 |
| 复合条件匹配 | ❌ 不可行 | args 是 OR 逻辑，无法要求多个 token 同时存在 |
| 运行时 git 查询 | ❌ 不可行 | YAML 是静态 pattern，无法调用 git 命令 |
| 分支模式匹配 | ⚠️ 部分可行 | 可用 `release*` 匹配，但无法匹配路径段 |

### 3.5 要实现真正的分支级权限，需要

#### 方案 A: 新增 `branch` 维度

```yaml
permissions:
  deny:
    - branch:
        target: "main|master|develop|release/*"
        shared: true  # 动态判断是否共享
      reason: "Force push to shared branch"
```

**实现要求**:
- 运行时调用 `git branch -r --contains <branch>` 查询分支属性
- 查询 `git log --format='%ae' <branch>` 获取提交者信息
- 查询 `git config branch.<name>.remote` 获取远程仓库
- 缓存查询结果（避免重复调用）
- 添加超时机制（防止 git 命令卡住）

#### 方案 B: 改造 args 为 AND 逻辑

```yaml
permissions:
  deny:
    - args_match: AND  # 新语法：要求所有条件同时满足
        - "push"
        - "--force"
        - "origin"
        - "main|master|develop"
      reason: "Force push to shared branch"
```

**实现要求**:
- 修改 args 维度的匹配逻辑（从 OR 改为 AND）
- 添加新语法支持（`args_match: AND`）
- 保持向后兼容（旧的 `args` 保持 OR 逻辑）

#### 方案 C: 新增 `shared-branches` 配置

```yaml
# rules.yml 顶部配置
shared_branches:
  - main
  - master
  - develop
  - "release/*"

permissions:
  deny:
    - command: [git]
      args: ["push", "--force"]
      branch:
        in: shared_branches  # 引用预定义列表
      reason: "Force push to shared branch"
```

**实现要求**:
- 新增 `shared_branches` 配置项
- 新增 `branch` 维度，支持 `in` 操作符引用列表
- 运行时解析分支名，匹配列表中的模式

---

## 四、建议的实施路径

### 短期 (1-2 周)

1. **Phase 1 UI 补全**: 集成 YAML 编辑器，暴露完整的规则编辑能力
2. **文档更新**: 明确说明 YAML 规则的完整能力边界
3. **临时方案**: 在文档中提供手动配置分支级权限的方法（硬编码分支名）

### 中期 (1-2 月)

1. **Phase 2 可视化编辑器**: 提供图形化规则创建界面
2. **args AND 逻辑**: 改造 args 维度，支持复合条件匹配
3. **规则测试功能**: 支持在 UI 中测试规则匹配结果

### 长期 (3-6 月)

1. **branch 维度**: 实现运行时 git 查询，支持动态分支判断
2. **规则版本控制**: 支持规则变更历史和回滚
3. **规则审计日志**: 记录规则匹配历史，支持审计

---

## 五、与 PerryLink dsh-auto-review 的对比总结

| 维度 | dsh-perm-gate | dsh-auto-review | 差距分析 |
|------|--------------|-----------------|----------|
| 规则格式 | YAML 静态规则 | cordis patch 配置 | 格式不同，无法直接兼容 |
| 匹配逻辑 | 模式匹配 (pattern) | AI 语义理解 | 各有优势：模式匹配快，语义理解准 |
| 分支权限 | 不支持动态判断 | 不支持（无分支维度） | 两者都需要新增能力 |
| UI 面板 | 简化接口，缺失 YAML 编辑器 | 完整配置面板 | 我们需要补全 UI |
| 配置入口 | settings.yaml | cordis.patch.yml | 入口不同，无法直接融合 |
| 执行速度 | < 10ms (静态匹配) | 3-60s (AI 审查) | 我们的速度优势明显 |

**核心结论**: 两者是互补关系，不是替代关系。perm-gate 的静态规则适合确定性拦截（速度优先），auto-review 的 AI 审查适合模糊场景（精度优先）。分支级权限是两者都缺失的能力，需要各自实现。
