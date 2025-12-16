// src/workmodes/almanac/view/week-view-calendar.ts
// Week view calendar component - displays a 7-day horizontal layout with hourly slots

import { formatTimestamp, computeEventOccurrencesInRange, advanceTime } from "../helpers";
import { showEventContextMenu } from "./event-context-menu";
import { createInlineEditor } from "./inline-editor";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../helpers";

export interface WeekViewCalendarOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly onDayClick?: (timestamp: CalendarTimestamp) => void;
    readonly onEventClick?: (event: CalendarEvent) => void;
    readonly onEventSave?: (event: CalendarEvent) => Promise<void>;
    readonly onEventDelete?: (event: CalendarEvent) => void;
    readonly onEventDuplicate?: (event: CalendarEvent) => void;
}

export interface WeekViewCalendarHandle {
    readonly root: HTMLElement;
    update(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void;
    destroy(): void;
}

interface DayColumn {
    readonly timestamp: CalendarTimestamp;
    readonly isCurrentDay: boolean;
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
}

/**
 * Week View Calendar
 *
 * Displays a 7-day horizontal layout with hourly time slots.
 * Shows events positioned at their specific times within each day.
 * Ideal for detailed scheduling and hourly planning.
 */
export function createWeekViewCalendar(
    options: WeekViewCalendarOptions,
): WeekViewCalendarHandle {
    const root = document.createElement("div");
    root.classList.add("sm-almanac-week-view");

    const header = document.createElement("div");
    header.classList.add("sm-almanac-week-view__header");
    root.appendChild(header);

    const grid = document.createElement("div");
    grid.classList.add("sm-almanac-week-view__grid");
    root.appendChild(grid);

    function updateGrid(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void {
        header.replaceChildren();
        grid.replaceChildren();

        if (!schema || !currentTimestamp) {
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("sm-almanac-week-view__empty");
            emptyMessage.textContent = "No active calendar";
            grid.appendChild(emptyMessage);
            return;
        }

        // Calculate week range (current day + next 6 days)
        const weekDays: DayColumn[] = [];
        for (let i = 0; i < 7; i++) {
            const dayTimestamp = advanceTime(schema, currentTimestamp, i, "day").timestamp;
            const dayStart = { ...dayTimestamp, hour: 0, minute: 0 };
            const dayEnd = advanceTime(schema, dayStart, 1, "day").timestamp;

            const isCurrentDay = i === 0;

            // Find events for this day
            const dayEvents: CalendarEvent[] = [];
            for (const event of events) {
                const occurrences = computeEventOccurrencesInRange(
                    event,
                    schema,
                    event.calendarId,
                    dayStart,
                    dayEnd,
                    { includeStart: true, limit: 10 },
                );
                if (occurrences.length > 0) {
                    dayEvents.push(event);
                }
            }

            // Find phenomena for this day
            const dayPhenomena: PhenomenonOccurrence[] = [];
            for (const phenomenon of phenomena) {
                if (
                    phenomenon.timestamp.year === dayTimestamp.year &&
                    phenomenon.timestamp.monthId === dayTimestamp.monthId &&
                    phenomenon.timestamp.day === dayTimestamp.day
                ) {
                    dayPhenomena.push(phenomenon);
                }
            }

            weekDays.push({
                timestamp: dayTimestamp,
                isCurrentDay,
                events: dayEvents,
                phenomena: dayPhenomena,
            });
        }

        // Render header (Week Range)
        const weekStart = weekDays[0].timestamp;
        const weekEnd = weekDays[6].timestamp;
        const weekTitle = document.createElement("h3");
        weekTitle.classList.add("sm-almanac-week-view__week-title");
        weekTitle.textContent = `Week: ${formatTimestamp(weekStart)} - ${formatTimestamp(weekEnd)}`;
        header.appendChild(weekTitle);

        // Render time slots column (hours 0-23)
        const timeColumn = document.createElement("div");
        timeColumn.classList.add("sm-almanac-week-view__time-column");

        const timeHeader = document.createElement("div");
        timeHeader.classList.add("sm-almanac-week-view__time-header");
        timeHeader.textContent = "Time";
        timeColumn.appendChild(timeHeader);

        for (let hour = 0; hour < schema.hoursPerDay; hour++) {
            const timeSlot = document.createElement("div");
            timeSlot.classList.add("sm-almanac-week-view__time-slot");
            timeSlot.textContent = `${hour.toString().padStart(2, "0")}:00`;
            timeColumn.appendChild(timeSlot);
        }
        grid.appendChild(timeColumn);

        // Render day columns
        for (const dayColumn of weekDays) {
            const column = document.createElement("div");
            column.classList.add("sm-almanac-week-view__day-column");
            if (dayColumn.isCurrentDay) {
                column.classList.add("is-current-day");
            }

            // Day header
            const dayHeader = document.createElement("div");
            dayHeader.classList.add("sm-almanac-week-view__day-header");
            dayHeader.textContent = formatTimestamp(dayColumn.timestamp);
            dayHeader.addEventListener("click", () => {
                if (options.onDayClick) {
                    options.onDayClick(dayColumn.timestamp);
                }
            });
            column.appendChild(dayHeader);

            // Hour slots
            for (let hour = 0; hour < schema.hoursPerDay; hour++) {
                const slot = document.createElement("div");
                slot.classList.add("sm-almanac-week-view__hour-slot");

                // Find events at this hour
                const hourEvents = dayColumn.events.filter(event => {
                    // Check if event occurs at this hour
                    const occurrences = computeEventOccurrencesInRange(
                        event,
                        schema,
                        event.calendarId,
                        { ...dayColumn.timestamp, hour, minute: 0, precision: "minute" },
                        { ...dayColumn.timestamp, hour: hour + 1, minute: 0, precision: "minute" },
                        { includeStart: true, limit: 5 },
                    );
                    return occurrences.length > 0;
                });

                if (hourEvents.length > 0) {
                    slot.classList.add("has-events");

                    // Create individual event indicators (for search highlighting)
                    for (const event of hourEvents) {
                        const eventIndicator = document.createElement("div");
                        eventIndicator.classList.add("sm-almanac-week-view__event-indicator");
                        eventIndicator.setAttribute("data-event-id", event.id);
                        eventIndicator.textContent = event.title.substring(0, 20);
                        eventIndicator.title = event.title;

                        // Inline editing: Click-to-edit title
                        if (options.onEventSave) {
                            const inlineEditor = createInlineEditor(eventIndicator, {
                                onSave: async (newTitle: string) => {
                                    if (options.onEventSave) {
                                        const updatedEvent = { ...event, title: newTitle };
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
                            eventIndicator.addEventListener("click", (e) => {
                                e.stopPropagation();
                                inlineEditor.activate();
                            });
                        }

                        // Context menu: Right-click for actions
                        eventIndicator.addEventListener("contextmenu", (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            showEventContextMenu(e.clientX, e.clientY, {
                                event,
                                onEdit: () => {
                                    if (options.onEventClick) {
                                        options.onEventClick(event);
                                    }
                                },
                                onDuplicate: () => {
                                    if (options.onEventDuplicate) {
                                        options.onEventDuplicate(event);
                                    }
                                },
                                onChangePriority: async (priority: number) => {
                                    if (options.onEventSave) {
                                        const updatedEvent = { ...event, priority };
                                        await options.onEventSave(updatedEvent);
                                    }
                                },
                                onChangeCategory: async (category: string) => {
                                    if (options.onEventSave) {
                                        const updatedEvent = { ...event, category };
                                        await options.onEventSave(updatedEvent);
                                    }
                                },
                                onMarkAsRead: () => {
                                    // TODO: Implement mark as read functionality if needed
                                },
                                onDelete: () => {
                                    if (options.onEventDelete) {
                                        options.onEventDelete(event);
                                    }
                                },
                            });
                        });

                        // Double-click to edit full details
                        eventIndicator.addEventListener("dblclick", (e) => {
                            e.stopPropagation();
                            if (options.onEventClick) {
                                options.onEventClick(event);
                            }
                        });

                        slot.appendChild(eventIndicator);
                    }
                }

                column.appendChild(slot);
            }

            grid.appendChild(column);
        }
    }

    updateGrid(options.events, options.phenomena, options.schema, options.currentTimestamp);

    return {
        root,
        update: updateGrid,
        destroy: () => {
            root.replaceChildren();
        },
    };
}
