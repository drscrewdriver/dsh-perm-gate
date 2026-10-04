/**
 * sid.ts —— AppContainer 容器 SID 的形状校验与容器名常量。
 *
 * 派生**不在 Node 侧做**：自造 S-1-15-2 SID（sha256 排序等任何手工形状）会被
 * `NtCreateLowBoxToken` 以 STATUS_INVALID_SID (0xC0000030) 拒绝——容器 SID 必须由
 * OS 自己的推导产生（launcher 的 `--print-sid` 走官方
 * `DeriveAppContainerSidFromName`，Win8+，名字确定则 SID 确定，机器内稳定，
 * 回环豁免与 ACL 授予因此终身复用）。本模块只保留：容器名（改名字 = 换 SID =
 * 旧豁免/旧 ACE 全部脱靶）与 SID 字符串形状校验。
 */
/** The fixed AppContainer container name — changing it invalidates every
 * standing exemption/ACE (it derives a brand-new SID). */
export declare const APPCONTAINER_NAME = "dsh-perm-gate.ac";
export declare const APPCONTAINER_AUTHORITY = "S-1-15-2";
/**
 * Structural check for an AppContainer SID string — an OPAQUE handle check.
 *
 * 实测（2026-10-05，26200）：经典派生为 4 子权限，新代 moniker 派生与真实
 * UWP 包 SID 为 7 子权限，且**非单调**——校验只认 `S-1-15-2` 权威前缀 +
 * ≥4 个 uint32 子权限，绝不假设数量或排序（自造 SID 本就被内核拒收，
 * 这里只是形状门，不是派生器）。
 */
export declare function isAppContainerSid(sid: string): boolean;
