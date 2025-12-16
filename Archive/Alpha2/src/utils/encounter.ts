/**
 * Encounter Utilities
 *
 * Pure functions for D&D 5e encounter building.
 * Includes CR parsing, XP calculation, difficulty assessment,
 * creature filtering, and encounter generation.
 *
 * Consolidated from cr-utils.ts, xp-threshold.ts, difficulty.ts,
 * filter.ts, roll.ts, and encounter-gen.ts.
 *
 * @module utils/encounter
 */

import type { StatblockData } from '../schemas/character/creature';
import type {
	Party,
	Difficulty,
	EncounterParams,
	Encounter,
	EncounterGroup,
} from '../schemas/encounter';
import {
	CR_TO_XP,
	CR_VALUES,
	XP_THRESHOLDS_BY_LEVEL,
	ENCOUNTER_MULTIPLIERS,
	ENCOUNTER_CHECK_PROBABILITY,
	DIFFICULTY_LEVELS,
} from '../constants/encounter';

// ============================================================================
// CR Utilities
// ============================================================================

/**
 * Parse a CR string to a numeric value.
 * Handles fractions like "1/8" -> 0.125.
 */
export function parseCr(cr: string): number {
	if (cr.includes('/')) {
		const [num, denom] = cr.split('/').map(Number);
		return num / denom;
	}
	return parseFloat(cr);
}

/**
 * Convert a numeric CR back to the canonical string form.
 */
export function crToString(numericCr: number): string {
	if (numericCr === 0.125) return '1/8';
	if (numericCr === 0.25) return '1/4';
	if (numericCr === 0.5) return '1/2';
	return String(Math.floor(numericCr));
}

/**
 * Get XP value for a given CR string.
 */
export function getXpForCr(cr: string): number {
	return CR_TO_XP[cr] ?? 0;
}

/**
 * Get XP value for a numeric CR.
 */
export function getXpForNumericCr(numericCr: number): number {
	const crString = crToString(numericCr);
	return getXpForCr(crString);
}

/**
 * Check if a CR string is valid.
 */
export function isValidCr(cr: string): boolean {
	return (CR_VALUES as readonly string[]).includes(cr);
}

// ============================================================================
// Party Thresholds
// ============================================================================

/** XP thresholds for a party at all difficulty levels */
export type PartyThresholds = Record<Difficulty, number>;

/**
 * Get XP threshold for a single character at a given level and difficulty.
 */
export function getCharacterThreshold(
	level: number,
	difficulty: Difficulty
): number {
	const clampedLevel = Math.max(1, Math.min(20, level));
	const index = clampedLevel - 1;
	return XP_THRESHOLDS_BY_LEVEL[difficulty][index];
}

/**
 * Calculate XP thresholds for an entire party.
 * Sums individual character thresholds.
 */
export function calculatePartyThresholds(party: Party): PartyThresholds {
	const thresholds: PartyThresholds = {
		easy: 0,
		medium: 0,
		hard: 0,
		deadly: 0,
	};

	for (const member of party) {
		for (const difficulty of DIFFICULTY_LEVELS) {
			thresholds[difficulty] += getCharacterThreshold(
				member.level,
				difficulty
			);
		}
	}

	return thresholds;
}

/**
 * Get the target XP threshold for a party at a specific difficulty.
 */
export function getPartyThreshold(party: Party, difficulty: Difficulty): number {
	const thresholds = calculatePartyThresholds(party);
	return thresholds[difficulty];
}

// ============================================================================
// Difficulty Calculation
// ============================================================================

/**
 * Get the encounter multiplier based on creature count.
 */
export function getEncounterMultiplier(creatureCount: number): number {
	for (const [maxCount, multiplier] of ENCOUNTER_MULTIPLIERS) {
		if (creatureCount <= maxCount) {
			return multiplier;
		}
	}
	return 4.0;
}

/**
 * Calculate adjusted XP for an encounter.
 */
export function calculateAdjustedXp(
	totalXp: number,
	creatureCount: number
): number {
	const multiplier = getEncounterMultiplier(creatureCount);
	return Math.floor(totalXp * multiplier);
}

