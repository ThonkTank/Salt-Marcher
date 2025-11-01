// src/workmodes/almanac/view/timeline-view-calendar.ts
// Timeline view calendar component - chronological list with date separators

import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../domain";
import { formatTimestamp, computeEventOccurrencesInRange, advanceTime } from "../domain";

export interface TimelineViewCalendarOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly daysAhead?: number; // How many days to show (default: 30)
    readonly onEventClick?: (event: CalendarEvent) => void;
}

export interface TimelineViewCalendarHandle {
    readonly root: HTMLElement;
    update(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void;
    destroy(): void;
}

interface TimelineEntry {
    readonly timestamp: CalendarTimestamp;
    readonly type: "event" | "phenomenon";
    readonly item: CalendarEvent | PhenomenonOccurrence;
}

interface DayGroup {
    readonly date: string;
    readonly timestamp: CalendarTimestamp;
    readonly isToday: boolean;
    readonly entries: TimelineEntry[];
}

/**
 * Timeline View Calendar
 *
 * Displays events and phenomena in a chronological timeline format.
 * Groups items by day with clear date separators.
 * Shows full event details in a scrollable list.
 * Ideal for reviewing schedules and planning ahead.
 */
export function createTimelineViewCalendar(
    options: TimelineViewCalendarOptions,
): TimelineViewCalendarHandle {
    const root = document.createElement("div");
    root.classList.add("sm-almanac-timeline-view");

    const header = document.createElement("div");
    header.classList.add("sm-almanac-timeline-view__header");
    root.appendChild(header);

    const timeline = document.createElement("div");
    timeline.classList.add("sm-almanac-timeline-view__timeline");
    root.appendChild(timeline);

    function updateTimeline(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void {
        header.replaceChildren();
        timeline.replaceChildren();

        if (!schema || !currentTimestamp) {
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("sm-almanac-timeline-view__empty");
            emptyMessage.textContent = "No active calendar";
            timeline.appendChild(emptyMessage);
            return;
        }

        // Render header
        const timelineTitle = document.createElement("h3");
        timelineTitle.classList.add("sm-almanac-timeline-view__title");
        const daysAhead = options.daysAhead ?? 30;
        timelineTitle.textContent = `Timeline (Next ${daysAhead} days)`;
        header.appendChild(timelineTitle);

        // Calculate range
        const rangeStart = currentTimestamp;
        const rangeEnd = advanceTime(schema, currentTimestamp, daysAhead, "day").timestamp;

        // Collect all timeline entries
        const timelineEntries: TimelineEntry[] = [];

        // Add events
        for (const event of events) {
            const occurrences = computeEventOccurrencesInRange(
                event,
                schema,
                event.calendarId,
                rangeStart,
                rangeEnd,
                { includeStart: true, limit: 100 },
            );
            for (const occurrence of occurrences) {
                timelineEntries.push({
                    timestamp: occurrence.timestamp,
                    type: "event",
                    item: event,
                });
            }
        }

        // Add phenomena
        for (const phenomenon of phenomena) {
            // Check if phenomenon falls within range
            const phenTimestamp = phenomenon.timestamp;
            if (
                compareTimestamps(phenTimestamp, rangeStart) >= 0 &&
                compareTimestamps(phenTimestamp, rangeEnd) < 0
            ) {
                timelineEntries.push({
                    timestamp: phenTimestamp,
                    type: "phenomenon",
                    item: phenomenon,
                });
            }
        }

        // Sort entries by timestamp
        timelineEntries.sort((a, b) => compareTimestamps(a.timestamp, b.timestamp));

        // Group entries by day
        const dayGroups: DayGroup[] = [];
        const dayMap = new Map<string, TimelineEntry[]>();

        for (const entry of timelineEntries) {
            const dateKey = `${entry.timestamp.year}-${entry.timestamp.monthId}-${entry.timestamp.day}`;
            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, []);
            }
            dayMap.get(dateKey)!.push(entry);
        }

        for (const [dateKey, entries] of dayMap.entries()) {
            const firstEntry = entries[0];
            const isToday =
                firstEntry.timestamp.year === currentTimestamp.year &&
                firstEntry.timestamp.monthId === currentTimestamp.monthId &&
                firstEntry.timestamp.day === currentTimestamp.day;

            dayGroups.push({
                date: dateKey,
                timestamp: firstEntry.timestamp,
                isToday,
                entries,
            });
        }

        // Render day groups
        if (dayGroups.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("sm-almanac-timeline-view__empty");
            emptyMessage.textContent = `No events or phenomena in the next ${daysAhead} days`;
            timeline.appendChild(emptyMessage);
            return;
        }

        for (const dayGroup of dayGroups) {
            const daySection = document.createElement("div");
            daySection.classList.add("sm-almanac-timeline-view__day-section");
            if (dayGroup.isToday) {
                daySection.classList.add("is-today");
            }

            // Day header
            const dayHeader = document.createElement("div");
            dayHeader.classList.add("sm-almanac-timeline-view__day-header");
            dayHeader.textContent = formatTimestamp(dayGroup.timestamp);
            daySection.appendChild(dayHeader);

            // Entries
            for (const entry of dayGroup.entries) {
                const entryEl = document.createElement("div");
                entryEl.classList.add("sm-almanac-timeline-view__entry");
                entryEl.classList.add(`is-${entry.type}`);

                const timeLabel = document.createElement("div");
                timeLabel.classList.add("sm-almanac-timeline-view__entry-time");
                timeLabel.textContent = `${entry.timestamp.hour.toString().padStart(2, "0")}:${entry.timestamp.minute.toString().padStart(2, "0")}`;
                entryEl.appendChild(timeLabel);

                const content = document.createElement("div");
                content.classList.add("sm-almanac-timeline-view__entry-content");

                if (entry.type === "event") {
                    const event = entry.item as CalendarEvent;
                    const title = document.createElement("div");
                    title.classList.add("sm-almanac-timeline-view__entry-title");
                    title.textContent = event.title;
                    content.appendChild(title);

                    if (event.description) {
                        const description = document.createElement("div");
                        description.classList.add("sm-almanac-timeline-view__entry-description");
                        description.textContent = event.description;
                        content.appendChild(description);
                    }

                    entryEl.addEventListener("click", () => {
                        if (options.onEventClick) {
                            options.onEventClick(event);
                        }
                    });
                } else {
                    const phenomenon = entry.item as PhenomenonOccurrence;
                    const title = document.createElement("div");
                    title.classList.add("sm-almanac-timeline-view__entry-title");
                    title.textContent = phenomenon.name;
                    content.appendChild(title);

                    const type = document.createElement("div");
                    type.classList.add("sm-almanac-timeline-view__entry-type");
                    type.textContent = phenomenon.type;
                    content.appendChild(type);
                }

                entryEl.appendChild(content);
                daySection.appendChild(entryEl);
            }

            timeline.appendChild(daySection);
        }
    }

    updateTimeline(options.events, options.phenomena, options.schema, options.currentTimestamp);

    return {
        root,
        update: updateTimeline,
        destroy: () => {
            root.replaceChildren();
        },
    };
}

/**
 * Compare two timestamps for ordering
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareTimestamps(a: CalendarTimestamp, b: CalendarTimestamp): number {
    if (a.year !== b.year) return a.year - b.year;
    if (a.monthId !== b.monthId) return a.monthId.localeCompare(b.monthId);
    if (a.day !== b.day) return a.day - b.day;
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
}
