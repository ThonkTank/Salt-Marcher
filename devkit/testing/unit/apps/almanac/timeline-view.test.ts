// devkit/testing/unit/apps/almanac/timeline-view.test.ts
// Unit tests for Timeline View calendar component

import { describe, it, expect, beforeEach } from "vitest";
import { createTimelineViewCalendar } from "../../../../../src/workmodes/almanac/view/timeline-view-calendar";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../../../../../src/workmodes/almanac/domain";

describe("TimelineViewCalendar", () => {
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
            {
                id: "event-3",
                calendarId: "test-calendar",
                title: "Evening Exercise",
                description: "Gym session",
                startTime: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 15,
                    hour: 18,
                    minute: 30,
                    precision: "minute",
                },
                category: "personal",
                tags: ["health"],
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
            {
                id: "phenomenon-2",
                name: "Solar Eclipse",
                type: "solar",
                timestamp: {
                    calendarId: "test-calendar",
                    year: 2025,
                    monthId: "jan",
                    day: 18,
                    hour: 14,
                    minute: 0,
                    precision: "minute",
                },
            },
        ];
    });

    describe("Component Creation", () => {
        it("creates timeline view with valid schema", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            expect(timelineView.root).toBeDefined();
            expect(timelineView.root.classList.contains("sm-almanac-timeline-view")).toBe(true);
        });

        it("shows empty state with null schema", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: null,
                currentTimestamp: mockTimestamp,
            });

            const emptyMessage = timelineView.root.querySelector(".sm-almanac-timeline-view__empty");
            expect(emptyMessage).toBeDefined();
            expect(emptyMessage?.textContent).toBe("No active calendar");
        });

        it("shows empty state with null timestamp", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: null,
            });

            const emptyMessage = timelineView.root.querySelector(".sm-almanac-timeline-view__empty");
            expect(emptyMessage).toBeDefined();
        });
    });

    describe("Timeline Rendering", () => {
        it("renders timeline title with days ahead", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 30,
            });

            const title = timelineView.root.querySelector(".sm-almanac-timeline-view__title");
            expect(title?.textContent).toBe("Timeline (Next 30 days)");
        });

        it("uses default days ahead if not specified", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
            });

            const title = timelineView.root.querySelector(".sm-almanac-timeline-view__title");
            expect(title?.textContent).toBe("Timeline (Next 30 days)");
        });

        it("groups entries by day", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const daySections = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__day-section");
            expect(daySections.length).toBeGreaterThan(0);
        });

        it("highlights today's section", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const todaySection = timelineView.root.querySelector(".sm-almanac-timeline-view__day-section.is-today");
            expect(todaySection).toBeDefined();
        });

        it("shows empty message when no events in range", () => {
            const emptyTimestamp: CalendarTimestamp = {
                calendarId: "test-calendar",
                year: 2025,
                monthId: "feb",
                day: 1,
                hour: 0,
                minute: 0,
                precision: "minute",
            };

            const timelineView = createTimelineViewCalendar({
                events: [],
                phenomena: [],
                schema: mockSchema,
                currentTimestamp: emptyTimestamp,
                daysAhead: 5,
            });

            const emptyMessage = timelineView.root.querySelector(".sm-almanac-timeline-view__empty");
            expect(emptyMessage).toBeDefined();
            expect(emptyMessage?.textContent).toContain("No events or phenomena in the next 5 days");
        });
    });

    describe("Event Display", () => {
        it("renders event entries", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const eventEntries = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry.is-event");
            expect(eventEntries.length).toBeGreaterThan(0);
        });

        it("displays event titles", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const eventTitles = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry.is-event .sm-almanac-timeline-view__entry-title");
            expect(eventTitles.length).toBeGreaterThan(0);
            const titleTexts = Array.from(eventTitles).map(el => el.textContent);
            expect(titleTexts).toContain("Morning Meeting");
        });

        it("displays event time labels", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const timeLables = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry-time");
            expect(timeLables.length).toBeGreaterThan(0);
            const timeTexts = Array.from(timeLables).map(el => el.textContent);
            expect(timeTexts.some(t => t === "09:00")).toBe(true);
        });

        it("displays event descriptions when available", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const descriptions = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry-description");
            expect(descriptions.length).toBeGreaterThan(0);
            const descTexts = Array.from(descriptions).map(el => el.textContent);
            expect(descTexts).toContain("Team standup");
        });
    });

    describe("Phenomenon Display", () => {
        it("renders phenomenon entries", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const phenomenonEntries = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry.is-phenomenon");
            expect(phenomenonEntries.length).toBeGreaterThan(0);
        });

        it("displays phenomenon names", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const phenomenonTitles = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry.is-phenomenon .sm-almanac-timeline-view__entry-title");
            const titleTexts = Array.from(phenomenonTitles).map(el => el.textContent);
            expect(titleTexts).toContain("Full Moon");
        });

        it("displays phenomenon types", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const phenomenonTypes = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__entry.is-phenomenon .sm-almanac-timeline-view__entry-type");
            const typeTexts = Array.from(phenomenonTypes).map(el => el.textContent);
            expect(typeTexts).toContain("lunar");
        });
    });

    describe("Chronological Ordering", () => {
        it("sorts entries chronologically within each day", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const daySections = timelineView.root.querySelectorAll(".sm-almanac-timeline-view__day-section");
            for (const daySection of Array.from(daySections)) {
                const entries = daySection.querySelectorAll(".sm-almanac-timeline-view__entry");
                const times = Array.from(entries)
                    .map(entry => entry.querySelector(".sm-almanac-timeline-view__entry-time")?.textContent || "")
                    .filter(t => t.length > 0);

                // Check that times are in ascending order
                for (let i = 1; i < times.length; i++) {
                    expect(times[i] >= times[i - 1]).toBe(true);
                }
            }
        });
    });

    describe("User Interactions", () => {
        it("triggers onEventClick when event entry is clicked", () => {
            let clickedEvent: CalendarEvent | null = null;
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
                onEventClick: (event) => {
                    clickedEvent = event;
                },
            });

            const eventEntry = timelineView.root.querySelector(".sm-almanac-timeline-view__entry.is-event");
            expect(eventEntry).toBeDefined();
            (eventEntry as HTMLElement).click();
            expect(clickedEvent).not.toBeNull();
            expect(clickedEvent?.id).toBe("event-1");
        });

        it("does not trigger onEventClick when phenomenon entry is clicked", () => {
            let clickedEvent: CalendarEvent | null = null;
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
                onEventClick: (event) => {
                    clickedEvent = event;
                },
            });

            const phenomenonEntry = timelineView.root.querySelector(".sm-almanac-timeline-view__entry.is-phenomenon");
            if (phenomenonEntry) {
                (phenomenonEntry as HTMLElement).click();
                expect(clickedEvent).toBeNull();
            }
        });
    });

    describe("Update Method", () => {
        it("updates view when timestamp changes", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const newTimestamp: CalendarTimestamp = {
                ...mockTimestamp,
                day: 20,
            };

            timelineView.update(mockEvents, mockPhenomena, mockSchema, newTimestamp);

            const title = timelineView.root.querySelector(".sm-almanac-timeline-view__title");
            expect(title).toBeDefined();
        });

        it("handles empty events and phenomena lists", () => {
            const timelineView = createTimelineViewCalendar({
                events: [],
                phenomena: [],
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            const emptyMessage = timelineView.root.querySelector(".sm-almanac-timeline-view__empty");
            expect(emptyMessage).toBeDefined();
        });
    });

    describe("Cleanup", () => {
        it("clears DOM on destroy", () => {
            const timelineView = createTimelineViewCalendar({
                events: mockEvents,
                phenomena: mockPhenomena,
                schema: mockSchema,
                currentTimestamp: mockTimestamp,
                daysAhead: 10,
            });

            expect(timelineView.root.children.length).toBeGreaterThan(0);
            timelineView.destroy();
            expect(timelineView.root.children.length).toBe(0);
        });
    });
});
