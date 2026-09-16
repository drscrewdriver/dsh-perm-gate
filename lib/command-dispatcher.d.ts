/**
 * Command dispatcher - routes commands to appropriate parsers.
 * Runs parsers in priority order, returns first match.
 */
import type { CommandParser, ClassificationResult } from './command-semantics.js';
/**
 * Register a parser manually (for testing or custom parsers).
 */
export declare function registerParser(parser: CommandParser): void;
/**
 * Clear all registered parsers (for testing).
 */
export declare function clearParsers(): void;
/**
 * Dispatch a command to the appropriate parser.
 * Returns classification result or null if no parser matches.
 */
export declare function dispatchCommand(command: string): ClassificationResult | null;
/**
 * Get all registered parsers (for inspection/testing).
 */
export declare function getParsers(): readonly CommandParser[];
