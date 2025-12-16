// src/features/encounters/data/party-repository.ts
// Repository pattern for party and character data access

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("encounter-party-repository");
import { getPartyState } from "@services/state/party-store";
import { getCharacterById as getCharacterByIdFromStore } from "@services/state/character-store";
import type { PartyMember } from "@services/state/party-store";
import type { Character } from "@services/domain";

/**
 * Repository interface for party and character data access.
 * Abstracts store access for testing and dependency injection.
 */
export interface PartyRepository {
	/**
	 * Get all party members from the shared party store.
	 * @returns Array of party members
	 */
	getPartyMembers(): readonly PartyMember[];

	/**
	 * Get character details by ID from the shared character store.
	 * @param id - Character ID
	 * @returns Character if found, null otherwise
	 */
	getCharacterById(id: string): Character | null;
}

/**
 * Default implementation of PartyRepository using shared stores.
 */
export class StorePartyRepository implements PartyRepository {
	getPartyMembers(): readonly PartyMember[] {
		try {
			const state = getPartyState();
			return state.members;
		} catch (err) {
			logger.error("Failed to get party members", err);
			return [];
		}
	}

	getCharacterById(id: string): Character | null {
		try {
			return getCharacterByIdFromStore(id);
		} catch (err) {
			logger.error("Failed to get character by ID", { id, err });
			return null;
		}
	}
}

/**
 * Factory function to create the default repository instance.
 * Allows for easy dependency injection in tests.
 */
export function createPartyRepository(): PartyRepository {
	return new StorePartyRepository();
}
