/**
 * Shared Entity Types
 *
 * Character, Creature, and Location type definitions shared across
 * workmodes, features, and services to eliminate layer violations.
 *
 * @module services/domain/entity-types
 */

import type { BuildingProduction } from "@features/locations/building-production";

// ============================================================================
// CHARACTER TYPES
// ============================================================================

/**
 * Character data structure - minimal scope for combat readiness
 *
 * Stored in Presets/Characters/ as markdown files with YAML frontmatter.
 * Referenced by PartyMember via characterId for reusability.
 */
export type Character = {
	/** Unique identifier */
	readonly id: string;

	/** Character name */
	readonly name: string;

	/** Character level (1-20) */
	readonly level: number;

	/** Character class (e.g., Fighter, Wizard, Rogue) */
	readonly characterClass: string;

	/** Maximum hit points */
	readonly maxHp: number;

	/** Armor class */
	readonly ac: number;

	/** Optional notes or description */
	readonly notes?: string;
};

/**
 * Character creation data (without ID - generated on save)
 */
export type CharacterCreateData = Omit<Character, "id">;

/**
 * Partial character data for updates
 */
export type CharacterUpdateData = Partial<CharacterCreateData> & { id: string };

// ============================================================================
// CREATURE TYPES
// ============================================================================

/**
 * Ability score keys used throughout creature stats
 */
export type AbilityScoreKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/**
 * Spellcasting ability
 */
export type SpellcastingAbility = AbilityScoreKey;

// Legacy object-based format (deprecated, will be migrated to array format)
export type CreatureSpeedValue = {
	distance?: string;
	hover?: boolean;
	note?: string;
};

export type CreatureSpeedExtra = CreatureSpeedValue & {
	label: string;
};

export type CreatureSpeeds = {
	walk?: CreatureSpeedValue;
	swim?: CreatureSpeedValue;
	fly?: CreatureSpeedValue;
	burrow?: CreatureSpeedValue;
	climb?: CreatureSpeedValue;
	extras?: CreatureSpeedExtra[];
};

// New array-based format (preferred)
export type SpeedEntry = {
	type: string; // "walk", "fly", "swim", "burrow", "climb", or custom
	value: string; // e.g. "30 ft."
	hover?: boolean; // Only for fly speed
	note?: string; // Additional notes
};

export type SpeedArray = SpeedEntry[];

// Structured token types for creature fields
export type SenseToken = {
	type?: string; // "darkvision", "blindsight", "tremorsense", "truesight"
	range?: string; // e.g. "120"
	value?: string; // Fallback for freeform text
};

export type LanguageToken = {
	value?: string; // e.g. "Common", "Draconic"
	type?: string; // "telepathy"
	range?: string; // e.g. "120" (for telepathy)
};

export type SimpleValueToken = {
	value: string; // Freeform text value
};

export type SpellcastingSpell = {
	name: string;
	notes?: string;
	prepared?: boolean;
};

export type SpellcastingGroupAtWill = {
	type: "at-will";
	title?: string;
	spells: SpellcastingSpell[];
};

export type SpellcastingGroupPerDay = {
	type: "per-day";
	uses: string;
	title?: string;
	note?: string;
	spells: SpellcastingSpell[];
};

export type SpellcastingGroupLevel = {
	type: "level";
	level: number;
	title?: string;
	slots?: number | string;
	note?: string;
	spells: SpellcastingSpell[];
};

export type SpellcastingGroupCustom = {
	type: "custom";
	title: string;
	description?: string;
	spells?: SpellcastingSpell[];
};

export type SpellcastingGroup =
	| SpellcastingGroupAtWill
	| SpellcastingGroupPerDay
	| SpellcastingGroupLevel
	| SpellcastingGroupCustom;

export type SpellcastingComputedValues = {
	abilityMod?: number | null;
	proficiencyBonus?: number | null;
	saveDc?: number | null;
	attackBonus?: number | null;
};

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

// ============================================================================
// CREATURE ENTRY TYPES (Traits, Actions, Legendary Actions, etc.)
// ============================================================================

export type DamageInstance = {
	dice?: string; // e.g. "2d8"
	bonus?: number; // Flat bonus
	type: string; // "Slashing", "Fire", "Lightning", etc.
	average?: number; // Pre-calculated average (optional)
};

