/**
 * Preset deny keywords inherited from dsh-approval-gate's `DEFAULT_DENY_KEYWORDS`
 * (the preset blacklist layer of its pipeline). One keyword per entry, matched
 * case-insensitively on word boundaries against the call's command text and its
 * scalar arguments — document bodies are skipped — so a keyword can no longer
 * veto an unrelated identifier or file text that merely contains it.
 *
 * Pure data shared by the node half (deny-keyword pre-layer) and the client
 * bundle (the settings card's preset tags), so it must stay import-free.
 */
/** The preset blacklist; the gate applies it whenever the namespace carries no override. */
export declare const DEFAULT_DENY_KEYWORDS: readonly string[];
