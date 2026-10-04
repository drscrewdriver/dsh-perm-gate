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
export const APPCONTAINER_NAME = 'dsh-perm-gate.ac'

export const APPCONTAINER_AUTHORITY = 'S-1-15-2'

/** Structural check for a well-formed AppContainer SID string (4 sub-authorities). */
export function isAppContainerSid(sid: string): boolean {
  const parts = sid.split('-')
  if (parts.length !== 8 || parts[0] !== 'S' || parts[1] !== '1' || parts[2] !== '15' || parts[3] !== '2') return false
  let prev = -1
  for (const part of parts.slice(4)) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 0xFFFF_FFFF || n <= prev) return false
    prev = n
  }
  return true
}
