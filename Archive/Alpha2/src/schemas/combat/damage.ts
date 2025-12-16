/**
 * Damage Schema
 *
 * Damage instances, targeting, and area of effect types.
 *
 * @module schemas/combat/damage
 */

import { AOE_SHAPES } from '../../constants/rules';

// ============================================================================
// DAMAGE
// ============================================================================

/**
 * A single instance of damage with dice, bonus, and type
 */
export type DamageInstance = {
	dice?: string; // e.g. "2d8"
	bonus?: number; // Flat bonus
	type: string; // "Slashing", "Fire", "Lightning", etc.
	average?: number; // Pre-calculated average (optional)
};

// ============================================================================
// AREA OF EFFECT
// ============================================================================

/**
 * Shape of an area of effect
 */
export type AoeShape = typeof AOE_SHAPES[number];

/**
 * Area-based targeting (cone, line, sphere, etc.)
 */
export type AreaTarget = {
	shape: AoeShape;
	size: string; // "90 ft.", "30 ft.", etc.
	width?: string; // For line: "5 ft."
	origin?: "self" | "point" | "creature";
	description?: string; // Full text for complex cases
};

// ============================================================================
// SINGLE & SPECIAL TARGETING
// ============================================================================

/**
 * Single target with optional restrictions
 */
export type SingleTarget = {
	type: "single";
	count?: number; // Default 1, can be "up to 3", etc.
	range?: string; // "30 ft.", "within 5 feet", etc.
	restrictions?: {
		size?: string[]; // ["Medium", "Small", "smaller"]
		conditions?: string[]; // ["Charmed", "Grappled", "Prone"]
		creatureTypes?: string[]; // ["Humanoid", "Giant"]
		visibility?: boolean; // "can see"
		other?: string[]; // Any other restrictions
	};
};

/**
 * Special targeting with custom description
 */
export type SpecialTarget = {
	type: "special";
	description: string; // "creature in swarm's space", "destination space", etc.
};

/**
 * Union of all targeting types
 */
export type Targeting = AreaTarget | SingleTarget | SpecialTarget;
