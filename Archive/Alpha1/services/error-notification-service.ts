// src/services/error-notification-service.ts
// Centralized error notification service with user-friendly messages and logging

import { Notice } from 'obsidian';
import type { PluginLogger } from '@services/logging/logger';

export enum NotificationLevel {
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
    SUCCESS = 'success'
}

export interface NotificationOptions {
    showToUser?: boolean;
    logToConsole?: boolean;
    duration?: number;
    context?: string;
}

/**
 * Centralized error notification service
 * Handles error logging, user notifications, and context tracking
 */
export class ErrorNotificationService {
    constructor(
        private logger: PluginLogger,
        private defaultContext: string = 'salt-marcher'
    ) {}

    /**
     * Log and optionally notify user about an error
     */
    error(message: string, error?: unknown, options?: NotificationOptions): void {
        const opts = { showToUser: true, logToConsole: true, ...options };
        const context = opts.context || this.defaultContext;

        // Always log errors
        if (opts.logToConsole) {
            this.logger.error(`[${context}] ${message}`, error);
        }

        // Show to user if requested
        if (opts.showToUser) {
            const userMessage = this.formatUserMessage(message, error);
            new Notice(userMessage, opts.duration || 5000);
        }
    }

    /**
     * Log and optionally notify user about a warning
     */
    warning(message: string, options?: NotificationOptions): void {
        const opts = { showToUser: false, logToConsole: true, ...options };
        const context = opts.context || this.defaultContext;

        if (opts.logToConsole) {
            this.logger.warn(`[${context}] ${message}`);
        }

        if (opts.showToUser) {
            new Notice(`⚠️ ${message}`, opts.duration || 4000);
        }
    }

    /**
     * Log and optionally notify user about info
     */
    info(message: string, options?: NotificationOptions): void {
        const opts = { showToUser: false, logToConsole: false, ...options };
        const context = opts.context || this.defaultContext;

        if (opts.logToConsole) {
            this.logger.info(`[${context}] ${message}`);
        }

        if (opts.showToUser) {
            new Notice(message, opts.duration || 3000);
        }
    }

    /**
     * Log and optionally notify user about success
     */
    success(message: string, options?: NotificationOptions): void {
        const opts = { showToUser: true, logToConsole: false, ...options };
        const context = opts.context || this.defaultContext;

        if (opts.logToConsole) {
            this.logger.info(`[${context}] ${message}`);
        }

        if (opts.showToUser) {
            new Notice(`✅ ${message}`, opts.duration || 3000);
        }
    }

    /**
     * Format error message for user display
     * Includes error details if available
     */
    private formatUserMessage(message: string, error?: unknown): string {
        if (!error) return `❌ ${message}`;

        const errorMessage = this.extractErrorMessage(error);
        if (errorMessage && !message.includes(errorMessage)) {
            return `❌ ${message}: ${errorMessage}`;
        }
        return `❌ ${message}`;
    }

    /**
     * Extract error message from various error types
     */
    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
        }
        return String(error);
    }
}

// Singleton instance management
let instance: ErrorNotificationService | null = null;

/**
 * Get or create the error notification service singleton
 */
export function getErrorNotificationService(logger: PluginLogger): ErrorNotificationService {
    if (!instance) {
        instance = new ErrorNotificationService(logger);
    }
    return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetErrorNotificationService(): void {
    instance = null;
}
