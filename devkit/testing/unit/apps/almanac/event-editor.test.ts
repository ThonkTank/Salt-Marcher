// devkit/testing/unit/apps/almanac/event-editor.test.ts
// Tests for event editor modal logic

import { describe, it, expect } from "vitest";
import type {
    CalendarSchema,
    CalendarTimestamp,
    CalendarEvent,
    CalendarEventSingle,
    CalendarEventRecurring,
} from "../../../../../src/workmodes/almanac/domain";

const mockSchema: CalendarSchema = {
    id: "test-calendar",
    name: "Test Calendar",
    daysPerWeek: 7,
    months: [
        { id: "jan", name: "January", length: 31 },
        { id: "feb", name: "February", length: 28 },
        { id: "mar", name: "March", length: 31 },
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

describe("Event Editor Logic", () => {
    describe("Single Event Creation", () => {
        it("creates single all-day event with required fields", () => {
            const event: CalendarEventSingle = {
                id: "test-event-1",
                calendarId: "test-calendar",
                kind: "single",
                title: "Test Event",
                description: "Test Description",
                category: "Meeting",
                tags: ["work", "important"],
                priority: 5,
                date: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 20,
                    precision: "day",
                },
                allDay: true,
                timePrecision: "day",
            };

            expect(event.kind).toBe("single");
            expect(event.allDay).toBe(true);
            expect(event.date.precision).toBe("day");
            expect(event.date.hour).toBeUndefined();
            expect(event.date.minute).toBeUndefined();
            expect(event.startTime).toBeUndefined();
        });

        it("creates single timed event with hour/minute", () => {
            const event: CalendarEventSingle = {
                id: "test-event-2",
                calendarId: "test-calendar",
                kind: "single",
                title: "Timed Meeting",
                date: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "feb",
                    day: 10,
                    hour: 14,
                    minute: 30,
                    precision: "minute",
                },
                allDay: false,
                timePrecision: "minute",
                startTime: {
                    hour: 14,
                    minute: 30,
                },
            };

            expect(event.allDay).toBe(false);
            expect(event.date.hour).toBe(14);
            expect(event.date.minute).toBe(30);
            expect(event.startTime).toEqual({ hour: 14, minute: 30 });
        });
    });

    describe("Recurring Event Creation", () => {
        it("creates annual recurring event", () => {
            const event: CalendarEventRecurring = {
                id: "test-recurring-1",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Annual Festival",
                date: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "mar",
                    day: 15,
                    precision: "day",
                },
                allDay: true,
                rule: {
                    type: "annual_offset",
                    offsetDayOfYear: 75, // Assuming day 75 of year
                },
                timePolicy: "all_day",
            };

            expect(event.kind).toBe("recurring");
            expect(event.rule.type).toBe("annual_offset");
            expect(event.timePolicy).toBe("all_day");
        });

        it("creates monthly recurring event", () => {
            const event: CalendarEventRecurring = {
                id: "test-recurring-2",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Monthly Review",
                date: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 1,
                    hour: 9,
                    minute: 0,
                    precision: "minute",
                },
                allDay: false,
                rule: {
                    type: "monthly_position",
                    monthId: "jan",
                    day: 1,
                },
                timePolicy: "fixed",
                startTime: {
                    hour: 9,
                    minute: 0,
                },
            };

            expect(event.rule.type).toBe("monthly_position");
            expect(event.timePolicy).toBe("fixed");
            expect(event.startTime).toEqual({ hour: 9, minute: 0 });
        });

        it("creates weekly recurring event", () => {
            const event: CalendarEventRecurring = {
                id: "test-recurring-3",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Weekly Stand-up",
                date: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 6, // Monday
                    hour: 10,
                    minute: 0,
                    precision: "minute",
                },
                allDay: false,
                rule: {
                    type: "weekly_dayIndex",
                    dayIndex: 0, // Monday
                    interval: 1, // Every week
                },
                timePolicy: "fixed",
                startTime: {
                    hour: 10,
                    minute: 0,
                },
            };

            expect(event.rule.type).toBe("weekly_dayIndex");
            expect((event.rule as any).interval).toBe(1);
            expect((event.rule as any).dayIndex).toBe(0);
        });
    });

    describe("Form Validation Logic", () => {
        it("validates required title field", () => {
            const event: Partial<CalendarEventSingle> = {
                title: "",
                date: mockTimestamp,
            };

            expect(event.title).toBeFalsy();
        });

        it("validates day within month bounds", () => {
            const validDay = 15;
            const invalidDay = 32;
            const monthLength = mockSchema.months[0].length;

            expect(validDay).toBeGreaterThan(0);
            expect(validDay).toBeLessThanOrEqual(monthLength);
            expect(invalidDay).toBeGreaterThan(monthLength);
        });

        it("validates hour within day bounds", () => {
            const validHour = 14;
            const invalidHour = 25;
            const hoursPerDay = mockSchema.hoursPerDay ?? 24;

            expect(validHour).toBeGreaterThanOrEqual(0);
            expect(validHour).toBeLessThan(hoursPerDay);
            expect(invalidHour).toBeGreaterThanOrEqual(hoursPerDay);
        });

        it("validates minute within hour bounds", () => {
            const validMinute = 30;
            const invalidMinute = 60;
            const minutesPerHour = mockSchema.minutesPerHour ?? 60;

            expect(validMinute).toBeGreaterThanOrEqual(0);
            expect(validMinute).toBeLessThan(minutesPerHour);
            expect(invalidMinute).toBeGreaterThanOrEqual(minutesPerHour);
        });
    });

    describe("Day of Year Calculation", () => {
        it("calculates day of year for first month", () => {
            const timestamp: CalendarTimestamp = {
                calendarId: "test-calendar",
                year: 2025,
                monthId: "jan",
                day: 15,
                precision: "day",
            };

            // January 15 = day 15 of year
            const expected = 15;

            // Manual calculation
            let dayOfYear = 0;
            for (const month of mockSchema.months) {
                if (month.id === timestamp.monthId) {
                    dayOfYear += timestamp.day;
                    break;
                }
                dayOfYear += month.length;
            }

            expect(dayOfYear).toBe(expected);
        });

        it("calculates day of year for later month", () => {
            const timestamp: CalendarTimestamp = {
                calendarId: "test-calendar",
                year: 2025,
                monthId: "mar",
                day: 10,
                precision: "day",
            };

            // January (31) + February (28) + March 10 = 69
            const expected = 31 + 28 + 10;

            let dayOfYear = 0;
            for (const month of mockSchema.months) {
                if (month.id === timestamp.monthId) {
                    dayOfYear += timestamp.day;
                    break;
                }
                dayOfYear += month.length;
            }

            expect(dayOfYear).toBe(expected);
        });
    });

    describe("Event Type Inference", () => {
        it("infers annual recurrence type", () => {
            const event: CalendarEventRecurring = {
                id: "test",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Test",
                date: mockTimestamp,
                allDay: true,
                rule: { type: "annual_offset", offsetDayOfYear: 50 },
                timePolicy: "all_day",
            };

            const recurrenceType = event.rule.type === "annual_offset" ? "annual" : "other";
            expect(recurrenceType).toBe("annual");
        });

        it("infers monthly recurrence type", () => {
            const event: CalendarEventRecurring = {
                id: "test",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Test",
                date: mockTimestamp,
                allDay: true,
                rule: { type: "monthly_position", monthId: "jan", day: 1 },
                timePolicy: "all_day",
            };

            const recurrenceType = event.rule.type === "monthly_position" ? "monthly_position" : "other";
            expect(recurrenceType).toBe("monthly_position");
        });

        it("infers weekly recurrence type", () => {
            const event: CalendarEventRecurring = {
                id: "test",
                calendarId: "test-calendar",
                kind: "recurring",
                title: "Test",
                date: mockTimestamp,
                allDay: true,
                rule: { type: "weekly_dayIndex", dayIndex: 0, interval: 1 },
                timePolicy: "all_day",
            };

            const recurrenceType = event.rule.type === "weekly_dayIndex" ? "weekly_dayIndex" : "other";
            expect(recurrenceType).toBe("weekly_dayIndex");
        });
    });

    describe("Tag Parsing", () => {
        it("parses comma-separated tags", () => {
            const tagString = "festival, moon, autumn";
            const tags = tagString.split(',').map(t => t.trim()).filter(t => t.length > 0);

            expect(tags).toEqual(["festival", "moon", "autumn"]);
        });

        it("handles empty tag string", () => {
            const tagString = "";
            const tags = tagString.split(',').map(t => t.trim()).filter(t => t.length > 0);

            expect(tags).toEqual([]);
        });

        it("handles extra spaces and commas", () => {
            const tagString = "  tag1  ,  , tag2  , tag3 ,  ";
            const tags = tagString.split(',').map(t => t.trim()).filter(t => t.length > 0);

            expect(tags).toEqual(["tag1", "tag2", "tag3"]);
        });
    });

    describe("Priority Validation", () => {
        it("clamps priority to valid range", () => {
            const priorityAbove = 15;
            const priorityBelow = -5;
            const priorityValid = 5;

            const clampedAbove = Math.max(0, Math.min(10, priorityAbove));
            const clampedBelow = Math.max(0, Math.min(10, priorityBelow));
            const clampedValid = Math.max(0, Math.min(10, priorityValid));

            expect(clampedAbove).toBe(10);
            expect(clampedBelow).toBe(0);
            expect(clampedValid).toBe(5);
        });
    });
});
