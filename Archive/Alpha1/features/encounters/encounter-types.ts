/**
 * Consolidated Encounter Types
 *
 * Single source of truth for all encounter-related type definitions.
 * Replaces the scattered incompatible type definitions across the codebase.
 */

import type { TFile } from 'obsidian';
import type { PartyMember } from '@services/state/party-store';
import type { SessionContext } from '../audio/auto-selection-types';
import type { TileData } from '../maps/data/tile-repository';

// ============================================================================
// CORE ENCOUNTER TYPES
// ============================================================================

/**
 * Combatant in an encounter
 * Represents a single participant in combat (creature or player)
 */
export interface Combatant {
    // Identity
    id: string;                      // Unique instance ID
    creatureId?: string;              // Reference to creature definition
    characterId?: string;             // Reference to player character (if applicable)

    // Basic Info
    name: string;                     // Display name
    cr: number;                       // Challenge rating
    characterClass?: string;          // Class (for player characters)

    // Combat Stats
    initiative: number;               // Initiative roll result
    currentHp: number;                // Current hit points
    maxHp: number;                    // Maximum hit points
    tempHp: number;                   // Temporary hit points (D&D 5e)
    ac: number;                       // Armor class

    // Status
    defeated: boolean;                // Whether combatant is defeated (HP <= 0)

    // References
    creatureFile?: string;            // Path to creature definition file
    sourceFile?: TFile;               // Obsidian file reference
}

/**
 * Generated encounter with all metadata
 */
export interface Encounter {
    // Identity
    id: string;                       // Unique encounter ID
    title: string;                    // Encounter name/description

    // Participants
    combatants: Combatant[];          // All combatants (sorted by initiative)

    // Balance Info
    totalXp: number;                  // Raw XP value
    adjustedXp: number;               // XP adjusted for party size
    difficulty: EncounterDifficulty;  // Calculated difficulty rating

    // Metadata
    source: EncounterSource;          // How encounter was triggered
    warnings?: string[];              // Any generation warnings
    timestamp: number;                // When generated (Date.now())
}

// ============================================================================
// GENERATION TYPES
// ============================================================================

/**
 * Context needed to generate an encounter
 */
export interface EncounterGenerationContext {
    // Party Information
    party: readonly PartyMember[];    // Party members with levels

    // Environment
    tileData?: TileData;             // Current hex terrain data
    sessionContext?: SessionContext;  // Weather, time, situation

    // Configuration
    difficulty?: EncounterDifficulty; // Target difficulty
    crRange?: {                      // Override CR range
        min?: number;
        max?: number;
    };

    // Location
    hexCoords?: { q: number; r: number; s: number };
    mapFile?: TFile;
}

/**
 * Simplified creature data for generation algorithms
 */
export interface SimplifiedCreature {
    // Identity
    id: string;
    name: string;
    type: string;

    // Combat Stats
    cr: number;
    hp: string;                      // e.g., "2d8+2"
    ac: string;                      // e.g., "15 (leather armor)"

    // Habitat Preferences
    terrainPreference?: string[];
    floraPreference?: string[];
    moisturePreference?: string[];

    // Source
    file: TFile;
}

// ============================================================================
// DISPLAY TYPES
// ============================================================================

/**
 * Creature as displayed in nearby list
 */
export interface NearbyCreature {
    creature: CreatureEntity;         // Full creature data
    score: number;                    // Habitat match score (0-100)
}

/**
 * Creature entity from Library
 */
export interface CreatureEntity {
    // Core fields from CreateSpec
    id: string;
    name: string;
    type: string;
    size: string;
    alignment: string;

    // Stats
    stats: {
        cr: number;
        hp: number;
        ac: number;
        speed: string;
    };

    // Abilities
    abilities: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };

    // Habitat
    habitat: {
        terrain?: string[];
        flora?: string[];
        moisture?: string[];
    };

    // Source
    sourceFile: TFile;
}

