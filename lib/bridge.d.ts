/**
 * settings bridge — T12（spec webServer 数据桥规范）：describe/mutate 两端点。
 *
 * 桥只是 HTTP 皮：读 = svc.describe 取自家 ns 描述符；写 = svc.mutate 转 ops 落
 * 宿主 settings 服务（不落盘不缓存第二份，天然规避双写/锁竞争）。mutate 成功即
 * describe 回填，带 expectedRevision 乐观并发。守卫：POST-only + ns 硬编码自家
 * allowlist + 秘密不回读（redactSecrets）。
 *
 * 数据面消费方 = client BridgeDocHandle（T13b 双轨数据源：0.1.7+ 原生句柄优先，
 * ≤0.1.5 settingsScope 不解析时落到本桥——free-search 同架构）。
 *
 * T20-b 泛化（2026-10-08）：路由从 ns 参数派生（bridgeRoutesFor），一个宿主进程
 * 可为多个 ns 各注册一对端点（steward 双 ns：会话管家 + 搜索索引）——客户端与
 * 服务端各自持同一派生式，测试钉死两半一致，URL 契约不可能漂移。
 */
interface SettingsServiceLike {
    update(ns: string, patch: object): Promise<void>;
    register?(ns: string, schema: unknown, options?: {
        base?: unknown;
    }): unknown;
    installSection?(owner: unknown, ns: string, schema: unknown, entry: unknown, hooks: unknown): unknown;
    describe?(o?: {
        redactSecrets?: boolean;
    }): Array<{
        ns: unknown;
        [k: string]: unknown;
    }>;
    mutate?(ns: string, ops: Array<{
        op: string;
        path: string[];
        value?: unknown;
    }>, expectedRevision?: number): Promise<unknown>;
    writable?: boolean;
}
/** 一个 settings ns 的桥路由对——client 与 server 必须同式派生（测试钉死一致）。 */
export declare function bridgeRoutesFor(ns: string): {
    describe: string;
    mutate: string;
};
export declare function registerSettingsBridgeRoutes(server: unknown, getSettingsSvc: () => SettingsServiceLike | undefined, ns: string): Array<() => void>;
export {};
