// src/workmodes/library/library-controller.ts
// Controller: Minimal orchestration layer for Library workmode
// Library delegates most functionality to TabbedBrowseView, so this controller
// primarily exists to satisfy STRUCTURE_STANDARDS.md requirements.

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-controller');

/**
 * Context object passed to Library controller
 */
export interface LibraryControllerContext {
    readonly app: App;
}

/**
 * Library controller
 *
 * Unlike Cartographer/SessionRunner which have complex orchestration,
 * Library uses TabbedBrowseView from data-manager for most functionality.
 * This controller provides a minimal lifecycle interface.
 */
export class LibraryController {
    private readonly app: App;
    private isInitialized = false;

    constructor(ctx: LibraryControllerContext) {
        this.app = ctx.app;
    }

    /**
     * Initialize controller (called once during view construction)
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('Controller already initialized');
            return;
        }

        logger.info('Controller initializing');
        this.isInitialized = true;

        // Future initialization logic can go here:
        // - Register event listeners
        // - Initialize shared state
        // - Set up watchers

        logger.info('Controller initialized');
    }

    /**
     * Cleanup controller (called during view destruction)
     */
    destroy(): void {
        if (!this.isInitialized) {
            return;
        }

        logger.info('Controller destroying');

        // Future cleanup logic can go here:
        // - Unregister event listeners
        // - Clean up state
        // - Cancel pending operations

        this.isInitialized = false;
        logger.info('Controller destroyed');
    }

    /**
     * Get initialization state
     */
    getInitialized(): boolean {
        return this.isInitialized;
    }
}
