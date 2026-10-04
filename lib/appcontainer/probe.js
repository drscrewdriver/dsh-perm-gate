/**
 * probe.ts —— launcher `--probe` 裁决的 Node 侧消费（解析 / 缓存键 / 归因）。
 *
 * 探针产物只做**诊断与归因**，不做放行依据：逐 launch 的 Region B 解析 +
 * LookupMoniker 只读预检（launcher 进程内）才是唯一信任锚。缓存因此只在
 * Node 进程内存中、按 launcher 哈希 + OS build 键控——**永不落盘共享**：
 * 探测结论与「会话上下文」（提权/受限 job）强相关（同一台机器两种上下文
 * 结论相反已实测），进程内缓存即天然一上下文一份，键里无需也无法诚实
 * 表达上下文，落盘共享则必然跨上下文污染。
 */
import { execFile } from 'node:child_process';
/**
 * Parse the probe's single-line stdout. Returns undefined for anything that
 * is not a recognizable verdict (crash output, truncated line, foreign text) —
 * the controller treats undefined as UNAVAILABLE-with-retry.
 */
export function parseProbeJson(text) {
    const line = text.split('\n').map((l) => l.trim()).find((l) => l.startsWith('{'));
    if (line === undefined)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return undefined;
    }
    const p = parsed;
    if (typeof p['era'] !== 'string' || typeof p['sid'] !== 'string' || typeof p['osBuild'] !== 'number')
        return undefined;
    if (typeof p['derive'] !== 'object' || p['derive'] === null)
        return undefined;
    if (typeof p['registered'] !== 'object' || p['registered'] === null)
        return undefined;
    if (typeof p['tryLaunch'] !== 'object' || p['tryLaunch'] === null)
        return undefined;
    return parsed;
}
/**
 * The in-memory probe cache key. The launcher hash covers code changes, the
 * OS build covers kernel-side behavior changes; context is deliberately NOT
 * in the key because the cache never leaves the process (see header).
 */
export function probeCacheKey(launcherHash, probe) {
    return `${launcherHash}@${probe.osBuild}`;
}
/** Run `launcher --probe` and parse its verdict. Undefined = launcher unusable. */
export function runProbe(exePath, timeoutMs = 60_000) {
    return new Promise((resolve) => {
        execFile(exePath, ['--probe'], { windowsHide: true, timeout: timeoutMs, maxBuffer: 1 << 20 }, (error, stdout) => {
            if (error !== undefined && error !== null) {
                resolve(undefined); // crash/timeout: UNAVAILABLE, retried on next ensure
                return;
            }
            resolve(parseProbeJson(String(stdout ?? '')));
        });
    });
}
/** Human-attributable one-liner for deny logs (which resolution level failed). */
export function probeAttribution(probe) {
    const derive = `${probe.derive.name}(${probe.derive.module}) hr=0x${(probe.derive.hr >>> 0).toString(16)}`;
    const launch = probe.tryLaunch.attempted
        ? `tryLaunch win32Err=${probe.tryLaunch.win32Err}${probe.tryLaunch.childExit !== null ? ` childExit=${probe.tryLaunch.childExit}` : ''}`
        : 'tryLaunch skipped';
    return `era=${probe.era} derive=${derive} registered=${probe.registered.state} ${launch}`;
}
