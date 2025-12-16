/**
 * Preset Schema Types
 *
 * Minimal types for bundled preset data (creatures, etc.).
 * Optimized for JSON storage and fast loading.
 *
 * @module SaltMarcherCore/schemas/preset
 */

// ============================================================================
// Size Type
// ============================================================================

export type CreatureSize =
	| 'Tiny'
	| 'Small'
	| 'Medium'
	| 'Large'
	| 'Huge'
	| 'Gargantuan';

// ============================================================================
// Ability Scores
// ============================================================================

export type AbilityScores = {
	str: number;
	dex: number;
	con: number;
	int: number;
	wis: number;
	cha: number;
};

// ============================================================================
// Creature Preset
// ============================================================================

/**
 * Minimal creature data for presets.
 * Generated from References/rulebooks markdown files.
 */
export type CreaturePreset = {
	/** Unique identifier (filename without extension) */
	id: string;
	/** Display name */
	name: string;
	/** Creature size */
	size: CreatureSize;
	/** Creature type (Beast, Aberration, Dragon, etc.) */
	type: string;
	/** Type tags (Dinosaur, Chromatic, etc.) */
	typeTags?: string[];
	/** Alignment (Unaligned, Lawful Evil, etc.) */
	alignment?: string;
	/** Armor Class */
	ac: number;
	/** Hit Points */
	hp: number;
	/** Hit Dice expression (e.g., "6d10+18") */
	hitDice?: string;
	/** Speed (e.g., "60 ft." or "40 ft., fly 80 ft.") */
	speed: string;
	/** Ability scores */
	abilities: AbilityScores;
	/** Challenge Rating (e.g., "2", "1/4", "1/2") */
	cr: string;
	/** Experience Points */
	xp?: number;
	/** Proficiency Bonus */
	pb?: number;
	/** Skills (e.g., { "Perception": 5 }) */
	skills?: Record<string, number>;
	/** Saving throw proficiencies (e.g., { "dex": 3, "wis": 6 }) */
	saves?: Record<string, number>;
	/** Senses (e.g., "darkvision 60 ft.") */
	senses?: string;
	/** Passive Perception */
	passivePerception?: number;
	/** Languages */
	languages?: string;
	/** Damage immunities */
	immunities?: string;
	/** Damage resistances */
	resistances?: string;
	/** Damage vulnerabilities */
	vulnerabilities?: string;
	/** Condition immunities */
	conditionImmunities?: string;
	/** Traits section (markdown) */
	traits?: string;
	/** Actions section (markdown) */
	actions?: string;
	/** Bonus Actions section (markdown) */
	bonusActions?: string;
	/** Reactions section (markdown) */
	reactions?: string;
	/** Legendary Actions section (markdown) */
	legendary?: string;
};