// ============================================================================
// STATE TYPES
// ============================================================================

/**
 * Combat state for presenter
 */
export interface CombatState {
    isActive: boolean;                       // Whether combat is ongoing
    participants: readonly Combatant[];      // All participants
    activeParticipantId: string | null;      // Current turn
    round: number;                           // Current round number
}

/**
 * Encounter session state
 */
export interface EncounterSessionState {
    currentEncounter: Encounter | null;
    combatState: CombatState | null;
    nearbyCreatures: NearbyCreature[];
}

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * Encounter difficulty ratings (D&D 5e)
 */
export type EncounterDifficulty =
    | 'trivial'
    | 'easy'
    | 'medium'
    | 'hard'
    | 'deadly';

/**
 * How encounter was triggered
 */
export type EncounterSource =
    | 'travel'       // Random travel encounter
    | 'manual'       // User-triggered
    | 'scripted'     // Pre-planned encounter
    | 'ambush'       // Surprise encounter
    | 'lair';        // Creature lair

/**
 * Combat participant status
 */
export type CombatantStatus =
    | 'active'       // Normal, can act
    | 'unconscious'  // At 0 HP
    | 'dead'         // Failed death saves
    | 'fled';        // Left combat

// ============================================================================
// CONVERSION UTILITIES (Type Guards and Adapters)
// ============================================================================

/**
 * Type guard to check if object is Combatant
 */
export function isCombatant(obj: any): obj is Combatant {
    return obj &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.initiative === 'number' &&
        typeof obj.currentHp === 'number' &&
        typeof obj.maxHp === 'number' &&
        typeof obj.tempHp === 'number' &&
        typeof obj.defeated === 'boolean';
}

/**
 * Combat-specific participant interface for session-runner
 * Used by combat-logic.ts for initiative tracking and HP management
 */
export interface CombatParticipantWithTemp {
    readonly id: string;
    readonly creatureId: string;
    readonly name: string;
    readonly initiative: number;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly tempHp: number;
    readonly defeated: boolean;
}

// ============================================================================
// D&D 5E REFERENCE DATA
// ============================================================================

/**
 * CR to XP mapping (D&D 5e DMG p.82)
 */
export const CR_TO_XP: Record<number, number> = {
    0: 10,
    0.125: 25,
    0.25: 50,
    0.5: 100,
    1: 200,
    2: 450,
    3: 700,
    4: 1100,
    5: 1800,
    6: 2300,
    7: 2900,
    8: 3900,
    9: 5000,
    10: 5900,
    11: 7200,
    12: 8400,
    13: 10000,
    14: 11500,
    15: 13000,
    16: 15000,
    17: 18000,
    18: 20000,
    19: 22000,
    20: 25000,
    21: 33000,
    22: 41000,
    23: 50000,
    24: 62000,
    25: 75000,
    26: 90000,
    27: 105000,
    28: 120000,
    29: 135000,
    30: 155000,
};

/**
 * XP thresholds per character level (D&D 5e DMG p.82)
 */
export const XP_THRESHOLDS_BY_LEVEL: Record<
    number,
    { easy: number; medium: number; hard: number; deadly: number }
> = {
    1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
    2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
    3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
    4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
    5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
    6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
    7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
    8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
    9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
    10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
    11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
    12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
    13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
    14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
    15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
    16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
    17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
    18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
    19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
    20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

/**
 * Encounter multiplier based on number of monsters (D&D 5e DMG p.82)
 */
export const ENCOUNTER_MULTIPLIERS: Array<{ minMonsters: number; multiplier: number }> = [
    { minMonsters: 1, multiplier: 1.0 },
    { minMonsters: 2, multiplier: 1.5 },
    { minMonsters: 3, multiplier: 2.0 },
    { minMonsters: 7, multiplier: 2.5 },
    { minMonsters: 11, multiplier: 3.0 },
    { minMonsters: 15, multiplier: 4.0 },
];
