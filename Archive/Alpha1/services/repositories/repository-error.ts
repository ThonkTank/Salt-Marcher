// src/services/repositories/repository-error.ts
// Standardized error handling for repository operations

/**
 * Error codes for repository operations
 */
export type RepositoryErrorCode =
    | 'NOT_FOUND'       // Entity or file not found
    | 'INVALID_DATA'    // Data validation failed
    | 'IO_ERROR'        // Vault I/O operation failed
    | 'PARSE_ERROR'     // Failed to parse file content
    | 'VALIDATION_ERROR' // Schema/constraint validation failed
    | 'CACHE_ERROR';    // Cache operation failed

/**
 * Standardized repository error with error codes and context
 *
 * **Usage:**
 * ```typescript
 * throw new RepositoryError(
 *   'NOT_FOUND',
 *   'Creature not found',
 *   { name: 'Goblin', path: 'Creatures/Goblin.md' }
 * );
 * ```
 *
 * **Error Handling:**
 * ```typescript
 * try {
 *   await repo.load(app, id);
 * } catch (error) {
 *   if (error instanceof RepositoryError && error.code === 'NOT_FOUND') {
 *     // Handle missing entity
 *   }
 * }
 * ```
 */
export class RepositoryError extends Error {
    constructor(
        public readonly code: RepositoryErrorCode,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'RepositoryError';

        // Maintain proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RepositoryError);
        }
    }

    /**
     * Create a NOT_FOUND error
     */
    static notFound(entityType: string, id: string, path?: string): RepositoryError {
        return new RepositoryError(
            'NOT_FOUND',
            `${entityType} not found: ${id}`,
            { entityType, id, path }
        );
    }

    /**
     * Create an INVALID_DATA error
     */
    static invalidData(entityType: string, reason: string, data?: unknown): RepositoryError {
        return new RepositoryError(
            'INVALID_DATA',
            `Invalid ${entityType} data: ${reason}`,
            { entityType, reason, data }
        );
    }

    /**
     * Create an IO_ERROR
     */
    static ioError(operation: string, path: string, cause?: Error): RepositoryError {
        return new RepositoryError(
            'IO_ERROR',
            `I/O error during ${operation}: ${path}`,
            { operation, path, cause: cause?.message }
        );
    }

    /**
     * Create a PARSE_ERROR
     */
    static parseError(path: string, cause?: Error): RepositoryError {
        return new RepositoryError(
            'PARSE_ERROR',
            `Failed to parse file: ${path}`,
            { path, cause: cause?.message }
        );
    }

    /**
     * Create a VALIDATION_ERROR
     */
    static validationError(entityType: string, errors: string[]): RepositoryError {
        return new RepositoryError(
            'VALIDATION_ERROR',
            `Validation failed for ${entityType}`,
            { entityType, errors }
        );
    }

    /**
     * Create a CACHE_ERROR
     */
    static cacheError(operation: string, reason: string): RepositoryError {
        return new RepositoryError(
            'CACHE_ERROR',
            `Cache error during ${operation}: ${reason}`,
            { operation, reason }
        );
    }

    /**
     * Check if an error is a RepositoryError with specific code
     */
    static isCode(error: unknown, code: RepositoryErrorCode): boolean {
        return error instanceof RepositoryError && error.code === code;
    }

    /**
     * Convert any error to RepositoryError
     */
    static from(error: unknown, defaultCode: RepositoryErrorCode = 'IO_ERROR'): RepositoryError {
        if (error instanceof RepositoryError) {
            return error;
        }

        if (error instanceof Error) {
            return new RepositoryError(defaultCode, error.message, { cause: error });
        }

        return new RepositoryError(defaultCode, String(error));
    }
}
