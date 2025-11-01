// src/workmodes/almanac/view/upcoming-events-list.ts
// Upcoming events list component for Almanac MVP - displays next 7 days of events

import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../domain";
import { formatTimestamp, computeNextEventOccurrence, computeEventOccurrencesInRange, advanceTime } from "../domain";

export interface UpcomingEventsListOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly onEventClick?: (event: CalendarEvent) => void;
}

export interface UpcomingEventsListHandle {
    readonly root: HTMLElement;
    update(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void;
    destroy(): void;
}

interface DisplayOccurrence {
    readonly type: "event" | "phenomenon";
    readonly timestamp: CalendarTimestamp;
    readonly title: string;
    readonly category?: string;
    readonly id: string;
    readonly source?: CalendarEvent;
}

/**
 * Upcoming Events List
 *
 * Displays upcoming calendar events and phenomena for the next 7 days.
 * Used in Almanac MVP to show what's coming up without complex calendar grid.
 */
export function createUpcomingEventsList(
    options: UpcomingEventsListOptions,
): UpcomingEventsListHandle {
    const root = document.createElement("div");
    root.classList.add("sm-almanac-upcoming-events");

    const header = document.createElement("div");
    header.classList.add("sm-almanac-upcoming-events__header");
    header.textContent = "Upcoming Events (Next 7 Days)";
    root.appendChild(header);

    const list = document.createElement("ul");
    list.classList.add("sm-almanac-upcoming-events__list");
    root.appendChild(list);

    function updateList(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void {
        list.replaceChildren();

        if (!schema || !currentTimestamp) {
            const emptyItem = document.createElement("li");
            emptyItem.classList.add("sm-almanac-upcoming-events__item", "is-empty");
            emptyItem.textContent = "No active calendar";
            list.appendChild(emptyItem);
            return;
        }

        // Calculate range: current time to 7 days ahead
        const rangeEnd = advanceTime(schema, currentTimestamp, 7, "day").timestamp;

        // Collect all occurrences in range
        const occurrences: DisplayOccurrence[] = [];

        // Add event occurrences
        for (const event of events) {
            const eventOccurrences = computeEventOccurrencesInRange(
                event,
                schema,
                event.calendarId,
                currentTimestamp,
                rangeEnd,
                { includeStart: true, limit: 10 },
            );

            for (const occurrence of eventOccurrences) {
                occurrences.push({
                    type: "event",
                    timestamp: occurrence.start,
                    title: occurrence.title,
                    category: occurrence.category,
                    id: occurrence.eventId,
                    source: event,
                });
            }
        }

        // Add phenomenon occurrences
        for (const phenomenon of phenomena) {
            occurrences.push({
                type: "phenomenon",
                timestamp: phenomenon.timestamp,
                title: phenomenon.name,
                category: phenomenon.category,
                id: phenomenon.phenomenonId,
            });
        }

        // Sort by timestamp
        occurrences.sort((a, b) => {
            const timestampA = a.timestamp;
            const timestampB = b.timestamp;

            if (timestampA.year !== timestampB.year) {
                return timestampA.year - timestampB.year;
            }
            const monthA = schema.months.findIndex(m => m.id === timestampA.monthId);
            const monthB = schema.months.findIndex(m => m.id === timestampB.monthId);
            if (monthA !== monthB) {
                return monthA - monthB;
            }
            if (timestampA.day !== timestampB.day) {
                return timestampA.day - timestampB.day;
            }
            const hourA = timestampA.hour ?? 0;
            const hourB = timestampB.hour ?? 0;
            if (hourA !== hourB) {
                return hourA - hourB;
            }
            const minuteA = timestampA.minute ?? 0;
            const minuteB = timestampB.minute ?? 0;
            return minuteA - minuteB;
        });

        if (occurrences.length === 0) {
            const emptyItem = document.createElement("li");
            emptyItem.classList.add("sm-almanac-upcoming-events__item", "is-empty");
            emptyItem.textContent = "No upcoming events";
            list.appendChild(emptyItem);
            return;
        }

        for (const occurrence of occurrences) {
            const item = document.createElement("li");
            item.classList.add("sm-almanac-upcoming-events__item");
            item.dataset.type = occurrence.type;
            if (occurrence.category) {
                item.dataset.category = occurrence.category;
            }

            const monthName = schema.months.find(m => m.id === occurrence.timestamp.monthId)?.name;
            const timestampText = formatTimestamp(occurrence.timestamp, monthName);

            const timestampSpan = document.createElement("span");
            timestampSpan.classList.add("sm-almanac-upcoming-events__timestamp");
            timestampSpan.textContent = timestampText;
            item.appendChild(timestampSpan);

            const titleSpan = document.createElement("span");
            titleSpan.classList.add("sm-almanac-upcoming-events__title");
            titleSpan.textContent = occurrence.title;
            item.appendChild(titleSpan);

            const typeSpan = document.createElement("span");
            typeSpan.classList.add("sm-almanac-upcoming-events__type");
            typeSpan.textContent = occurrence.type === "event" ? "Event" : "Phenomenon";
            item.appendChild(typeSpan);

            if (occurrence.type === "event" && occurrence.source && options.onEventClick) {
                item.classList.add("is-clickable");
                item.addEventListener("click", () => {
                    if (occurrence.source) {
                        options.onEventClick?.(occurrence.source);
                    }
                });
            }

            list.appendChild(item);
        }
    }

    updateList(options.events, options.phenomena, options.schema, options.currentTimestamp);

    return {
        root,
        update: updateList,
        destroy() {
            list.replaceChildren();
            root.replaceChildren();
        },
    };
}
