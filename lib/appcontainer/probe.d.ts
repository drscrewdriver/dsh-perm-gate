export interface ProbeDerive {
    readonly name: string;
    readonly module: string;
    readonly hr: number;
}
export type ProbeRegisteredState = 'yes' | 'no' | 'unknown' | 'n/a';
/** The `--probe` verdict, exactly the launcher's single-line JSON. */
export interface LauncherProbe {
    readonly era: 'classic' | 'moniker' | 'none';
    readonly derive: ProbeDerive;
    readonly sid: string;
    readonly sidSubAuthorities: number;
    readonly registered: {
        readonly state: ProbeRegisteredState;
        readonly lookupHr: number;
        readonly mappingMoniker: string | null;
    };
    readonly tryLaunch: {
        readonly attempted: boolean;
        readonly win32Err: number;
        readonly childExit: number | null;
    };
    readonly osBuild: number;
    readonly capabilities: Readonly<Record<string, boolean>>;
    readonly mxc: {
        readonly present: boolean;
    };
}
/**
 * Parse the probe's single-line stdout. Returns undefined for anything that
 * is not a recognizable verdict (crash output, truncated line, foreign text) —
 * the controller treats undefined as UNAVAILABLE-with-retry.
 */
export declare function parseProbeJson(text: string): LauncherProbe | undefined;
/**
 * The in-memory probe cache key. The launcher hash covers code changes, the
 * OS build covers kernel-side behavior changes; context is deliberately NOT
 * in the key because the cache never leaves the process (see header).
 */
export declare function probeCacheKey(launcherHash: string, probe: LauncherProbe): string;
/** Run `launcher --probe` and parse its verdict. Undefined = launcher unusable. */
export declare function runProbe(exePath: string, timeoutMs?: number): Promise<LauncherProbe | undefined>;
/** Human-attributable one-liner for deny logs (which resolution level failed). */
export declare function probeAttribution(probe: LauncherProbe): string;
