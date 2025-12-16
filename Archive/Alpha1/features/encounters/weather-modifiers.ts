/**
 * Weather-Based Encounter Modifiers
 *
 * Modifies encounter probabilities and behavior based on weather conditions and time of day.
 * Affects visibility, creature activity, and encounter difficulty.
 */

import type { SessionContext } from "../audio/auto-selection-types";

/**
 * Weather modifier result
 */
export interface WeatherModifier {
	/** Encounter chance multiplier (0.0 = no encounters, 2.0 = double encounters) */
	encounterChance: number;

	/** Visibility penalty (0 = normal, 1 = heavily obscured) */
	visibilityPenalty: number;

	/** Surprise chance modifier (-0.5 to +0.5) */
	surpriseModifier: number;

	/** Difficulty modifier (-1 = easier, 0 = normal, +1 = harder) */
	difficultyModifier: number;

	/** Active conditions affecting the encounter */
	conditions: string[];

	/** Description of weather effects */
	description: string;
}

/**
 * Calculate weather-based encounter modifiers
 *
 * @param context Session context with weather and time information
 * @returns Weather modifier affecting encounters
 *
 * @example
 * ```typescript
 * const context: SessionContext = {
 *   weather: "heavy_snow",
 *   timeOfDay: "night"
 * };
 * const modifier = calculateWeatherModifiers(context);
 * // modifier.encounterChance = 0.4 (heavy snow reduces activity)
 * // modifier.visibilityPenalty = 0.8 (heavy obscurement)
 * // modifier.surpriseModifier = 0.3 (harder to spot enemies)
 * ```
 */
export function calculateWeatherModifiers(context: SessionContext): WeatherModifier {
	let encounterChance = 1.0;
	let visibilityPenalty = 0.0;
	let surpriseModifier = 0.0;
	let difficultyModifier = 0;
	const conditions: string[] = [];
	const descriptions: string[] = [];

	// Weather effects
	const weather = context.weather?.toLowerCase() || "clear";

	// Heavy precipitation reduces activity but increases surprise
	if (weather.includes("heavy_rain") || weather.includes("downpour")) {
		encounterChance *= 0.6; // Heavy rain reduces creature activity
		visibilityPenalty = 0.5; // Lightly obscured
		surpriseModifier += 0.2; // Harder to hear enemies
		conditions.push("heavily_raining");
		descriptions.push("Heavy rain reduces visibility and muffles sounds");
	} else if (weather.includes("rain") || weather.includes("drizzle")) {
		encounterChance *= 0.8;
		visibilityPenalty = 0.2;
		surpriseModifier += 0.1;
		conditions.push("raining");
		descriptions.push("Rain reduces visibility slightly");
	}

	// Snow effects
	if (weather.includes("heavy_snow") || weather.includes("blizzard")) {
		encounterChance *= 0.4; // Blizzard drastically reduces activity
		visibilityPenalty = 0.8; // Heavily obscured
		surpriseModifier += 0.3;
		difficultyModifier += 1; // Movement difficult, combat harder
		conditions.push("blizzard", "difficult_terrain");
		descriptions.push("Blizzard creates heavy obscurement and difficult terrain");
	} else if (weather.includes("snow")) {
		encounterChance *= 0.7;
		visibilityPenalty = 0.3;
		surpriseModifier += 0.1;
		conditions.push("snowing");
		descriptions.push("Snowfall reduces visibility");
	}

	// Fog effects
	if (weather.includes("heavy_fog") || weather.includes("thick_fog")) {
		encounterChance *= 1.2; // Fog doesn't reduce activity, may increase ambush predators
		visibilityPenalty = 0.9; // Heavily obscured
		surpriseModifier += 0.4; // Very hard to spot enemies
		conditions.push("heavy_fog");
		descriptions.push("Heavy fog creates near-zero visibility");
	} else if (weather.includes("fog") || weather.includes("mist")) {
		encounterChance *= 1.1;
		visibilityPenalty = 0.4;
		surpriseModifier += 0.2;
		conditions.push("fog");
		descriptions.push("Fog reduces visibility significantly");
	}

	// Storm effects
	if (weather.includes("thunderstorm") || weather.includes("storm")) {
		encounterChance *= 0.5; // Storms reduce activity dramatically
		visibilityPenalty = 0.6;
		surpriseModifier += 0.2;
		difficultyModifier += 1;
		conditions.push("storm", "lightning");
		descriptions.push("Storm creates dangerous conditions with lightning strikes");
	}

	// Clear weather slightly increases encounters (animals more active)
	if (weather === "clear" || weather === "sunny") {
		encounterChance *= 1.1;
		descriptions.push("Clear weather allows normal visibility");
	}

	// Time of day effects
	const time = context.timeOfDay?.toLowerCase() || "day";

	if (time === "night") {
		encounterChance *= 1.3; // Nocturnal predators more active
		visibilityPenalty = Math.max(visibilityPenalty, 0.6); // Darkness is lightly obscured (without darkvision)
		surpriseModifier += 0.3; // Much harder to spot threats in darkness
		difficultyModifier += 0; // No inherent difficulty, but visibility matters
		conditions.push("darkness");
		descriptions.push("Darkness limits vision and favors nocturnal predators");
	} else if (time === "dawn" || time === "dusk" || time === "evening") {
		encounterChance *= 1.2; // Crepuscular animals active at twilight
		visibilityPenalty = Math.max(visibilityPenalty, 0.3); // Dim light
		surpriseModifier += 0.1;
		conditions.push("dim_light");
		descriptions.push("Twilight reduces visibility and increases predator activity");
	} else if (time === "morning" || time === "afternoon") {
		encounterChance *= 1.0; // Normal activity during day
		descriptions.push("Daylight allows full visibility");
	}

	// Situation modifiers (from climate tags in context)
	const situation = context.situation?.toLowerCase() || "";

	// Aquatic environments
	if (situation.includes("aquatic")) {
		encounterChance *= 1.4; // Water environments often have dense populations
		descriptions.push("Aquatic environment increases encounter density");
	}

	// Extreme cold
	if (situation.includes("arctic") || situation.includes("cold")) {
		encounterChance *= 0.7; // Cold-blooded creatures inactive, fewer overall
		descriptions.push("Cold climate reduces overall creature activity");
	}

	// Extreme heat
	if (situation.includes("hot") || situation.includes("desert")) {
		// Night encounters in desert (animals avoid daytime heat)
		if (time === "night") {
			encounterChance *= 1.5; // Desert creatures very active at night
			descriptions.push("Desert creatures emerge at night to avoid heat");
		} else {
			encounterChance *= 0.6; // Day encounters reduced
			descriptions.push("Heat forces creatures to seek shelter during day");
		}
	}

	// Arid/dry conditions
	if (situation.includes("arid") || situation.includes("dry")) {
		encounterChance *= 0.8; // Fewer creatures in dry environments
		descriptions.push("Arid conditions reduce creature density");
	}

	// Wet/tropical conditions
	if (situation.includes("wet") || situation.includes("tropical")) {
		encounterChance *= 1.3; // Dense biodiversity
		descriptions.push("Tropical environment increases creature diversity and density");
	}

	return {
		encounterChance: Math.max(0.1, Math.min(3.0, encounterChance)), // Clamp to 0.1-3.0x
		visibilityPenalty: Math.max(0.0, Math.min(1.0, visibilityPenalty)), // Clamp to 0.0-1.0
		surpriseModifier: Math.max(-0.5, Math.min(0.5, surpriseModifier)), // Clamp to -0.5 to +0.5
		difficultyModifier,
		conditions: Array.from(new Set(conditions)), // Remove duplicates
		description: descriptions.join(". ") + ".",
	};
}

