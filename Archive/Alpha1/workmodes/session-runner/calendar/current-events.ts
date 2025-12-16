// src/workmodes/session-runner/calendar/current-events.ts
// Current events component - displays events happening right now

import { setIcon } from "obsidian";
import { compareTimestampsWithSchema } from "@services/orchestration";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "@domain";

export interface CurrentEventsOptions {
    readonly host: HTMLElement;
    readonly onClickEvent?: (eventId: string) => void;
}

export interface CurrentEventsHandle {
    readonly root: HTMLElement;
    setEvents(events: ReadonlyArray<CalendarEvent>, calendar: CalendarSchema | null, currentTimestamp: CalendarTimestamp | null): void;
    destroy(): void;
}

/**
 * Creates a current events section.
 *
 * Shows events that are currently active (happening right now).
 *
 * For simplicity, "current" means:
 * - Events that occur on the same day as the current timestamp
 * - Optionally in future: Check startTime/endTime for precise duration matching
 */
export function createCurrentEvents(options: CurrentEventsOptions): CurrentEventsHandle {
    const { host, onClickEvent } = options;

    // Root container
    const root = host.createDiv({ cls: "sm-calendar-current-events" });

    // Header (compact with divider line)
    const header = root.createDiv({ cls: "sm-calendar-current-events__header" });
    const headerText = header.createSpan({ text: "NOW (0)" });
    const headerLine = header.createDiv({ cls: "sm-calendar-current-events__header-line" });

    // Event list container
    const listContainer = root.createDiv({ cls: "sm-calendar-current-events__list" });

    /**
     * Filters events to find those currently active.
     *
     * Currently: Events that occur on the same day as currentTimestamp.
     */
    function filterCurrentEvents(
        events: ReadonlyArray<CalendarEvent>,
        calendar: CalendarSchema,
        currentTimestamp: CalendarTimestamp,
    ): CalendarEvent[] {
        return events.filter(event => {
            // Compare date part only (ignore time for now)
            const isSameYear = event.date.year === currentTimestamp.year;
            const isSameMonth = event.date.monthId === currentTimestamp.monthId;
            const isSameDay = event.date.day === currentTimestamp.day;

            return isSameYear && isSameMonth && isSameDay;
        });
    }

    /**
     * Calculates a relative end time message for an event.
     *
     * For events with endTime, shows "until HH:MM".
     * For all-day events, shows "until end of day".
     */
    function getEndTimeMessage(event: CalendarEvent, currentTimestamp: CalendarTimestamp): string {
        if (event.kind === "single" && event.endTime) {
            const hour = String(event.endTime.hour).padStart(2, "0");
            const minute = String(event.endTime.minute).padStart(2, "0");
            return `until ${hour}:${minute}`;
        }

        if (event.allDay) {
            return "until end of day";
        }

        // No specific end time
        return "ongoing";
    }

    /**
     * Renders an event item (compact one-line format).
     * Format: "🔵 Event Title • until 15:00"
     */
    function renderEventItem(event: CalendarEvent, currentTimestamp: CalendarTimestamp): HTMLElement {
        const item = listContainer.createDiv({ cls: "sm-calendar-current-events__item" });

        // Indicator icon (Obsidian icon instead of colored dot)
        const indicator = item.createDiv({ cls: "sm-calendar-current-events__indicator" });
        setIcon(indicator, "circle-dot");

        // End time message
        const endMessage = getEndTimeMessage(event, currentTimestamp);

        // Content: "Event Title • until 15:00"
        const content = item.createDiv({ cls: "sm-calendar-current-events__content" });
        content.textContent = `${event.title} • ${endMessage}`;

        // Click handler
        if (onClickEvent) {
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
            events: ReadonlyArray<CalendarEvent>,
            calendar: CalendarSchema | null,
            currentTimestamp: CalendarTimestamp | null,
        ): void {
            // Clear previous content
            listContainer.empty();

            // Handle null cases
            if (!calendar || !currentTimestamp || events.length === 0) {
                headerText.textContent = "NOW (0)";
                const emptyState = listContainer.createDiv({
                    cls: "sm-calendar-current-events__empty",
                    text: "Keine laufenden Ereignisse",
                });
                return;
            }

            // Filter to current events
            const currentEvents = filterCurrentEvents(events, calendar, currentTimestamp);

            // Update count
            headerText.textContent = `NOW (${currentEvents.length})`;

            // Render events or empty state
            if (currentEvents.length === 0) {
                const emptyState = listContainer.createDiv({
                    cls: "sm-calendar-current-events__empty",
                    text: "Keine laufenden Ereignisse",
                });
            } else {
                // Sort by priority (high to low) then by time
                const sorted = Array.from(currentEvents).sort((a, b) => {
                    const priorityA = a.priority ?? 0;
                    const priorityB = b.priority ?? 0;
                    if (priorityA !== priorityB) {
                        return priorityB - priorityA; // Higher priority first
                    }

                    // Same priority: Sort by time
                    if (calendar) {
                        return compareTimestampsWithSchema(calendar, a.date, b.date);
                    }
                    return 0;
                });

                // Render each event
                for (const event of sorted) {
                    renderEventItem(event, currentTimestamp);
                }
            }
        },
        destroy(): void {
            root.empty();
        },
    };
}
