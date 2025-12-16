// src/workmodes/library/core/virtual-file-hooks.ts
// Save hooks for updating virtual file cache when SQLite entities are saved

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-virtual-files');
import { VirtualNoteCache } from "@services/virtual/virtual-note-cache";

/**
 * Create a postSave hook that updates virtual file cache
 * Called after SQLite entities are saved
 *
 * @param entityType - Type of entity being saved (creatures, spells, etc)
 * @returns postSave hook function
 */
export function createVirtualFilePostSaveHook(entityType: string) {
  return async (filePath: string, values: any): Promise<void> => {
    try {
      // Check if this is a virtual file path (from SQLite)
      if (!filePath.includes("/")) {
        logger.debug(`Skipping non-virtual path: ${filePath}`);
        return;
      }

      // Extract entity name from path (e.g., "creatures/Dragon" -> "Dragon")
      const parts = filePath.split("/");
      if (parts.length !== 2) {
        logger.debug(`Unexpected path format: ${filePath}`);
        return;
      }

      const [type, name] = parts;

      // Verify entity type matches
      if (type !== entityType) {
        logger.warn(`Type mismatch: expected ${entityType}, got ${type}`);
        return;
      }

      // Update cache
      const cache = VirtualNoteCache.getInstance();
      const cacheKey = `${type}:${name}`;

      // Invalidate cache entry so next access will reload from SQLite
      cache.delete(cacheKey);

      // Also invalidate any list caches that might include this entity
      cache.delete(`list:${type}`);
      cache.delete(`list:all`);

      logger.debug(`Cache invalidated for ${cacheKey}`);

      // Trigger any Obsidian file events if needed
      // This helps update the UI if the entity is currently open
      const app = (globalThis as any).app;
      if (app?.metadataCache) {
        // Trigger metadata cache update
        const virtualPath = `SaltMarcher/${getEntityFolder(type)}/${name}.md`;
        app.metadataCache.trigger("changed", { path: virtualPath });
      }
    } catch (err) {
      // Don't throw - we don't want to break the save operation
      logger.error("Failed to update cache", err);
    }
  };
}

/**
 * Get display folder name for entity type
 */
function getEntityFolder(entityType: string): string {
  const folderMap: Record<string, string> = {
    creatures: "Creatures",
    spells: "Spells",
    items: "Items",
    equipment: "Equipment",
    terrains: "Terrains",
    regions: "Regions",
    factions: "Factions",
    calendars: "Calendars",
    locations: "Locations",
    playlists: "Playlists",
    "encounter-tables": "EncounterTables",
    characters: "Characters"
  };

  return folderMap[entityType] || entityType;
}

/**
 * Create a preSave hook that prepares virtual file metadata
 * Called before SQLite entities are saved
 *
 * @param entityType - Type of entity being saved
 * @returns preSave hook function
 */
export function createVirtualFilePreSaveHook(entityType: string) {
  return (values: any): any => {
    // Add metadata that helps with virtual file generation
    const enhanced = {
      ...values,
      __virtualMeta: {
        entityType,
        savedAt: Date.now(),
        version: 1
      }
    };

    return enhanced;
  };
}

/**
 * Register virtual file hooks for all entity types
 * Call this during plugin initialization
 */
export function registerAllVirtualFileHooks(): void {
  const entityTypes = [
    "creatures",
    "spells",
    "items",
    "equipment",
    "terrains",
    "regions",
    "factions",
    "calendars",
    "locations",
    "playlists",
    "encounter-tables",
    "characters"
  ];

  for (const entityType of entityTypes) {
    // This would need to be integrated into each CreateSpec
    // For now, we export the functions that can be used individually
    logger.debug(`[VirtualFileHooks] Hooks ready for ${entityType}`);
  }
}