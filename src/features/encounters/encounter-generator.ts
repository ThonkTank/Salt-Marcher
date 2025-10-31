/**
 * Encounter Generator
 *
 * Core logic for generating random encounters from encounter tables with CR balancing.
 * Follows D&D 5e DMG encounter building guidelines (p.81-85).
 */

import type { App } from "obsidian";
import type {
    EncounterGenerationContext,
    GeneratedEncounter,
    EncounterCombatant,
} from "./types";
import type { EncounterTableData, EncounterTableEntry } from "../../workmodes/library/encounter-tables/types";
import type { SessionContext } from "../audio/auto-selection-types";
import {
    CR_TO_XP,
    XP_THRESHOLDS_BY_LEVEL,
    ENCOUNTER_MULTIPLIERS,
} from "./types";
import { calculatePlaylistScore } from "../audio/auto-selection";
import { parseCR } from "../../workmodes/library/encounter-tables/serializer";

/**
 * Generate random encounter from encounter table
 */
export async function generateEncounter(
    app: App,
    tables: EncounterTableData[],
    context: EncounterGenerationContext,
): Promise<GeneratedEncounter> {
    const warnings: string[] = [];

    // Select best matching table based on session context
    const selectedTable = selectEncounterTable(tables, context, warnings);
    if (!selectedTable) {
        throw new Error("No matching encounter table found");
    }

    // Roll on table to select entry
    const selectedEntry = rollOnTable(selectedTable);
    if (!selectedEntry) {
        throw new Error("No encounter entry selected (empty table)");
    }

    // Load creatures from Library
    const creatures = await loadCreaturesFromLibrary(app, selectedEntry.creatures, warnings);
    if (creatures.length === 0) {
        throw new Error("No creatures could be loaded from Library");
    }

    // Roll quantity
    const quantity = rollQuantity(selectedEntry.quantity || "1");

    // Select creatures matching CR range and spawn combatants
    const combatants = spawnCombatants(creatures, quantity, context, warnings);

    // Calculate XP and difficulty
    const { totalXp, adjustedXp, difficulty } = calculateEncounterDifficulty(
        combatants,
        context,
    );

    // Sort by initiative (descending)
    combatants.sort((a, b) => b.initiative - a.initiative);

    // Build title
    const title = selectedEntry.description || `Random Encounter: ${selectedEntry.creatures.join(", ")}`;

    return {
        title,
        combatants,
        totalXp,
        adjustedXp,
        difficulty,
        warnings: warnings.length > 0 ? warnings : undefined,
        sourceTable: selectedTable.name,
        sourceEntry: selectedEntry,
    };
}

/**
 * Select best encounter table based on context tags
 */
function selectEncounterTable(
    tables: EncounterTableData[],
    context: EncounterGenerationContext,
    warnings: string[],
): EncounterTableData | null {
    if (tables.length === 0) {
        warnings.push("No encounter tables available");
        return null;
    }

    // Filter by CR range if specified
    const crFiltered = tables.filter((table) => {
        if (!table.crRange && !context.crRange) return true;

        const tableMin = table.crRange?.min ?? 0;
        const tableMax = table.crRange?.max ?? 30;
        const contextMin = context.crRange?.min ?? 0;
        const contextMax = context.crRange?.max ?? 30;

        // Check overlap
        return !(tableMax < contextMin || tableMin > contextMax);
    });

    if (crFiltered.length === 0) {
        warnings.push("No encounter tables match CR range");
        return tables[0]; // Fallback to any table
    }

    // If no session context, pick random
    if (!context.sessionContext) {
        return crFiltered[Math.floor(Math.random() * crFiltered.length)];
    }

    // Score tables by tag match (reuse playlist scoring logic)
    const scored = crFiltered.map((table) => ({
        table,
        score: calculatePlaylistScore(table as any, context.sessionContext!).score,
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].table;
}

/**
 * Roll on encounter table using weighted selection
 */
function rollOnTable(table: EncounterTableData): EncounterTableEntry | null {
    if (table.entries.length === 0) return null;

    const totalWeight = table.entries.reduce((sum, entry) => sum + (entry.weight || 1), 0);
    let roll = Math.random() * totalWeight;

    for (const entry of table.entries) {
        const weight = entry.weight || 1;
        if (roll < weight) {
            return entry;
        }
        roll -= weight;
    }

    // Fallback to last entry
    return table.entries[table.entries.length - 1];
}

/**
 * Load creature data from Library
 */
async function loadCreaturesFromLibrary(
    app: App,
    creatureNames: string[],
    warnings: string[],
): Promise<Array<{ name: string; cr: number; hp: string; ac: string; file: string }>> {
    const creatures: Array<{ name: string; cr: number; hp: string; ac: string; file: string }> = [];

    for (const name of creatureNames) {
        try {
            // Search for creature file in vault
            const files = app.vault.getMarkdownFiles();
            const creatureFile = files.find(
                (f) => f.basename.toLowerCase() === name.toLowerCase() && f.path.includes("Creatures"),
            );

            if (!creatureFile) {
                warnings.push(`Creature "${name}" not found in Library`);
                continue;
            }

            // Read frontmatter
            const content = await app.vault.read(creatureFile);
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!fmMatch) {
                warnings.push(`Creature "${name}" has no frontmatter`);
                continue;
            }

            // Parse CR, HP, AC from frontmatter
            const fm = fmMatch[1];
            const crMatch = fm.match(/cr:\s*(.+)/);
            const hpMatch = fm.match(/hp:\s*'(.+)'/);
            const acMatch = fm.match(/ac:\s*'(.+)'/);

            if (!crMatch || !hpMatch || !acMatch) {
                warnings.push(`Creature "${name}" missing cr, hp, or ac fields`);
                continue;
            }

            const cr = parseCR(crMatch[1].trim());

            creatures.push({
                name,
                cr,
                hp: hpMatch[1],
                ac: acMatch[1],
                file: creatureFile.path,
            });
        } catch (error) {
            warnings.push(`Error loading creature "${name}": ${error.message}`);
        }
    }

    return creatures;
}

/**
 * Roll dice formula (e.g. "1d4", "2", "1d6+2")
 */
function rollQuantity(formula: string): number {
    const trimmed = formula.trim();

    // Simple number
    if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10);
    }

    // Dice formula: NdM or NdM+B
    const match = trimmed.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) {
        return 1; // Fallback to 1
    }

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;

    let total = bonus;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * sides) + 1;
    }

    return Math.max(1, total);
}

