/**
 * Creature Schema
 *
 * NPC-specific types for D&D 5e creatures/monsters.
 * Player character shared stats are in core-stats.ts.
 *
 * @module schemas/character/creature
 */

import {
	TEMPERATURE_PREFERENCES,
	PRECIPITATION_PREFERENCES
} from '../../constants/climate';
import { TERRAIN_TYPES } from '../../constants/terrain';

// Import types needed for this file
import type {
	AbilityScoreKey,
	AbilityScore,
	CreatureSpeeds,
	SpeedArray,
	SaveBonus,
	SkillBonus,
	SenseToken,
	LanguageToken,
	SimpleValueToken
} from './core-stats';
import type { BaseEntry, SpecialEntry } from './ability';
import type { SpellcastingEntry, SpellcastingData } from './spell';
import type { AttackEntry, SaveEntry, MultiattackEntry } from '../combat/attack';

// ============================================================================
// HABITAT PREFERENCES
// ============================================================================

/**
 * Temperature preference for creature habitat
 */
export type TemperaturePreference = typeof TEMPERATURE_PREFERENCES[number];

/**
 * Precipitation preference for creature habitat
 */
export type PrecipitationPreference = typeof PRECIPITATION_PREFERENCES[number];

/**
 * Terrain preference for creature habitat
 */
export type TerrainPreference = typeof TERRAIN_TYPES[number];

// ============================================================================
// LEGACY ENTRY FORMAT
// ============================================================================

/**
 * Legacy entry format (for backwards compatibility during migration)
 */
export type LegacyEntry = BaseEntry & {
	entryType?: undefined;
	kind?: string;
	to_hit?: string;
	to_hit_from?: {
		ability: AbilityScoreKey | "best_of_str_dex";
		proficient?: boolean;
	};
	range?: string;
	target?: string;
	save_ability?: string;
	save_dc?: number;
	save_effect?: string;
	damage?: string;
	damage_from?: {
		dice: string;
		ability?: AbilityScoreKey | "best_of_str_dex";
		bonus?: string;
	};
};

// ============================================================================
// CREATURE ENTRY UNION
// ============================================================================

/**
 * Union type for all creature entry types
 */
export type CreatureEntry =
	| AttackEntry
	| SaveEntry
	| MultiattackEntry
	| SpellcastingEntry
	| SpecialEntry
	| LegacyEntry;

// ============================================================================
// STATBLOCK DATA (Main Creature Type)
// ============================================================================

/**
 * Normalised creature data used for persistence and Markdown export.
 * The structure intentionally mirrors the reference stat blocks.
 */
export type StatblockData = {
	// NPC Identity
	name: string;
	size?: string;
	type?: string;
	typeTags?: string[];
	alignmentLawChaos?: string;
	alignmentGoodEvil?: string;
	alignmentOverride?: string;

	// Core Stats (shared with PCs)
	ac?: string;
	initiative?: string;
	hp?: string;
	hitDice?: string;
	speeds?: CreatureSpeeds | SpeedArray;
	abilities?: AbilityScore[];
	pb?: string;
	saves?: SaveBonus[];
	skills?: SkillBonus[];

	// Senses & Languages
	sensesList?: SenseToken[];
	languagesList?: LanguageToken[];
	passivesList?: SimpleValueToken[];

	// Habitat & Environment preferences (NPC-specific)
	temperaturePreference?: TemperaturePreference[];
	precipitationPreference?: PrecipitationPreference[];
	terrainPreference?: TerrainPreference[];
	elevationRange?: { min?: number; max?: number };

	// Resistances & Immunities
	damageVulnerabilitiesList?: SimpleValueToken[];
	damageResistancesList?: SimpleValueToken[];
	damageImmunitiesList?: SimpleValueToken[];
	conditionImmunitiesList?: SimpleValueToken[];
	gearList?: SimpleValueToken[];

	// Challenge Rating
	cr?: string;
	xp?: string;

	// Legacy text fields
	traits?: string;
	actions?: string;
	legendary?: string;

	// Structured entries
	entries?: CreatureEntry[];

	// Legacy actions list
	actionsList?: Array<{
		name: string;
		kind?: string;
		to_hit?: string;
		range?: string;
		target?: string;
		save_ability?: string;
		save_dc?: number;
		save_effect?: string;
		damage?: string;
		recharge?: string;
		text?: string;
	}>;

	// Spellcasting
	spellcasting?: SpellcastingData;

	// User notes (for JSON storage compatibility)
	notes?: string;
};

/**
 * Type alias for backward compatibility
 */
export type CreatureData = StatblockData;
