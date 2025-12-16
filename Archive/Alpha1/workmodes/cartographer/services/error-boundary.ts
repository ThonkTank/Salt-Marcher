// src/workmodes/cartographer/services/error-boundary.ts
// Error isolation boundary for tool operations

import type { AxialCoord } from "../contracts/controller-interfaces";

/**
 * Context information for error reporting.
 * Provides details about what operation failed and where.
 */
export interface ErrorContext {
    /** ID of the tool that triggered the error (if applicable) */
    toolId?: string;
    /** Name of the operation being performed */
    operation: string;
    /** Hex coordinate where error occurred (if applicable) */
    coord?: AxialCoord;
}

/**
 * Error isolation boundary that catches and handles errors without crashing.
 * Tracks error states per tool and provides recovery mechanisms.
 */
export interface ErrorBoundary {
    /**
     * Wrap an async operation with error handling.
     * Returns null if operation throws.
     */
    wrap<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T | null>;

    /**
     * Wrap a synchronous operation with error handling.
     * Returns null if operation throws.
     */
    wrapSync<T>(operation: () => T, context: ErrorContext): T | null;

    /**
     * Check if a tool is currently in an error state.
     */
    hasError(toolId: string): boolean;

    /**
     * Clear the error state for a tool.
     * Typically called when switching away from a broken tool.
     */
    clearError(toolId: string): void;
}

/**
 * Create an error boundary for isolating tool failures.
 *
 * @param onError - Called when an error is caught with error details
 * @param onRecovery - Optional callback when recovering from error state
 * @returns ErrorBoundary instance
 *
 * @example
 * ```typescript
 * const boundary = createErrorBoundary(
 *   (err, ctx) => logger.error("Tool error", { err, ctx }),
 *   () => resetToSafeState()
 * );
 *
 * // Async operation
 * const result = await boundary.wrap(
 *   async () => dangerousOperation(),
 *   { toolId: "terrain-brush", operation: "paint" }
 * );
 *
 * // Sync operation
 * const value = boundary.wrapSync(
 *   () => calculateSomething(),
 *   { operation: "calculate" }
 * );
 * ```
 */
export function createErrorBoundary(
    onError: (err: unknown, ctx: ErrorContext) => void,
    onRecovery?: () => void
): ErrorBoundary {
    // Track which tools are in error state
    const errorStates = new Map<string, boolean>();

    return {
        async wrap<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T | null> {
            try {
                return await operation();
            } catch (err) {
                // Mark tool as errored if toolId provided
                if (context.toolId) {
                    errorStates.set(context.toolId, true);
                }
                // Report error with full context
                onError(err, context);
                // Trigger recovery if available
                onRecovery?.();
                return null;
            }
        },

        wrapSync<T>(operation: () => T, context: ErrorContext): T | null {
            try {
                return operation();
            } catch (err) {
                // Mark tool as errored if toolId provided
                if (context.toolId) {
                    errorStates.set(context.toolId, true);
                }
                // Report error with full context
                onError(err, context);
                // Trigger recovery if available
                onRecovery?.();
                return null;
            }
        },

        hasError(toolId: string): boolean {
            return errorStates.get(toolId) ?? false;
        },

        clearError(toolId: string): void {
            errorStates.delete(toolId);
        },
    };
}
