// VaultAdapter-Implementierung für CLI-Testing
// Lädt Daten aus presets/ statt aus Obsidian-Vault
// Siehe: docs/architecture/Infrastructure.md

import type { VaultAdapter } from './VaultAdapter';

/**
 * VaultAdapter der Presets aus dem presets/ Ordner lädt.
 * Verwendet für CLI-Testing ohne Obsidian-Abhängigkeit.
 */
export class PresetVaultAdapter implements VaultAdapter {
  private data: Record<string, unknown[]> = {};

  /**
   * Registriert Entities eines Typs.
   * Aufgerufen beim Laden der Presets.
   */
  register<T>(type: string, entities: T[]): void {
    this.data[type] = entities;
  }

  getEntity<T>(type: string, id: string): T {
    const entities = this.data[type] as Array<{ id: string }> | undefined;
    if (!entities) {
      throw new Error(`Entity type '${type}' not registered`);
    }
    const entity = entities.find(e => e.id === id);
    if (!entity) {
      throw new Error(`Entity '${id}' of type '${type}' not found`);
    }
    return entity as T;
  }

  getAllEntities<T>(type: string): T[] {
    return (this.data[type] ?? []) as T[];
  }

  saveEntity<T extends { id: string }>(type: string, entity: T): void {
    if (!this.data[type]) {
      this.data[type] = [];
    }
    const entities = this.data[type] as Array<{ id: string }>;
    const existingIndex = entities.findIndex(e => e.id === entity.id);
    if (existingIndex >= 0) {
      entities[existingIndex] = entity;
    } else {
      entities.push(entity);
    }
  }
}
