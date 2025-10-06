// src/apps/library/core/spell-presets.ts
// Verwaltet das Vault-Verzeichnis "SaltMarcher/Presets/Spells" für Spell-Presets

import { App, TFile } from "obsidian";
import { createVaultFilePipeline } from "./file-pipeline";
import type { SpellData } from "./spell-files";

export const SPELL_PRESETS_DIR = "SaltMarcher/Presets/Spells";

const SPELL_PRESET_PIPELINE = createVaultFilePipeline<SpellData>({
    dir: SPELL_PRESETS_DIR,
    defaultBaseName: "Spell Preset",
    getBaseName: data => data.name,
    toContent: () => "", // Presets werden nicht geschrieben, nur gelesen
    sanitizeName: name => name.replace(/[\\/:*?"<>|]/g, '-'),
});

export const ensureSpellPresetDir = SPELL_PRESET_PIPELINE.ensure;
export const listSpellPresetFiles = SPELL_PRESET_PIPELINE.list;
export const watchSpellPresetDir = SPELL_PRESET_PIPELINE.watch;

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