// ============================================================================
// TARGETING & AREA OF EFFECT
// ============================================================================

export type AoeShape = "line" | "cone" | "sphere" | "cube" | "cylinder" | "emanation";

export type AreaTarget = {
	shape: AoeShape;
	size: string; // "90 ft.", "30 ft.", etc.
	width?: string; // For line: "5 ft."
	origin?: "self" | "point" | "creature";
	description?: string; // Full text for complex cases
};

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

export type SpecialTarget = {
	type: "special";
	description: string; // "creature in swarm's space", "destination space", etc.
};

export type Targeting = AreaTarget | SingleTarget | SpecialTarget;

// ============================================================================
// DURATION & TIMING
// ============================================================================

export type DurationTiming =
	| { type: "instant" }
	| { type: "rounds"; count: number }
	| { type: "minutes"; count: number }
	| { type: "hours"; count: number }
	| { type: "until"; trigger: string } // "until target takes damage", "until caster dies"
	| { type: "start-of-turn"; whose: "target" | "source" }
	| { type: "end-of-turn"; whose: "target" | "source" };

export type SaveToEnd = {
	timing: "start-of-turn" | "end-of-turn" | "when-damage" | "custom";
	dc?: number; // If different from initial DC
	description?: string; // Additional context
};

// ============================================================================
// CONDITIONS & EFFECTS
// ============================================================================

