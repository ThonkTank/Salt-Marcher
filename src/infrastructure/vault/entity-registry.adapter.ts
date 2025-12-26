/**
 * VaultEntityRegistryAdapter - EntityRegistry implementation backed by Obsidian Vault.
 *
 * Implements the EntityRegistryPort interface using JSON files stored in the Vault.
 * Uses unbounded in-memory cache with lazy loading per entity type.
 *
 * Storage structure: {basePath}/data/{entityType}/{id}.json
 *
 * @see docs/architecture/EntityRegistry.md
 * @see docs/architecture/Infrastructure.md
 */

import type { Vault } from 'obsidian';
import { z } from 'zod';
import type { Result } from '@core/types/result';
import { ok, err } from '@core/types/result';
import type { EntityType, EntityId } from '@core/types/common';
import type {
  EntityRegistryPort,
  Entity,
  ValidationError,
  NotFoundError,
  IOError,
} from '@core/types/entity-registry.port';
import {
  ValidationError as ValidationErrorClass,
  NotFoundError as NotFoundErrorClass,
  IOError as IOErrorClass,
} from '@core/types/entity-registry.port';
import { createVaultIO, type VaultIO } from './shared';

// Import available schemas
import {
  creatureDefinitionSchema,
  characterSchema,
  npcSchema,
  factionSchema,
  itemSchema,
  overworldMapSchema,
  basePoiSchema,
  terrainDefinitionSchema,
  questDefinitionSchema,
  partySchema,
  calendarDefinitionSchema,
  journalEntrySchema,
} from '@core/schemas';

// ============================================================================
// Schema Mapping
// ============================================================================

/**
 * Maps EntityType to their Zod validation schemas.
 * Some types use a passthrough schema for entities without full schema definitions.
 */
const entitySchemas: Partial<Record<EntityType, z.ZodTypeAny>> = {
  creature: creatureDefinitionSchema,
  character: characterSchema,
  npc: npcSchema,
  faction: factionSchema,
  item: itemSchema,
  map: overworldMapSchema,
  poi: basePoiSchema,
  terrain: terrainDefinitionSchema,
  quest: questDefinitionSchema,
  encounter: z.object({ id: z.string() }).passthrough(), // Schema will be redefined with new specs
  party: partySchema,
  calendar: calendarDefinitionSchema,
  journal: journalEntrySchema,
  // Types without full schemas yet - use passthrough
  maplink: z.object({ id: z.string() }).passthrough(),
  shop: z.object({ id: z.string() }).passthrough(),
  worldevent: z.object({ id: z.string() }).passthrough(),
  track: z.object({ id: z.string() }).passthrough(),
};

/**
 * Get the Zod schema for an entity type.
 * Falls back to a passthrough schema if not defined.
 */
