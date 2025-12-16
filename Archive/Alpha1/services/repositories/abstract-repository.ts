// src/services/repositories/abstract-repository.ts
// Abstract base class for repositories with optional caching

import type { App } from "obsidian";
import { RepositoryError } from "./repository-error";
import type { Repository } from "./base-repository";

/**
 * Abstract repository base class
 *
 * **Features:**
 * - Implements common Repository interface methods
 * - Provides template methods for subclasses to override
 * - No caching (subclasses can add via composition)
 *
 * **Subclass Implementation:**
 * - Must implement abstract methods (loadFromSource, saveToSource, etc.)
 * - Can override exists() for optimization
 * - Should use RepositoryError for all failures
 *
 * **Usage:**
 * ```typescript
 * class SimpleRepository extends AbstractRepository<MyEntity> {
 *   protected async loadFromSource(app: App, id: string): Promise<MyEntity> {
 *     // Load from vault
 *   }
 *
 *   protected async loadAllFromSource(app: App): Promise<MyEntity[]> {
 *     // Load all from vault
 *   }
 * }
 * ```
 */
export abstract class AbstractRepository<T> implements Repository<T> {
    /**
     * Load single entity from underlying data source
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @returns Entity data
     * @throws RepositoryError with code 'NOT_FOUND' if not found
     */
    protected abstract loadFromSource(app: App, id: string): Promise<T>;

    /**
     * Load all entities from underlying data source
     *
     * @param app - Obsidian App instance
     * @returns Array of all entities
     */
    protected abstract loadAllFromSource(app: App): Promise<T[]>;

    /**
     * Save entity to underlying data source
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @param data - Entity data
     * @throws RepositoryError with code 'INVALID_DATA' or 'IO_ERROR'
     */
    protected abstract saveToSource(app: App, id: string, data: T): Promise<void>;

    /**
     * Delete entity from underlying data source
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @throws RepositoryError with code 'NOT_FOUND' or 'IO_ERROR'
     */
    protected abstract deleteFromSource(app: App, id: string): Promise<void>;

    /**
     * Check if entity exists in underlying data source
     *
     * Default implementation tries to load and catches NOT_FOUND errors.
     * Override for better performance.
     *
     * @param app - Obsidian App instance
     * @param id - Entity identifier
     * @returns True if entity exists
     */
    protected async existsInSource(app: App, id: string): Promise<boolean> {
        try {
            await this.loadFromSource(app, id);
            return true;
        } catch (error) {
            if (RepositoryError.isCode(error, 'NOT_FOUND')) {
                return false;
            }
            throw error;
        }
    }

    // ===== Public API (implements Repository interface) =====

    async load(app: App, id: string): Promise<T> {
        return this.loadFromSource(app, id);
    }

    async loadAll(app: App): Promise<T[]> {
        return this.loadAllFromSource(app);
    }

    async save(app: App, id: string, data: T): Promise<void> {
        return this.saveToSource(app, id, data);
    }

    async delete(app: App, id: string): Promise<void> {
        return this.deleteFromSource(app, id);
    }

    async exists(app: App, id: string): Promise<boolean> {
        return this.existsInSource(app, id);
    }
}
