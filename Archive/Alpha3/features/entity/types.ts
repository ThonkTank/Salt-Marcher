/**
 * Entity Feature - Types
 * Inbound Port (EntityFeaturePort) und Outbound Port (EntityStoragePort)
 */

import type { EntityId } from '@core/types/common';
import type { CreatureData } from '@core/schemas/creature';

// ═══════════════════════════════════════════════════════════════
// Entity Types
// ═══════════════════════════════════════════════════════════════

/**
 * Supported entity types
 * Extensible for Items, Factions, etc.
 */
export type EntityType = 'creature';

/**
 * Summary info for entity lists (without full data)
 */
export interface EntitySummary {
  id: EntityId<'entity'>;
  smType: EntityType;
  name: string;
  filePath: string;
}

/**
 * Full creature entity with data
 */
export interface CreatureEntity extends EntitySummary {
  smType: 'creature';
  data: CreatureData;
}

/**
 * Union of all entity types
 * Extensible: Entity = CreatureEntity | ItemEntity | FactionEntity
 */
export type Entity = CreatureEntity;

// ═══════════════════════════════════════════════════════════════
// Inbound Port - EntityFeaturePort
// ═══════════════════════════════════════════════════════════════

/**
 * Inbound Port für das Entity Feature
 * Wird von Application Layer und anderen Features aufgerufen
 */
export interface EntityFeaturePort {
  // ─────────────────────────────────────────────────────────────
  // Generic Entity Queries
  // ─────────────────────────────────────────────────────────────

  /**
   * Get entity by ID
   */
  getEntity(id: EntityId<'entity'>): Entity | null;

  /**
   * List all entities (optionally filtered by type)
   */
  listEntities(type?: EntityType): EntitySummary[];

  // ─────────────────────────────────────────────────────────────
  // Creature-specific Queries
  // ─────────────────────────────────────────────────────────────

  /**
   * Get creature by ID
   */
  getCreature(id: EntityId<'entity'>): CreatureEntity | null;

  /**
   * List all creatures
   */
  listCreatures(): CreatureEntity[];

  /**
   * Find creatures that prefer a specific terrain
   * Used by Encounter Generator
   */
  findCreaturesByTerrain(terrain: string): CreatureEntity[];

  /**
   * Find creatures within a CR range
   * Used by Encounter Generator for difficulty balancing
   */
  findCreaturesByCR(minCR: number, maxCR: number): CreatureEntity[];

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize feature, load all entities from storage
   */
  initialize(): Promise<void>;

  /**
   * Reload all entities from storage
   */
  reload(): Promise<void>;

  /**
   * Cleanup on plugin unload
   */
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════
// Outbound Port - EntityStoragePort
// ═══════════════════════════════════════════════════════════════

/**
 * Outbound Port for entity persistence
 * Implemented by infrastructure layer (Vault Adapter)
 */
export interface EntityStoragePort {
  /**
   * Scan storage for all entities and return summaries
   */
  scanEntities(): Promise<EntitySummary[]>;

  /**
   * Load full entity data by file path
   */
  loadEntity(filePath: string): Promise<Entity | null>;
}
