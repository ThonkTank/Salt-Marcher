/**
 * Ability Schema
 *
 * Templates for passive abilities, traits, and limited use mechanics.
 *
 * @module schemas/character/ability
 */

import {
	CREATURE_ENTRY_CATEGORIES,
	LIMITED_USE_RESETS
} from '../../constants/rules';

// ============================================================================
// LIMITED USE
// ============================================================================

/**
 * When a limited use ability resets
 */
export type LimitedUseReset = typeof LIMITED_USE_RESETS[number];

/**
 * Limited use tracking for abilities
 */
export type LimitedUse = {
	count: number; // Number of uses
	reset: LimitedUseReset;
	conditional?: {
		count: number;
		condition: string;
	};
};

// ============================================================================
// ENTRY TYPES
// ============================================================================

/**
 * Category of creature entry (statblock section)
 */
export type CreatureEntryCategory = typeof CREATURE_ENTRY_CATEGORIES[number];

/**
 * Base entry type with common fields for all abilities
 */
export type BaseEntry = {
	category: CreatureEntryCategory;
	name: string;
	text?: string; // Always keep text for rendering/fallback
	recharge?: string; // "5-6", "4-6", "6"
	limitedUse?: LimitedUse;
};

/**
 * Special entry for traits and passive abilities
 */
export type SpecialEntry = BaseEntry & {
	entryType: "special";
	// Just uses text field for description
};
