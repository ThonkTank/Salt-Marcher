/**
 * CharacterStorageAdapter - Adapts EntityRegistry to CharacterStoragePort.
 *
 * Allows the Party feature to use the EntityRegistry for character persistence.
 *
 * @see src/features/party/types.ts - CharacterStoragePort interface
 * @see docs/architecture/Infrastructure.md
 */

import type { CharacterStoragePort } from '@/features/party/types';
import type { EntityRegistryPort } from '@core/types/entity-registry.port';
import type { CharacterId } from '@core/index';
import type { Character } from '@core/schemas';
import { ok, err, createError } from '@core/index';

/**
 * Create a CharacterStoragePort backed by the EntityRegistry.
 *
 * @param registry - The EntityRegistry instance (must have 'character' type preloaded)
 * @returns CharacterStoragePort implementation
 */
export function createCharacterStorageAdapter(
  registry: EntityRegistryPort
): CharacterStoragePort {
  return {
    async load(id: CharacterId) {
      const result = registry.get('character', id);
      if (!result) {
        return err(createError('CHARACTER_NOT_FOUND', `Character ${id} not found`));
      }
      return ok(result as Character);
    },

    async save(character: Character) {
      const result = registry.save('character', character);
      if (!result.ok) {
        return err(createError('SAVE_FAILED', `Failed to save character ${character.id}`));
      }
      return ok(undefined);
    },

    async loadMany(ids: readonly CharacterId[]) {
      const characters: Character[] = [];
      for (const id of ids) {
        const result = registry.get('character', id);
        if (result) {
          characters.push(result as Character);
        }
      }
      return ok(characters);
    },

    async listIds() {
      const all = registry.getAll('character') as Character[];
      return ok(all.map((c) => c.id as CharacterId));
    },

    async exists(id: CharacterId) {
      return registry.exists('character', id);
    },
  };
}
