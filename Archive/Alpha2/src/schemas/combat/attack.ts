/**
 * Attack Schema
 *
 * Attack data, saving throws, and multiattack templates.
 *
 * @module schemas/combat/attack
 */

import { ATTACK_TYPES } from '../../constants/rules';
import type { AbilityScoreKey } from '../character/core-stats';
import type { BaseEntry } from '../character/ability';
import type { DamageInstance, Targeting } from './damage';
import type { EffectBlock } from './condition';

// ============================================================================
// ATTACK TYPES
// ============================================================================

/**
 * Type of attack (melee or ranged)
 */
export type AttackType = typeof ATTACK_TYPES[number];

// ============================================================================
// ATTACK DATA
// ============================================================================

/**
 * Complete attack data
 */
export type AttackData = {
	type: AttackType;
	bonus: number; // Attack bonus (e.g. +12)
	reach?: string; // "10 ft." for melee
	range?: string; // "120 ft." or "30/120 ft." for ranged
	targeting?: Targeting; // Structured targeting
	target?: string; // Legacy: "one target", "up to three targets", etc.
	damage: DamageInstance[]; // Primary + secondary damage
	onHit?: EffectBlock; // Structured effects
	additionalEffects?: string; // Legacy: Any text-based effects
};

/**
 * Attack as a creature entry
 */
export type AttackEntry = BaseEntry & {
	entryType: "attack";
	attack: AttackData;
};

// ============================================================================
// SAVING THROW DATA
// ============================================================================

/**
 * Saving throw based ability data
 */
export type SavingThrowData = {
	ability: AbilityScoreKey;
	dc: number; // Save DC
	targeting?: Targeting; // Structured targeting
	area?: string; // Legacy: "90-foot-long, 5-foot-wide Line"
	targets?: string; // Legacy: "each creature in area", "one creature", etc.
	onFail?: {
		damage?: DamageInstance[];
		effects?: EffectBlock; // Structured effects
		legacyEffects?: string; // Legacy: "target is grappled", etc.
	};
	onSuccess?:
		| {
				damage?: "half" | "none"; // Structured
				effects?: EffectBlock; // Structured effects
				legacyText?: string; // Legacy: "Half damage", "no effect", etc.
		  }
		| string; // Legacy: string format
};

/**
 * Save-based ability as a creature entry
 */
export type SaveEntry = BaseEntry & {
	entryType: "save";
	save: SavingThrowData;
};

// ============================================================================
// MULTIATTACK
// ============================================================================

/**
 * Multiattack substitution option
 */
export type MultiattackSubstitution = {
	replace: string; // Which attack to replace
	with: {
		type: "attack" | "spellcasting" | "other";
		name?: string; // Attack name
		spell?: string; // Spell name (for spellcasting)
		text?: string; // Full text (legacy/fallback)
	};
	count?: number; // How many can be replaced
};

/**
 * Multiattack data
 */
export type MultiattackData = {
	attacks: Array<{
		name: string; // Reference to another entry
		count: number; // How many times
	}>;
	substitutions?: MultiattackSubstitution[];
};

/**
 * Multiattack as a creature entry
 */
export type MultiattackEntry = BaseEntry & {
	entryType: "multiattack";
	multiattack: MultiattackData;
};
