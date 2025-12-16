// src/workmodes/cartographer/editor/tools/base/brush-execution.ts
// Unified abort/rollback utilities for brush tools

/**
 * Standard abort error name for brush operations.
 * Used to distinguish user cancellations from actual errors.
 */
export const ABORT_ERROR_NAME = "AbortError";

/**
 * Creates a named abort error for a brush tool.
 * Attempts to use DOMException if available (browser environment),
 * falls back to standard Error with custom name.
 *
 * @param toolName Name of the tool being aborted (e.g., "terrain-brush")
 * @returns AbortError instance
 *
 * @example
 * ```ts
 * throw createAbortError("terrain-brush");
 * ```
 */
export function createAbortError(toolName: string): Error {
    const message = `${toolName} application aborted`;

    if (typeof DOMException === "function") {
        return new DOMException(message, ABORT_ERROR_NAME);
    }

    const error = new Error(message);
    error.name = ABORT_ERROR_NAME;
    return error;
}

/**
 * Type guard to check if an error is an abort error.
 * Handles both DOMException and standard Error instances.
 *
 * @param error Unknown error object
 * @returns True if error is an AbortError
 *
 * @example
 * ```ts
 * try {
 *   await applyBrush(...);
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     // User cancelled - handle gracefully
 *   } else {
 *     // Actual error - log and report
 *   }
 * }
 * ```
 */
export function isAbortError(error: unknown): boolean {
    if (!error) return false;

    // Check DOMException first (browser environment)
    if (typeof DOMException === "function" && error instanceof DOMException) {
        return error.name === ABORT_ERROR_NAME;
    }

    // Fallback to standard Error
    return error instanceof Error && error.name === ABORT_ERROR_NAME;
}

/**
 * Creates a function that throws if the abort signal is triggered.
 * Use this at the start of async loops to check cancellation.
 *
 * @param signal AbortSignal from editor lifecycle (null if not available)
 * @param toolName Name of the tool for error message
 * @returns Function that throws AbortError if signal is aborted
 *
 * @example
 * ```ts
 * const throwIfAborted = createAbortChecker(abortSignal, "terrain-brush");
 *
 * // Check before expensive operations
 * throwIfAborted();
 * const tiles = await loadTiles();
 *
 * // Check in loops
 * for (const coord of coords) {
 *   throwIfAborted();
 *   await processTile(coord);
 * }
 * ```
 */
export function createAbortChecker(
    signal: AbortSignal | null,
    toolName: string
): () => void {
    return () => {
        if (signal?.aborted) {
            throw createAbortError(toolName);
        }
    };
}

/**
 * Manages rollback state for batch operations.
 * Stores original values that can be restored if operation aborts.
 *
 * @template T Type of values being stored (usually TileData)
 *
 * @example
 * ```ts
 * const rollback = new RollbackManager<TileData>();
 *
 * // Save original before modification
 * rollback.save("3,5", originalTileData);
 *
 * // On error: restore all originals
 * for (const [key, data] of rollback.getOriginals()) {
 *   await tileStore.saveTile(parseCoord(key), data);
 * }
 *
 * // On success: clear rollback state
 * rollback.clear();
 * ```
 */
export class RollbackManager<T> {
    private originals = new Map<string, T>();

    /**
     * Store original value before modification.
     *
     * @param key Unique identifier (usually coord key like "3,5")
     * @param value Original value to restore on rollback
     */
    save(key: string, value: T): void {
        // Only save first version (don't overwrite if already saved)
        if (!this.originals.has(key)) {
            this.originals.set(key, value);
        }
    }

    /**
     * Get all stored original values for rollback.
     * Returns a map of key → original value.
     */
    getOriginals(): Map<string, T> {
        return this.originals;
    }

    /**
     * Clear stored values (after successful commit).
     * Should be called after operation succeeds to free memory.
     */
    clear(): void {
        this.originals.clear();
    }

    /**
     * Check if any values are stored.
     * Useful for determining if rollback is needed.
     */
    hasChanges(): boolean {
        return this.originals.size > 0;
    }
}
