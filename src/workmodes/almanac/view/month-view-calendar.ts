// src/workmodes/almanac/view/month-view-calendar.ts
// Month view calendar grid component - displays a month grid with events

import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../domain";
import { formatTimestamp, computeEventOccurrencesInRange, advanceTime } from "../domain";

export interface MonthViewCalendarOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly onDayClick?: (timestamp: CalendarTimestamp) => void;
    readonly onEventClick?: (event: CalendarEvent) => void;
}

export interface MonthViewCalendarHandle {
    readonly root: HTMLElement;
    update(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        currentTimestamp: CalendarTimestamp | null,
    ): void;
    destroy(): void;
}

interface DayCell {
    readonly day: number;
    readonly isCurrentDay: boolean;
    readonly isOtherMonth: boolean;
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
}

/**
 * Month View Calendar
 *
 * Displays a calendar grid for a single month with event indicators.
 * Shows day cells in a week-based grid with visual event markers.
 */
export function createMonthViewCalendar(
    options: MonthViewCalendarOptions,
): MonthViewCalendarHandle {
    const root = document.createElement("div");
    root.classList.add("sm-almanac-month-view");

    const header = document.createElement("div");
    header.classList.add("sm-almanac-month-view__header");
    root.appendChild(header);

    const grid = document.createElement("div");
    grid.classList.add("sm-almanac-month-view__grid");
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
            emptyMessage.classList.add("sm-almanac-month-view__empty");
            emptyMessage.textContent = "No active calendar";
            grid.appendChild(emptyMessage);
            return;
        }

        // Render header (Month Year)
        const currentMonth = schema.months.find(m => m.id === currentTimestamp.monthId);
        if (!currentMonth) {
            const errorMessage = document.createElement("div");
            errorMessage.classList.add("sm-almanac-month-view__error");
            errorMessage.textContent = "Invalid month ID";
            grid.appendChild(errorMessage);
            return;
        }

        const monthYearTitle = document.createElement("h3");
        monthYearTitle.classList.add("sm-almanac-month-view__month-title");
        monthYearTitle.textContent = `${currentMonth.name} ${currentTimestamp.year}`;
        header.appendChild(monthYearTitle);

        // Render weekday headers
        const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const weekdayHeader = document.createElement("div");
        weekdayHeader.classList.add("sm-almanac-month-view__weekday-header");
        for (const weekday of weekdayNames) {
            const weekdayCell = document.createElement("div");
            weekdayCell.classList.add("sm-almanac-month-view__weekday");
            weekdayCell.textContent = weekday;
            weekdayHeader.appendChild(weekdayCell);
        }
        grid.appendChild(weekdayHeader);

        // Calculate day cells
        const dayCells: DayCell[] = [];
        const monthLength = currentMonth.length;

        // Determine first day of month (weekday)
        // For MVP, assume month starts on Monday (weekday 0)
        // In future, calculate actual weekday based on calendar math
        const firstWeekday = 0; // Monday

        // Add padding days from previous month if needed
        for (let i = 0; i < firstWeekday; i++) {
            dayCells.push({
                day: 0,
                isCurrentDay: false,
                isOtherMonth: true,
                events: [],
                phenomena: [],
            });
        }

        // Add days of current month
        for (let day = 1; day <= monthLength; day++) {
            const dayTimestamp: CalendarTimestamp = {
                calendarId: currentTimestamp.calendarId,
                year: currentTimestamp.year,
                monthId: currentTimestamp.monthId,
                day,
                hour: 0,
                minute: 0,
                precision: "minute",
            };

            const isCurrentDay = day === currentTimestamp.day;

            // Find events for this day
            const dayStart = dayTimestamp;
            const dayEnd = advanceTime(schema, dayTimestamp, 1, "day").timestamp;
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
            const dayPhenomena = phenomena.filter(p => {
                const ts = p.timestamp;
                return ts.year === currentTimestamp.year &&
                    ts.monthId === currentTimestamp.monthId &&
                    ts.day === day;
            });

            dayCells.push({
                day,
                isCurrentDay,
                isOtherMonth: false,
                events: dayEvents,
                phenomena: dayPhenomena,
            });
        }

        // Add padding days from next month
        const remainingCells = 7 - (dayCells.length % 7);
        if (remainingCells < 7) {
            for (let i = 0; i < remainingCells; i++) {
                dayCells.push({
                    day: 0,
                    isCurrentDay: false,
                    isOtherMonth: true,
                    events: [],
                    phenomena: [],
                });
            }
        }

        // Render day cells
        for (const cell of dayCells) {
            const dayCell = document.createElement("div");
            dayCell.classList.add("sm-almanac-month-view__day");

            if (cell.isOtherMonth) {
                dayCell.classList.add("is-other-month");
            } else {
                if (cell.isCurrentDay) {
                    dayCell.classList.add("is-current-day");
                }

                const dayNumber = document.createElement("div");
                dayNumber.classList.add("sm-almanac-month-view__day-number");
                dayNumber.textContent = String(cell.day);
                dayCell.appendChild(dayNumber);

                // Event indicators
                if (cell.events.length > 0 || cell.phenomena.length > 0) {
                    const indicators = document.createElement("div");
                    indicators.classList.add("sm-almanac-month-view__event-indicators");

                    const totalCount = cell.events.length + cell.phenomena.length;
                    const indicator = document.createElement("div");
                    indicator.classList.add("sm-almanac-month-view__event-indicator");
                    indicator.textContent = String(totalCount);
                    indicator.title = `${cell.events.length} event(s), ${cell.phenomena.length} phenomenon(a)`;
                    indicators.appendChild(indicator);

                    dayCell.appendChild(indicators);
                }

                // Click handler
                if (options.onDayClick) {
                    dayCell.classList.add("is-clickable");
                    const dayTimestamp: CalendarTimestamp = {
                        calendarId: currentTimestamp.calendarId,
                        year: currentTimestamp.year,
                        monthId: currentTimestamp.monthId,
                        day: cell.day,
                        hour: currentTimestamp.hour ?? 0,
                        minute: currentTimestamp.minute ?? 0,
                        precision: "minute",
                    };
                    dayCell.addEventListener("click", () => {
                        options.onDayClick?.(dayTimestamp);
                    });
                }
            }

            grid.appendChild(dayCell);
        }
    }

    updateGrid(options.events, options.phenomena, options.schema, options.currentTimestamp);

    return {
        root,
        update: updateGrid,
        destroy() {
            grid.replaceChildren();
            header.replaceChildren();
            root.replaceChildren();
        },
    };
}
