// src/workmodes/almanac/view/month-view-calendar.ts
// Month view calendar grid component - displays a month grid with events

import {
    computeEventOccurrencesInRange,
    advanceTime,
    getWeekdayForTimestamp,
    getMonthById,
    getMonthIndex,
    getDayOfYear,
} from "../helpers";
import { DefaultAstronomicalCalculator } from "../helpers/astronomical-calculator";
import { showEventContextMenu } from "./event-context-menu";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence, MoonPhase } from "../helpers";

// Icon mappings for day cell decorations
const MOON_PHASE_ICONS: Record<string, string> = {
    new_moon: '🌑',
    waxing_crescent: '🌒',
    first_quarter: '🌓',
    waxing_gibbous: '🌔',
    full_moon: '🌕',
    waning_gibbous: '🌖',
    last_quarter: '🌗',
    waning_crescent: '🌘',
};

const SEASON_TRANSITIONS = [
    { day: 80, name: 'Frühlingsanfang', icon: '🌸' },   // Spring
    { day: 172, name: 'Sommeranfang', icon: '☀️' },     // Summer
    { day: 266, name: 'Herbstanfang', icon: '🍂' },     // Autumn
    { day: 355, name: 'Winteranfang', icon: '❄️' },     // Winter
];

export interface MonthViewCalendarOptions {
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly phenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly schema: CalendarSchema | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly onDayClick?: (timestamp: CalendarTimestamp) => void;
    readonly onEventClick?: (event: CalendarEvent) => void;
    readonly onMonthNavigate?: (year: number, monthId: string) => void;
    readonly onEventSave?: (event: CalendarEvent) => Promise<void>;
    readonly onEventDelete?: (event: CalendarEvent) => void;
    readonly onEventDuplicate?: (event: CalendarEvent) => void;
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
    readonly moonPhase?: MoonPhase;
    readonly seasonTransitionIcon?: string;
    readonly seasonTransitionName?: string;
}

interface MonthViewState {
    displayYear: number;
    displayMonthId: string;
    followCurrentMonth: boolean;
}

