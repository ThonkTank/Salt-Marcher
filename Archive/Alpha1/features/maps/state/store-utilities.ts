/**
 * Shared Utility Functions for Map Stores
 *
 * This module contains common helper functions extracted from multiple map store implementations
 * to reduce code duplication (~260 lines across 4 stores).
 *
 * Extracted from:
 * - faction-overlay-store.ts
 * - location-marker-store.ts
 * - location-influence-store.ts
 * - tile-store.ts
 *
 * @module store-utilities
 */

import { coordToKey as centralCoordToKey } from "@geometry";
import type { AxialCoord } from "@geometry";

/**
 * Re-export AxialCoord as canonical coordinate type for stores
 */
export type { AxialCoord };

/**
 * Validates and normalizes a coordinate object.
 *
 * Ensures the coordinate has valid numeric q and r properties.
 * Returns a new object with rounded integers, or null if invalid.
 *
 * @param coord - The coordinate to normalize
 * @returns Normalized coordinate with integer q,r or null if invalid
 *
 * @example
 * ```typescript
 * normalizeCoord({ q: 1.5, r: 2.7 }) // { q: 2, r: 3 }
 * normalizeCoord({ q: 1, r: NaN })   // null
 * normalizeCoord(null)               // null
 * ```
 */
export function normalizeCoord(coord: any): AxialCoord | null {
	if (!coord || typeof coord !== 'object') return null;
	const q = Number(coord.q);
	const r = Number(coord.r);
	if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
	return { q, r };
}

/**
 * Converts a coordinate to a string key for map storage.
 *
 * DEPRECATED: Use coordToKey() from @geometry instead.
 * This function redirects to the central implementation for consistency.
 *
 * Format: "q,r" (e.g., "5,10") - Axial coordinate format
 *
 * @param coord - The coordinate to convert
 * @returns String key in format "q,r"
 *
 * @example
 * ```typescript
 * keyFromCoord({ q: 5, r: 10 }) // "5,10"
 * keyFromCoord({ q: 0, r: 0 })  // "0,0"
 * ```
 */
export function keyFromCoord(coord: AxialCoord): string {
	return centralCoordToKey(coord);
}

/**
 * Normalizes a string by trimming whitespace.
 *
 * Returns null for empty strings or non-string inputs.
 *
 * @param str - The string to normalize
 * @returns Trimmed string or null if empty/invalid
 *
 * @example
 * ```typescript
 * normalizeString("  hello  ") // "hello"
 * normalizeString("")          // null
 * normalizeString("   ")       // null
 * normalizeString(123)         // null
 * ```
 */
export function normalizeString(str: any): string | null {
	if (typeof str !== 'string') return null;
	const trimmed = str.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates and normalizes a hex color code.
 *
 * Accepts 3 or 6 digit hex codes with or without '#' prefix.
 * Returns lowercase hex with '#' or null if invalid.
 *
 * @param color - The color code to validate
 * @returns Normalized hex color or null if invalid
 *
 * @example
 * ```typescript
 * normalizeColor("#FF0000")  // "#ff0000"
 * normalizeColor("FF0000")   // "#ff0000"
 * normalizeColor("#F00")     // "#f00"
 * normalizeColor("invalid")  // null
 * ```
 */
export function normalizeColor(color: any): string | null {
	if (typeof color !== 'string') return null;
	const trimmed = color.trim();
	// Match #RGB or #RRGGBB patterns (with or without #)
	const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
	return match ? `#${match[1].toLowerCase()}` : null;
}

/**
 * Creates a consistent hash from a string.
 *
 * Uses a simple but effective hash algorithm (djb2) to convert strings
 * to numeric hashes. Useful for generating deterministic IDs or colors
 * from string identifiers.
 *
 * Note: This is NOT a cryptographic hash and should not be used for security.
 *
 * @param str - The string to hash
 * @returns 32-bit signed integer hash
 *
 * @example
 * ```typescript
 * hashString("faction-123")  // -1234567890 (deterministic)
 * hashString("faction-123")  // -1234567890 (always same)
 * hashString("faction-456")  // -9876543210 (different)
 * ```
 */
export function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash;
}

/**
 * Parses a coordinate key string back to an AxialCoord object.
 *
 * Inverse of keyFromCoord(). Supports "q,r" format.
 * Returns null if the format is invalid.
 *
 * @param key - The coordinate key string to parse
 * @returns Parsed coordinate or null if invalid
 *
 * @example
 * ```typescript
 * coordFromKey("5,10")  // { q: 5, r: 10 }
 * coordFromKey("0,0")   // { q: 0, r: 0 }
 * coordFromKey("invalid") // null
 * coordFromKey("5")     // null
 * ```
 */
export function coordFromKey(key: string): AxialCoord | null {
	const parts = key.split(",");

	if (parts.length !== 2) return null;

	const q = parseInt(parts[0], 10);
	const r = parseInt(parts[1], 10);

	if (isNaN(q) || isNaN(r)) return null;

	return { q, r };
}

/**
 * Checks if two coordinates are equal.
 *
 * Compares q and r values for equality.
 *
 * @param a - First coordinate
 * @param b - Second coordinate
 * @returns True if coordinates are equal
 *
 * @example
 * ```typescript
 * coordsEqual({ q: 5, r: 10 }, { q: 5, r: 10 })  // true
 * coordsEqual({ q: 5, r: 10 }, { q: 5, r: 11 })  // false
 * ```
 */
export function coordsEqual(a: AxialCoord | null, b: AxialCoord | null): boolean {
	if (!a || !b) return a === b;
	return a.q === b.q && a.r === b.r;
}

/**
 * Validates that a value is a valid map key (non-empty string).
 *
 * Ensures the key is a string and not empty after trimming.
 *
 * @param key - The key to validate
 * @returns True if the key is valid
 *
 * @example
 * ```typescript
 * isValidMapKey("faction-123")  // true
 * isValidMapKey("")             // false
 * isValidMapKey("   ")          // false
 * isValidMapKey(123)            // false
 * ```
 */
export function isValidMapKey(key: any): key is string {
	return typeof key === "string" && key.trim().length > 0;
}
