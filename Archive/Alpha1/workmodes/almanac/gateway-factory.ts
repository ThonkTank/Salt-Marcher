// src/workmodes/almanac/gateway-factory.ts
// Factory function for creating CalendarStateGateway with vault-backed repositories

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-gateway');
import { VaultCalendarStateGateway, type CalendarStateGateway } from "./data/calendar-state-gateway";
import { VaultCalendarRepository, VaultEventRepository, VaultAlmanacRepository } from "./data/repositories";

/**
 * Creates a vault-backed CalendarStateGateway for Almanac workmode
 *
 * @param app - Obsidian app instance
 * @returns CalendarStateGateway instance configured with vault repositories
 */
export function createAlmanacGateway(app: App): CalendarStateGateway {
    logger.info("Creating vault-backed gateway");

    // Create vault-backed repositories with shared store
    const calendarRepo = new VaultCalendarRepository(app.vault);
    const eventRepo = new VaultEventRepository(calendarRepo);
    const phenomenonRepo = new VaultAlmanacRepository(calendarRepo, calendarRepo);

    // Create gateway with repositories
    const gateway = new VaultCalendarStateGateway(
        calendarRepo,
        eventRepo,
        phenomenonRepo,
        app,
        undefined, // No hook dispatcher yet (Phase 13+)
        undefined, // No faction simulation hook yet (Phase 13+)
        undefined  // No weather simulation hook yet (Phase 13+)
    );

    logger.info("Gateway created successfully");
    return gateway;
}
