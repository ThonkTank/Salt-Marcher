// Vault-Adapter Interface für Datenzugriff
// Siehe: docs/architecture/Infrastructure.md

// TODO: [Spec: Infrastructure.md] Vollständige Implementierung des VaultAdapters
// Aktuell nur minimales Interface für Service-Zugriff auf Entities.
// Fehlend:
// - Obsidian-Integration
// - Caching
// - Validierung gegen Schemas
// - Error-Handling mit Result<T, E>

/**
 * Minimales Interface für Vault-Zugriff.
 * Wird von Services verwendet um Entities zu laden.
 */
export interface VaultAdapter {
  /**
   * Lädt eine einzelne Entity nach Typ und ID.
   *
   * TODO: [Spec: Services.md] Return sollte Result<T, EntityNotFoundError> sein
   */
  getEntity<T>(type: string, id: string): T;

  /**
   * Lädt alle Entities eines Typs.
   */
  getAllEntities<T>(type: string): T[];

  /**
   * Speichert eine Entity im Vault.
   * Erstellt neue Entity oder überschreibt existierende (basierend auf entity.id).
   */
  saveEntity<T extends { id: string }>(type: string, entity: T): void;

  // TODO: [Spec: Infrastructure.md] Weitere Methoden nach Bedarf:
  // - deleteEntity(type: string, id: string): Result<void, DeleteError>
  // - queryEntities<T>(type: string, predicate: (e: T) => boolean): T[]
}
