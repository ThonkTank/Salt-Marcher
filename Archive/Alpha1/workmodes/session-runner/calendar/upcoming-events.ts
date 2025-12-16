// src/workmodes/session-runner/calendar/upcoming-events.ts
// Upcoming events component with relative timestamps and improved sorting

import { setIcon } from "obsidian";
import { compareTimestampsWithSchema, formatTimestamp, timestampToAbsoluteDay } from "@services/orchestration";
import type { CalendarSchema, CalendarTimestamp } from "@domain";

export interface UpcomingEventItem {
    readonly id: string;
    readonly kind: "event" | "phenomenon";
    readonly title: string;
    readonly timestamp: CalendarTimestamp;
    readonly category?: string;
    readonly priority?: number;
}

export interface UpcomingEventsOptions {
    readonly host: HTMLElement;
    readonly limit?: number;
    readonly onClickEvent?: (eventId: string) => void;
}

export interface UpcomingEventsHandle {
    readonly root: HTMLElement;
    setEvents(
        events: ReadonlyArray<UpcomingEventItem>,
        calendar: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void;
    destroy(): void;
}

/**
 * Creates an upcoming events component with relative timestamps.
 *
 * Features:
 * - Relative time formatting ("Tomorrow", "In 3 days", "Next week")
 * - Priority-based sorting (high priority first, then chronological)
 * - Configurable limit (default 5)
 * - Click handlers for events (not phenomena)
 */
export function createUpcomingEvents(options: UpcomingEventsOptions): UpcomingEventsHandle {
    const { host, limit = 5, onClickEvent } = options;

    // Root container
    const root = host.createDiv({ cls: "sm-calendar-upcoming-events" });

    // Header (compact with divider line)
    const header = root.createDiv({ cls: "sm-calendar-upcoming-events__header" });
    const headerText = header.createSpan({ text: "UPCOMING (0)" });
    const headerLine = header.createDiv({ cls: "sm-calendar-upcoming-events__header-line" });

    // Event list container
    const listContainer = root.createEl("ul", { cls: "sm-calendar-upcoming-events__list" });

    /**
     * Formats a timestamp relative to the current timestamp.
     *
     * Examples:
     * - Same day: "Today at 14:30" or "Today"
     * - Next day: "Tomorrow at 09:00" or "Tomorrow"
     * - 2-6 days: "In 3 days at 18:00"
     * - 7-13 days: "Next week"
     * - 14+ days: Absolute date (e.g., "Year 1489, Day 15")
     */
    function formatRelativeTimestamp(
        timestamp: CalendarTimestamp,
        currentTimestamp: CalendarTimestamp,
        calendar: CalendarSchema,
    ): string {
        // Calculate day difference
        const currentDay = timestampToAbsoluteDay(calendar, currentTimestamp);
        const eventDay = timestampToAbsoluteDay(calendar, timestamp);
        const dayDiff = eventDay - currentDay;

        // Build time part (if timestamp has hour/minute precision)
        let timePart = "";
        if (timestamp.precision === "hour") {
            const hour = String(timestamp.hour ?? 0).padStart(2, "0");
            timePart = ` at ${hour}:00`;
        } else if (timestamp.precision === "minute") {
            const hour = String(timestamp.hour ?? 0).padStart(2, "0");
            const minute = String(timestamp.minute ?? 0).padStart(2, "0");
            timePart = ` at ${hour}:${minute}`;
        }

        // Format based on day difference
        if (dayDiff === 0) {
            return `Today${timePart}`;
        }
        if (dayDiff === 1) {
            return `Tomorrow${timePart}`;
        }
        if (dayDiff >= 2 && dayDiff <= 6) {
            return `In ${dayDiff} days${timePart}`;
        }
        if (dayDiff >= 7 && dayDiff <= 13) {
            return `Next week${timePart}`;
        }

        // Fallback to absolute date for far future events
        return formatTimestamp(timestamp);
    }

    /**
     * Renders an event item (very compact one-line format).
     * Format: "📅 Tomorrow • Event Title"
     */
    function renderEventItem(
        event: UpcomingEventItem,
        currentTimestamp: CalendarTimestamp,
        calendar: CalendarSchema,
    ): HTMLElement {
        const item = listContainer.createEl("li", { cls: "sm-calendar-upcoming-events__item" });

        // Icon based on kind (Obsidian icons instead of Unicode)
        const iconEl = item.createSpan({ cls: "sm-calendar-upcoming-events__icon" });
        setIcon(iconEl, event.kind === "event" ? "calendar" : "map-pin");

        // Relative timestamp
        const relativeTime = formatRelativeTimestamp(event.timestamp, currentTimestamp, calendar);

        // Content: "Tomorrow • Event Title"
        const content = item.createDiv({ cls: "sm-calendar-upcoming-events__content" });
        content.textContent = `${relativeTime} • ${event.title}`;

        // Click handler (only for events, not phenomena)
        if (event.kind === "event" && onClickEvent) {
            item.classList.add("is-clickable");
            item.addEventListener("click", () => {
                onClickEvent(event.id);
            });
        }

        return item;
    }

    // Public API
    return {
        root,
        setEvents(
            events: ReadonlyArray<UpcomingEventItem>,
            calendar: CalendarSchema | null,
            currentTimestamp: CalendarTimestamp | null,
        ): void {
            // Clear previous content
            listContainer.empty();

            // Handle null cases
            if (!calendar || !currentTimestamp || events.length === 0) {
                headerText.textContent = "UPCOMING (0)";
                const emptyItem = listContainer.createEl("li", {
                    cls: "sm-calendar-upcoming-events__empty",
                    text: "Keine kommenden Ereignisse",
                });
                return;
            }

            // Sort by priority (high to low) then by timestamp (early to late)
            const sorted = Array.from(events).sort((a, b) => {
                const priorityA = a.priority ?? 0;
                const priorityB = b.priority ?? 0;

                if (priorityA !== priorityB) {
                    return priorityB - priorityA; // Higher priority first
                }

                // Same priority: Sort by timestamp
                return compareTimestampsWithSchema(calendar, a.timestamp, b.timestamp);
            });

            // Apply limit
            const limited = sorted.slice(0, limit);

            // Update count
            headerText.textContent = `UPCOMING (${limited.length})`;

            // Render each event
            for (const event of limited) {
                renderEventItem(event, currentTimestamp, calendar);
            }
        },
        destroy(): void {
            root.empty();
        },
    };
}
