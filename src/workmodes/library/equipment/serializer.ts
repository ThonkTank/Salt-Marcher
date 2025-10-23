// src/workmodes/library/entities/equipment/serializer.ts
// Markdown serialization for equipment data (body only - frontmatter handled by data-manager)

import type { EquipmentData } from "./types";

/**
 * Serializes EquipmentData to Markdown body (frontmatter handled separately by data-manager)
 */
export function equipmentToMarkdown(d: EquipmentData): string {
    const lines: string[] = [];
    const name = d.name || "Unnamed Equipment";

    // Header
    lines.push(`# ${name}`);

    // Type and category line
    const typeParts: string[] = [];
    if (d.type === "weapon") {
        if (d.weapon_category) typeParts.push(d.weapon_category);
        if (d.weapon_type) typeParts.push(d.weapon_type);
        typeParts.push("Weapon");
    } else if (d.type === "armor") {
        if (d.armor_category) typeParts.push(d.armor_category);
        typeParts.push("Armor");
    } else if (d.type === "tool") {
        if (d.tool_category) typeParts.push(d.tool_category);
        typeParts.push("Tool");
    } else if (d.type === "gear") {
        typeParts.push("Adventuring Gear");
        if (d.gear_category) typeParts.push(`(${d.gear_category})`);
    }

    if (typeParts.length > 0) {
        lines.push(`*${typeParts.join(" ")}*`);
    }
    lines.push("");

    // Basic stats
    const stats: string[] = [];
    if (d.cost) stats.push(`- **Cost:** ${d.cost}`);
    if (d.weight) stats.push(`- **Weight:** ${d.weight}`);
    if (stats.length > 0) {
        lines.push(...stats);
        lines.push("");
    }

    // Weapon-specific details
    if (d.type === "weapon") {
        if (d.damage) {
            lines.push(`**Damage:** ${d.damage}`);
            lines.push("");
        }
        if (d.properties && d.properties.length > 0) {
            lines.push(`**Properties:** ${d.properties.join(", ")}`);
            lines.push("");
        }
        if (d.mastery) {
            lines.push(`**Mastery:** ${d.mastery}`);
            lines.push("");
        }
    }

    // Armor-specific details
    if (d.type === "armor") {
        if (d.ac) {
            lines.push(`**Armor Class (AC):** ${d.ac}`);
            lines.push("");
        }
        if (d.strength_requirement) {
            lines.push(`**Strength Requirement:** ${d.strength_requirement}`);
            lines.push("");
        }
        if (d.stealth_disadvantage) {
            lines.push(`**Stealth:** Disadvantage`);
            lines.push("");
        }
        if (d.don_time || d.doff_time) {
            const timeParts: string[] = [];
            if (d.don_time) timeParts.push(`Don: ${d.don_time}`);
            if (d.doff_time) timeParts.push(`Doff: ${d.doff_time}`);
            lines.push(`**Time:** ${timeParts.join(", ")}`);
            lines.push("");
        }
    }

    // Tool-specific details
    if (d.type === "tool") {
        if (d.ability) {
            lines.push(`**Ability:** ${d.ability}`);
            lines.push("");
        }
        if (d.utilize && d.utilize.length > 0) {
            lines.push(`## Utilize`);
            lines.push("");
            for (const use of d.utilize) {
                lines.push(`- ${use}`);
            }
            lines.push("");
        }
        if (d.craft && d.craft.length > 0) {
            lines.push(`## Craft`);
            lines.push("");
            lines.push(d.craft.join(", "));
            lines.push("");
        }
        if (d.variants && d.variants.length > 0) {
            lines.push(`## Variants`);
            lines.push("");
            for (const variant of d.variants) {
                lines.push(`- ${variant}`);
            }
            lines.push("");
        }
    }

    // Gear-specific details
    if (d.type === "gear") {
        if (d.capacity) {
            lines.push(`**Capacity:** ${d.capacity}`);
            lines.push("");
        }
        if (d.duration) {
            lines.push(`**Duration:** ${d.duration}`);
            lines.push("");
        }
        if (d.special_use) {
            lines.push(`## Special Use`);
            lines.push("");
            lines.push(d.special_use);
            lines.push("");
        }
    }

    // Description
    if (d.description) {
        lines.push(d.description.trim());
        lines.push("");
    }

    return lines.join("\n");
}
