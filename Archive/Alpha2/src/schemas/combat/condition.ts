/**
 * Condition Schema
 *
 * Conditions, effects, duration, and escape mechanics.
 *
 * @module schemas/combat/condition
 */

import {
	ESCAPE_TYPES,
	MOVEMENT_EFFECT_TYPES,
	MECHANICAL_EFFECT_TYPES,
	SAVE_TO_END_TIMINGS
} from '../../constants/rules';
import type { AbilityScoreKey } from '../character/core-stats';
import type { DamageInstance } from './damage';

// ============================================================================
// DURATION & TIMING
// ============================================================================

/**
 * Duration timing for effects
 */
export type DurationTiming =
	| { type: "instant" }
	| { type: "rounds"; count: number }
	| { type: "minutes"; count: number }
	| { type: "hours"; count: number }
	| { type: "until"; trigger: string }
	| { type: "start-of-turn"; whose: "target" | "source" }
	| { type: "end-of-turn"; whose: "target" | "source" };

/**
 * When a save can be made to end an effect
 */
export type SaveToEndTiming = typeof SAVE_TO_END_TIMINGS[number];

/**
 * Save to end an ongoing effect
 */
export type SaveToEnd = {
	timing: SaveToEndTiming;
	dc?: number; // If different from initial DC
	description?: string; // Additional context
};

// ============================================================================
// ESCAPE MECHANICS
// ============================================================================

/**
 * Type of escape from a condition (DC check or contest)
 */
export type EscapeType = typeof ESCAPE_TYPES[number];

// ============================================================================
// CONDITIONS
// ============================================================================

/**
 * A condition effect applied to a target
 */
export type ConditionEffect = {
	condition: string; // "Grappled", "Prone", "Charmed", "Frightened", etc.
	duration?: DurationTiming;
	escape?: {
		type: EscapeType;
		dc?: number; // Escape DC
		ability?: AbilityScoreKey;
	};
	restrictions?: {
		size?: string; // "Large or smaller"
		while?: string; // "While Grappled, also Restrained"
	};
	saveToEnd?: SaveToEnd;
	additionalText?: string; // Complex behavior that can't be structured
};

// ============================================================================
// MOVEMENT EFFECTS
// ============================================================================

/**
 * Type of forced movement
 */
export type MovementEffectType = typeof MOVEMENT_EFFECT_TYPES[number];

/**
 * Forced movement effect
 */
export type MovementEffect = {
	type: MovementEffectType;
	distance?: string; // "60 feet", "half speed"
	direction?: string; // "straight away", "toward caster"
	description?: string; // For complex movement
};

// ============================================================================
// MECHANICAL EFFECTS
// ============================================================================

/**
 * Type of mechanical effect
 */
export type MechanicalEffectType = typeof MECHANICAL_EFFECT_TYPES[number];

/**
 * A mechanical effect (penalty, advantage, etc.)
 */
export type MechanicalEffect = {
	type: MechanicalEffectType;
	target: string; // What it affects: "AC", "attack rolls", "damage rolls", "Strength checks"
	modifier?: number | string; // -1, -5, "half", etc.
	duration?: DurationTiming;
	description: string;
};

// ============================================================================
// DAMAGE OVER TIME
// ============================================================================

/**
 * Ongoing damage effect
 */
export type DamageOverTime = {
	damage: DamageInstance[];
	timing: DurationTiming;
	saveToEnd?: SaveToEnd;
};

// ============================================================================
// EFFECT BLOCK
// ============================================================================

/**
 * Collection of effects that can be applied
 */
export type EffectBlock = {
	conditions?: ConditionEffect[];
	movement?: MovementEffect;
	damageOverTime?: DamageOverTime;
	mechanical?: MechanicalEffect[];
	knowledge?: string; // Sprite's "knows emotions and alignment"
	other?: string; // Fallback for complex effects
};
