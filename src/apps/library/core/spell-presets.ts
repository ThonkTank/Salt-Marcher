// src/apps/library/core/spell-presets.ts
// Verwaltet das Vault-Verzeichnis "SaltMarcher/Presets/Spells" für Spell-Presets

import { App, TFile } from "obsidian";
import { createVaultFilePipeline, sanitizeVaultFileName } from "./file-pipeline";
import type { SpellData } from "./spell-files";

export const SPELL_PRESETS_DIR = "SaltMarcher/Presets/Spells";

type SpellPresetDocument = SpellData & { fixtureId?: string };

const SPELL_PRESET_PIPELINE = createVaultFilePipeline<SpellPresetDocument>({
    dir: SPELL_PRESETS_DIR,
    defaultBaseName: "Spell Preset",
    getBaseName: data => data.name,
    toContent: data => spellPresetToMarkdown(data),
    sanitizeName: name => sanitizeVaultFileName(name, "Spell Preset"),
});

export const ensureSpellPresetDir = SPELL_PRESET_PIPELINE.ensure;
export const listSpellPresetFiles = SPELL_PRESET_PIPELINE.list;
export const watchSpellPresetDir = SPELL_PRESET_PIPELINE.watch;

export async function createSpellPresetFile(
    app: App,
    data: SpellPresetDocument
): Promise<TFile> {
    return SPELL_PRESET_PIPELINE.create(app, data);
}

export function spellPresetToMarkdown(
    data: SpellPresetDocument,
    options: { fixtureId?: string } = {}
): string {
    const lines: string[] = ["---", "smType: spell"];
    const push = (key: string, value: unknown): void => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value) && value.length === 0) return;
        lines.push(`${key}: ${serializeFrontmatterValue(value)}`);
    };

    const fixtureId = options.fixtureId ?? data.fixtureId;
    push("fixtureId", fixtureId);
    push("name", data.name);
    push("level", data.level);
    push("school", data.school);
    push("casting_time", data.casting_time);
    push("range", data.range);
    push("components", data.components);
    push("materials", data.materials);
    push("duration", data.duration);
    push("concentration", data.concentration);
    push("ritual", data.ritual);
    push("classes", data.classes);
    push("save_ability", data.save_ability);
    push("save_effect", data.save_effect);
    push("attack", data.attack);
    push("damage", data.damage);
    push("damage_type", data.damage_type);
    push("description", data.description);
    push("higher_levels", data.higher_levels);

    lines.push("---", "");

    const body: string[] = [];
    if (data.description) {
        body.push(data.description.trim(), "");
    }
    if (data.higher_levels) {
        body.push("## At Higher Levels", "", data.higher_levels.trim(), "");
    }

    const content = [...lines, ...body];
    if (body.length === 0) content.push("");
    return content.join("\n");
}

function serializeFrontmatterValue(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(entry => serializeScalar(entry)).join(", ")}]`;
    }
    return serializeScalar(value);
}

function serializeScalar(value: unknown): string {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    return JSON.stringify(value);
}

/**
 * Lädt einen Spell Preset aus einer Datei.
 * Nutzt Obsidian's MetadataCache für robustes YAML-Parsing.
 */
export async function loadSpellPreset(app: App, file: TFile): Promise<SpellData> {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) {
        throw new Error(`No frontmatter found in ${file.path}`);
    }

    const fm = cache.frontmatter;

    // Build SpellData from frontmatter
    const data: SpellData = {
        name: fm.name ?? file.basename,
        level: fm.level,
        school: fm.school,
        casting_time: fm.casting_time,
        range: fm.range,
        components: fm.components,
        materials: fm.materials,
        duration: fm.duration,
        concentration: fm.concentration,
        ritual: fm.ritual,
        classes: fm.classes,
        save_ability: fm.save_ability,
        save_effect: fm.save_effect,
        attack: fm.attack,
        damage: fm.damage,
        damage_type: fm.damage_type,
        description: fm.description,
        higher_levels: fm.higher_levels,
    };

    console.log('[Spell Preset Loader] Loaded spell preset:', data.name, {
        level: data.level,
        school: data.school,
        classes: data.classes,
        hasDescription: !!data.description,
        hasHigherLevels: !!data.higher_levels,
    });

    return data;
}

/**
 * Findet Spell Presets anhand eines Suchstrings.
 */
export async function findSpellPresets(
    app: App,
    query: string,
    options: {
        limit?: number;
        level?: number;
        school?: string;
    } = {}
): Promise<Array<{ file: TFile; data: SpellData; score: number }>> {
    const { limit = 10, level, school } = options;
    const files = await listSpellPresetFiles(app);

    const results: Array<{ file: TFile; data: SpellData; score: number }> = [];

    for (const file of files) {
        // Score based on name match
        const name = file.basename.toLowerCase();
        const q = query.toLowerCase();

        let score = 0;
        if (name === q) {
            score = 1000; // Exact match
        } else if (name.startsWith(q)) {
            score = 900 - Math.abs(name.length - q.length);
        } else if (name.includes(q)) {
            score = 700 - name.indexOf(q);
        } else {
            // Token match
            const tokens = name.split(/[\s-]/);
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i].startsWith(q)) {
                    score = 600 - i * 10;
                    break;
                }
            }
        }

        if (score > 0) {
            try {
                const data = await loadSpellPreset(app, file);

                // Filter by level if specified
                if (level != null && data.level !== level) continue;

                // Filter by school if specified
                if (school && data.school?.toLowerCase() !== school.toLowerCase()) continue;

                results.push({ file, data, score });
            } catch (err) {
                console.warn(`Failed to load spell preset ${file.path}:`, err);
            }
        }

        if (results.length >= limit * 2) break; // Stop early if we have enough
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}

/**
 * Gibt alle verfügbaren Spell-Levels zurück.
 */
export async function getSpellLevels(app: App): Promise<number[]> {
    const files = await listSpellPresetFiles(app);
    const levels = new Set<number>();

    for (const file of files) {
        try {
            const data = await loadSpellPreset(app, file);
            if (data.level != null) {
                levels.add(data.level);
            }
        } catch (err) {
            console.warn(`Failed to load spell preset ${file.path}:`, err);
        }
    }

    return Array.from(levels).sort((a, b) => a - b);
}

/**
 * Gibt alle verfügbaren Spell-Schools zurück.
 */
export async function getSpellSchools(app: App): Promise<string[]> {
    const files = await listSpellPresetFiles(app);
    const schools = new Set<string>();

    for (const file of files) {
        try {
            const data = await loadSpellPreset(app, file);
            if (data.school) {
                schools.add(data.school);
            }
        } catch (err) {
            console.warn(`Failed to load spell preset ${file.path}:`, err);
        }
    }

    return Array.from(schools).sort();
}
