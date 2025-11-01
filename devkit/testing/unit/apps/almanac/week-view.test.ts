// devkit/testing/unit/apps/almanac/week-view.test.ts
// Unit tests for Week View calendar component

import { describe, it, expect, beforeEach } from "vitest";
import { createWeekViewCalendar } from "../../../../../src/workmodes/almanac/view/week-view-calendar";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../../../../../src/workmodes/almanac/domain";

describe("WeekViewCalendar", () => {
    let mockSchema: CalendarSchema;
    let mockTimestamp: CalendarTimestamp;
    let mockEvents: CalendarEvent[];
    let mockPhenomena: PhenomenonOccurrence[];

    beforeEach(() => {
        mockSchema = {
            id: "test-calendar",
            name: "Test Calendar",
            months: [
                { id: "jan", name: "January", length: 31 },
                { id: "feb", name: "February", length: 28 },
            ],
            daysPerWeek: 7,
            hoursPerDay: 24,
            minutesPerHour: 60,
            epoch: { year: 1, monthId: "jan", day: 1 },
        };

        mockTimestamp = {
            calendarId: "test-calendar",
            year: 2025,
            monthId: "jan",
            day: 15,
            hour: 12,
            minute: 30,
            precision: "minute",
        };

        mockEvents = [
            {
                id: "event-1",
                calendarId: "test-calendar",
                title: "Morning Meeting",
                description: "Team standup",
                startTime: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 15,
                    hour: 9,
                    minute: 0,
                    precision: "minute",
                },
                category: "work",
                tags: ["meeting"],
                recurrence: null,
            },
            {
                id: "event-2",
                calendarId: "test-calendar",
                title: "Lunch Break",
                description: "Daily lunch",
                startTime: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 16,
                    hour: 13,
                    minute: 0,
                    precision: "minute",
                },
                category: "personal",
                tags: ["food"],
                recurrence: null,
            },
        ];

        mockPhenomena = [
            {
                id: "phenomenon-1",
                name: "Full Moon",
                type: "lunar",
                timestamp: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 17,
                    hour: 0,
                    minute: 0,
                    precision: "minute",
                },
            },
        ];
    });

    describe("Component Creation", () => {
        it("creates week view with valid schema", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            expect(weekView.root).toBeDefined();
            expect(weekView.root.classList.contains("sm-almanac-week-view")).toBe(true);
        });

        it("shows empty state with null schema", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: null,
                currentTimestamp: mockTimestamp,
            });

            const emptyMessage = weekView.root.querySelector(".sm-almanac-week-view__empty");
            expect(emptyMessage).toBeDefined();
            expect(emptyMessage?.textContent).toBe("No active calendar");
        });

        it("shows empty state with null timestamp", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: null,
            });

            const emptyMessage = weekView.root.querySelector(".sm-almanac-week-view__empty");
            expect(emptyMessage).toBeDefined();
        });
    });

    describe("Week Grid Rendering", () => {
        it("renders 7 day columns", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const dayColumns = weekView.root.querySelectorAll(".sm-almanac-week-view__day-column");
            expect(dayColumns.length).toBe(7);
        });

        it("highlights current day", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const currentDayColumn = weekView.root.querySelector(".sm-almanac-week-view__day-column.is-current-day");
            expect(currentDayColumn).toBeDefined();
        });

        it("renders time slots for each hour", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const timeSlots = weekView.root.querySelectorAll(".sm-almanac-week-view__time-slot");
            expect(timeSlots.length).toBe(mockSchema.hoursPerDay);
        });

        it("renders hour slots for each day", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const dayColumns = weekView.root.querySelectorAll(".sm-almanac-week-view__day-column");
            for (const dayColumn of Array.from(dayColumns)) {
                const hourSlots = dayColumn.querySelectorAll(".sm-almanac-week-view__hour-slot");
                expect(hourSlots.length).toBe(mockSchema.hoursPerDay);
            }
        });
    });

    describe("Event Display", () => {
        it("shows event indicators for events", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const eventIndicators = weekView.root.querySelectorAll(".sm-almanac-week-view__event-indicator");
            expect(eventIndicators.length).toBeGreaterThan(0);
        });

        it("displays event count in indicators", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const eventIndicators = weekView.root.querySelectorAll(".sm-almanac-week-view__event-indicator");
            for (const indicator of Array.from(eventIndicators)) {
                const count = parseInt(indicator.textContent || "0", 10);
                expect(count).toBeGreaterThan(0);
            }
        });
    });

    describe("User Interactions", () => {
        it("triggers onDayClick when day header is clicked", () => {
            let clickedTimestamp: CalendarTimestamp | null = null;
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                onDayClick: (timestamp) => {
                    clickedTimestamp = timestamp;
                },
            });

            const dayHeader = weekView.root.querySelector(".sm-almanac-week-view__day-header");
            expect(dayHeader).toBeDefined();
            (dayHeader as HTMLElement).click();
            expect(clickedTimestamp).not.toBeNull();
        });

        it("triggers onEventClick when event indicator is clicked", () => {
            let clickedEvent: CalendarEvent | null = null;
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                onEventClick: (event) => {
                    clickedEvent = event;
                },
            });

            const eventIndicator = weekView.root.querySelector(".sm-almanac-week-view__event-indicator");
            if (eventIndicator) {
                (eventIndicator as HTMLElement).click();
                expect(clickedEvent).not.toBeNull();
            }
        });
    });

    describe("Update Method", () => {
        it("updates view when timestamp changes", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const newTimestamp: CalendarTimestamp = {
                ...mockTimestamp,
                day: 20,
            };

            weekView.update(mockEvents, mockPhenomena, mockSchema, newTimestamp);

            // Check that new week is rendered
            const weekTitle = weekView.root.querySelector(".sm-almanac-week-view__week-title");
            expect(weekTitle?.textContent).toContain("Week:");
        });

        it("handles empty events list", () => {
            const weekView = createWeekViewCalendar({
                events: [],
                phenomena: [],
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const eventIndicators = weekView.root.querySelectorAll(".sm-almanac-week-view__event-indicator");
            expect(eventIndicators.length).toBe(0);
        });
    });

    describe("Cleanup", () => {
        it("clears DOM on destroy", () => {
            const weekView = createWeekViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            expect(weekView.root.children.length).toBeGreaterThan(0);
            weekView.destroy();
            expect(weekView.root.children.length).toBe(0);
        });
    });
});
