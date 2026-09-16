import { type RuleAction } from './rule.js';
/** Rules per action, so the panel can say "3 deny / 7 allow / 1 ask" at a glance. */
export interface RulesViewCounts {
    readonly allow: number;
    readonly deny: number;
    readonly ask: number;
}
/** The whole read-only face of one permissions document. */
export interface RulesView {
    /** Absolute path, or `''` when the gate has no rules file configured. */
    readonly path: string;
    readonly exists: boolean;
    /** File size on disk, not the length of `raw` — a truncated view still reports the truth. */
    readonly bytes: number;
    /** Content hash of the text the gate would load, for correlating with a reload. */
    readonly hash: string;
    readonly lines: number;
    /** The document itself. Empty when absent, unreadable, or truncated away. */
    readonly raw: string;
    readonly truncated: boolean;
    /** Parsed only when the document compiled; absent when it did not. */
    readonly defaultAction?: RuleAction;
    readonly counts: RulesViewCounts;
    /** Why the document could not be shown or parsed. Absent when all is well. */
    readonly error?: string;
}
/**
 * Read one permissions document for display.
 *
 * Never throws: a missing, unreadable or malformed file is a state the panel has
 * to render, not an error that should blank the section. Every failure mode is
 * reported in the returned value instead.
 */
export declare function readRulesView(rulesFile: string): RulesView;
