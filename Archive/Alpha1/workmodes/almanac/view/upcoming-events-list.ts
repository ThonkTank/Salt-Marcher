// src/workmodes/almanac/view/upcoming-events-list.ts
// Upcoming events list component for Almanac MVP - displays next 7 days of events

import { formatTimestamp, computeEventOccurrencesInRange, advanceTime, timestampToAbsoluteDay } from "../helpers";
import { showEventContextMenu } from "./event-context-menu";
import { createInlineEditor } from "./inline-editor";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../helpers";

export interface UpcomingEventsListOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly onEventClick?: (event: CalendarEvent) => void;
    readonly onEventSave?: (event: CalendarEvent) => Promise<void>;
    readonly onEventDelete?: (event: CalendarEvent) => void;
    readonly onEventDuplicate?: (event: CalendarEvent) => void;
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
 * Format relative time difference between current time and event time (LOW #41)
 * Returns German strings like "Heute", "Morgen", "In 3 Tagen", "Vor 2 Tagen"
 */
function formatRelativeTime(
    schema: CalendarSchema,
    currentTimestamp: CalendarTimestamp,
    eventTimestamp: CalendarTimestamp
): string {
    const currentDay = timestampToAbsoluteDay(schema, currentTimestamp);
    const eventDay = timestampToAbsoluteDay(schema, eventTimestamp);
    const dayDiff = eventDay - currentDay;

    // Same day
    if (dayDiff === 0) {
        // Check if it's in the future or past (hour comparison)
        const currentHour = currentTimestamp.hour ?? 0;
        const eventHour = eventTimestamp.hour ?? 0;
        const hourDiff = eventHour - currentHour;

        if (hourDiff > 0) {
            return `Heute (in ${hourDiff} Std.)`;
        } else if (hourDiff < -1) {
            return `Heute (vor ${Math.abs(hourDiff)} Std.)`;
        } else {
            return "Heute";
        }
    }

    // Tomorrow
    if (dayDiff === 1) {
        return "Morgen";
    }

    // Yesterday
    if (dayDiff === -1) {
        return "Gestern";
    }

    // Future (2-6 days)
    if (dayDiff > 1 && dayDiff <= 6) {
        return `In ${dayDiff} Tagen`;
    }

    // Future (7+ days, show weeks)
    if (dayDiff >= 7 && dayDiff < 14) {
        return "In 1 Woche";
    }
    if (dayDiff >= 14) {
        const weeks = Math.floor(dayDiff / 7);
        return `In ${weeks} Wochen`;
    }

    // Past (2+ days ago)
    if (dayDiff < -1) {
        return `Vor ${Math.abs(dayDiff)} Tagen`;
    }

    return ""; // Fallback (should not occur)
}

/**
 * Format day header for grouping (LOW #42)
 * Returns German strings like "Heute - Montag, 15. Kalisar 1024"
 */
function formatDayHeader(
    schema: CalendarSchema,
    currentTimestamp: CalendarTimestamp,
    dayTimestamp: CalendarTimestamp
): string {
    const currentDay = timestampToAbsoluteDay(schema, currentTimestamp);
    const targetDay = timestampToAbsoluteDay(schema, dayTimestamp);
    const dayDiff = targetDay - currentDay;

    // Get relative day name
    let relativeName = "";
    if (dayDiff === 0) {
        relativeName = "Heute";
    } else if (dayDiff === 1) {
        relativeName = "Morgen";
    } else if (dayDiff === -1) {
        relativeName = "Gestern";
    } else if (dayDiff > 1 && dayDiff <= 6) {
        relativeName = `In ${dayDiff} Tagen`;
    } else if (dayDiff >= 7) {
        const weeks = Math.floor(dayDiff / 7);
        relativeName = weeks === 1 ? "In 1 Woche" : `In ${weeks} Wochen`;
    } else if (dayDiff < -1) {
        relativeName = `Vor ${Math.abs(dayDiff)} Tagen`;
    }

    // Get absolute date (without time)
    const monthName = schema.months.find(m => m.id === dayTimestamp.monthId)?.name ?? dayTimestamp.monthId;
    const absoluteDate = `${dayTimestamp.day}. ${monthName} ${dayTimestamp.year}`;

    return relativeName ? `${relativeName} · ${absoluteDate}` : absoluteDate;
}

/**
 * Upcoming Events List
 *
 * Displays upcoming calendar events and phenomena for the next 7 days.
 * Used in Almanac MVP to show what's coming up without complex calendar grid.
 *
 * LOW #41: Shows relative time context ("In 2 Tagen", "Morgen", "Heute")
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

        // LOW #42: Group events by day with visual headers
        let previousAbsoluteDay: number | null = null;

        for (const occurrence of occurrences) {
            const currentAbsoluteDay = timestampToAbsoluteDay(schema, occurrence.timestamp);

            // Insert day header if day changed
            if (previousAbsoluteDay === null || currentAbsoluteDay !== previousAbsoluteDay) {
                const dayHeader = document.createElement("div");
                dayHeader.classList.add("sm-almanac-upcoming-events__day-header");
                dayHeader.textContent = formatDayHeader(schema, currentTimestamp, occurrence.timestamp);
                list.appendChild(dayHeader);
                previousAbsoluteDay = currentAbsoluteDay;
            }
            const item = document.createElement("li");
            item.classList.add("sm-almanac-upcoming-events__item");
            item.dataset.type = occurrence.type;
            if (occurrence.category) {
                item.dataset.category = occurrence.category;
            }

            // Add data attribute for search highlighting
            if (occurrence.type === "event") {
                item.setAttribute("data-event-id", occurrence.id);
            } else {
                item.setAttribute("data-phenomenon-id", occurrence.id);
            }

            // LOW #41: Show relative time prominently with absolute time as secondary info
            const monthName = schema.months.find(m => m.id === occurrence.timestamp.monthId)?.name;
            const relativeTimeText = formatRelativeTime(schema, currentTimestamp, occurrence.timestamp);
            const absoluteTimeText = formatTimestamp(occurrence.timestamp, monthName);

            // Container for time information
            const timeContainer = document.createElement("div");
            timeContainer.classList.add("sm-almanac-upcoming-events__time");

            // Relative time (prominent)
            const relativeTimeSpan = document.createElement("span");
            relativeTimeSpan.classList.add("sm-almanac-upcoming-events__relative-time");
            relativeTimeSpan.textContent = relativeTimeText;
            timeContainer.appendChild(relativeTimeSpan);

            // Absolute time (secondary, smaller text)
            const absoluteTimeSpan = document.createElement("span");
            absoluteTimeSpan.classList.add("sm-almanac-upcoming-events__absolute-time");
            absoluteTimeSpan.textContent = absoluteTimeText;
            timeContainer.appendChild(absoluteTimeSpan);

            item.appendChild(timeContainer);

            const titleSpan = document.createElement("span");
            titleSpan.classList.add("sm-almanac-upcoming-events__title");
            titleSpan.textContent = occurrence.title;
            item.appendChild(titleSpan);

            const typeSpan = document.createElement("span");
            typeSpan.classList.add("sm-almanac-upcoming-events__type");
            typeSpan.textContent = occurrence.type === "event" ? "Event" : "Phenomenon";
            item.appendChild(typeSpan);

            if (occurrence.type === "event" && occurrence.source) {
                // Inline editing: Click-to-edit title
                if (options.onEventSave) {
                    const inlineEditor = createInlineEditor(titleSpan, {
                        onSave: async (newTitle: string) => {
                            if (occurrence.source && options.onEventSave) {
                                const updatedEvent = { ...occurrence.source, title: newTitle };
                                await options.onEventSave(updatedEvent);
                            }
                        },
                        validate: (value: string) => {
                            if (!value.trim()) {
                                return "Title cannot be empty";
                            }
                            return null;
                        },
                    });

                    // Activate on click
                    titleSpan.addEventListener("click", (e) => {
                        e.stopPropagation();
                        inlineEditor.activate();
                    });
                }

                // Context menu: Right-click for actions
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!occurrence.source) return;

                    showEventContextMenu(e.clientX, e.clientY, {
                        event: occurrence.source,
                        onEdit: () => {
                            if (occurrence.source && options.onEventClick) {
                                options.onEventClick(occurrence.source);
                            }
                        },
                        onDuplicate: () => {
                            if (occurrence.source && options.onEventDuplicate) {
                                options.onEventDuplicate(occurrence.source);
                            }
                        },
                        onChangePriority: async (priority: number) => {
                            if (occurrence.source && options.onEventSave) {
                                const updatedEvent = { ...occurrence.source, priority };
                                await options.onEventSave(updatedEvent);
                            }
                        },
                        onChangeCategory: async (category: string) => {
                            if (occurrence.source && options.onEventSave) {
                                const updatedEvent = { ...occurrence.source, category };
                                await options.onEventSave(updatedEvent);
                            }
                        },
                        onMarkAsRead: () => {
                            // TODO: Implement mark as read functionality if needed
                        },
                        onDelete: () => {
                            if (occurrence.source && options.onEventDelete) {
                                options.onEventDelete(occurrence.source);
                            }
                        },
                    });
                });

                // Clickable item (double-click to edit)
                if (options.onEventClick) {
                    item.classList.add("is-clickable");
                    item.addEventListener("dblclick", () => {
                        if (occurrence.source) {
                            options.onEventClick?.(occurrence.source);
                        }
                    });
                }
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
