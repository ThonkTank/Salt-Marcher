// devkit/testing/unit/apps/almanac/almanac-mvp.test.ts
// Tests for Almanac MVP components

import { describe, it, expect, vi } from "vitest";
import { createAlmanacTimeDisplay } from "../../../../../src/workmodes/almanac/view/almanac-time-display";
import { createUpcomingEventsList } from "../../../../../src/workmodes/almanac/view/upcoming-events-list";
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
