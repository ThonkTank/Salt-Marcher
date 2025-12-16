/**
 * Creature Importer
 *
 * Simple importer for bundled creature presets.
 * Reads directly from generated JSON - no vault access needed.
 *
 * @module SaltMarcherCore/utils/creature-importer
 */

import type { CreaturePreset, StatblockData } from '../schemas';

// Import generated creatures (bundled at build time)
import creaturesData from '../generated/creatures.json';

// Type assertion for the imported JSON
const creatures = creaturesData as CreaturePreset[];

// ============================================================================
// Getters (direct JSON access)
// ============================================================================

/**
 * Get all creature presets.
 */
export function getCreaturePresets(): CreaturePreset[] {
	return creatures;
}

/**
 * Get a creature preset by ID.
 */
export function getCreatureById(id: string): CreaturePreset | undefined {
	return creatures.find((c) => c.id === id);
}

/**
 * Search creatures by name (case-insensitive).
 */
export function searchCreatures(query: string): CreaturePreset[] {
	const lowerQuery = query.toLowerCase();
	return creatures.filter((c) => c.name.toLowerCase().includes(lowerQuery));
}

/**
 * Get creatures by CR.
 */
export function getCreaturesByCR(cr: string): CreaturePreset[] {
	return creatures.filter((c) => c.cr === cr);
}

/**
 * Get creatures by type.
 */
export function getCreaturesByType(type: string): CreaturePreset[] {
	return creatures.filter((c) => c.type.toLowerCase() === type.toLowerCase());
}

// ============================================================================
// Conversion
// ============================================================================

/**
 * Calculate ability modifier from score.
 */
function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

/**
 * Convert CreaturePreset to StatblockData for vault storage/display.
 */
export function presetToStatblock(preset: CreaturePreset): StatblockData {
	return {
		name: preset.name,
		size: preset.size,
		type: preset.type,
		ac: String(preset.ac),
		hp: String(preset.hp),
		hitDice: preset.hitDice,
		// Convert abilities object to array format
		abilities: [
			{ key: 'str', value: preset.abilities.str, modifier: abilityModifier(preset.abilities.str) },
			{ key: 'dex', value: preset.abilities.dex, modifier: abilityModifier(preset.abilities.dex) },
			{ key: 'con', value: preset.abilities.con, modifier: abilityModifier(preset.abilities.con) },
			{ key: 'int', value: preset.abilities.int, modifier: abilityModifier(preset.abilities.int) },
			{ key: 'wis', value: preset.abilities.wis, modifier: abilityModifier(preset.abilities.wis) },
			{ key: 'cha', value: preset.abilities.cha, modifier: abilityModifier(preset.abilities.cha) },
		],
		cr: preset.cr,
		xp: preset.xp ? String(preset.xp) : undefined,
		pb: preset.pb ? `+${preset.pb}` : undefined,
		// Convert skills object to array format
		skills: preset.skills
			? Object.entries(preset.skills).map(([key, value]) => ({ key, value }))
			: undefined,
		// Senses and languages as token arrays
		sensesList: preset.senses
			? [{ key: 'senses', value: preset.senses }]
			: undefined,
		languagesList: preset.languages
			? preset.languages.split(',').map((l) => ({ key: l.trim() }))
			: undefined,
		passivesList: preset.passivePerception
			? [{ key: 'perception', value: preset.passivePerception }]
			: undefined,
		// Text sections
		traits: preset.traits,
		actions: preset.actions,
		legendary: preset.legendary,
	};
}
