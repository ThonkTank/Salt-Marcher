/**
 * Spell Schema
 *
 * Spellcasting types, spell groups, and spell entry templates.
 *
 * @module schemas/character/spell
 */

import { SPELL_COMPONENTS } from '../../constants/rules';
import type { AbilityScoreKey } from './core-stats';
import type { BaseEntry } from './ability';

// ============================================================================
// SPELLCASTING ABILITY
// ============================================================================

/**
 * Ability used for spellcasting
 */
export type SpellcastingAbility = AbilityScoreKey;

// ============================================================================
// SPELL COMPONENTS
// ============================================================================

/**
 * Spell component type (V, S, M)
 */
export type SpellComponent = typeof SPELL_COMPONENTS[number];

// ============================================================================
// SPELL DEFINITIONS
// ============================================================================

/**
 * A single spell in a spellcasting list
 */
export type SpellcastingSpell = {
	name: string;
	notes?: string;
	prepared?: boolean;
};

// ============================================================================
// SPELLCASTING GROUPS
// ============================================================================

/**
 * At-will spells group
 */
export type SpellcastingGroupAtWill = {
	type: "at-will";
	title?: string;
	spells: SpellcastingSpell[];
};

/**
 * Per-day spells group
 */
export type SpellcastingGroupPerDay = {
	type: "per-day";
	uses: string;
	title?: string;
	note?: string;
	spells: SpellcastingSpell[];
};

/**
 * Spell level group with slots
 */
export type SpellcastingGroupLevel = {
	type: "level";
	level: number;
	title?: string;
	slots?: number | string;
	note?: string;
	spells: SpellcastingSpell[];
};

/**
 * Custom spellcasting group
 */
export type SpellcastingGroupCustom = {
	type: "custom";
	title: string;
	description?: string;
	spells?: SpellcastingSpell[];
};

/**
 * Union of all spellcasting group types
 */
export type SpellcastingGroup =
	| SpellcastingGroupAtWill
	| SpellcastingGroupPerDay
	| SpellcastingGroupLevel
	| SpellcastingGroupCustom;

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Computed spellcasting values (derived from ability scores)
 */
export type SpellcastingComputedValues = {
	abilityMod?: number | null;
	proficiencyBonus?: number | null;
	saveDc?: number | null;
	attackBonus?: number | null;
};

// ============================================================================
// SPELLCASTING DATA
// ============================================================================

/**
 * Complete spellcasting data for a creature
 */
export type SpellcastingData = {
	title?: string;
	summary?: string;
	ability?: SpellcastingAbility;
	saveDcOverride?: number;
	attackBonusOverride?: number;
	notes?: string[];
	groups: SpellcastingGroup[];
	computed?: SpellcastingComputedValues;
};

/**
 * Spellcasting entry data (for innate/action-based spellcasting)
 */
export type SpellcastingEntryData = {
	ability: AbilityScoreKey;
	saveDC?: number;
	attackBonus?: number;
	excludeComponents?: SpellComponent[];
	spellLists: Array<{
		frequency: "at-will" | "1/day" | "2/day" | "3/day" | string;
		spells: string[]; // Spell names
	}>;
};

/**
 * Spellcasting as a creature entry
 */
export type SpellcastingEntry = BaseEntry & {
	entryType: "spellcasting";
	spellcasting: SpellcastingEntryData;
};
