// src/features/encounters/cr-utils.ts
// Challenge Rating (CR) utilities
// Shared between encounter generation, encounter tables, and creature management

/**
 * Parse CR string to number
 * Handles fractional CRs (1/8, 1/4, 1/2) and string/number inputs
 *
 * @param cr - CR value as string or number
 * @returns Numeric CR value
 *
 * @example
 * parseCR("1/8") // 0.125
 * parseCR("1/4") // 0.25
 * parseCR("1/2") // 0.5
 * parseCR("5") // 5
 * parseCR(3) // 3
 */
export function parseCR(cr: string | number): number {
    if (typeof cr === "number") return cr;
    if (cr === "1/8") return 0.125;
    if (cr === "1/4") return 0.25;
    if (cr === "1/2") return 0.5;
    const parsed = parseFloat(cr);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format CR number to display string
 * Converts decimal CRs to fractional notation
 *
 * @param cr - Numeric CR value
 * @returns Formatted CR string
 *
 * @example
 * formatCR(0.125) // "1/8"
 * formatCR(0.25) // "1/4"
 * formatCR(0.5) // "1/2"
 * formatCR(5) // "5"
 */
export function formatCR(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return cr.toString();
}
