/**
 * tui-command.ts — `/gate`：权限门（perm-gate）的 dsh-tui 终端面。
 *
 * 背景：dsh-tui 不加载 client 半边（history 卡片 / 规则页不执行），工具审批只显示
 * `toolName` 一行。于是「这条命令为什么被拦 / 规则文件长什么样」在终端里无从查证。
 * 命令面只读 + 干跑：
 *   status = 规则文件路径/默认动作
 *   rules  = allow/deny/ask 计数
 *   why    = 对一条命令跑 dry-run，输出判定链（不执行命令）
 *
 * 契约（.agents/plans/dsh-tui-faces/spec.md §3）：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */
import type { Context } from '@deepseek-ai/cordis';
export type CommandKind = 'success' | 'error';
export interface CommandResult {
    kind: CommandKind;
    text: string;
}
export interface GateRulesView {
    path: string;
    exists: boolean;
    bytes: number;
    lines: number;
    truncated: boolean;
    defaultAction?: string;
    counts: {
        allow: number;
        deny: number;
        ask: number;
    };
}
export interface GateVerdict {
    decision?: string;
    reason?: string;
    layers?: Array<{
        name?: string;
        decision?: string;
        reason?: string;
    }>;
    [key: string]: unknown;
}
export interface GateCommandDeps {
    rules(): GateRulesView;
    evaluate(command: string): GateVerdict;
    /** 最近的审计环条目（只读；宿主把审批/判定写进 MemoryAuditMirror）。 */
    history(limit: number): Array<{
        at?: number;
        tool?: string;
        decision?: string;
        reason?: string;
    }>;
    /** 会话级授权清单（只读）。 */
    grants(): Array<{
        tool: string;
        expiresAt: number;
        remaining: number;
    }>;
}
export declare function clip(text: string, width?: number): string;
export declare function renderLines(lines: string[], limit?: number): string;
/** 纯函数入口。 */
export declare function runGateCommand(rawInput: string, deps: GateCommandDeps): CommandResult;
/** 注册 `/gate`：无 commands 服务时静默跳过（老线安全）。 */
export declare function registerGateCommand(ctx: Context, deps: GateCommandDeps): void;
