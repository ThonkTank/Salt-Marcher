// src/apps/library/core/item-files.ts
// Manages the vault directory "SaltMarcher/Items" for magic item storage
import { App, TFile } from "obsidian";
import { createVaultFilePipeline, sanitizeVaultFileName } from "./file-pipeline";

export const ITEMS_DIR = "SaltMarcher/Items";

/**
 * Comprehensive item data structure covering all D&D 5e magic item mechanics
 */
export type ItemData = {
    // === Basic Information ===
    name: string;
    category?: string;          // Armor, Potion, Ring, Rod, Scroll, Staff, Wand, Weapon, Wondrous Item
    type?: string;              // e.g. "Armor (Plate)", "Weapon (Longsword)", "Any Medium Armor"
    rarity?: string;            // Common, Uncommon, Rare, Very Rare, Legendary, Artifact

    // === Attunement ===
    attunement?: boolean;
    attunement_req?: string;    // e.g. "by a Cleric", "by a Druid, Sorcerer, Warlock, or Wizard"

    // === Charges System ===
    max_charges?: number;       // e.g. 10
    recharge_formula?: string;  // e.g. "1d6 + 4", "1d3"
    recharge_time?: string;     // "Dawn", "Long Rest", etc.
    destruction_risk?: string;  // e.g. "On 1, turns to water and is destroyed"

    // === Spells ===
    spells?: Array<{
        name: string;
        charge_cost?: number;     // Cost in charges
        level?: number;           // Spell level
        save_dc?: number;         // Fixed DC (e.g. Gust of Wind DC 13)
        uses_caster_dc?: boolean; // Uses wearer's DC
    }>;

    // === Spell Storage (Ring of Spell Storing) ===
    spell_storage_capacity?: number;  // Max spell levels

    // === Bonuses ===
    bonuses?: Array<{
        type: string;             // "AC", "attack", "damage", "ability_score", "skill", "save"
        value: string | number;   // "+1", "+2", "21" (for ability scores)
        applies_to?: string;      // Optional: "Longbow and Shortbow", "Fire spells", etc.
    }>;

    // === Resistances & Immunities ===
    resistances?: string[];     // ["Fire", "Force"]
    immunities?: string[];      // ["damage from Magic Missile spell"]

    // === Ability Score Modifications ===
    ability_changes?: Array<{
        ability: string;          // "str", "con", "dex", "int", "wis", "cha"
        value: number;            // Score (e.g. 19, 21, 29)
        condition?: string;       // Optional: "while wearing", "maximum of 20"
    }>;

    // === Speed Modifications ===
    speed_changes?: Array<{
        type: string;             // "walk", "swim", "fly", "burrow", "climb"
        value: string;            // "30 feet", "40 feet"
        condition?: string;       // Optional conditions
    }>;

    // === Special Properties/Effects ===
    properties?: Array<{
        name: string;             // e.g. "Darkvision", "Alarm", "Cold Resistance"
        description: string;
        range?: string;           // e.g. "30 feet", "60 feet"
    }>;

    // === Usage Limits (non-charge based) ===
    usage_limit?: {
        amount: string;           // "10 minutes", "3 times", "once"
        reset: string;            // "Long Rest", "Dawn", "per day"
        cumulative_failure?: {    // Wind Fan style
            chance_per_use: number;
            on_failure: string;
        };
    };

    // === Curse ===
    cursed?: boolean;
    curse_description?: string;

    // === Variants (for +1/+2/+3 Items) ===
    has_variants?: boolean;
    variant_info?: string;      // Description of variants

    // === Tables (Bag of Tricks, Deck of Many Things) ===
    tables?: Array<{
        name: string;             // "Gray Bag of Tricks", "Deck of Many Things"
        description?: string;
        entries: Array<{
            roll: string;           // "1d8", "1-10", "01-15"
            result: string;
        }>;
    }>;

    // === Sentient Item Properties ===
    sentient?: boolean;
    sentient_props?: {
        intelligence?: number;
        wisdom?: number;
        charisma?: number;
        alignment?: string;
        languages?: string[];
        senses?: string;          // "Hearing and Darkvision 120 ft"
        communication?: string;   // "telepathy", "speaks Common and Elvish"
        purpose?: string;
    };

    // === Description & Notes ===
    description?: string;       // Main description
    notes?: string;             // Additional notes

    // === Weight & Value ===
    weight?: string;            // "5 pounds", "2 to 5 pounds"
    value?: string;             // "2,000 GP", "varies"
};

