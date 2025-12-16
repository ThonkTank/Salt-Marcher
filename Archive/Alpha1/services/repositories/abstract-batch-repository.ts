// src/services/repositories/abstract-batch-repository.ts
// Abstract repository with batch operations support

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('abstract-batch-repository');
import { AbstractRepository } from "./abstract-repository";
import { RepositoryError } from "./repository-error";
import type { BatchRepository } from "./base-repository";

/**
 * Abstract repository with batch operations
 *
 * **Batch Operations:**
 * - More efficient than N individual operations
 * - Parallel loading for independent entities
 * - Single write for multiple entities (if supported by underlying storage)
 *
 * **Subclass Implementation:**
 * - Can override batch methods for better performance
 * - Default implementations use parallel Promise.all() for reads
 * - Default implementations use sequential operations for writes (override for atomicity)
 *
 * **Usage:**
 * ```typescript
 * class TileRepository extends AbstractBatchRepository<TileData> {
 *   // Inherits default batch implementations
 *   // Can override for storage-specific optimizations
 * }
 * ```
 */
export abstract class AbstractBatchRepository<T>
    extends AbstractRepository<T>
    implements BatchRepository<T>
{
    /**
     * Load multiple entities in parallel
     *
     * Default implementation: Promise.all() of individual loads
     * Override for better performance (e.g., single file read for JSON storage)
     */
    async loadBatch(app: App, ids: string[]): Promise<Map<string, T>> {
        const result = new Map<string, T>();

        // Load in parallel
        const results = await Promise.allSettled(
            ids.map(async (id) => {
                try {
                    const entity = await this.load(app, id);
                    return { id, entity };
                } catch (error) {
                    // Skip missing entities (NOT_FOUND is expected)
                    if (RepositoryError.isCode(error, 'NOT_FOUND')) {
                        return null;
                    }
                    throw error;
                }
            })
        );

        // Collect successful loads
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value !== null) {
                const { id, entity } = result.value;
                result.set(id, entity);
            }
        }

        logger.debug(`Batch load`, {
            requested: ids.length,
            loaded: result.size,
        });

        return result;
    }

    /**
     * Save multiple entities
     *
     * Default implementation: Sequential saves (not atomic)
     * Override for atomic batch saves if supported by storage
     */
    async saveBatch(app: App, items: Array<{ id: string; data: T }>): Promise<void> {
        const errors: Array<{ id: string; error: Error }> = [];

        // Save sequentially (not atomic by default)
        for (const { id, data } of items) {
            try {
                await this.save(app, id, data);
            } catch (error) {
                errors.push({
                    id,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }
        }

        if (errors.length > 0) {
            throw new RepositoryError(
                'IO_ERROR',
                `Batch save failed: ${errors.length}/${items.length} errors`,
                { errors: errors.map(e => ({ id: e.id, message: e.error.message })) }
            );
        }

        logger.debug(`Batch save`, {
            count: items.length,
        });
    }

    /**
     * Delete multiple entities
     *
     * Default implementation: Sequential deletes (not atomic)
     * Override for atomic batch deletes if supported by storage
     */
    async deleteBatch(app: App, ids: string[]): Promise<void> {
        const errors: Array<{ id: string; error: Error }> = [];

        // Delete sequentially (not atomic by default)
        for (const id of ids) {
            try {
                await this.delete(app, id);
            } catch (error) {
                // Skip NOT_FOUND errors (already deleted)
                if (!RepositoryError.isCode(error, 'NOT_FOUND')) {
                    errors.push({
                        id,
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            }
        }

        if (errors.length > 0) {
            throw new RepositoryError(
                'IO_ERROR',
                `Batch delete failed: ${errors.length}/${ids.length} errors`,
                { errors: errors.map(e => ({ id: e.id, message: e.error.message })) }
            );
        }

        logger.debug(`Batch delete`, {
            count: ids.length,
        });
    }
}