/**
 * Spawn combatants from creatures
 */
function spawnCombatants(
    creatures: Array<{ name: string; cr: number; hp: string; ac: string; file: string }>,
    quantity: number,
    context: EncounterGenerationContext,
    warnings: string[],
): EncounterCombatant[] {
    const combatants: EncounterCombatant[] = [];

    // Filter creatures by CR range
    const crMin = context.crRange?.min ?? 0;
    const crMax = context.crRange?.max ?? 30;
    const validCreatures = creatures.filter((c) => c.cr >= crMin && c.cr <= crMax);

    if (validCreatures.length === 0) {
        warnings.push("No creatures match CR range, using all available creatures");
        validCreatures.push(...creatures);
    }

    // Spawn quantity of creatures
    for (let i = 0; i < quantity; i++) {
        const creature = validCreatures[Math.floor(Math.random() * validCreatures.length)];

        // Parse HP (expecting format like "19" or "3d8+6")
        const maxHp = parseInt(creature.hp, 10) || 10;

        // Parse AC (expecting format like "12")
        const ac = parseInt(creature.ac, 10) || 10;

        // Roll initiative (1d20 + dex mod, for now just 1d20)
        const initiative = Math.floor(Math.random() * 20) + 1;

        combatants.push({
            name: creature.name,
            cr: creature.cr,
            initiative,
            currentHp: maxHp,
            maxHp,
            ac,
            creatureFile: creature.file,
            id: `${creature.name}-${Date.now()}-${i}`,
        });
    }

    return combatants;
}

/**
 * Calculate encounter XP and difficulty
 */
function calculateEncounterDifficulty(
    combatants: EncounterCombatant[],
    context: EncounterGenerationContext,
): {
    totalXp: number;
    adjustedXp: number;
    difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly";
} {
    // Sum total XP
    const totalXp = combatants.reduce((sum, c) => sum + (CR_TO_XP[c.cr] || 0), 0);

    // Apply encounter multiplier based on number of monsters
    const multiplier = getEncounterMultiplier(combatants.length);
    const adjustedXp = totalXp * multiplier;

    // Calculate party XP threshold
    const level = Math.max(1, Math.min(20, Math.floor(context.partyLevel)));
    const thresholds = XP_THRESHOLDS_BY_LEVEL[level];
    const partyXp = {
        easy: thresholds.easy * context.partySize,
        medium: thresholds.medium * context.partySize,
        hard: thresholds.hard * context.partySize,
        deadly: thresholds.deadly * context.partySize,
    };

    // Determine difficulty
    let difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly";
    if (adjustedXp < partyXp.easy) {
        difficulty = "trivial";
    } else if (adjustedXp < partyXp.medium) {
        difficulty = "easy";
    } else if (adjustedXp < partyXp.hard) {
        difficulty = "medium";
    } else if (adjustedXp < partyXp.deadly) {
        difficulty = "hard";
    } else {
        difficulty = "deadly";
    }

    return { totalXp, adjustedXp, difficulty };
}

/**
 * Get encounter multiplier based on number of monsters
 */
function getEncounterMultiplier(monsterCount: number): number {
    for (let i = ENCOUNTER_MULTIPLIERS.length - 1; i >= 0; i--) {
        if (monsterCount >= ENCOUNTER_MULTIPLIERS[i].minMonsters) {
            return ENCOUNTER_MULTIPLIERS[i].multiplier;
        }
    }
    return 1.0;
}
