/**
 * Encounter Schemas
 *
 * Types for party composition, encounter generation, and active encounter state.
 * Consolidated from party.ts, encounter.ts, params.ts, and state.ts.
 *
 * @module schemas/encounter
 */

import type { StatblockData } from './character/creature';

// ============================================================================
// Difficulty
// ============================================================================

/** D&D 5e encounter difficulty levels */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// ============================================================================
// Party
// ============================================================================

/** A single party member */
export type PartyMember = {
	/** Character name */
	name: string;
	/** Character level (1-20) */
	level: number;
};

/** A party of adventurers */
export type Party = PartyMember[];

// ============================================================================
// Encounter Generation
// ============================================================================

/** Parameters for encounter generation */
export type EncounterParams = {
	/** Target difficulty level */
	difficulty: Difficulty;
	/** Optional: filter by creature type(s) - e.g., "beast", "undead" */
	creatureTypes?: string[];
	/** Optional: minimum CR (as number, e.g., 0.125 for 1/8) */
	crMin?: number;
	/** Optional: maximum CR (as number) */
	crMax?: number;
	/** Optional: maximum total creature count */
	maxCreatureCount?: number;
};

/** A creature group in the encounter (same creature, multiple count) */
export type EncounterGroup = {
	/** The creature statblock */
	creature: StatblockData;
	/** Number of this creature in the encounter */
	count: number;
	/** XP value for one creature */
	xpEach: number;
};

/** A generated encounter */
export type Encounter = {
	/** Creature groups in this encounter */
	groups: EncounterGroup[];
	/** Total raw XP (before multiplier) */
	totalXp: number;
	/** Adjusted XP (after multiplier) */
	adjustedXp: number;
	/** Multiplier applied based on monster count */
	multiplier: number;
	/** Actual difficulty achieved */
	difficulty: Difficulty;
	/** Total creature count */
	creatureCount: number;
};

// ============================================================================
// Active Encounter State
// ============================================================================

/** Result of an encounter check roll */
export type EncounterCheckResult =
	| { triggered: false }
	| { triggered: true; encounter: Encounter };

/** An active encounter during travel */
export type ActiveEncounter = {
	/** The generated encounter */
	encounter: Encounter;
	/** Terrain type where encounter occurred */
	terrain: string;
	/** Travel hour when encounter was triggered */
	hour: number;
};

/** Full encounter service state (exposed to subscribers) */
export type EncounterServiceState = {
	activeEncounter: ActiveEncounter | null;
	party: Party;
};
