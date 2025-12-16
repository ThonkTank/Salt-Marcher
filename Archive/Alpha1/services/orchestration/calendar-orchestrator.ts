/**
 * Calendar Orchestration Service
 *
 * Centralizes calendar-related cross-workmode communication to eliminate
 * direct imports between workmodes (session-runner → almanac).
 *
 * This service provides:
 * - Re-exports of calendar types from @services/domain/calendar
 * - Re-exports of calendar functions from @services/domain/calendar
 * - Gateway creation and access
 * - Event query helpers
 *
 * Architecture:
 * - Workmodes import from @services/orchestration instead of @workmodes/almanac
 * - Types come from @services/domain/calendar (centralized type layer)
 * - Functions come from @services/domain/calendar
 * - Gateway comes from almanac workmode (runtime implementation)
 *
 * @module services/orchestration/calendar-orchestrator
 */

import type { App } from "obsidian";

// Re-export gateway types and interfaces (runtime implementation stays in almanac)
export type {
    CalendarStateGateway,
    CalendarStateSnapshot,
    AdvanceTimeResult,
    TravelLeafPreferencesSnapshot,
} from "@workmodes/almanac/data/calendar-state-gateway";

// Re-export gateway factory (runtime implementation stays in almanac)
export { createAlmanacGateway } from "@workmodes/almanac/gateway-factory";

// Re-export calendar functions from centralized domain
export {
    compareTimestampsWithSchema,
    formatTimestamp,
    timestampToAbsoluteDay,
    createMinuteTimestamp,
    createDayTimestamp,
} from "@services/domain/calendar";

// Re-export TimeUnit type from centralized domain
export type { TimeUnit } from "@services/domain/calendar";

// Re-export CalendarTimestamp type for convenience
export type { CalendarTimestamp } from "@services/domain/calendar";

/**
 * Get current calendar timestamp from gateway
 *
 * Convenience helper for accessing current time without direct gateway dependency.
 *
 * @param gateway - Calendar state gateway
 * @returns Current timestamp or null if not set
 */
export function getCurrentTimestamp(gateway: import("@workmodes/almanac/data/calendar-state-gateway").CalendarStateGateway): import("@services/domain/calendar").CalendarTimestamp | null {
    return gateway.getCurrentTimestamp();
}

/**
 * Get active calendar ID from gateway
 *
 * @param gateway - Calendar state gateway
 * @returns Active calendar ID or null
 */
export function getActiveCalendarId(gateway: import("@workmodes/almanac/data/calendar-state-gateway").CalendarStateGateway): string | null {
    return gateway.getActiveCalendarId();
}
