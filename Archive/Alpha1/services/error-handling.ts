// src/utils/error-handling.ts
// Error handling wrapper utilities for safe operation execution

import type { ErrorNotificationService } from '@services/error-notification-service';

/**
 * Wraps an async function with error handling
 * Logs errors and optionally notifies user
 *
 * @param fn - Async function to wrap
 * @param context - Context name for error logging
 * @param notificationService - Service for error notifications
 * @param fallback - Optional fallback value to return on error
 * @returns Wrapped function that handles errors gracefully
 *
 * @example
 * const safeLoad = withErrorHandling(
 *   loadData,
 *   'data-loader',
 *   notificationService,
 *   []
 * );
 * const result = await safeLoad();
 */
export function withErrorHandling<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string,
    notificationService: ErrorNotificationService,
    fallback?: R
): (...args: T) => Promise<R | undefined> {
    return async (...args: T) => {
        try {
            return await fn(...args);
        } catch (error) {
            notificationService.error(
                `Operation failed in ${context}`,
                error,
                { context, showToUser: true }
            );
            return fallback;
        }
    };
}

/**
 * Wraps a sync function with error handling
 * Logs errors and optionally notifies user
 *
 * @param fn - Sync function to wrap
 * @param context - Context name for error logging
 * @param notificationService - Service for error notifications
 * @param fallback - Optional fallback value to return on error
 * @returns Wrapped function that handles errors gracefully
 *
 * @example
 * const safeCalculate = withSyncErrorHandling(
 *   calculateValue,
 *   'math-calc',
 *   notificationService,
 *   0
 * );
 * const result = safeCalculate();
 */
export function withSyncErrorHandling<T extends any[], R>(
    fn: (...args: T) => R,
    context: string,
    notificationService: ErrorNotificationService,
    fallback?: R
): (...args: T) => R | undefined {
    return (...args: T) => {
        try {
            return fn(...args);
        } catch (error) {
            notificationService.error(
                `Operation failed in ${context}`,
                error,
                { context, showToUser: false, logToConsole: true }
            );
            return fallback;
        }
    };
}

/**
 * Type guard for Error objects
 *
 * @example
 * if (isError(value)) {
 *   console.log(value.message);
 * }
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Ensures we have an Error object
 * Converts strings and other types to Error instances
 *
 * @example
 * const error = ensureError(someValue);
 * console.log(error.message);
 */
export function ensureError(value: unknown): Error {
    if (isError(value)) return value;
    if (typeof value === 'string') return new Error(value);
    return new Error(String(value));
}

/**
 * Safely extracts error message from various error types
 *
 * @example
 * const message = getErrorMessage(caughtError);
 */
export function getErrorMessage(error: unknown): string {
    if (isError(error)) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'An unknown error occurred';
}

/**
 * Type-safe async error wrapper with context
 * Provides consistent error handling pattern with optional user notification
 *
 * @param operation - The async operation to wrap
 * @param context - Context name for error messages
 * @param notificationService - Service for notifications
 * @param showToUser - Whether to show error notification to user
 * @returns Promise that resolves to either the result or undefined on error
 *
 * @example
 * const result = await safeOperation(
 *   async () => await loadData(),
 *   'data-loading',
 *   notificationService,
 *   true
 * );
 */
export async function safeOperation<T>(
    operation: () => Promise<T>,
    context: string,
    notificationService: ErrorNotificationService,
    showToUser: boolean = false
): Promise<T | undefined> {
    try {
        return await operation();
    } catch (error) {
        notificationService.error(
            `Operation failed in ${context}`,
            error,
            { context, showToUser, logToConsole: true }
        );
        return undefined;
    }
}

/**
 * Catch-all handler for fire-and-forget promises
 * Logs errors without throwing
 *
 * @example
 * void fireAndForget(
 *   loadData(),
 *   'data-loader',
 *   notificationService
 * );
 */
export function fireAndForget<T>(
    promise: Promise<T>,
    context: string,
    notificationService: ErrorNotificationService
): void {
    promise.catch(error => {
        notificationService.error(
            `Background operation failed in ${context}`,
            error,
            { context, showToUser: false, logToConsole: true }
        );
    });
}