/**
 * Apply weather modifiers to encounter chance roll
 *
 * @param baseChance Base encounter chance (0.0-1.0, typically 0.1-0.3)
 * @param context Session context
 * @returns Modified encounter chance (0.0-1.0)
 *
 * @example
 * ```typescript
 * const baseChance = 0.15; // 15% base encounter chance per hour
 * const context: SessionContext = { weather: "blizzard", timeOfDay: "night" };
 * const modifiedChance = applyWeatherToEncounterChance(baseChance, context);
 * // modifiedChance ≈ 0.078 (blizzard 0.4x + night 1.3x = 0.52x total)
 * ```
 */
export function applyWeatherToEncounterChance(
	baseChance: number,
	context: SessionContext,
): number {
	const modifier = calculateWeatherModifiers(context);
	const modifiedChance = baseChance * modifier.encounterChance;
	return Math.max(0.0, Math.min(1.0, modifiedChance)); // Clamp to valid probability
}

/**
 * Get visibility range in feet based on weather conditions
 *
 * @param context Session context
 * @returns Visibility range in feet
 *
 * @example
 * ```typescript
 * const context: SessionContext = { weather: "heavy_fog" };
 * const range = getVisibilityRange(context);
 * // range = 30 (heavily obscured beyond 30 feet)
 * ```
 */
export function getVisibilityRange(context: SessionContext): number {
	const modifier = calculateWeatherModifiers(context);

	// Base visibility ranges (in feet)
	const NORMAL_VISIBILITY = 300; // Normal vision range
	const DIM_LIGHT_VISIBILITY = 120; // Dim light reduces range
	const DARKNESS_VISIBILITY = 60; // Darkness (without darkvision)

	// Start with time-based range
	const time = context.timeOfDay?.toLowerCase() || "day";
	let range = NORMAL_VISIBILITY;

	if (time === "night") {
		range = DARKNESS_VISIBILITY;
	} else if (time === "dawn" || time === "dusk" || time === "evening") {
		range = DIM_LIGHT_VISIBILITY;
	}

	// Apply weather penalty
	if (modifier.visibilityPenalty >= 0.8) {
		// Heavily obscured (blizzard, heavy fog)
		range = Math.min(range, 30); // D&D 5e heavily obscured range
	} else if (modifier.visibilityPenalty >= 0.4) {
		// Lightly obscured (fog, rain)
		range = Math.min(range, 120);
	} else if (modifier.visibilityPenalty > 0) {
		// Slightly reduced
		range = Math.floor(range * (1.0 - modifier.visibilityPenalty * 0.5));
	}

	return Math.max(10, range); // Minimum 10 feet visibility
}

/**
 * Get recommended CR adjustment based on weather difficulty
 *
 * @param context Session context
 * @returns CR adjustment (+1 = harder, -1 = easier, 0 = normal)
 *
 * @example
 * ```typescript
 * const context: SessionContext = { weather: "blizzard", timeOfDay: "night" };
 * const adjustment = getWeatherCRModifier(context);
 * // adjustment = 1 (blizzard adds difficulty)
 * ```
 */
export function getWeatherCRModifier(context: SessionContext): number {
	const modifier = calculateWeatherModifiers(context);
	return modifier.difficultyModifier;
}
