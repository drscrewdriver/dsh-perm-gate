/**
 * debug-generation — T10b served 集合诊断端点（临时，上线前删，spec served 七步第 2 步）。
 *
 * GET /api/dsh-perm-gate/debug-generation
 * 返回插件持有的 settings 服务实例自检：全量 describe 的 ns 列表 + 方法面。
 * 判读：ns 列表若同时含 dsh-perm-gate / dsh-session-guard / dsh-free-search-settings
 * 等其他插件命名空间 → 持有的是宿主共享单例（identitySame=TRUE，H3 孤儿假设死）；
 * 若只有自家 ns → 孤儿实例坐实（H3 成立）。
 */
interface SettingsServiceLike {
    update(ns: string, patch: object): Promise<void>;
    register?(ns: string, schema: unknown, options?: {
        base?: unknown;
    }): unknown;
    installSection?(owner: unknown, ns: string, schema: unknown, entry: unknown, hooks: unknown): unknown;
    describe?(): Array<{
        ns: unknown;
    }>;
}
export declare const DEBUG_GENERATION_ROUTE = "/api/dsh-perm-gate/debug-generation";
export declare function registerDebugGenerationRoute(server: unknown, getSettingsSvc: () => SettingsServiceLike | undefined): (() => void) | undefined;
export {};
