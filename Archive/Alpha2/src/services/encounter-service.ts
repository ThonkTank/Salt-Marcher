/**
 * Encounter Service
 *
 * Stateful service for managing encounters during travel.
 * Handles party management, encounter checks, and active encounter state.
 * Extends BaseService for subscription pattern.
 *
 * Uses bundled creature presets for encounter generation.
 *
 * @module services/encounter-service
 */

import type {
	Party,
	PartyMember,
	Difficulty,
	ActiveEncounter,
	EncounterCheckResult,
	EncounterServiceState,
} from '../schemas/encounter';
import type { StatblockData, TerrainData, ILibraryStore } from '../schemas';
import { BaseService } from './base-service';
import { generateEncounter, rollEncounterCheck } from '../utils/encounter';
import { getCreaturePresets, presetToStatblock } from '../utils/preset';
import { getTerrainCreatureTypes } from '../constants/terrain-registry';

// Re-export type for backward compatibility
export type { EncounterServiceState } from '../schemas/encounter';

// ============================================================================
// EncounterService
// ============================================================================

/**
 * Stateful service for encounter management during travel.
 * Extends BaseService for consistent subscription pattern.
 */
export class EncounterService extends BaseService<EncounterServiceState> {
	private defaultDifficulty: Difficulty = 'medium';
	private libraryStore: ILibraryStore | null = null;

	constructor(initialParty: Party = []) {
		super();
		this.state = {
			activeEncounter: null,
			party: initialParty,
		};
	}

	/**
	 * Set the library store for dynamic creature lookup.
	 * Must be called before checkForEncounter to enable dynamic loading.
	 */
	setLibraryStore(store: ILibraryStore): void {
		this.libraryStore = store;
	}

	// ========================================================================
	// Party Management
	// ========================================================================

	/** Add a party member */
	addPartyMember(name: string, level: number): void {
		const member: PartyMember = { name, level: Math.min(20, Math.max(1, level)) };
		this.state.party = [...this.state.party, member];
		this.notify();
	}

	/** Remove a party member by index */
	removePartyMember(index: number): void {
		if (index >= 0 && index < this.state.party.length) {
			this.state.party = this.state.party.filter((_, i) => i !== index);
			this.notify();
		}
	}

	/** Update a party member */
	updatePartyMember(index: number, name: string, level: number): void {
		if (index >= 0 && index < this.state.party.length) {
			this.state.party = this.state.party.map((member, i) =>
				i === index
					? { name, level: Math.min(20, Math.max(1, level)) }
					: member
			);
			this.notify();
		}
	}

	/** Clear all party members */
	clearParty(): void {
		this.state.party = [];
		this.notify();
	}

	// ========================================================================
	// Encounter Management
	// ========================================================================

	/**
	 * Check for a random encounter.
	 * If triggered and party exists, generates encounter based on terrain.
	 * Now async to support dynamic creature loading from LibraryStore.
	 */
	async checkForEncounter(terrain: string, hour: number): Promise<EncounterCheckResult> {
		// Skip if party is empty
		if (this.state.party.length === 0) {
			return { triggered: false };
		}

		// Skip if already in encounter
		if (this.state.activeEncounter !== null) {
			return { triggered: false };
		}

		// Roll for encounter
		const rollResult = rollEncounterCheck();
		if (!rollResult) {
			return { triggered: false };
		}

		// Get creatures for terrain (dynamic lookup)
		const creatures = await this.getCreaturesForTerrain(terrain);
		if (!creatures || creatures.length === 0) {
			return { triggered: false };
		}

		// Generate encounter using pure function
		const result = generateEncounter(
			creatures,
			this.state.party,
			{ difficulty: this.defaultDifficulty }
		);

		if (!result.success) {
			return { triggered: false };
		}

		// Set active encounter
		this.state.activeEncounter = {
			encounter: result.encounter,
			terrain,
			hour,
		};
		this.notify();

		return { triggered: true, encounter: result.encounter };
	}

	/**
	 * Get creatures for a terrain type.
	 * Uses bundled presets filtered by creature type.
	 * Falls back to user-defined terrain's nativeCreatures if available.
	 */
	private async getCreaturesForTerrain(terrain: string): Promise<StatblockData[]> {
		// Try user-defined terrain with nativeCreatures first
		if (this.libraryStore) {
			const terrainData = await this.libraryStore.load<TerrainData>('terrain', terrain);
			if (terrainData && terrainData.data.nativeCreatures.length > 0) {
				const userCreatures = await this.loadCreaturesByIds(terrainData.data.nativeCreatures);
				if (userCreatures.length > 0) {
					return userCreatures;
				}
			}
		}

		// Use bundled presets filtered by creature type
		const creatureTypes = getTerrainCreatureTypes(terrain.toLowerCase());

		const matchingPresets = getCreaturePresets().filter((p) =>
			creatureTypes.includes(p.type.toLowerCase())
		);

		if (matchingPresets.length > 0) {
			return matchingPresets.map(presetToStatblock);
		}

		// Last resort: try 'grassland' as fallback terrain
		if (terrain !== 'grassland' && terrain !== 'plains') {
			return this.getCreaturesForTerrain('grassland');
		}

		return [];
	}

	/**
	 * Load full creature data by IDs from user store.
	 */
	private async loadCreaturesByIds(ids: string[]): Promise<StatblockData[]> {
		if (!this.libraryStore) return [];

		const creatures: StatblockData[] = [];

		for (const id of ids) {
			const loaded = await this.libraryStore.load<StatblockData>('creature', id);
			if (loaded) {
				creatures.push(loaded.data);
			}
		}

		return creatures;
	}

	/** Dismiss the current encounter */
	dismissEncounter(): void {
		if (this.state.activeEncounter !== null) {
			this.state.activeEncounter = null;
			this.notify();
		}
	}

	/** Check if there's an active encounter */
	hasActiveEncounter(): boolean {
		return this.state.activeEncounter !== null;
	}

	/** Set the default difficulty for generated encounters */
	setDefaultDifficulty(difficulty: Difficulty): void {
		this.defaultDifficulty = difficulty;
	}
}
