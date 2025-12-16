// src/features/encounters/creature-utils.ts
// Shared utility functions for creature data manipulation

import { parseCR, formatCR } from "./cr-utils";

/**
 * Normalize a string for case-insensitive lookups.
 * Converts to lowercase for consistent map key comparison.
 *
 * @param value - String to normalize
 * @returns Lowercase normalized string
 *
 * @example
 * normalizeForLookup("Wolf") // "wolf"
 * normalizeForLookup("DRAGON") // "dragon"
 */
export function normalizeForLookup(value: string): string {
    return value.toLowerCase();
}

/**
 * Add a value to a multi-value index map.
 * Creates array if key doesn't exist, then appends value.
 *
 * @param map - Map to update
 * @param key - Index key
 * @param value - Value to add to array
 *
 * @example
 * const typeIndex = new Map<string, CreatureData[]>();
 * addToMultiIndex(typeIndex, "beast", wolfData);
 * addToMultiIndex(typeIndex, "beast", bearData);
 * // typeIndex.get("beast") === [wolfData, bearData]
 */
export function addToMultiIndex<K, V>(
    map: Map<K, V[]>,
    key: K,
    value: V
): void {
    if (!map.has(key)) {
        map.set(key, []);
    }
    map.get(key)!.push(value);
}

// Re-export CR utilities for convenience
export { parseCR, formatCR };
