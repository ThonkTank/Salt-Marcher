/**
 * Creature Schema
 *
 * Simplified creature/statblock types for SaltMarcherCore Library.
 * Contains only the fields needed for display and storage.
 *
 * @module SaltMarcherCore/schemas/creature
 */

// ============================================================================
// ABILITY SCORES
// ============================================================================

/**
 * Ability score entry
 */
export type AbilityScore = {
	key: string;
	value: number;
	modifier: number;
};

// ============================================================================
// STATBLOCK DATA (Main Creature Type)
// ============================================================================

/**
 * Normalised creature data used for persistence and display.
 * Simplified version for the Library - full version with combat
 * details lives in the game-specific plugin.
 */
export type StatblockData = {
	// Identity
	name: string;
	size?: string;
	type?: string;
	typeTags?: string[];
	alignmentLawChaos?: string;
	alignmentGoodEvil?: string;
	alignmentOverride?: string;

	// Core Stats
	ac?: string;
	initiative?: string;
	hp?: string;
	hitDice?: string;
	speeds?: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number };
	abilities?: AbilityScore[];
	pb?: string;

	// Saves & Skills (simplified)
	saves?: Array<{ key: string; value: number }>;
	skills?: Array<{ key: string; value: number }>;

	// Senses & Languages
	sensesList?: Array<{ key: string; value: string | number }>;
	languagesList?: Array<{ key: string; value?: string }>;
	passivesList?: Array<{ key: string; value: number }>;

	// Habitat & Environment preferences
	temperaturePreference?: string[];
	precipitationPreference?: string[];
	terrainPreference?: string[];
	elevationRange?: { min?: number; max?: number };

	// Resistances & Immunities
	damageVulnerabilitiesList?: Array<{ key: string }>;
	damageResistancesList?: Array<{ key: string }>;
	damageImmunitiesList?: Array<{ key: string }>;
	conditionImmunitiesList?: Array<{ key: string }>;
	gearList?: Array<{ key: string }>;

	// Challenge Rating
	cr?: string;
	xp?: string;

	// Text fields (for display)
	traits?: string;
	actions?: string;
	legendary?: string;

	// User notes (for JSON storage compatibility)
	notes?: string;
};

/**
 * Type alias for backward compatibility
 */
export type CreatureData = StatblockData;