const ITEM_PIPELINE = createVaultFilePipeline<ItemData>({
    dir: ITEMS_DIR,
    defaultBaseName: "Item",
    getBaseName: data => data.name,
    toContent: itemToMarkdown,
    sanitizeName: name => sanitizeVaultFileName(name, "Item"),
});

export const ensureItemDir = ITEM_PIPELINE.ensure;

export const listItemFiles = ITEM_PIPELINE.list;

export const watchItemDir = ITEM_PIPELINE.watch;

function yamlList(items?: string[]): string | undefined {
    if (!items || items.length === 0) return undefined;
    const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
    return `[${safe}]`;
}

function escapeJson(obj: any): string {
    return JSON.stringify(obj).replace(/"/g, '\\"');
}

export function itemToMarkdown(d: ItemData): string {
    const lines: string[] = [];
    const name = d.name || "Unnamed Item";

    // === YAML Frontmatter ===
    lines.push("---");
    lines.push("smType: item");
    lines.push(`name: "${name.replace(/"/g, '\\"')}"`);

    // Basic info
    if (d.category) lines.push(`category: "${d.category}"`);
    if (d.type) lines.push(`type: "${d.type}"`);
    if (d.rarity) lines.push(`rarity: "${d.rarity}"`);

    // Attunement
    if (d.attunement != null) lines.push(`attunement: ${!!d.attunement}`);
    if (d.attunement_req) lines.push(`attunement_req: "${d.attunement_req.replace(/"/g, '\\"')}"`);

    // Charges
    if (d.max_charges != null) lines.push(`max_charges: ${d.max_charges}`);
    if (d.recharge_formula) lines.push(`recharge_formula: "${d.recharge_formula}"`);
    if (d.recharge_time) lines.push(`recharge_time: "${d.recharge_time}"`);
    if (d.destruction_risk) lines.push(`destruction_risk: "${d.destruction_risk.replace(/"/g, '\\"')}"`);

    // Spells (as JSON)
    if (d.spells && d.spells.length > 0) {
        lines.push(`spells_json: "${escapeJson(d.spells)}"`);
    }

    // Spell storage
    if (d.spell_storage_capacity != null) {
        lines.push(`spell_storage_capacity: ${d.spell_storage_capacity}`);
    }

    // Bonuses (as JSON)
    if (d.bonuses && d.bonuses.length > 0) {
        lines.push(`bonuses_json: "${escapeJson(d.bonuses)}"`);
    }

    // Resistances & Immunities
    const resistancesYaml = yamlList(d.resistances);
    if (resistancesYaml) lines.push(`resistances: ${resistancesYaml}`);

    const immunitiesYaml = yamlList(d.immunities);
    if (immunitiesYaml) lines.push(`immunities: ${immunitiesYaml}`);

    // Ability changes (as JSON)
    if (d.ability_changes && d.ability_changes.length > 0) {
        lines.push(`ability_changes_json: "${escapeJson(d.ability_changes)}"`);
    }

    // Speed changes (as JSON)
    if (d.speed_changes && d.speed_changes.length > 0) {
        lines.push(`speed_changes_json: "${escapeJson(d.speed_changes)}"`);
    }

    // Properties (as JSON)
    if (d.properties && d.properties.length > 0) {
        lines.push(`properties_json: "${escapeJson(d.properties)}"`);
    }

    // Usage limits (as JSON)
    if (d.usage_limit) {
        lines.push(`usage_limit_json: "${escapeJson(d.usage_limit)}"`);
    }

    // Curse
    if (d.cursed != null) lines.push(`cursed: ${!!d.cursed}`);
    if (d.curse_description) lines.push(`curse_description: "${d.curse_description.replace(/"/g, '\\"')}"`);

    // Variants
    if (d.has_variants != null) lines.push(`has_variants: ${!!d.has_variants}`);
    if (d.variant_info) lines.push(`variant_info: "${d.variant_info.replace(/"/g, '\\"')}"`);

    // Tables (as JSON)
    if (d.tables && d.tables.length > 0) {
        lines.push(`tables_json: "${escapeJson(d.tables)}"`);
    }

    // Sentient properties
    if (d.sentient != null) lines.push(`sentient: ${!!d.sentient}`);
    if (d.sentient_props) {
        lines.push(`sentient_props_json: "${escapeJson(d.sentient_props)}"`);
    }

    // Weight & Value
    if (d.weight) lines.push(`weight: "${d.weight}"`);
    if (d.value) lines.push(`value: "${d.value}"`);

    lines.push("---\n");

    // === Markdown Body ===
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

export async function createItemFile(app: App, d: ItemData): Promise<TFile> {
    return ITEM_PIPELINE.create(app, d);
}