/**
 * Month View Calendar
 *
 * Displays a calendar grid for a single month with event indicators.
 * Shows day cells in a week-based grid with visual event markers.
 * Includes navigation to browse different months.
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

    // Initialize astronomical calculator for moon phases and seasonal transitions
    const astronomicalCalculator = new DefaultAstronomicalCalculator();

    // Initialize state with current timestamp
    const state: MonthViewState = {
        displayYear: options.currentTimestamp?.year ?? 1,
        displayMonthId: options.currentTimestamp?.monthId ?? "",
        followCurrentMonth: true,
    };

    let currentSchema: CalendarSchema | null = options.schema;
    let currentTimestamp: CalendarTimestamp | null = options.currentTimestamp;
    let currentEvents: ReadonlyArray<CalendarEvent> = options.events;
    let currentPhenomena: ReadonlyArray<PhenomenonOccurrence> = options.phenomena;

    function navigatePrevMonth(): void {
        if (!currentSchema) return;

        state.followCurrentMonth = false;
        const monthIndex = getMonthIndex(currentSchema, state.displayMonthId);

        if (monthIndex > 0) {
            // Move to previous month in same year
            state.displayMonthId = currentSchema.months[monthIndex - 1].id;
        } else {
            // Wrap to last month of previous year
            state.displayYear--;
            state.displayMonthId = currentSchema.months[currentSchema.months.length - 1].id;
        }

        updateGrid(currentEvents, currentPhenomena, currentSchema, currentTimestamp);
        options.onMonthNavigate?.(state.displayYear, state.displayMonthId);
    }

    function navigateNextMonth(): void {
        if (!currentSchema) return;

        state.followCurrentMonth = false;
        const monthIndex = getMonthIndex(currentSchema, state.displayMonthId);

        if (monthIndex < currentSchema.months.length - 1) {
            // Move to next month in same year
            state.displayMonthId = currentSchema.months[monthIndex + 1].id;
        } else {
            // Wrap to first month of next year
            state.displayYear++;
            state.displayMonthId = currentSchema.months[0].id;
        }

        updateGrid(currentEvents, currentPhenomena, currentSchema, currentTimestamp);
        options.onMonthNavigate?.(state.displayYear, state.displayMonthId);
    }

    function navigateToToday(): void {
        if (!currentTimestamp) return;

        state.displayYear = currentTimestamp.year;
        state.displayMonthId = currentTimestamp.monthId;
        state.followCurrentMonth = true;

        updateGrid(currentEvents, currentPhenomena, currentSchema, currentTimestamp);
        options.onMonthNavigate?.(state.displayYear, state.displayMonthId);
    }

    function updateGrid(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        schema: CalendarSchema | null,
        timestamp: CalendarTimestamp | null,
    ): void {
        // Store current data for navigation functions
        currentEvents = events;
        currentPhenomena = phenomena;
        currentSchema = schema;
        currentTimestamp = timestamp;

        // Auto-update state if following current month
        if (state.followCurrentMonth && timestamp) {
            state.displayYear = timestamp.year;
            state.displayMonthId = timestamp.monthId;
        }

        header.replaceChildren();
        grid.replaceChildren();

        if (!schema || !timestamp) {
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("sm-almanac-month-view__empty");
            emptyMessage.textContent = "No active calendar";
            grid.appendChild(emptyMessage);
            return;
        }

        // Get the month to display (may differ from current if navigated)
        const displayMonth = getMonthById(schema, state.displayMonthId);
        if (!displayMonth) {
            const errorMessage = document.createElement("div");
            errorMessage.classList.add("sm-almanac-month-view__error");
            errorMessage.textContent = "Invalid month ID";
            grid.appendChild(errorMessage);
            return;
        }

        // Render header with navigation
        const headerContainer = document.createElement("div");
        headerContainer.style.display = "flex";
        headerContainer.style.justifyContent = "space-between";
        headerContainer.style.alignItems = "center";
        headerContainer.style.width = "100%";

        const navigation = document.createElement("div");
        navigation.classList.add("sm-almanac-month-view__navigation");

        const prevBtn = document.createElement("button");
        prevBtn.classList.add("sm-almanac-month-view__nav-btn", "is-prev");
        prevBtn.textContent = "◀";
        prevBtn.title = "Previous month";
        prevBtn.addEventListener("click", navigatePrevMonth);
        navigation.appendChild(prevBtn);

        const todayBtn = document.createElement("button");
        todayBtn.classList.add("sm-almanac-month-view__nav-btn", "is-today");
        todayBtn.textContent = "Today";
        todayBtn.title = "Return to current month";
        todayBtn.addEventListener("click", navigateToToday);
        navigation.appendChild(todayBtn);

        const nextBtn = document.createElement("button");
        nextBtn.classList.add("sm-almanac-month-view__nav-btn", "is-next");
        nextBtn.textContent = "▶";
        nextBtn.title = "Next month";
        nextBtn.addEventListener("click", navigateNextMonth);
        navigation.appendChild(nextBtn);

        const monthYearTitle = document.createElement("h3");
        monthYearTitle.classList.add("sm-almanac-month-view__month-title");
        monthYearTitle.textContent = `${displayMonth.name} ${state.displayYear}`;

        headerContainer.appendChild(navigation);
        headerContainer.appendChild(monthYearTitle);
        header.appendChild(headerContainer);

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
        const monthLength = displayMonth.length;

        // Calculate actual first weekday of the month using calendar epoch
        const firstDayOfMonth: CalendarTimestamp = {
            calendarId: timestamp.calendarId,
            year: state.displayYear,
            monthId: state.displayMonthId,
            day: 1,
            precision: "day",
        };
        const firstWeekday = getWeekdayForTimestamp(schema, firstDayOfMonth);

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
                calendarId: timestamp.calendarId,
                year: state.displayYear,
                monthId: state.displayMonthId,
                day,
                hour: 0,
                minute: 0,
                precision: "minute",
            };

            // Check if this is the actual current day
            const isCurrentDay =
                day === timestamp.day &&
                state.displayMonthId === timestamp.monthId &&
                state.displayYear === timestamp.year;

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
                return ts.year === state.displayYear &&
                    ts.monthId === state.displayMonthId &&
                    ts.day === day;
            });

            // Calculate icon data (moon phase, season transitions)
            const dayOfYear = getDayOfYear(schema, dayTimestamp);
            const moonPhaseData = astronomicalCalculator.computeMoonPhase(dayOfYear, state.displayYear);

            // Check if this day is a season transition
            const seasonTransition = SEASON_TRANSITIONS.find(t => t.day === dayOfYear);

            dayCells.push({
                day,
                isCurrentDay,
                isOtherMonth: false,
                events: dayEvents,
                phenomena: dayPhenomena,
                moonPhase: moonPhaseData.phase,
                seasonTransitionIcon: seasonTransition?.icon,
                seasonTransitionName: seasonTransition?.name,
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

                // Day icons (moon phase, season transitions, holidays)
                const iconsContainer = document.createElement("div");
                iconsContainer.classList.add("sm-almanac-month-view__day-icons");

                // Moon phase icon
                if (cell.moonPhase) {
                    const moonIcon = document.createElement("span");
                    moonIcon.classList.add("sm-almanac-month-view__day-icon");
                    moonIcon.textContent = MOON_PHASE_ICONS[cell.moonPhase] || '🌙';
                    moonIcon.title = `Mondphase: ${cell.moonPhase.replace('_', ' ')}`;
                    iconsContainer.appendChild(moonIcon);
                }

                // Season transition icon
                if (cell.seasonTransitionIcon && cell.seasonTransitionName) {
                    const seasonIcon = document.createElement("span");
                    seasonIcon.classList.add("sm-almanac-month-view__day-icon");
                    seasonIcon.textContent = cell.seasonTransitionIcon;
                    seasonIcon.title = cell.seasonTransitionName;
                    iconsContainer.appendChild(seasonIcon);
                }

                // Holiday/special event icon
                const holidays = [...cell.events, ...cell.phenomena].filter(
                    e => e.category === 'holiday'
                );
                if (holidays.length > 0) {
                    const holidayIcon = document.createElement("span");
                    holidayIcon.classList.add("sm-almanac-month-view__day-icon");
                    holidayIcon.textContent = '🎉';
                    holidayIcon.title = holidays.map(h => h.title || h.name).join(', ');
                    iconsContainer.appendChild(holidayIcon);
                }

                // Only append container if it has icons
                if (iconsContainer.children.length > 0) {
                    dayCell.appendChild(iconsContainer);
                }

                // Event indicators
                if (cell.events.length > 0 || cell.phenomena.length > 0) {
                    const indicators = document.createElement("div");
                    indicators.classList.add("sm-almanac-month-view__event-indicators");

                    // Create individual indicators for each event (for search highlighting)
                    for (const event of cell.events) {
                        const indicator = document.createElement("div");
                        indicator.classList.add("sm-almanac-month-view__event-indicator");
                        indicator.setAttribute("data-event-id", event.id);
                        indicator.textContent = "•";
                        indicator.title = event.title;

                        // Make clickable (double-click to edit)
                        indicator.addEventListener("dblclick", (e) => {
                            e.stopPropagation();
                            if (options.onEventClick) {
                                options.onEventClick(event);
                            }
                        });

                        // Context menu: Right-click for actions
                        indicator.addEventListener("contextmenu", (e) => {
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

                        indicators.appendChild(indicator);
                    }

                    // Create indicators for phenomena
                    for (const phenomenon of cell.phenomena) {
                        const indicator = document.createElement("div");
                        indicator.classList.add("sm-almanac-month-view__event-indicator", "is-phenomenon");
                        indicator.setAttribute("data-phenomenon-id", phenomenon.phenomenonId);
                        indicator.textContent = "○";
                        indicator.title = phenomenon.name;
                        indicators.appendChild(indicator);
                    }

                    dayCell.appendChild(indicators);
                }

                // Click handler
                if (options.onDayClick) {
                    dayCell.classList.add("is-clickable");
                    const dayTimestamp: CalendarTimestamp = {
                        calendarId: timestamp.calendarId,
                        year: state.displayYear,
                        monthId: state.displayMonthId,
                        day: cell.day,
                        hour: timestamp.hour ?? 0,
                        minute: timestamp.minute ?? 0,
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
