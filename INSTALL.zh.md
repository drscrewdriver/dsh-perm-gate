# 安装指南

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

`dsh-perm-gate` 版本 **2.1.2**。裁决链、规则文件格式与自动审查档位请见
[中文 README](./README.zh.md)。

## 前置条件

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。
- Node.js **>= 20**（见 `package.json` 的 `engines`）。
- `dsh` CLI 已在 `PATH` 中。
- 需要一个目标 profile —— 浏览器端只为 `web` profile 构建（`package.json`
  里 `dsh.client.platform = "web"`）。

## 按你的 DSH 版本选择 tag

单一构建同时覆盖两条 DSH 线，所以任一 tag 安装的代码都能工作 —— 保留 tag
是为了让你锁定的版本在每条线上都有意义。

| 你的 DSH | 安装方式 |
|----------|----------|
| `0.1.2-alpha.1` 或更高（含 `0.1.5-rc.2`） | `dsh plugin --profile web add dsh-perm-gate`（tag `latest`） |
| 不高于 `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH 不强制 `engines.dsh`，因此 tag 是选择机制而非兼容性关卡。
详见 [RELEASING.md](./RELEASING.md) 了解为何单一制品覆盖两条线以及 tag 的发布方式。

## 用官方 CLI 安装

```sh
dsh plugin --profile web add dsh-perm-gate
```

该命令会拉取已发布的包、应用 `cordis.patch.yml`（自动审查会话档位 + 插件条目），
并装配 host / client 两半。

## 从源码安装

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts，tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` 同时是 `prepublishOnly` 步骤，所以发布时不会带出过期的 `lib/`。

## 启用与配置

在 profile 的 `cordis.yml` 中加入插件：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # 可选；默认 $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # 受保护目标检查的钉死根目录
    defaultAction: ask              # allow | ask | deny
```

可从 [examples/permissions.example.yaml](./examples/permissions.example.yaml) 起步，
然后重载 profile。

## 升级

```sh
dsh plugin --profile web update dsh-perm-gate
```

随后重新应用 profile 以重读补丁文件：

```sh
dsh profile reload --profile web
```

## **DSH** 升级后：重打输入区图标补丁

「自动审查（高权限）」之所以和「自动审查」一样显示盾+眼图标，只是因为
`scripts/patch-permission-glyph.mjs` 把这一项加进了 **DSH 宿主包里的一张封闭 Map**。
DSH 对插件档位**设计上就不给图标** —— 那张表自己的注释写着 *"host-configured
names outside the design set get none"*；而插件能影响的 option 对象只携带
`{value, name, description}`，所以插件侧没有可用的接缝。

该补丁改的是**宿主**文件，因此 **DSH 升级或重装会把它抹掉**。升级*本插件*不会：
图标从来不属于插件，而插件自己的贡献（`cordis.patch.yml` 里的 `name:` /
`description:`）随包发布。

```sh
npx dsh-perm-gate-patch-glyph            # 应用补丁
npx dsh-perm-gate-patch-glyph --check    # 只检查；图标已丢失时退出码为 1
dsh profile reload --profile web
```

脚本**随本包分发** —— 既是 `scripts/patch-permission-glyph.mjs`，也是一个
`dsh-perm-gate-patch-glyph` bin —— 所以不需要源码 checkout。它**故意没有**挂在
`postinstall` 上：它改的是宿主包，插件不该未经许可改写自己所在的 harness。有没有它
都不影响 DSH 运行，档位本身照常工作。

脚本是幂等的（重复执行是 no-op），只备份一次，且拒绝写坏切片 —— 它会对结果跑
`node --check`，失败即还原备份 —— 所以每次 DSH 升级后无条件重跑都是安全的。
它从运行中的 `node` 二进制反推包路径，因此 nvm 换版本或安装软链重指都不会让它失效。

**重装插件并不会恢复图标。**`dsh plugin --profile web add …` 只是把参数转发给
profile 目录里的 pnpm，只写 profile 自己的 `node_modules`；`-w`
（`--workspace-root`，而本 profile 的 workspace 就是 `packages: ['.']`）对此没有
任何改变。图标住在 DSH 安装里。在标准安装上，下面三条路径不是三份副本，而是
**同一个物理文件**：

| 路径 | 实际是什么 |
|------|-----------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | DSH 安装位（可能是软链） |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | 指向它的**目录联接（junction）** |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | 被补丁的那个文件 |

要观察的现象：档位依然工作、门禁依然生效，但它在输入区下拉里那一行没有图标，
收起后的触发器显示纯文字，而同排其他档位是图标+文字。

## 从分裂的插件迁移

`dsh-perm-gate` 把原先散落在 `dsh-permission-rules`、`dsh-auto-mode`、
`dsh-auto-review`、`dsh-movein-permissions` 中的门禁、审批接缝与（可选）分类器
合并为一个包。

1. 导出既有规则列表（deny / allow / ask），合并到同一个 `permissions.yaml`。
2. 从 `cordis.yml` 删除上述四个插件，只加入唯一的 `dsh-perm-gate` 条目。
3. 删除这些插件贡献的 preset 覆盖 —— `cordis.patch.yml` 是**整体替换**
   `permission.config.presets`，其他插件遗留的逐 key 补丁可能静默抹掉
   自动审查档（或某个内置档）。
4. 重载 profile，并用下面的 `--list` 验证。

## 验证

```sh
# 汇总已加载的规则集（无需 harness）
dsh-perm-gate --rules permissions.yaml --list