/**
 * Determine encounter difficulty by comparing adjusted XP to party thresholds.
 * Returns the highest threshold that the adjusted XP meets or exceeds.
 */
export function determineDifficulty(
	adjustedXp: number,
	partyThresholds: PartyThresholds
): Difficulty {
	const reversedDifficulties = [...DIFFICULTY_LEVELS].reverse() as Difficulty[];

	for (const difficulty of reversedDifficulties) {
		if (adjustedXp >= partyThresholds[difficulty]) {
			return difficulty;
		}
	}

	return 'easy';
}

/**
 * Check if an encounter's adjusted XP is within range for a target difficulty.
 */
export function matchesDifficulty(
	adjustedXp: number,
	targetDifficulty: Difficulty,
	partyThresholds: PartyThresholds
): boolean {
	const targetThreshold = partyThresholds[targetDifficulty];
	const difficultyIndex = DIFFICULTY_LEVELS.indexOf(targetDifficulty);

	if (adjustedXp < targetThreshold) {
		return false;
	}

	if (difficultyIndex < DIFFICULTY_LEVELS.length - 1) {
		const nextDifficulty = DIFFICULTY_LEVELS[difficultyIndex + 1] as Difficulty;
		const nextThreshold = partyThresholds[nextDifficulty];
		if (adjustedXp >= nextThreshold) {
			return false;
		}
	}

	return true;
}

// ============================================================================
// Creature Filtering
// ============================================================================

/**
 * Filter creatures by encounter parameters.
 */
export function filterCreatures(
	creatures: StatblockData[],
	params: EncounterParams
): StatblockData[] {
	return creatures.filter((creature) => {
		// Filter by creature type
		if (params.creatureTypes && params.creatureTypes.length > 0) {
			const creatureType = creature.type?.toLowerCase();
			if (!creatureType) return false;

			const matchesType = params.creatureTypes.some((filterType) =>
				creatureType.includes(filterType.toLowerCase())
			);
			if (!matchesType) return false;
		}

		// Filter by CR range
		if (params.crMin !== undefined || params.crMax !== undefined) {
			const crString = creature.cr;
			if (!crString) return false;

			const crNumeric = parseCr(crString);

			if (params.crMin !== undefined && crNumeric < params.crMin) {
				return false;
			}
			if (params.crMax !== undefined && crNumeric > params.crMax) {
				return false;
			}
		}

		return true;
	});
}

/**
 * Sort creatures by CR (ascending).
 */
export function sortCreaturesByCr(creatures: StatblockData[]): StatblockData[] {
	return [...creatures].sort((a, b) => {
		const crA = a.cr ? parseCr(a.cr) : 0;
		const crB = b.cr ? parseCr(b.cr) : 0;
		return crA - crB;
	});
}

/**
 * Group creatures by CR for more efficient encounter building.
 */
export function groupCreaturesByCr(
	creatures: StatblockData[]
): Map<string, StatblockData[]> {
	const groups = new Map<string, StatblockData[]>();

	for (const creature of creatures) {
		const cr = creature.cr ?? '0';
		const existing = groups.get(cr) ?? [];
		existing.push(creature);
		groups.set(cr, existing);
	}

	return groups;
}

// ============================================================================
// Encounter Generation
// ============================================================================

/** Result of encounter generation attempt */
export type EncounterResult =
	| { success: true; encounter: Encounter }
	| { success: false; reason: string };

/**
 * Get the maximum XP for a difficulty level (threshold of next level).
 */
function getMaxXpForDifficulty(
	difficulty: Difficulty,
	thresholds: PartyThresholds
): number {
	const levels: Difficulty[] = ['easy', 'medium', 'hard', 'deadly'];
	const index = levels.indexOf(difficulty);

	if (index < levels.length - 1) {
		return thresholds[levels[index + 1]] - 1;
	}

	// For deadly, allow up to 1.5x the deadly threshold
	return Math.floor(thresholds.deadly * 1.5);
}

/**
 * Build an encounter by selecting creatures to match target XP.
 * Uses a greedy approach: start with higher CR, fill with lower.
 */
