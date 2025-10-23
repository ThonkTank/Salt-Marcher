// src/workmodes/library/entities/items/serializer.ts
// Markdown serialization for item data (body only - frontmatter handled by data-manager)

import type { ItemData } from "./types";

/**
 * Serializes ItemData to Markdown body (frontmatter handled separately by data-manager)
 */
export function itemToMarkdown(d: ItemData): string {
    const lines: string[] = [];
    const name = d.name || "Unnamed Item";

    // Header
    lines.push(`# ${name}`);

    // Type/Rarity line
    const typeParts: string[] = [];
    if (d.category) typeParts.push(d.category);
    if (d.type) typeParts.push(`(${d.type})`);
    if (d.rarity) typeParts.push(d.rarity);
    if (d.attunement) {
        const attunementText = d.attunement_req
            ? `Requires Attunement ${d.attunement_req}`
            : "Requires Attunement";
        typeParts.push(`(${attunementText})`);
    }
    if (typeParts.length > 0) {
        lines.push(`*${typeParts.join(" ")}*`);
    }
    lines.push("");

    // Basic stats
    const stats: string[] = [];
    if (d.weight) stats.push(`- Weight: ${d.weight}`);
    if (d.value) stats.push(`- Value: ${d.value}`);
    if (stats.length > 0) {
        lines.push(...stats);
        lines.push("");
    }

    // Charges
    if (d.max_charges != null) {
        lines.push(`## Charges\n`);
        lines.push(`This item has ${d.max_charges} charges.`);
        if (d.recharge_formula || d.recharge_time) {
            const rechargeParts: string[] = [];
            if (d.recharge_formula) rechargeParts.push(`regains ${d.recharge_formula} charges`);
            if (d.recharge_time) rechargeParts.push(`at ${d.recharge_time}`);
            lines.push(rechargeParts.join(" ") + ".");
        }
        if (d.destruction_risk) {
            lines.push(d.destruction_risk);
        }
        lines.push("");
    }

    // Spells
    if (d.spells && d.spells.length > 0) {
        lines.push(`## Spells\n`);
        lines.push("This item can cast the following spells:");
        lines.push("");
        for (const spell of d.spells) {
            const parts: string[] = [spell.name];
            if (spell.charge_cost != null) parts.push(`(${spell.charge_cost} charge${spell.charge_cost === 1 ? "" : "s"})`);
            if (spell.level != null) parts.push(`[Level ${spell.level}]`);
            if (spell.save_dc != null) parts.push(`DC ${spell.save_dc}`);
            if (spell.uses_caster_dc) parts.push("(uses caster's DC)");
            lines.push(`- ${parts.join(" ")}`);
        }
        lines.push("");
    }

    // Spell Storage
    if (d.spell_storage_capacity != null) {
        lines.push(`## Spell Storage\n`);
        lines.push(`This item can store up to ${d.spell_storage_capacity} levels of spells.`);
        lines.push("");
    }

    // Bonuses
    if (d.bonuses && d.bonuses.length > 0) {
        lines.push(`## Bonuses\n`);
        for (const bonus of d.bonuses) {
            const parts: string[] = [`${bonus.value} to ${bonus.type}`];
            if (bonus.applies_to) parts.push(`(${bonus.applies_to})`);
            lines.push(`- ${parts.join(" ")}`);
        }
        lines.push("");
    }

    // Resistances & Immunities
    if (d.resistances && d.resistances.length > 0) {
        lines.push(`- Resistances: ${d.resistances.join(", ")}`);
    }
    if (d.immunities && d.immunities.length > 0) {
        lines.push(`- Immunities: ${d.immunities.join(", ")}`);
    }
    if ((d.resistances && d.resistances.length > 0) || (d.immunities && d.immunities.length > 0)) {
        lines.push("");
    }

    // Ability Changes
    if (d.ability_changes && d.ability_changes.length > 0) {
        lines.push(`## Ability Changes\n`);
        for (const change of d.ability_changes) {
            const parts: string[] = [`${change.ability.toUpperCase()} becomes ${change.value}`];
            if (change.condition) parts.push(`(${change.condition})`);
            lines.push(`- ${parts.join(" ")}`);
        }
        lines.push("");
    }

    // Speed Changes
    if (d.speed_changes && d.speed_changes.length > 0) {
        lines.push(`## Speed Modifications\n`);
        for (const speed of d.speed_changes) {
            const parts: string[] = [`${speed.type} ${speed.value}`];
            if (speed.condition) parts.push(`(${speed.condition})`);
            lines.push(`- ${parts.join(" ")}`);
        }
        lines.push("");
    }

    // Properties
    if (d.properties && d.properties.length > 0) {
        lines.push(`## Properties\n`);
        for (const prop of d.properties) {
            lines.push(`**${prop.name}${prop.range ? ` (${prop.range})` : ""}**`);
            lines.push(prop.description);
            lines.push("");
        }
    }

    // Usage Limit
    if (d.usage_limit) {
        lines.push(`## Usage\n`);
        lines.push(`Can be used ${d.usage_limit.amount}, resets ${d.usage_limit.reset}.`);
        if (d.usage_limit.cumulative_failure) {
            lines.push(`${d.usage_limit.cumulative_failure.chance_per_use}% chance per use: ${d.usage_limit.cumulative_failure.on_failure}`);
        }
        lines.push("");
    }

    // Description
    if (d.description) {
        lines.push(d.description.trim());
        lines.push("");
    }

    // Tables
    if (d.tables && d.tables.length > 0) {
        for (const table of d.tables) {
            lines.push(`## ${table.name}\n`);
            if (table.description) {
                lines.push(table.description);
                lines.push("");
            }
            lines.push("| Roll | Result |");
            lines.push("| :--- | :----- |");
            for (const entry of table.entries) {
                lines.push(`| ${entry.roll} | ${entry.result} |`);
            }
            lines.push("");
        }
    }

    // Curse
    if (d.cursed && d.curse_description) {
        lines.push(`## Curse\n`);
        lines.push(d.curse_description.trim());
        lines.push("");
    }

    // Sentient Properties
    if (d.sentient && d.sentient_props) {
        lines.push(`## Sentient Item\n`);
        const sp = d.sentient_props;
        if (sp.intelligence != null || sp.wisdom != null || sp.charisma != null) {
            lines.push(`**Ability Scores:** INT ${sp.intelligence ?? "-"}, WIS ${sp.wisdom ?? "-"}, CHA ${sp.charisma ?? "-"}`);
        }
        if (sp.alignment) lines.push(`**Alignment:** ${sp.alignment}`);
        if (sp.senses) lines.push(`**Senses:** ${sp.senses}`);
        if (sp.communication) lines.push(`**Communication:** ${sp.communication}`);
        if (sp.languages && sp.languages.length > 0) {
            lines.push(`**Languages:** ${sp.languages.join(", ")}`);
        }
        if (sp.purpose) {
            lines.push(`**Purpose:** ${sp.purpose}`);
        }
        lines.push("");
    }

    // Variants
    if (d.has_variants && d.variant_info) {
        lines.push(`## Variants\n`);
        lines.push(d.variant_info.trim());
        lines.push("");
    }

    // Notes
    if (d.notes) {
        lines.push(`## Notes\n`);
        lines.push(d.notes.trim());
        lines.push("");
    }

    return lines.join("\n");
}