# 对单次调用 dry-run
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

`--list` 的输出形如：

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

UI 里 **设置 → 插件 → 自动审查** 应渲染出一个开关加四个后台策略开关。

## 卸载

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

移除插件也会移除它的补丁贡献，自动审查档位会重新从会话权限下拉框消失。

## 排查

**权限下拉框里没有自动审查档。**
DSH 的 bundle patch 是整体替换 `permission.config.presets`，而非逐 key 合并。
请重载 profile 让 `cordis.patch.yml` 重新生效，并确认没有更晚加载的插件覆盖了
`presets`。

**「自动审查（高权限）」在输入区丢了图标。**
DSH 升级或重装替换了被打了补丁的宿主 bundle；重装插件不会把它带回来。执行
`npx dsh-perm-gate-patch-glyph` 后重载即可。档位本身不受影响 ——
没有补丁，它的标签与门禁照常工作。

**规则文件存在但 `--list` 显示 `ruleCount: 0`。**
`rulesFile` 按 harness 进程的 CWD 解析，而不是插件目录。建议使用绝对路径，
或确认 shell 的 CWD。格式错误的文档在加载时 loud fail，绝不会静默失效。

**`llmAssist` 从不触发。**
需要配置 `classifierEndpoint`、`classifierModel`、`classifierApiKey`
（在 **设置 → 插件 → 自动审查** 或 `cordis.yml` 中填写）。
任一缺失或网络错误都会回退到人工接缝 —— 门禁按设计 fail-closed。

**「审批记录」页一直是空的。**
门禁只在 `gatePresets` 列出的档位里工作（默认 `['permissive']`，即下拉框里的
「自动审查」），会话处在别的档位时它不记录任何事件——请在权限下拉框为本会话选择
「自动审查」。从未选过档位的会话同样在范围之外。新会话的初始档位由
`permission.defaultPreset` 设置决定。

**设置卡片显示「设置命名空间不可用」。**
该插件未装配进当前 profile。执行 `dsh plugin --profile web add dsh-perm-gate`
并重载。

**选择 `ja` / `ko` 报 `locale "<id>" is not registered`。**
官方 DSH 的 `LocaleRuntime` 只暴露 `zh` / `en`，详见
[中文 README](./README.zh.md) 的兼容性说明。

## 许可证

[MIT](./LICENSE)