function buildEncounter(
	sortedCreatures: StatblockData[],
	targetXp: number,
	maxXp: number,
	thresholds: PartyThresholds,
	maxCreatureCount?: number
): Encounter | null {
	const groups: Map<string, EncounterGroup> = new Map();
	let totalXp = 0;
	let creatureCount = 0;

	const tryAddCreature = (creature: StatblockData, xpEach: number): boolean => {
		const testCount = creatureCount + 1;
		const testTotalXp = totalXp + xpEach;
		const testAdjusted = calculateAdjustedXp(testTotalXp, testCount);

		if (maxCreatureCount !== undefined && testCount > maxCreatureCount) {
			return false;
		}
		if (testAdjusted > maxXp) {
			return false;
		}

		const creatureKey = creature.name;
		const existing = groups.get(creatureKey);

		if (existing) {
			existing.count++;
		} else {
			groups.set(creatureKey, {
				creature,
				count: 1,
				xpEach,
			});
		}

		totalXp = testTotalXp;
		creatureCount = testCount;
		return true;
	};

	// Start from highest CR creature
	const reversed = [...sortedCreatures].reverse();

	for (const creature of reversed) {
		const crString = creature.cr ?? '0';
		const xpEach = getXpForCr(crString);

		if (xpEach === 0) continue;

		tryAddCreature(creature, xpEach);

		const adjustedXp = calculateAdjustedXp(totalXp, creatureCount);
		if (adjustedXp >= targetXp) {
			break;
		}
	}

	// If we couldn't meet the minimum threshold, try filling with lowest CR
	let adjustedXp = calculateAdjustedXp(totalXp, creatureCount);

	if (adjustedXp < targetXp && sortedCreatures.length > 0) {
		const lowestCr = sortedCreatures[0];
		const xpEach = getXpForCr(lowestCr.cr ?? '0');

		while (adjustedXp < targetXp) {
			if (!tryAddCreature(lowestCr, xpEach)) {
				break;
			}
			adjustedXp = calculateAdjustedXp(totalXp, creatureCount);
		}
	}

	if (creatureCount === 0) {
		return null;
	}

	const finalAdjusted = calculateAdjustedXp(totalXp, creatureCount);
	const finalDifficulty = determineDifficulty(finalAdjusted, thresholds);

	return {
		groups: Array.from(groups.values()),
		totalXp,
		adjustedXp: finalAdjusted,
		multiplier: getEncounterMultiplier(creatureCount),
		difficulty: finalDifficulty,
		creatureCount,
	};
}

/**
 * Generate a single "fair" encounter matching the target difficulty.
 */
export function generateEncounter(
	creatures: StatblockData[],
	party: Party,
	params: EncounterParams
): EncounterResult {
	// Validate inputs
	if (party.length === 0) {
		return { success: false, reason: 'Party is empty' };
	}

	if (creatures.length === 0) {
		return { success: false, reason: 'No creatures available' };
	}

	// Filter creatures by params
	const filtered = filterCreatures(creatures, params);
	if (filtered.length === 0) {
		return { success: false, reason: 'No creatures match the filter criteria' };
	}

	// Calculate party thresholds
	const thresholds = calculatePartyThresholds(party);
	const targetXp = thresholds[params.difficulty];
	const maxXp = getMaxXpForDifficulty(params.difficulty, thresholds);

	// Sort by CR for building encounter
	const sorted = sortCreaturesByCr(filtered);

	// Build encounter
	const encounter = buildEncounter(
		sorted,
		targetXp,
		maxXp,
		thresholds,
		params.maxCreatureCount
	);

	if (!encounter) {
		return {
			success: false,
			reason: 'Could not build an encounter matching the target difficulty',
		};
	}

	return { success: true, encounter };
}

// ============================================================================
// Encounter Checks
// ============================================================================

/**
 * Roll to check if a random encounter occurs.
 * @param probability - Probability of encounter (0-1), default 0.125 (12.5%)
 */
export function rollEncounterCheck(
	probability: number = ENCOUNTER_CHECK_PROBABILITY
): boolean {
	return Math.random() < probability;
}
