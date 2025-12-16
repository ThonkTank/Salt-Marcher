// src/workmodes/almanac/almanac-controller.ts
// Controller: Orchestrates the Almanac workmode lifecycle and coordinates state, view, and gateway interactions.

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-controller');
import type { CalendarStateGateway } from "./data/calendar-state-gateway";
import type { CalendarSchema, CalendarTimestamp, CalendarEvent } from "./helpers";

/**
 * Context passed to Almanac components and handlers
 *
 * Provides dependency injection for all Almanac functionality.
 * Components receive this context to access app, gateway, and state.
 */
export interface AlmanacContext {
    readonly app: App;
    readonly gateway: CalendarStateGateway;
    getActiveCalendar(): CalendarSchema | null;
    getCurrentTimestamp(): CalendarTimestamp | null;
    getEvents(): CalendarEvent[];
}

/**
 * AlmanacController
 *
 * Orchestrates the Almanac workmode:
 * - Manages lifecycle (onOpen/onClose)
 * - Coordinates gateway (vault integration)
 * - Maintains state (calendar, timestamp, events)
 * - Provides context to view components
 *
 * Pattern: Context Object + Repository Pattern
 * - Context: AlmanacContext injected into components
 * - Repository: CalendarStateGateway abstracts vault I/O
 *
 * Responsibilities:
 * - Initialize gateway and load calendar state
 * - Coordinate view rendering via almanac-mvp
 * - Handle state changes and propagate to view
 * - Clean up resources on close
 */
export class AlmanacController {
    private readonly app: App;
    private readonly gateway: CalendarStateGateway;

    private host: HTMLElement | null = null;
    private activeCalendar: CalendarSchema | null = null;
    private currentTimestamp: CalendarTimestamp | null = null;
    private events: CalendarEvent[] = [];
    private cleanupFn: (() => void) | null = null;

    constructor(app: App, gateway: CalendarStateGateway) {
        this.app = app;
        this.gateway = gateway;

        logger.info("Controller initialized");
    }

    /**
     * Open the Almanac view
     *
     * Lifecycle:
     * 1. Load calendar state from gateway (vault)
     * 2. Create view context
     * 3. Render view via almanac-mvp
     * 4. Store cleanup function for onClose
     *
     * @param host - DOM element to mount view into
     */
    async onOpen(host: HTMLElement): Promise<void> {
        logger.info("Opening Almanac view");

        this.host = host;

        try {
            // Load calendar state from vault via gateway
            const snapshot = await this.gateway.loadSnapshot();

            if (!snapshot.activeCalendar || !snapshot.currentTimestamp) {
                logger.warn("No active calendar or current timestamp available");
                // View will show setup notice
            } else {
                this.activeCalendar = snapshot.activeCalendar as CalendarSchema;
                this.currentTimestamp = snapshot.currentTimestamp;
                this.events = (snapshot.upcomingEvents as CalendarEvent[]) || [];

                logger.info("Calendar state loaded", {
                    calendar: this.activeCalendar.name,
                    timestamp: this.currentTimestamp,
                    eventCount: this.events.length
                });
            }

            // Render view (almanac-mvp handles all UI)
            const { renderAlmanacMVP } = await import("./view/almanac-mvp");
            const cleanup = await renderAlmanacMVP(this.app, host, this.gateway);

            if (cleanup) {
                this.cleanupFn = cleanup;
            }

            logger.info("View rendered successfully");
        } catch (error) {
            logger.error("Failed to open Almanac view", error);
            throw error;
        }
    }

    /**
     * Close the Almanac view
     *
     * Cleanup:
     * 1. Call view cleanup function (removes listeners, etc.)
     * 2. Clear state references
     * 3. Clear host reference
     */
    async onClose(): Promise<void> {
        logger.info("Closing Almanac view");

        // Call view cleanup if exists
        if (this.cleanupFn) {
            try {
                this.cleanupFn();
                this.cleanupFn = null;
            } catch (error) {
                logger.error("Error during view cleanup", error);
            }
        }

        // Clear state
        this.activeCalendar = null;
        this.currentTimestamp = null;
        this.events = [];
        this.host = null;

        logger.info("View closed successfully");
    }

    /**
     * Create context for Almanac components
     *
     * Context provides dependency injection:
     * - App instance for Obsidian API
     * - Gateway for vault operations
     * - State accessors for calendar, timestamp, events
     *
     * @returns AlmanacContext for component use
     */
    createContext(): AlmanacContext {
        return {
            app: this.app,
            gateway: this.gateway,
            getActiveCalendar: () => this.activeCalendar,
            getCurrentTimestamp: () => this.currentTimestamp,
            getEvents: () => this.events,
        };
    }

    /**
     * Refresh calendar state from gateway
     *
     * Use when:
     * - Calendar changes externally
     * - Time advances
     * - Events are created/updated/deleted
     *
     * Future: Trigger view re-render after refresh
     */
    async refresh(): Promise<void> {
        logger.info("Refreshing calendar state");

        try {
            const snapshot = await this.gateway.loadSnapshot();

            if (snapshot.activeCalendar && snapshot.currentTimestamp) {
                this.activeCalendar = snapshot.activeCalendar as CalendarSchema;
                this.currentTimestamp = snapshot.currentTimestamp;
                this.events = (snapshot.upcomingEvents as CalendarEvent[]) || [];

                logger.info("State refreshed", {
                    calendar: this.activeCalendar.name,
                    timestamp: this.currentTimestamp,
                    eventCount: this.events.length
                });
            }
        } catch (error) {
            logger.error("Failed to refresh state", error);
            throw error;
        }
    }
}
