// src/workmodes/library/storage/utils.ts
// Gemeinsame Utility-Funktionen für Library Storage
// Eliminiert Duplikation zwischen creatures, items, spells, equipment

/**
 * Converts a string array to YAML list format with proper escaping.
 * Returns undefined if the array is empty or undefined.
 *
 * @example
 * yamlList(["Fire", "Ice"]) // => '["Fire", "Ice"]'
 * yamlList([]) // => undefined
 */
export function yamlList(items?: string[]): string | undefined {
    if (!items || items.length === 0) return undefined;
    const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
    return `[${safe}]`;
}

/**
 * Escapes a string for safe inclusion in YAML/JSON values.
 * Handles quotes and backslashes.
 */
export function escapeYaml(value: string): string {
    return value.replace(/"/g, '\\"');
}

/**
 * Escapes an object for JSON embedding in YAML frontmatter.
 * Serializes to JSON and escapes quotes.
 */
export function escapeJson(obj: any): string {
    return JSON.stringify(obj).replace(/"/g, '\\"');
}

/**
 * Formats a signed number with explicit + or - prefix.
 *
 * @example
 * formatSigned(3) // => "+3"
 * formatSigned(-2) // => "-2"
 * formatSigned(0) // => "+0"
 */
export function formatSigned(n: number): string {
    return (n >= 0 ? "+" : "") + n;
}

/**
 * Parses a numeric value from a string, extracting the first number found.
 * Returns null if no number can be extracted.
 *
 * @example
 * parseNumericValue("+5") // => 5
 * parseNumericValue("15 (Leather Armor)") // => 15
 * parseNumericValue("none") // => null
 */
export function parseNumericValue(v?: string): number | null {
    if (!v) return null;
    const m = String(v).match(/-?\d+/);
    if (!m) return null;
    return Number(m[0]);
}
