/**
 * Git command parser - extracts subcommand, branch, remote, flags, destructiveness.
 * P0 priority - most critical for branch permissions.
 *
 * Handles:
 * - git push/force push detection
 * - git branch operations (delete, rename)
 * - git checkout/switch with branch names
 * - git merge/rebase
 * - git reset (soft/hard/mixed)
 * - git clean (destructive file deletion)
 * - git stash operations
 * - git refspec parsing (HEAD:main)
 * - Remote vs branch name disambiguation
 */
import type { CommandParser, CommandSemantics } from '../command-semantics.js';
export declare class GitParser implements CommandParser {
    readonly name = "git";
    readonly priority = 10;
    canParse(command: string): boolean;
    parse(command: string): CommandSemantics | null;
    private analyzeSubcommand;
    private parseGitArgs;
    private extractFlags;
    private extractRemote;
    private extractBranch;
    private extractBranchName;
    private extractRefs;
    /**
     * 目标是否落在保护分支上。
     *
     * **只剥已知的 ref 前缀，不对任意 `/` 取末段。** 早先的写法是
     * `branch.split('/').pop()`，于是：
     *   - `refs/heads/main` → `main`  ✅ 期望如此
     *   - `backup/main`     → `main`  ❌ **误判**（它是含斜杠的普通分支名）
     *   - `feat/release`    → `release` ❌ **误判**
     *
     * 误判方向不是"更安全"。这条判据喂给 P0 硬拒——而 P0 是**不可配置撤销**的
     * （见 engine.ts 顶部："deterministic, monotonic, never negotiated"）。
     * 漏判还有关键词层与 LLM 层兜底，误判则是"合法工作流被永久挡住且无出口"。
     */
    private isProtectedBranch;
}
