/**
 * Encounter Table Serializer
 *
 * Converts EncounterTableData to Markdown format with YAML frontmatter.
 * Follows the same pattern as playlist serializer.
 */

import type { EncounterTableData, EncounterTableEntry } from "./types";

/**
 * Convert encounter table to Markdown body (appears below frontmatter)
 */
export function encounterTableToMarkdown(data: EncounterTableData): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${data.display_name || data.name}`);
    lines.push("");

    // Description
    if (data.description) {
        lines.push(data.description);
        lines.push("");
    }

    // CR Range
    if (data.crRange) {
        const { min, max } = data.crRange;
        const minStr = min !== undefined ? formatCR(min) : "—";
        const maxStr = max !== undefined ? formatCR(max) : "—";
        lines.push(`**CR Range:** ${minStr} to ${maxStr}`);
        lines.push("");
    }

    // Tag Summary
    const tagSections: string[] = [];
    if (data.terrain_tags && data.terrain_tags.length > 0) {
        tagSections.push(`**Terrain:** ${data.terrain_tags.map((t) => t.value).join(", ")}`);
    }
    if (data.weather_tags && data.weather_tags.length > 0) {
        tagSections.push(`**Weather:** ${data.weather_tags.map((t) => t.value).join(", ")}`);
    }
    if (data.time_of_day_tags && data.time_of_day_tags.length > 0) {
        tagSections.push(`**Time:** ${data.time_of_day_tags.map((t) => t.value).join(", ")}`);
    }
    if (data.faction_tags && data.faction_tags.length > 0) {
        tagSections.push(`**Faction:** ${data.faction_tags.map((t) => t.value).join(", ")}`);
    }
    if (data.situation_tags && data.situation_tags.length > 0) {
        tagSections.push(`**Situation:** ${data.situation_tags.map((t) => t.value).join(", ")}`);
    }

    if (tagSections.length > 0) {
        lines.push(...tagSections);
        lines.push("");
    }

    // Encounter Entries Table
    if (data.entries && data.entries.length > 0) {
        lines.push("## Encounter Entries");
        lines.push("");
        lines.push("| Weight | Creatures | Quantity | Description |");
        lines.push("|--------|-----------|----------|-------------|");

        for (const entry of data.entries) {
            const weight = entry.weight || 1;
            const creatures = entry.creatures.join(", ");
            const quantity = entry.quantity || "1";
            const desc = entry.description || "—";

            lines.push(`| ${weight} | ${creatures} | ${quantity} | ${desc} |`);
        }

        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Format CR value for display
 */
function formatCR(cr: number): string {
    if (cr === 0.125) return "1/8";
    if (cr === 0.25) return "1/4";
    if (cr === 0.5) return "1/2";
    return cr.toString();
}

/**
 * Parse CR string to number
 */
export function parseCR(cr: string | number): number {
    if (typeof cr === "number") return cr;
    if (cr === "1/8") return 0.125;
    if (cr === "1/4") return 0.25;
    if (cr === "1/2") return 0.5;
    const parsed = parseFloat(cr);
    return isNaN(parsed) ? 0 : parsed;
}
