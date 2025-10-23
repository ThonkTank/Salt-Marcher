// src/workmodes/library/entities/spells/serializer.ts
// Markdown serialization for spell data (body only - frontmatter handled by data-manager)

import type { SpellData } from "./types";

/**
 * Serializes SpellData to Markdown body (frontmatter handled separately by data-manager)
 */
export function spellToMarkdown(d: SpellData): string {
    const lines: string[] = [];
    const name = d.name || "Unnamed Spell";

    // Header
    lines.push(`# ${name}`);

    // Level and School line
    const levelStr = (d.level == null) ? "" : (d.level === 0 ? "Cantrip" : `Level ${d.level}`);
    const parts = [levelStr, d.school].filter(Boolean);
    if (parts.length) {
        lines.push(parts.join(" "));
    }
    lines.push("");

    // Stats helper function
    const stat = (label: string, val?: string | boolean) => {
        if (val) lines.push(`- ${label}: ${val}`);
    };

    // Basic stats
    stat("Casting Time", d.casting_time);
    stat("Range", d.range);

    // Components
    const compLine = (d.components || []).join(", ") + (d.materials ? ` (${d.materials})` : "");
    if (d.components && d.components.length) {
        stat("Components", compLine);
    }

    stat("Duration", d.duration);
    if (d.concentration) lines.push("- Concentration: yes");
    if (d.ritual) lines.push("- Ritual: yes");

    // Classes
    if (d.classes && d.classes.length) {
        stat("Classes", (d.classes || []).join(", "));
    }

    // Combat stats
    if (d.attack) stat("Attack", d.attack);
    if (d.save_ability) {
        stat("Save", `${d.save_ability}${d.save_effect ? ` (${d.save_effect})` : ""}`);
    }
    if (d.damage) {
        stat("Damage", `${d.damage}${d.damage_type ? ` ${d.damage_type}` : ""}`);
    }

    lines.push("");

    // Description
    if (d.description) {
        lines.push(d.description.trim());
        lines.push("");
    }

    // Higher levels
    if (d.higher_levels) {
        lines.push("## At Higher Levels\n");
        lines.push(d.higher_levels.trim());
        lines.push("");
    }

    return lines.join("\n");
}