function getSchemaForType(type: EntityType): z.ZodTypeAny {
  return entitySchemas[type] ?? z.object({ id: z.string() }).passthrough();
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create a VaultEntityRegistryAdapter instance.
 *
 * @param vault - Obsidian Vault instance
 * @param basePath - Base path in vault (e.g., "SaltMarcher")
 * @returns EntityRegistryPort implementation
 *
 * @example
 * ```typescript
 * const entityRegistry = createVaultEntityRegistryAdapter(app.vault, 'SaltMarcher');
 * const goblin = entityRegistry.get('creature', 'goblin-warrior');
 * ```
 */
export function createVaultEntityRegistryAdapter(
  vault: Vault,
  basePath: string
): EntityRegistryPort {
  const dataPath = `${basePath}/data`;
  const vaultIO = createVaultIO(vault);

  // Unbounded in-memory cache: Map<EntityType, Map<EntityId, Entity>>
  const cache = new Map<EntityType, Map<string, unknown>>();

  // Track which entity types have been fully loaded
  const loadedTypes = new Set<EntityType>();

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get the file path for an entity.
   */
  function getEntityPath(type: EntityType, id: string): string {
    return `${dataPath}/${type}/${id}.json`;
  }

  /**
   * Get the directory path for an entity type.
   */
  function getTypePath(type: EntityType): string {
    return `${dataPath}/${type}`;
  }

  /**
   * Get or create the cache map for an entity type.
   */
  function getTypeCache(type: EntityType): Map<string, unknown> {
    let typeCache = cache.get(type);
    if (!typeCache) {
      typeCache = new Map();
      cache.set(type, typeCache);
    }
    return typeCache;
  }

  /**
   * Load all entities of a type from vault into cache.
   */
  async function loadAllOfType(type: EntityType): Promise<void> {
    if (loadedTypes.has(type)) {
      return;
    }

    const typePath = getTypePath(type);
    const schema = getSchemaForType(type);
    const typeCache = getTypeCache(type);

    const filesResult = await vaultIO.listJsonFiles(typePath);
    if (!filesResult.ok) {
      // Directory doesn't exist or error - mark as loaded (empty)
      loadedTypes.add(type);
      return;
    }

    for (const id of filesResult.value) {
      const path = getEntityPath(type, id);
      const result = await vaultIO.readJson(path, schema);
      if (result.ok) {
        typeCache.set(id, result.value);
      }
      // Skip entities that fail to parse (logged by vaultIO)
    }

    loadedTypes.add(type);
  }

  /**
   * Load a single entity from vault into cache.
   */
  async function loadSingleEntity<T extends EntityType>(
    type: T,
    id: string
  ): Promise<Entity<T> | null> {
    const typeCache = getTypeCache(type);

    // Check cache first
    if (typeCache.has(id)) {
      return typeCache.get(id) as Entity<T>;
    }

    // If type is fully loaded, entity doesn't exist
    if (loadedTypes.has(type)) {
      return null;
    }

    // Try to load from vault
    const path = getEntityPath(type, id);
    const schema = getSchemaForType(type);
    const result = await vaultIO.readJson(path, schema);

    if (result.ok) {
      typeCache.set(id, result.value);
      return result.value as Entity<T>;
    }

    return null;
  }

  // ============================================================================
  // EntityRegistryPort Implementation
  // ============================================================================

  return {
    async preload(types: EntityType[]): Promise<void> {
      for (const type of types) {
        await loadAllOfType(type);
      }
    },

    get<T extends EntityType>(type: T, id: EntityId<T>): Entity<T> | null {
      const typeCache = getTypeCache(type);

      // Ensure type was preloaded
      if (!loadedTypes.has(type)) {
        throw new Error(
          `EntityRegistry: Type '${type}' not preloaded. ` +
            `Call preload(['${type}']) during initialization.`
        );
      }

      // Return from cache or null if not found
      if (typeCache.has(id)) {
        return typeCache.get(id) as Entity<T>;
      }

      return null;
    },

    getAll<T extends EntityType>(type: T): Entity<T>[] {
      // Ensure type was preloaded
      if (!loadedTypes.has(type)) {
        throw new Error(
          `EntityRegistry: Type '${type}' not preloaded. ` +
            `Call preload(['${type}']) during initialization.`
        );
      }

      const typeCache = getTypeCache(type);
      return Array.from(typeCache.values()) as Entity<T>[];
    },

    query<T extends EntityType>(
      type: T,
      predicate: (entity: Entity<T>) => boolean
    ): Entity<T>[] {
      // getAll() will throw if not preloaded
      return this.getAll(type).filter(predicate);
    },

    save<T extends EntityType>(
      type: T,
      entity: Entity<T>
    ): Result<void, ValidationError | IOError> {
      const schema = getSchemaForType(type);
      const parseResult = schema.safeParse(entity);

      if (!parseResult.success) {
        return err(
          new ValidationErrorClass(
            parseResult.error,
            type,
            (entity as { id?: string }).id
          )
        );
      }

      const id = (entity as { id: string }).id;
      const path = getEntityPath(type, id);

      // Use synchronous approach for MVP - write and update cache
      // Note: vaultIO.writeJson is async, but we need sync interface
      // This is a design limitation that may need addressing
      vaultIO.writeJson(path, entity).then((result) => {
        if (result.ok) {
          const typeCache = getTypeCache(type);
          typeCache.set(id, entity);
        }
      });

      // Optimistically update cache
      const typeCache = getTypeCache(type);
      typeCache.set(id, entity);

      return ok(undefined);
    },

    delete<T extends EntityType>(
      type: T,
      id: EntityId<T>
    ): Result<void, NotFoundError | IOError> {
      const typeCache = getTypeCache(type);

      // Check if entity exists
      if (!typeCache.has(id) && loadedTypes.has(type)) {
        return err(new NotFoundErrorClass(type, id));
      }

      const path = getEntityPath(type, id);

      // Delete from vault (async, but interface is sync)
      vault.adapter.remove(path).catch(() => {
        // Log error but don't fail - cache is already updated
      });

      // Remove from cache
      typeCache.delete(id);

      return ok(undefined);
    },

    exists<T extends EntityType>(type: T, id: EntityId<T>): boolean {
      const typeCache = getTypeCache(type);
      return typeCache.has(id);
    },

    count<T extends EntityType>(type: T): number {
      const typeCache = getTypeCache(type);
      return typeCache.size;
    },
  };
}

// ============================================================================
// Factory Helper
// ============================================================================

/**
 * Create and preload an EntityRegistry in one step.
 * Convenience function for plugin initialization.
 *
 * @param vault - Obsidian Vault instance
 * @param basePath - Base path in vault (e.g., "SaltMarcher")
 * @param types - Entity types to preload
 * @returns Promise resolving to initialized EntityRegistryPort
 *
 * @example
 * ```typescript
 * const entityRegistry = await createAndPreloadEntityRegistry(
 *   app.vault,
 *   'SaltMarcher',
 *   ['creature', 'npc', 'faction', 'quest', 'item']
 * );
 * // Now all sync methods work correctly
 * ```
 */
export async function createAndPreloadEntityRegistry(
  vault: Vault,
  basePath: string,
  types: EntityType[]
): Promise<EntityRegistryPort> {
  const adapter = createVaultEntityRegistryAdapter(vault, basePath);
  await adapter.preload(types);
  return adapter;
}
