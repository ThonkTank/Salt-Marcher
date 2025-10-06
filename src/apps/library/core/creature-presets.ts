// src/apps/library/core/creature-presets.ts
// Verwaltet das Vault-Verzeichnis "SaltMarcher/Presets/Creatures" für Statblock-Presets

import { App, TFile } from "obsidian";
import { createVaultFilePipeline } from "./file-pipeline";
import type { StatblockData } from "./creature-files";
import { spellcastingDataToEntry } from "../create/creature/entry-model";

export const PRESETS_DIR = "SaltMarcher/Presets/Creatures";

const PRESET_PIPELINE = createVaultFilePipeline<StatblockData>({
    dir: PRESETS_DIR,
    defaultBaseName: "Preset",
    getBaseName: data => data.name,
    toContent: () => "", // Presets werden nicht geschrieben, nur gelesen
    sanitizeName: name => name.replace(/[\\/:*?"<>|]/g, '-'),
});

export const ensurePresetDir = PRESET_PIPELINE.ensure;
export const listPresetFiles = PRESET_PIPELINE.list;
export const watchPresetDir = PRESET_PIPELINE.watch;

/**
 * Parst ein Alignment-String in Komponenten
 */
function parseAlignment(text?: string): {
    lawChaos?: string;
    goodEvil?: string;
    override?: string;
} {
    if (!text) return {};

    const normalized = text.toLowerCase().trim();

    // Spezialfälle
    if (normalized === "unaligned" || normalized === "any alignment") {
        return { override: text };
    }

    // "Neutral" alleine
    if (normalized === "neutral") {
        return { lawChaos: "Neutral", goodEvil: "Neutral" };
    }

    // Parse "Lawful Evil", "Chaotic Good", etc.
    const words = text.split(/\s+/);
    if (words.length === 2) {
        return { lawChaos: words[0], goodEvil: words[1] };
    } else if (words.length === 1) {
        // Nur ein Wort
        const word = words[0];
        if (["Good", "Evil"].some(w => w.toLowerCase() === word.toLowerCase())) {
            return { goodEvil: word };
        } else if (["Lawful", "Chaotic"].some(w => w.toLowerCase() === word.toLowerCase())) {
            return { lawChaos: word };
        }
    }

    return { override: text };
}

/**
 * Berechnet PB aus CR
 */
function calculatePBFromCR(cr?: string): string | undefined {
    if (!cr) return undefined;

    let crValue: number;
    if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(Number);
        crValue = num / denom;
    } else {
        crValue = Number(cr);
    }

    if (isNaN(crValue)) return undefined;

    if (crValue <= 4) return '+2';
    if (crValue <= 8) return '+3';
    if (crValue <= 12) return '+4';
    if (crValue <= 16) return '+5';
    if (crValue <= 20) return '+6';
    if (crValue <= 24) return '+7';
    if (crValue <= 28) return '+8';
    return '+9';
}

/**
 * Berechnet Initiative aus DEX
 */
function calculateInitiativeFromDex(dex?: string): string | undefined {
    if (!dex) return undefined;

    const dexValue = parseInt(dex);
    if (isNaN(dexValue)) return undefined;

    const modifier = Math.floor((dexValue - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Lädt einen Preset aus einer Datei.
 * Nutzt Obsidian's MetadataCache für robustes YAML-Parsing.
 */
export async function loadCreaturePreset(app: App, file: TFile): Promise<StatblockData> {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) {
        throw new Error(`No frontmatter found in ${file.path}`);
    }

    const fm = cache.frontmatter;

    // Helper: Parse JSON fields with proper error handling
    const parseJson = (value: string | undefined, fieldName: string): any => {
        if (!value) return undefined;
        try {
            return JSON.parse(value);
        } catch (err) {
            console.warn(`Failed to parse ${fieldName}:`, err);
            return undefined;
        }
    };

    // Parse alignment if provided as single field
    const alignmentParts = parseAlignment(fm.alignment);

    // Parse abilities first
    const abilities = fm.abilities_json ? parseJson(fm.abilities_json, 'abilities_json') : undefined;

    // Calculate initiative from DEX ability if not provided
    let initiative = fm.initiative;
    if (!initiative && abilities) {
        const dexAbility = abilities.find((a: any) => a.ability === 'dex');
        if (dexAbility) {
            const modifier = Math.floor((dexAbility.score - 10) / 2);
            initiative = modifier >= 0 ? `+${modifier}` : `${modifier}`;
        }
    }

    // Build StatblockData from frontmatter
    const data: StatblockData = {
        // Basic identity
        name: fm.name ?? file.basename,
        size: fm.size,
        type: fm.type,
        typeTags: fm.type_tags ?? fm.typeTags,

        // Alignment (use explicit fields or parse from combined)
        alignmentLawChaos: fm.alignmentLawChaos ?? alignmentParts.lawChaos,
        alignmentGoodEvil: fm.alignmentGoodEvil ?? alignmentParts.goodEvil,
        alignmentOverride: fm.alignmentOverride ?? alignmentParts.override,

        // Combat stats
        ac: fm.ac,
        initiative,
        hp: fm.hp,
        hitDice: fm.hit_dice ?? fm.hitDice,

        // Abilities
        abilities,
        pb: fm.pb ?? calculatePBFromCR(fm.cr), // Fallback: berechne aus CR

        // CR & XP
        cr: fm.cr,
        xp: fm.xp,

        // Speeds
        speeds: fm.speeds_json ? parseJson(fm.speeds_json, 'speeds_json') : undefined,

        // Saves & Skills
        saves: fm.saves_json ? parseJson(fm.saves_json, 'saves_json') : undefined,
        skills: fm.skills_json ? parseJson(fm.skills_json, 'skills_json') : undefined,

        // Senses & Languages
        sensesList: fm.senses,
        languagesList: fm.languages,
        passivesList: fm.passives,

        // Defenses
        damageVulnerabilitiesList: fm.damage_vulnerabilities,
        damageResistancesList: fm.damage_resistances,
        damageImmunitiesList: fm.damage_immunities,
        conditionImmunitiesList: fm.condition_immunities,
        gearList: fm.gear,

        // Entries & Spellcasting (JSON fields)
        entries: fm.entries_structured_json ? parseJson(fm.entries_structured_json, 'entries_structured_json') : undefined,
        spellcasting: fm.spellcasting_json ? parseJson(fm.spellcasting_json, 'spellcasting_json') : undefined,

        // Legacy fields
        traits: fm.traits,
        actions: fm.actions,
        legendary: fm.legendary,
    };

    // Fallback: Build speeds from individual fields if speeds_json not present
    if (!data.speeds && (fm.speed_walk || fm.speed_fly || fm.speed_swim || fm.speed_climb || fm.speed_burrow)) {
        data.speeds = {};
        if (fm.speed_walk) data.speeds.walk = { distance: fm.speed_walk };
        if (fm.speed_fly) {
            data.speeds.fly = {
                distance: fm.speed_fly,
                hover: fm.speed_fly_hover === true || fm.speed_fly_hover === 'true',
            };
        }
        if (fm.speed_swim) data.speeds.swim = { distance: fm.speed_swim };
        if (fm.speed_climb) data.speeds.climb = { distance: fm.speed_climb };
        if (fm.speed_burrow) data.speeds.burrow = { distance: fm.speed_burrow };
    }

    // Runtime Migration: Convert old spellcasting_json to new entry format
    if (data.spellcasting && !data.entries) {
        try {
            console.log(`[Preset Migration] Migrating spellcasting data for ${data.name}`);

            // Convert spellcasting data to entry format
            const spellEntry = spellcastingDataToEntry(data.spellcasting);

            // Ensure name is set (required by StatblockData.entries type)
            if (!spellEntry.name) {
                spellEntry.name = 'Spellcasting';
            }

            // Initialize entries array and add spellcasting entry
            // Cast to match StatblockData.entries type
            data.entries = [spellEntry as any];

            // Remove old spellcasting field to prevent confusion
            delete data.spellcasting;

            console.log(`[Preset Migration] Successfully migrated spellcasting for ${data.name}`);
        } catch (err) {
            console.error(`[Preset Migration] Failed to migrate spellcasting for ${data.name}:`, err);
            // Keep original spellcasting data on error
        }
    } else if (data.spellcasting && data.entries) {
        // Handle edge case: Both formats exist
        // Check if entries already contains a spellcasting entry
        const hasSpellcastingEntry = data.entries.some(
            (entry: any) =>
                entry.entryType === 'spellcasting' ||
                entry.spellGroups ||
                entry.spellAbility
        );

        if (!hasSpellcastingEntry) {
            try {
                console.log(`[Preset Migration] Adding missing spellcasting entry for ${data.name}`);

                // Convert and append spellcasting entry
                const spellEntry = spellcastingDataToEntry(data.spellcasting);

                // Ensure name is set (required by StatblockData.entries type)
                if (!spellEntry.name) {
                    spellEntry.name = 'Spellcasting';
                }

                // Cast to match StatblockData.entries type
                data.entries.push(spellEntry as any);

                // Remove old spellcasting field
                delete data.spellcasting;

                console.log(`[Preset Migration] Successfully added spellcasting entry for ${data.name}`);
            } catch (err) {
                console.error(`[Preset Migration] Failed to add spellcasting entry for ${data.name}:`, err);
                // Keep original spellcasting data on error
            }
        } else {
            // Already has spellcasting in new format, remove old field
            console.log(`[Preset Migration] Removing duplicate spellcasting_json for ${data.name}`);
            delete data.spellcasting;
        }
    }

    console.log('[Preset Loader] Loaded preset:', data.name, {
        type: data.type,
        size: data.size,
        typeTags: data.typeTags,
        alignmentLawChaos: data.alignmentLawChaos,
        alignmentGoodEvil: data.alignmentGoodEvil,
        alignmentOverride: data.alignmentOverride,
        initiative: data.initiative,
        pb: data.pb,
        hasEntries: !!data.entries,
        entriesCount: data.entries?.length ?? 0,
        hasSpellcasting: !!data.spellcasting,
        hasSpeeds: !!data.speeds,
        hasSaves: !!data.saves,
        hasSkills: !!data.skills,
        hasSenses: !!data.sensesList,
        hasLanguages: !!data.languagesList,
        hasPassives: !!data.passivesList,
    });

    return data;
}

/**
 * Findet Presets anhand eines Suchstrings.
 * Ähnlich wie findEntryPresets, aber für Creature-Presets.
 */
export async function findCreaturePresets(
    app: App,
    query: string,
    options: {
        limit?: number;
        category?: 'Animals' | 'Monsters';
    } = {}
): Promise<Array<{ file: TFile; data: StatblockData; score: number }>> {
    const { limit = 10, category } = options;
    const files = await listPresetFiles(app);

    const results: Array<{ file: TFile; data: StatblockData; score: number }> = [];

    for (const file of files) {
        // Filter by category if specified
        if (category) {
            const inCategory = file.path.includes(`/${category}/`);
            if (!inCategory) continue;
        }

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
                const data = await loadCreaturePreset(app, file);
                results.push({ file, data, score });
            } catch (err) {
                console.warn(`Failed to load preset ${file.path}:`, err);
            }
        }

        if (results.length >= limit * 2) break; // Stop early if we have enough
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}

/**
 * Gibt alle verfügbaren Kategorien zurück.
 */
export async function getPresetCategories(app: App): Promise<string[]> {
    const files = await listPresetFiles(app);
    const categories = new Set<string>();

    for (const file of files) {
        const match = file.path.match(/\/Presets\/Creatures\/([^/]+)\//);
        if (match) {
            categories.add(match[1]);
        }
    }

    return Array.from(categories).sort();
}
