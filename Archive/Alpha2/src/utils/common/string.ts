/**
 * Common string utilities
 */

/**
 * Capitalize first letter of a string
 */
export function capitalizeFirst(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize a word based on count
 * @example pluralize('day', 1) → 'day'
 * @example pluralize('day', 5) → 'days'
 */
export function pluralize(word: string, count: number): string {
    return count === 1 ? word : `${word}s`;
}

/**
 * Format count with pluralized word
 * @example formatCount(3, 'day') → '3 days'
 */
export function formatCount(count: number, word: string): string {
    return `${count} ${pluralize(word, count)}`;
}
