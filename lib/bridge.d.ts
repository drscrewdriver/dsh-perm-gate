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
export declare const BRIDGE_DESCRIBE_ROUTE = "/api/dsh-perm-gate/settings/describe";
export declare const BRIDGE_MUTATE_ROUTE = "/api/dsh-perm-gate/settings/mutate";
export declare function registerSettingsBridgeRoutes(server: unknown, getSettingsSvc: () => SettingsServiceLike | undefined, ns: string): Array<() => void>;
export {};
