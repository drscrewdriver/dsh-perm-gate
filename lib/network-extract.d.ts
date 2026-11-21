/** One extracted network candidate, shaped for `matchNetwork` in evaluate.ts. */
export interface NetworkTargetLite {
    readonly domain?: string;
    readonly ip?: string;
    readonly port?: number;
    readonly scheme?: string;
}
/**
 * Harvest network targets from a call's command text and arguments. The depth walk
 * mirrors `extractUrlCandidates`; a url-key value without a scheme falls back to
 * bare-host parsing (`{url: "169.254.169.254"}` from a raw-socket tool call).
 */
export declare function extractNetworkTargets(commandText: string | undefined, args: Record<string, unknown> | undefined): NetworkTargetLite[];