export type ConditionEffect = {
	condition: string; // "Grappled", "Prone", "Charmed", "Frightened", etc.
	duration?: DurationTiming;
	escape?: {
		type: "dc" | "contest";
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

export type MovementEffect = {
	type: "push" | "pull" | "teleport" | "compelled";
	distance?: string; // "60 feet", "half speed"
	direction?: string; // "straight away", "toward caster"
	description?: string; // For complex movement
};

export type DamageOverTime = {
	damage: DamageInstance[];
	timing: DurationTiming;
	saveToEnd?: SaveToEnd;
};

export type MechanicalEffect = {
	type: "damage-modifier" | "penalty" | "advantage" | "disadvantage" | "other";
	target: string; // What it affects: "AC", "attack rolls", "damage rolls", "Strength checks"
	modifier?: number | string; // -1, -5, "half", etc.
	duration?: DurationTiming;
	description: string;
};

export type EffectBlock = {
	conditions?: ConditionEffect[];
	movement?: MovementEffect;
	damageOverTime?: DamageOverTime;
	mechanical?: MechanicalEffect[];
	knowledge?: string; // Sprite's "knows emotions and alignment"
	other?: string; // Fallback for complex effects
};

export type AttackData = {
	type: "melee" | "ranged";
	bonus: number; // Attack bonus (e.g. +12)
	reach?: string; // "10 ft." for melee
	range?: string; // "120 ft." or "30/120 ft." for ranged
	targeting?: Targeting; // Structured targeting (NEW)
	target?: string; // Legacy: "one target", "up to three targets", etc.
	damage: DamageInstance[]; // Primary + secondary damage
	onHit?: EffectBlock; // Structured effects (NEW)
	additionalEffects?: string; // Legacy: Any text-based effects
};

export type SavingThrowData = {
	ability: AbilityScoreKey; // "str", "dex", "con", etc.
	dc: number; // Save DC
	targeting?: Targeting; // Structured targeting (NEW)
	area?: string; // Legacy: "90-foot-long, 5-foot-wide Line"
	targets?: string; // Legacy: "each creature in area", "one creature", etc.
	onFail?: {
		damage?: DamageInstance[];
		effects?: EffectBlock; // Structured effects (NEW)
		legacyEffects?: string; // Legacy: "target is grappled", etc.
	};
	onSuccess?:
		| {
				damage?: "half" | "none"; // Structured (NEW)
				effects?: EffectBlock; // Structured effects (NEW)
				legacyText?: string; // Legacy: "Half damage", "no effect", etc.
		  }
		| string; // Legacy: string format
};

export type LimitedUse = {
	count: number; // Number of uses
	reset: "short-rest" | "long-rest" | "day" | "dawn" | "dusk";
	conditional?: {
		// e.g. "4/Day in Lair"
		count: number;
		condition: string;
	};
};

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

export type MultiattackData = {
	attacks: Array<{
		name: string; // Reference to another entry
		count: number; // How many times
	}>;
	substitutions?: MultiattackSubstitution[];
};

export type SpellcastingEntryData = {
	ability: AbilityScoreKey;
	saveDC?: number;
	attackBonus?: number;
	excludeComponents?: Array<"V" | "S" | "M">;
	spellLists: Array<{
		frequency: "at-will" | "1/day" | "2/day" | "3/day" | string;
		spells: string[]; // Spell names
	}>;
};

// Base entry type with common fields
export type BaseEntry = {
	category: "trait" | "action" | "bonus" | "reaction" | "legendary";
	name: string;
	text?: string; // Always keep text for rendering/fallback
	recharge?: string; // "5-6", "4-6", "6"
	limitedUse?: LimitedUse;
};

// Specific entry types
export type AttackEntry = BaseEntry & {
	entryType: "attack";
	attack: AttackData;
};

export type SaveEntry = BaseEntry & {
	entryType: "save";
	save: SavingThrowData;
};

export type MultiattackEntry = BaseEntry & {
	entryType: "multiattack";
	multiattack: MultiattackData;
};

export type SpellcastingEntry = BaseEntry & {
	entryType: "spellcasting";
	spellcasting: SpellcastingEntryData;
};

export type SpecialEntry = BaseEntry & {
	entryType: "special";
	// Just uses text field
};

// Legacy entry format (for backwards compatibility during migration)
export type LegacyEntry = BaseEntry & {
	entryType?: undefined;
	kind?: string;
	to_hit?: string;
	to_hit_from?: {
		ability: "str" | "dex" | "con" | "int" | "wis" | "cha" | "best_of_str_dex";
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
		ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | "best_of_str_dex";
		bonus?: string;
	};
};

// Union type for all entry types
export type CreatureEntry =
	| AttackEntry
	| SaveEntry
	| MultiattackEntry
	| SpellcastingEntry
	| SpecialEntry
	| LegacyEntry;

/**
 * Ability score with value
 */
export type AbilityScore = {
	ability: AbilityScoreKey;
	score: number;
};

/**
 * New format for saving throws with explicit bonuses
 * Replaces boolean-only saveProf to support custom modifiers
 */
export type SaveBonus = {
	ability: AbilityScoreKey;
	bonus: number;
};

/**
 * New format for skills with explicit bonuses
 * Replaces skillsProf/skillsExpertise to support custom modifiers
 */
export type SkillBonus = {
	name: string;
	bonus: number;
};

/**
 * Normalised creature data used for persistence and Markdown export.
 * The structure intentionally mirrors the reference stat blocks.
 */
export type StatblockData = {
	name: string;
	size?: string;
	type?: string;
	typeTags?: string[];
	alignmentLawChaos?: string;
	alignmentGoodEvil?: string;
	alignmentOverride?: string;
	ac?: string;
	initiative?: string;
	hp?: string;
	hitDice?: string;
	speeds?: CreatureSpeeds | SpeedArray; // Accept both old and new formats
	abilities?: AbilityScore[];
	pb?: string;
	saves?: SaveBonus[];
	skills?: SkillBonus[];

	sensesList?: SenseToken[];
	languagesList?: LanguageToken[];
	passivesList?: SimpleValueToken[];

	// Habitat & Environment preferences
	temperatureRange?: { min?: number; max?: number };
	moisturePreference?: (
		| "desert"
		| "dry"
		| "lush"
		| "marshy"
		| "swampy"
		| "ponds"
		| "lakes"
		| "large_lake"
		| "sea"
		| "flood_plains"
	)[]; // Categorical moisture levels
	elevationRange?: { min?: number; max?: number };
	climatePreference?: SimpleValueToken[];
	terrainPreference?: ("plains" | "hills" | "mountains" | "any")[];
	floraPreference?: ("dense" | "medium" | "field" | "barren" | "any")[];
	weatherPreference?: SimpleValueToken[];
	activityPeriod?: SimpleValueToken[];

	damageVulnerabilitiesList?: SimpleValueToken[];
	damageResistancesList?: SimpleValueToken[];
	damageImmunitiesList?: SimpleValueToken[];
	conditionImmunitiesList?: SimpleValueToken[];
	gearList?: SimpleValueToken[];
	cr?: string;
	xp?: string;
	traits?: string;
	actions?: string;
	legendary?: string;
	entries?: CreatureEntry[];
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
	spellcasting?: SpellcastingData;
};

/**
 * Type alias for backward compatibility
 */
export type CreatureData = StatblockData;

// ============================================================================
// LOCATION TYPES
// ============================================================================

export type LocationType =
	| "Stadt"
	| "Dorf"
	| "Weiler"
	| "Gebäude"
	| "Dungeon"
	| "Camp"
	| "Landmark"
	| "Ruine"
	| "Festung";

export type OwnerType = "faction" | "npc" | "none";

export interface LocationData {
	name: string;
	type: LocationType;
	description?: string;
	parent?: string; // Parent location name (for hierarchy)
	owner_type?: OwnerType;
	owner_name?: string; // Faction or NPC name
	region?: string; // Optional region association
	coordinates?: string; // Optional hex coordinates (e.g., "12,34")
	notes?: string;
	// Dungeon-specific fields (only used when type === "Dungeon")
	grid_width?: number;
	grid_height?: number;
	cell_size?: number; // Grid cell size in pixels (default: 40)
	rooms?: DungeonRoom[];
	tokens?: DungeonToken[]; // Tokens placed on the grid
	// Building-specific fields (only used when type === "Gebäude")
	building_production?: BuildingProduction;
}

// Dungeon-specific types
export interface DungeonRoom {
	id: string; // R1, R2, R3, ...
	name: string; // Room name (e.g., "Entrance Hall")
	description?: string; // Markdown description with sensory details
	grid_bounds: GridBounds; // Room area on grid
	doors: DungeonDoor[];
	features: DungeonFeature[];
}

export interface GridBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DungeonDoor {
	id: string; // T1, T2, T3, ...
	position: GridPosition;
	leads_to?: string; // Target room ID or "outside"
	locked: boolean;
	description?: string;
}

export interface DungeonFeature {
	id: string; // F1, F2, F3, ...
	type: DungeonFeatureType;
	position: GridPosition;
	description: string;
}

export type DungeonFeatureType =
	| "secret" // G (Geheimnisse)
	| "trap" // H (Hindernisse/Hazards)
	| "treasure" // S (Schätze)
	| "hazard" // H (andere Gefahren)
	| "furniture" // (Möbel, Dekoration)
	| "other"; // (Sonstiges)

export interface GridPosition {
	x: number;
	y: number;
}

// Token types
export type TokenType = "player" | "npc" | "monster" | "object";

export interface DungeonToken {
	id: string; // Unique token ID (e.g., "token-1", "token-2")
	type: TokenType;
	position: GridPosition;
	label: string; // Display name (e.g., "Gandalf", "Goblin 1", "Chest")
	color?: string; // Hex color for token (default: type-based)
	size?: number; // Token size multiplier (default: 1.0)
}

// Helper functions
export function getFeatureTypePrefix(type: DungeonFeatureType): string {
	switch (type) {
		case "secret":
			return "G"; // Geheimnisse
		case "trap":
		case "hazard":
			return "H"; // Hindernisse/Hazards
		case "treasure":
			return "S"; // Schätze
		case "furniture":
		case "other":
			return "F"; // Features (generic)
	}
}

export function getFeatureTypeLabel(type: DungeonFeatureType): string {
	switch (type) {
		case "secret":
			return "Secret";
		case "trap":
			return "Trap";
		case "treasure":
			return "Treasure";
		case "hazard":
			return "Hazard";
		case "furniture":
			return "Furniture";
		case "other":
			return "Other";
	}
}

// Token helpers
export function getDefaultTokenColor(type: TokenType): string {
	switch (type) {
		case "player":
			return "#4a90e2"; // Blue
		case "npc":
			return "#50c878"; // Green
		case "monster":
			return "#e74c3c"; // Red
		case "object":
			return "#f39c12"; // Orange
	}
}

// Type guards
export function isDungeonLocation(
	data: LocationData,
): data is LocationData & Required<Pick<LocationData, "grid_width" | "grid_height">> {
	return (
		data.type === "Dungeon" &&
		typeof data.grid_width === "number" &&
		typeof data.grid_height === "number"
	);
}

export function isBuildingLocation(
	data: LocationData,
): data is LocationData & Required<Pick<LocationData, "building_production">> {
	return (
		data.type === "Gebäude" &&
		typeof data.building_production === "object" &&
		data.building_production !== null
	);
}
