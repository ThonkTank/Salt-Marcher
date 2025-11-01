// devkit/testing/unit/apps/almanac/almanac-mvp.test.ts
// Tests for Almanac MVP components

import { describe, it, expect, vi } from "vitest";
import { createAlmanacTimeDisplay } from "../../../../../src/workmodes/almanac/view/almanac-time-display";
import { createUpcomingEventsList } from "../../../../../src/workmodes/almanac/view/upcoming-events-list";
import { createMonthViewCalendar } from "../../../../../src/workmodes/almanac/view/month-view-calendar";
import { createWeekViewCalendar } from "../../../../../src/workmodes/almanac/view/week-view-calendar";
import { createTimelineViewCalendar } from "../../../../../src/workmodes/almanac/view/timeline-view-calendar";
import type { CalendarSchema, CalendarTimestamp } from "../../../../../src/workmodes/almanac/domain";

const mockSchema: CalendarSchema = {
    id: "test-calendar",
    name: "Test Calendar",
    daysPerWeek: 7,
    months: [
        { id: "jan", name: "January", length: 31 },
        { id: "feb", name: "February", length: 28 },
    ],
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    minuteStep: 1,
    epoch: { year: 1, monthId: "jan", day: 1 },
    schemaVersion: "1.0.0",
};

const mockTimestamp: CalendarTimestamp = {
    calendarId: "test-calendar",
    year: 2025,
    monthId: "jan",
    day: 15,
    hour: 14,
    minute: 30,
    precision: "minute",
};

describe("AlmanacTimeDisplay", () => {
    it("renders current time", () => {
        const onAdvanceDay = vi.fn();
        const onAdvanceHour = vi.fn();
        const onAdvanceMinute = vi.fn();

        const handle = createAlmanacTimeDisplay({
            currentTimestamp: mockTimestamp,
            schema: mockSchema,
            onAdvanceDay,
            onAdvanceHour,
            onAdvanceMinute,
        });

        expect(handle.root).toBeTruthy();
        expect(handle.root.classList.contains("sm-almanac-time-display")).toBe(true);

        // Check that time value is displayed
        const timeValue = handle.root.querySelector(".sm-almanac-time-display__value");
        expect(timeValue?.textContent).toContain("Year 2025");
        expect(timeValue?.textContent).toContain("Day 15");
        expect(timeValue?.textContent).toContain("January");

        handle.destroy();
    });

    it("shows empty state when no timestamp", () => {
        const handle = createAlmanacTimeDisplay({
            currentTimestamp: null,
            schema: null,
            onAdvanceDay: vi.fn(),
            onAdvanceHour: vi.fn(),
            onAdvanceMinute: vi.fn(),
        });

        const timeValue = handle.root.querySelector(".sm-almanac-time-display__value");
        expect(timeValue?.textContent).toBe("No active calendar");
        expect(timeValue?.classList.contains("is-empty")).toBe(true);

        handle.destroy();
    });

    it("calls advance callbacks when buttons clicked", () => {
        const onAdvanceDay = vi.fn();
        const onAdvanceHour = vi.fn();
        const onAdvanceMinute = vi.fn();

        const handle = createAlmanacTimeDisplay({
            currentTimestamp: mockTimestamp,
            schema: mockSchema,
            onAdvanceDay,
            onAdvanceHour,
            onAdvanceMinute,
        });

        // Find and click day forward button
        const buttons = handle.root.querySelectorAll<HTMLButtonElement>(
            ".sm-almanac-time-display__control-btn",
        );

        // Day backward (-), day forward (+)
        buttons[0].click();
        expect(onAdvanceDay).toHaveBeenCalledWith(-1);

        buttons[1].click();
        expect(onAdvanceDay).toHaveBeenCalledWith(1);

        // Hour backward (-), hour forward (+)
        buttons[2].click();
        expect(onAdvanceHour).toHaveBeenCalledWith(-1);

        buttons[3].click();
        expect(onAdvanceHour).toHaveBeenCalledWith(1);

        // Minute backward (-), minute forward (+)
        buttons[4].click();
        expect(onAdvanceMinute).toHaveBeenCalledWith(-1);

        buttons[5].click();
        expect(onAdvanceMinute).toHaveBeenCalledWith(1);

        handle.destroy();
    });

    it("updates display when update called", () => {
        const handle = createAlmanacTimeDisplay({
            currentTimestamp: mockTimestamp,
            schema: mockSchema,
            onAdvanceDay: vi.fn(),
            onAdvanceHour: vi.fn(),
            onAdvanceMinute: vi.fn(),
        });

        const newTimestamp: CalendarTimestamp = {
            ...mockTimestamp,
            day: 20,
        };

        handle.update(newTimestamp, mockSchema);

        const timeValue = handle.root.querySelector(".sm-almanac-time-display__value");
        expect(timeValue?.textContent).toContain("Day 20");

        handle.destroy();
    });
});

