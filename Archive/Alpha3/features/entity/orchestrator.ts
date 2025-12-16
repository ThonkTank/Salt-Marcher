/**
 * Entity Feature - Orchestrator
 * Core logic for entity management (Creatures, Items, Factions)
 */

import type { EntityId } from '@core/types/common';
import { isCRInRange } from '@core/schemas/creature';
import type {
  EntityFeaturePort,
  EntityStoragePort,
  Entity,
  EntitySummary,
  EntityType,
  CreatureEntity,
} from './types';

// ═══════════════════════════════════════════════════════════════
// EntityOrchestrator Implementation
// ═══════════════════════════════════════════════════════════════

class EntityOrchestrator implements EntityFeaturePort {
  private readonly storage: EntityStoragePort;

  // In-memory cache
  private entities: Map<EntityId<'entity'>, Entity> = new Map();
  private summaries: EntitySummary[] = [];

  private initialized = false;

  constructor(storage: EntityStoragePort) {
    this.storage = storage;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadAllEntities();

    this.initialized = true;
  }

  async reload(): Promise<void> {
    this.entities.clear();
    this.summaries = [];
    await this.loadAllEntities();
  }

  dispose(): void {
    this.entities.clear();
    this.summaries = [];
    this.initialized = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Generic Entity Queries
  // ─────────────────────────────────────────────────────────────

  getEntity(id: EntityId<'entity'>): Entity | null {
    return this.entities.get(id) ?? null;
  }

  listEntities(type?: EntityType): EntitySummary[] {
    if (!type) {
      return [...this.summaries];
    }

    return this.summaries.filter((s) => s.smType === type);
  }

  // ─────────────────────────────────────────────────────────────
  // Creature-specific Queries
  // ─────────────────────────────────────────────────────────────

  getCreature(id: EntityId<'entity'>): CreatureEntity | null {
    const entity = this.entities.get(id);
    if (entity?.smType === 'creature') {
      return entity;
    }
    return null;
  }

  listCreatures(): CreatureEntity[] {
    const creatures: CreatureEntity[] = [];

    for (const entity of this.entities.values()) {
      if (entity.smType === 'creature') {
        creatures.push(entity);
      }
    }

    return creatures;
  }

  findCreaturesByTerrain(terrain: string): CreatureEntity[] {
    const normalizedTerrain = terrain.toLowerCase();

    return this.listCreatures().filter((creature) => {
      const prefs = creature.data.terrainPreference;
      if (!prefs || prefs.length === 0) {
        return true;
      }

      return prefs.some(
        (pref) =>
          pref.toLowerCase().includes(normalizedTerrain) ||
          normalizedTerrain.includes(pref.toLowerCase())
      );
    });
  }

  findCreaturesByCR(minCR: number, maxCR: number): CreatureEntity[] {
    return this.listCreatures().filter((creature) =>
      isCRInRange(creature.data.cr, minCR, maxCR)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private async loadAllEntities(): Promise<void> {
    try {
      this.summaries = await this.storage.scanEntities();

      console.log(`[EntityOrchestrator] Found ${this.summaries.length} entities`);

      let loadedCount = 0;
      for (const summary of this.summaries) {
        const entity = await this.storage.loadEntity(summary.filePath);
        if (entity) {
          this.entities.set(entity.id, entity);
          loadedCount++;
        }
      }

      console.log(`[EntityOrchestrator] Loaded ${loadedCount} entities`);
    } catch (err) {
      console.error('[EntityOrchestrator] Failed to load entities:', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an EntityOrchestrator with injected storage
 *
 * @param storage - EntityStoragePort implementation
 * @returns EntityFeaturePort (call initialize()!)
 */
export function createEntityOrchestrator(
  storage: EntityStoragePort
): EntityFeaturePort {
  return new EntityOrchestrator(storage);
}
