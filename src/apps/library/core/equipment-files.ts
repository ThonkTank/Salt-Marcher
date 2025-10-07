// src/apps/library/core/equipment-files.ts
// Manages the vault directory "SaltMarcher/Equipment" for standard equipment storage
import { App, TFile } from "obsidian";
import { createVaultFilePipeline, sanitizeVaultFileName } from "./file-pipeline";

export const EQUIPMENT_DIR = "SaltMarcher/Equipment";

/**
 * Equipment type categories
 */
export type EquipmentType = "weapon" | "armor" | "tool" | "gear";

/**
 * Comprehensive equipment data structure covering all D&D 5e standard equipment
 */
export type EquipmentData = {
    // === Basic Information ===
    name: string;
    type: EquipmentType;
    cost?: string;              // e.g. "15 GP", "2 SP"
    weight?: string;            // e.g. "3 lb.", "1/4 lb.", "—"
    description?: string;       // General description

    // === Weapon Properties ===
    weapon_category?: "Simple" | "Martial";
    weapon_type?: "Melee" | "Ranged";
    damage?: string;            // e.g. "1d8 Slashing", "2d6 Bludgeoning"
    properties?: string[];      // e.g. ["Finesse", "Light", "Thrown (Range 20/60)"]
    mastery?: string;           // e.g. "Sap", "Vex", "Nick"

    // === Armor Properties ===
    armor_category?: "Light" | "Medium" | "Heavy" | "Shield";
    ac?: string;                // e.g. "11 + Dex modifier", "18", "+2"
    strength_requirement?: string;  // e.g. "Str 13", "Str 15"
    stealth_disadvantage?: boolean;
    don_time?: string;          // e.g. "1 Minute", "5 Minutes"
    doff_time?: string;         // e.g. "1 Minute", "5 Minutes"

    // === Tool Properties ===
    tool_category?: "Artisan" | "Gaming" | "Musical" | "Other";
    ability?: string;           // e.g. "Intelligence", "Dexterity", "Wisdom"
    utilize?: string[];         // e.g. ["Identify a substance (DC 15)"]
    craft?: string[];           // e.g. ["Acid", "Alchemist's Fire", "Oil"]
    variants?: string[];        // e.g. ["Dice (1 SP)", "Playing cards (5 SP)"]

    // === Adventuring Gear Properties ===
    gear_category?: string;     // e.g. "Container", "Light Source", "Utility"
    special_use?: string;       // Special usage description (e.g., for Acid, Alchemist's Fire)
    capacity?: string;          // Container capacity
    duration?: string;          // Duration for consumables
};

const EQUIPMENT_PIPELINE = createVaultFilePipeline<EquipmentData>({
    dir: EQUIPMENT_DIR,
    defaultBaseName: "Equipment",
    getBaseName: data => data.name,
    toContent: equipmentToMarkdown,
    sanitizeName: name => sanitizeVaultFileName(name, "Equipment"),
});

export const ensureEquipmentDir = EQUIPMENT_PIPELINE.ensure;

export const listEquipmentFiles = EQUIPMENT_PIPELINE.list;

export const watchEquipmentDir = EQUIPMENT_PIPELINE.watch;

function yamlList(items?: string[]): string | undefined {
    if (!items || items.length === 0) return undefined;
    const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", ");
    return `[${safe}]`;
}

export function equipmentToMarkdown(d: EquipmentData): string {
    const lines: string[] = [];
    const name = d.name || "Unnamed Equipment";

    // === YAML Frontmatter ===
    lines.push("---");
    lines.push("smType: equipment");
    lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    lines.push(`type: "${d.type}"`);

    // Basic info
    if (d.cost) lines.push(`cost: "${d.cost}"`);
    if (d.weight) lines.push(`weight: "${d.weight}"`);

    // Weapon fields
    if (d.weapon_category) lines.push(`weapon_category: "${d.weapon_category}"`);
    if (d.weapon_type) lines.push(`weapon_type: "${d.weapon_type}"`);
    if (d.damage) lines.push(`damage: "${d.damage}"`);
    const propertiesYaml = yamlList(d.properties);
    if (propertiesYaml) lines.push(`properties: ${propertiesYaml}`);
    if (d.mastery) lines.push(`mastery: "${d.mastery}"`);

    // Armor fields
    if (d.armor_category) lines.push(`armor_category: "${d.armor_category}"`);
    if (d.ac) lines.push(`ac: "${d.ac}"`);
    if (d.strength_requirement) lines.push(`strength_requirement: "${d.strength_requirement}"`);
    if (d.stealth_disadvantage != null) lines.push(`stealth_disadvantage: ${!!d.stealth_disadvantage}`);
    if (d.don_time) lines.push(`don_time: "${d.don_time}"`);
    if (d.doff_time) lines.push(`doff_time: "${d.doff_time}"`);

    // Tool fields
    if (d.tool_category) lines.push(`tool_category: "${d.tool_category}"`);
    if (d.ability) lines.push(`ability: "${d.ability}"`);
    const utilizeYaml = yamlList(d.utilize);
    if (utilizeYaml) lines.push(`utilize: ${utilizeYaml}`);
    const craftYaml = yamlList(d.craft);
    if (craftYaml) lines.push(`craft: ${craftYaml}`);
    const variantsYaml = yamlList(d.variants);
    if (variantsYaml) lines.push(`variants: ${variantsYaml}`);

    // Adventuring Gear fields
    if (d.gear_category) lines.push(`gear_category: "${d.gear_category}"`);
    if (d.special_use) lines.push(`special_use: "${d.special_use.replace(/"/g, '\\"')}"`);
    if (d.capacity) lines.push(`capacity: "${d.capacity}"`);
    if (d.duration) lines.push(`duration: "${d.duration}"`);

    lines.push("---\n");

    // === Markdown Body ===
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

export async function createEquipmentFile(app: App, d: EquipmentData): Promise<TFile> {
    return EQUIPMENT_PIPELINE.create(app, d);
}

export async function loadEquipmentFile(app: App, file: TFile): Promise<EquipmentData> {
    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};

    const data: EquipmentData = {
        name: frontmatter.name || file.basename,
        type: frontmatter.type || "weapon",
        cost: frontmatter.cost,
        weight: frontmatter.weight,
        weapon_category: frontmatter.weapon_category,
        weapon_type: frontmatter.weapon_type,
        damage: frontmatter.damage,
        properties: frontmatter.properties,
        mastery: frontmatter.mastery,
        armor_category: frontmatter.armor_category,
        ac: frontmatter.ac,
        strength_requirement: frontmatter.strength_requirement,
        stealth_disadvantage: frontmatter.stealth_disadvantage,
        don_time: frontmatter.don_time,
        doff_time: frontmatter.doff_time,
        tool_category: frontmatter.tool_category,
        ability: frontmatter.ability,
        utilize: frontmatter.utilize,
        craft: frontmatter.craft,
        variants: frontmatter.variants,
        gear_category: frontmatter.gear_category,
        special_use: frontmatter.special_use,
        capacity: frontmatter.capacity,
        duration: frontmatter.duration,
    };

    const content = await app.vault.read(file);
    const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)/);
    if (bodyMatch) {
        data.description = bodyMatch[1].trim();
    }

    return data;
}
