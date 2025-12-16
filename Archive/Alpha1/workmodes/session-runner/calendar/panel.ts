// src/workmodes/session-runner/calendar/panel.ts
// Main calendar panel for Session Runner - Refactored with compact, intuitive layout

import "./calendar-panel.css";
import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-calendar-panel");
import { LifecycleManager } from "@services/app-lifecycle-manager";
import { createCurrentEvents } from "./current-events";
import { openDatePickerModal } from "./date-picker-modal";
import { createTimeControls } from "./time-controls";
import { createTimestampDisplay } from "./timestamp-display";
import { createUpcomingEvents, type UpcomingEventItem } from "./upcoming-events";
import type {
    CalendarStateGateway,
    CalendarStateSnapshot,
    TimeUnit,
} from "@services/orchestration";
import type { CalendarEvent } from "@domain";

export interface CalendarPanelOptions {
    readonly host: HTMLElement;
    readonly app: App;
    readonly gateway: CalendarStateGateway;
    readonly travelId: string | null;
    readonly onOpenAlmanac?: () => void;
    /** Called after time advances successfully (for tidal layer refresh, etc.) */
    readonly onTimeAdvance?: (amount: number, unit: TimeUnit) => void | Promise<void>;
}

export interface CalendarPanelHandle {
    readonly root: HTMLElement;
    refresh(): Promise<void>;
    destroy(): void;
}

/**
 * Creates the main calendar panel for Session Runner.
 *
 * Layout (Compact & Unified):
 * ```
 * ┌─────────────────────────────────────┐
 * │   📅 Year 1489, Day 15              │ ← Large, centered timestamp
 * │      14:30 • afternoon               │
 * │                                      │
 * │ [1] [Days ▾] [▶] [📅]              │ ← Inline controls
 * │                                      │
 * │ ─── NOW (2) ───────────────────── │ ← Divider header
 * │ ⏺ Event 1 • until 15:00            │
 * │ ⏺ Event 2 • ongoing                │
 * │                                      │
 * │ ─── UPCOMING (5) ─────────────────│ ← Divider header
 * │ ▸ Tomorrow • Event 3                │
 * │ ▸ In 2 days • Event 4               │
 * │                                      │
 * │        → Open Almanac                │ ← Centered link
 * └─────────────────────────────────────┘
 * ```
 *
 * Features:
 * - Large, prominent timestamp (centered)
 * - Icon-based time controls (▶ advance, 📅 jump)
 * - Compact one-line event items
 * - Horizontal dividers instead of boxes
 * - Maximum visual clarity with minimal clutter
 */