describe("UpcomingEventsList", () => {
    it("renders empty list when no events", () => {
        const handle = createUpcomingEventsList({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        expect(handle.root).toBeTruthy();
        expect(handle.root.classList.contains("sm-almanac-upcoming-events")).toBe(true);

        const emptyItem = handle.root.querySelector(".is-empty");
        expect(emptyItem?.textContent).toBe("No upcoming events");

        handle.destroy();
    });

    it("shows empty state when no schema", () => {
        const handle = createUpcomingEventsList({
            events: [],
            phenomena: [],
            schema: null,
            currentTimestamp: null,
        });

        const emptyItem = handle.root.querySelector(".is-empty");
        expect(emptyItem?.textContent).toBe("No active calendar");

        handle.destroy();
    });

    it("renders phenomenon occurrence", () => {
        const phenomenon = {
            phenomenonId: "test-phenomenon",
            name: "Test Phenomenon",
            calendarId: "test-calendar",
            timestamp: mockTimestamp,
            endTimestamp: mockTimestamp,
            category: "season" as const,
            priority: 0,
            durationMinutes: 60,
            hooks: [],
            effects: [],
        };

        const handle = createUpcomingEventsList({
            events: [],
            phenomena: [phenomenon],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        const items = handle.root.querySelectorAll(".sm-almanac-upcoming-events__item");
        expect(items.length).toBe(1);

        const firstItem = items[0];
        expect(firstItem.dataset.type).toBe("phenomenon");
        expect(firstItem.textContent).toContain("Test Phenomenon");
        expect(firstItem.textContent).toContain("Phenomenon");

        handle.destroy();
    });

    it("updates list when update called", () => {
        const handle = createUpcomingEventsList({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        // Initially empty
        let items = handle.root.querySelectorAll(".sm-almanac-upcoming-events__item");
        expect(items.length).toBe(1); // Empty placeholder

        // Add phenomenon
        const phenomenon = {
            phenomenonId: "new-phenomenon",
            name: "New Phenomenon",
            calendarId: "test-calendar",
            timestamp: mockTimestamp,
            endTimestamp: mockTimestamp,
            category: "weather" as const,
            priority: 0,
            durationMinutes: 30,
            hooks: [],
            effects: [],
        };

        handle.update([],  [phenomenon], mockSchema, mockTimestamp);

        items = handle.root.querySelectorAll(".sm-almanac-upcoming-events__item");
        expect(items.length).toBe(1);
        expect(items[0].textContent).toContain("New Phenomenon");

        handle.destroy();
    });
});

describe("MonthViewCalendar", () => {
    it("renders month view grid", () => {
        const handle = createMonthViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        expect(handle.root).toBeTruthy();
        expect(handle.root.classList.contains("sm-almanac-month-view")).toBe(true);

        // Check header shows month and year
        const header = handle.root.querySelector(".sm-almanac-month-view__month-title");
        expect(header?.textContent).toContain("January");
        expect(header?.textContent).toContain("2025");

        // Check weekday header
        const weekdayHeader = handle.root.querySelector(".sm-almanac-month-view__weekday-header");
        expect(weekdayHeader).toBeTruthy();

        // Check day cells are rendered (should have 31 days for January + padding)
        const dayCells = handle.root.querySelectorAll(".sm-almanac-month-view__day");
        expect(dayCells.length).toBeGreaterThan(0);

        handle.destroy();
    });

    it("shows empty state when no calendar", () => {
        const handle = createMonthViewCalendar({
            events: [],
            phenomena: [],
            schema: null,
            currentTimestamp: null,
        });

        const emptyMessage = handle.root.querySelector(".sm-almanac-month-view__empty");
        expect(emptyMessage?.textContent).toBe("No active calendar");

        handle.destroy();
    });

    it("highlights current day", () => {
        const handle = createMonthViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp, // day 15
        });

        const dayCells = handle.root.querySelectorAll(".sm-almanac-month-view__day");

        // Find the cell with day number 15
        let currentDayCell: Element | null = null;
        for (const cell of dayCells) {
            const dayNumber = cell.querySelector(".sm-almanac-month-view__day-number");
            if (dayNumber?.textContent === "15") {
                currentDayCell = cell;
                break;
            }
        }

        expect(currentDayCell).toBeTruthy();
        expect(currentDayCell?.classList.contains("is-current-day")).toBe(true);

        handle.destroy();
    });

    it("calls onDayClick when day clicked", () => {
        const onDayClick = vi.fn();

        const handle = createMonthViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
            onDayClick,
        });

        // Find clickable day cell
        const dayCells = handle.root.querySelectorAll(".sm-almanac-month-view__day.is-clickable");
        expect(dayCells.length).toBeGreaterThan(0);

        // Click first valid day cell
        (dayCells[0] as HTMLElement).click();

        expect(onDayClick).toHaveBeenCalledWith(
            expect.objectContaining({
                calendarId: "test-calendar",
                year: 2025,
                monthId: "jan",
            })
        );

        handle.destroy();
    });

    it("shows event indicators on days with events", () => {
        const mockEvent = {
            id: "test-event",
            kind: "single" as const,
            title: "Test Event",
            calendarId: "test-calendar",
            date: mockTimestamp, // day 15
            allDay: false,
            timePrecision: "minute" as const,
            startTime: { hour: 14, minute: 30 },
            category: "meeting",
            tags: [],
            priority: 0,
            description: "",
        };

        const handle = createMonthViewCalendar({
            events: [mockEvent],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        // Find day 15 cell
        const dayCells = handle.root.querySelectorAll(".sm-almanac-month-view__day");
        let day15Cell: Element | null = null;
        for (const cell of dayCells) {
            const dayNumber = cell.querySelector(".sm-almanac-month-view__day-number");
            if (dayNumber?.textContent === "15") {
                day15Cell = cell;
                break;
            }
        }

        expect(day15Cell).toBeTruthy();

        // Check event indicator exists
        const indicator = day15Cell?.querySelector(".sm-almanac-month-view__event-indicator");
        expect(indicator).toBeTruthy();

        handle.destroy();
    });

    it("updates grid when update called", () => {
        const handle = createMonthViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        // Update to February
        const febTimestamp: CalendarTimestamp = {
            ...mockTimestamp,
            monthId: "feb",
        };

        handle.update([], [], mockSchema, febTimestamp);

        const header = handle.root.querySelector(".sm-almanac-month-view__month-title");
        expect(header?.textContent).toContain("February");
        expect(header?.textContent).toContain("2025");

        handle.destroy();
    });
});

describe("WeekViewCalendar - Integration", () => {
    it("renders week view grid", () => {
        const handle = createWeekViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        expect(handle.root).toBeTruthy();
        expect(handle.root.classList.contains("sm-almanac-week-view")).toBe(true);

        const dayColumns = handle.root.querySelectorAll(".sm-almanac-week-view__day-column");
        expect(dayColumns.length).toBe(7);

        handle.destroy();
    });

    it("shows current day highlight", () => {
        const handle = createWeekViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        const currentDayColumn = handle.root.querySelector(".sm-almanac-week-view__day-column.is-current-day");
        expect(currentDayColumn).toBeTruthy();

        handle.destroy();
    });

    it("updates when timestamp changes", () => {
        const handle = createWeekViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
        });

        const newTimestamp: CalendarTimestamp = {
            ...mockTimestamp,
            day: 20,
        };

        handle.update([], [], mockSchema, newTimestamp);

        const weekTitle = handle.root.querySelector(".sm-almanac-week-view__week-title");
        expect(weekTitle?.textContent).toContain("Week:");

        handle.destroy();
    });
});

describe("TimelineViewCalendar - Integration", () => {
    it("renders timeline view", () => {
        const handle = createTimelineViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
            daysAhead: 30,
        });

        expect(handle.root).toBeTruthy();
        expect(handle.root.classList.contains("sm-almanac-timeline-view")).toBe(true);

        const title = handle.root.querySelector(".sm-almanac-timeline-view__title");
        expect(title?.textContent).toBe("Timeline (Next 30 days)");

        handle.destroy();
    });

    it("shows empty message when no events", () => {
        const handle = createTimelineViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
            daysAhead: 1,
        });

        const emptyMessage = handle.root.querySelector(".sm-almanac-timeline-view__empty");
        expect(emptyMessage).toBeTruthy();

        handle.destroy();
    });

    it("updates when timestamp changes", () => {
        const handle = createTimelineViewCalendar({
            events: [],
            phenomena: [],
            schema: mockSchema,
            currentTimestamp: mockTimestamp,
            daysAhead: 30,
        });

        const newTimestamp: CalendarTimestamp = {
            ...mockTimestamp,
            day: 20,
        };

        handle.update([], [], mockSchema, newTimestamp);

        const title = handle.root.querySelector(".sm-almanac-timeline-view__title");
        expect(title).toBeTruthy();

        handle.destroy();
    });
});
