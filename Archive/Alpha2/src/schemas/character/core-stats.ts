/**
 * Core Stats Schema
 *
 * Shared statistics between player characters and NPCs.
 * Includes ability scores, movement, HP, AC, saves, skills, and senses.
 *
 * @module schemas/character/core-stats
 */

import { ABILITY_SCORE_KEYS } from '../../constants/rules';

// ============================================================================
// ABILITY SCORES
// ============================================================================

/**
 * Ability score keys used throughout creature stats
 */
export type AbilityScoreKey = typeof ABILITY_SCORE_KEYS[number];

/**
 * Ability score with value
 */
export type AbilityScore = {
	ability: AbilityScoreKey;
	score: number;
};

// ============================================================================
// MOVEMENT / SPEED
// ============================================================================

/**
 * Legacy object-based speed value (deprecated, will be migrated to array format)
 */
export type CreatureSpeedValue = {
	distance?: string;
	hover?: boolean;
	note?: string;
};

/**
 * Legacy extra speed entry with label
 */
export type CreatureSpeedExtra = CreatureSpeedValue & {
	label: string;
};

/**
 * Legacy object-based speeds collection
 */
export type CreatureSpeeds = {
	walk?: CreatureSpeedValue;
	swim?: CreatureSpeedValue;
	fly?: CreatureSpeedValue;
	burrow?: CreatureSpeedValue;
	climb?: CreatureSpeedValue;
	extras?: CreatureSpeedExtra[];
};

/**
 * New array-based speed entry (preferred format)
 */
export type SpeedEntry = {
	type: string; // "walk", "fly", "swim", "burrow", "climb", or custom
	value: string; // e.g. "30 ft."
	hover?: boolean; // Only for fly speed
	note?: string; // Additional notes
};

/**
 * Array of speed entries
 */
export type SpeedArray = SpeedEntry[];

// ============================================================================
// SAVES & SKILLS
// ============================================================================

/**
 * Saving throw bonus for a specific ability
 */
export type SaveBonus = {
	ability: AbilityScoreKey;
	bonus: number;
};

/**
 * Skill bonus with explicit value
 */
export type SkillBonus = {
	name: string;
	bonus: number;
};

// ============================================================================
// SENSES, LANGUAGES & TOKENS
// ============================================================================

/**
 * Sense entry (darkvision, blindsight, etc.)
 */
export type SenseToken = {
	type?: string; // "darkvision", "blindsight", "tremorsense", "truesight"
	range?: string; // e.g. "120"
	value?: string; // Fallback for freeform text
};

/**
 * Language entry with optional telepathy range
 */
export type LanguageToken = {
	value?: string; // e.g. "Common", "Draconic"
	type?: string; // "telepathy"
	range?: string; // e.g. "120" (for telepathy)
};

/**
 * Simple value token for lists (resistances, immunities, gear, etc.)
 */
export type SimpleValueToken = {
	value: string; // Freeform text value
};