export function createCalendarPanel(options: CalendarPanelOptions): CalendarPanelHandle {
    const { host, app, gateway, travelId, onOpenAlmanac, onTimeAdvance } = options;

    // Lifecycle management for proper cleanup
    const lifecycle = new LifecycleManager();

    // Note: No wrapper needed - host is already sm-panel-card__body from sidebar.ts
    // This allows calendar to integrate properly with card system (collapsible, consistent spacing)

    // Timestamp section
    const timestampSection = host.createDiv({ cls: "sm-calendar-panel__timestamp-section" });
    const timestampDisplay = createTimestampDisplay({
        host: timestampSection,
    });

    // Time controls section
    const controlsSection = host.createDiv({ cls: "sm-calendar-panel__controls-section" });
    const timeControls = createTimeControls({
        host: controlsSection,
        onAdvance: async (amount, unit) => {
            try {
                timestampDisplay.setLoading(true);
                await gateway.advanceTimeBy(amount, unit, {
                    hookContext: { scope: "global", travelId: null, reason: "advance" },
                });
                await refresh();

                // Notify external listeners (e.g., tidal layer refresh)
                if (onTimeAdvance) {
                    try {
                        await onTimeAdvance(amount, unit);
                    } catch (err) {
                        logger.warn("[calendar-panel] onTimeAdvance callback failed", err);
                    }
                }
            } catch (error) {
                logger.error("[calendar-panel] Failed to advance time", error);
                const message = error instanceof Error ? error.message : String(error);
                timestampDisplay.setError(`Error: ${message}`);
            } finally {
                timestampDisplay.setLoading(false);
            }
        },
        onJumpToDate: () => {
            // Get current snapshot to access calendar schema
            if (!snapshot?.activeCalendar || !snapshot?.currentTimestamp) {
                logger.warn("[calendar-panel] Cannot open date picker: No active calendar");
                return;
            }

            openDatePickerModal({
                app,
                calendar: snapshot.activeCalendar,
                currentTimestamp: snapshot.currentTimestamp,
                onConfirm: async (newTimestamp) => {
                    try {
                        timestampDisplay.setLoading(true);
                        await gateway.setCurrentTimestamp(newTimestamp);
                        await refresh();

                        // Notify external listeners
                        if (onTimeAdvance) {
                            try {
                                await onTimeAdvance(0, "minute"); // Dummy call to trigger refresh
                            } catch (err) {
                                logger.warn("[calendar-panel] onTimeAdvance callback failed after jump", err);
                            }
                        }
                    } catch (error) {
                        logger.error("[calendar-panel] Failed to jump to date", error);
                        const message = error instanceof Error ? error.message : String(error);
                        timestampDisplay.setError(`Error: ${message}`);
                    } finally {
                        timestampDisplay.setLoading(false);
                    }
                },
            });
        },
    });

    // Current events section
    const currentEventsSection = host.createDiv({ cls: "sm-calendar-panel__current-events-section" });
    const currentEvents = createCurrentEvents({
        host: currentEventsSection,
        onClickEvent: (eventId) => {
            // TODO: Implement event detail view
            logger.info("[calendar-panel] Open event", { eventId });
        },
    });

    // Upcoming events section
    const upcomingEventsSection = host.createDiv({ cls: "sm-calendar-panel__upcoming-events-section" });
    const upcomingEvents = createUpcomingEvents({
        host: upcomingEventsSection,
        limit: 5,
        onClickEvent: (eventId) => {
            // TODO: Implement event detail view
            logger.info("[calendar-panel] Open event", { eventId });
        },
    });

    // Almanac link
    if (onOpenAlmanac) {
        const linkSection = host.createDiv({ cls: "sm-calendar-panel__link-section" });
        const link = linkSection.createEl("a", {
            cls: "sm-calendar-panel__almanac-link",
            text: "→ Open Almanac",
        });
        link.addEventListener("click", (e) => {
            e.preventDefault();
            onOpenAlmanac();
        });
    }

    // Internal state
    let snapshot: CalendarStateSnapshot | null = null;
    let isDestroyed = false;

    /**
     * Refreshes the calendar panel with latest data.
     */
    async function refresh(): Promise<void> {
        if (isDestroyed) {
            return;
        }

        try {
            snapshot = await gateway.loadSnapshot();

            // Update timestamp display
            timestampDisplay.setTimestamp(snapshot.currentTimestamp);

            // Update time controls (enable/disable based on active calendar)
            timeControls.setDisabled(!snapshot.activeCalendar);

            // Prepare current and upcoming events
            if (snapshot.activeCalendar && snapshot.currentTimestamp) {
                // Merge events and phenomena for current events
                const allEventsForCurrent = [
                    ...snapshot.upcomingEvents,
                ] as CalendarEvent[];

                // Merge for upcoming events
                const upcomingItems: UpcomingEventItem[] = [
                    ...snapshot.upcomingEvents.map(e => ({
                        id: e.id,
                        kind: "event" as const,
                        title: e.title,
                        timestamp: e.date,
                        category: e.category,
                        priority: e.priority,
                    })),
                    ...snapshot.upcomingPhenomena.map(p => ({
                        id: p.phenomenonId,
                        kind: "phenomenon" as const,
                        title: p.name,
                        timestamp: p.timestamp,
                        category: undefined,
                        priority: undefined,
                    })),
                ];

                // Update current events (filter for today)
                currentEvents.setEvents(
                    allEventsForCurrent,
                    snapshot.activeCalendar,
                    snapshot.currentTimestamp,
                );

                // Update upcoming events (shows future events)
                upcomingEvents.setEvents(
                    upcomingItems,
                    snapshot.activeCalendar,
                    snapshot.currentTimestamp,
                );
            } else {
                // No active calendar - clear all event displays
                currentEvents.setEvents([], null, null);
                upcomingEvents.setEvents([], null, null);
            }
        } catch (error) {
            logger.error("[calendar-panel] Failed to refresh", error);
            timestampDisplay.setError("Failed to load calendar data");
            currentEvents.setEvents([], null, null);
            upcomingEvents.setEvents([], null, null);
        }
    }

    // Initial load
    void refresh();

    // Public API
    return {
        root: host,
        refresh,
        destroy: () => {
            isDestroyed = true;
            lifecycle.cleanup();
            timestampDisplay.destroy();
            timeControls.destroy();
            currentEvents.destroy();
            upcomingEvents.destroy();
            host.empty();
        },
    };
}
