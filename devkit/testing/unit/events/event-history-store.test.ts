// devkit/testing/unit/events/event-history-store.test.ts
// Unit tests for Event History Store

import { describe, it, expect, beforeEach } from "vitest";
import { EventHistoryStore } from "../../../../src/features/events/event-history-store";
import { createTriggeredEventEntry, createTriggeredPhenomenonEntry } from "../../../../src/features/events/event-history-types";
import type { CalendarEvent, PhenomenonOccurrence } from "../../../../src/workmodes/almanac/domain";

describe("EventHistoryStore", () => {
    let store: EventHistoryStore;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Use unique storage key for each test
        store = new EventHistoryStore(`test-${Date.now()}`);
    });

    describe("Timeline", () => {
        it("starts with empty timeline", () => {
            const timeline = store.getTimeline();
            expect(timeline).toEqual([]);
        });

        it("adds event to timeline", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);
            expect(timeline[0].eventId).toBe("evt-1");
            expect(timeline[0].title).toBe("Test Event");
        });

        it("adds phenomenon to timeline", () => {
            const mockPhenomenon: PhenomenonOccurrence = {
                phenomenonId: "phen-1",
                title: "Full Moon",
                timestamp: { year: 2025, monthId: "jan", day: 15 },
            };

            const entry = createTriggeredPhenomenonEntry(mockPhenomenon, {
                scope: "global",
                reason: "advance",
            });

            store.addPhenomenon(entry);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);
            expect(timeline[0].phenomenonId).toBe("phen-1");
            expect(timeline[0].title).toBe("Full Moon");
        });

        it("adds multiple entries to timeline", () => {
            const event1: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Event 1",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const event2: CalendarEvent = {
                kind: "single",
                id: "evt-2",
                calendarId: "cal-1",
                title: "Event 2",
                date: { year: 2025, monthId: "jan", day: 2 },
                allDay: true,
                timePrecision: "day",
            };

            store.addEvent(
                createTriggeredEventEntry(event1, event1.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );
            store.addEvent(
                createTriggeredEventEntry(event2, event2.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(2);
        });

        it("clears timeline", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            store.addEvent(
                createTriggeredEventEntry(mockEvent, mockEvent.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );

            expect(store.getTimeline()).toHaveLength(1);

            store.clear();

            expect(store.getTimeline()).toHaveLength(0);
        });
    });

    describe("Read State", () => {
        it("entries start as unread", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);

            const isRead = store.isRead(entry.id);
            expect(isRead).toBe(false);
        });

        it("marks entry as read", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);
            store.markAsRead(entry.id);

            const isRead = store.isRead(entry.id);
            expect(isRead).toBe(true);
        });

        it("marks entry as unread", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);
            store.markAsRead(entry.id);
            store.markAsUnread(entry.id);

            const isRead = store.isRead(entry.id);
            expect(isRead).toBe(false);
        });

        it("marks all entries as read", () => {
            const event1: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Event 1",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const event2: CalendarEvent = {
                kind: "single",
                id: "evt-2",
                calendarId: "cal-1",
                title: "Event 2",
                date: { year: 2025, monthId: "jan", day: 2 },
                allDay: true,
                timePrecision: "day",
            };

            const entry1 = createTriggeredEventEntry(event1, event1.date, {
                scope: "global",
                reason: "advance",
            });
            const entry2 = createTriggeredEventEntry(event2, event2.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry1);
            store.addEvent(entry2);
            store.markAllAsRead();

            expect(store.isRead(entry1.id)).toBe(true);
            expect(store.isRead(entry2.id)).toBe(true);
        });
    });

    describe("Inbox", () => {
        it("shows unread entries in inbox", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                priority: 80,
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);

            const inbox = store.getInbox();
            expect(inbox).toHaveLength(1);
            expect(inbox[0].title).toBe("Test Event");
            expect(inbox[0].priority).toBe(80);
        });

        it("does not show read entries in inbox", () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);
            store.markAsRead(entry.id);

            const inbox = store.getInbox();
            expect(inbox).toHaveLength(0);
        });

        it("sorts inbox by priority (high to low)", () => {
            const lowPriorityEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Low Priority",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                priority: 20,
            };

            const highPriorityEvent: CalendarEvent = {
                kind: "single",
                id: "evt-2",
                calendarId: "cal-1",
                title: "High Priority",
                date: { year: 2025, monthId: "jan", day: 2 },
                allDay: true,
                timePrecision: "day",
                priority: 90,
            };

            store.addEvent(
                createTriggeredEventEntry(lowPriorityEvent, lowPriorityEvent.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );
            store.addEvent(
                createTriggeredEventEntry(highPriorityEvent, highPriorityEvent.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );

            const inbox = store.getInbox();
            expect(inbox).toHaveLength(2);
            expect(inbox[0].title).toBe("High Priority");
            expect(inbox[1].title).toBe("Low Priority");
        });

        it("returns correct inbox count", () => {
            const event1: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Event 1",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const event2: CalendarEvent = {
                kind: "single",
                id: "evt-2",
                calendarId: "cal-1",
                title: "Event 2",
                date: { year: 2025, monthId: "jan", day: 2 },
                allDay: true,
                timePrecision: "day",
            };

            store.addEvent(
                createTriggeredEventEntry(event1, event1.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );
            store.addEvent(
                createTriggeredEventEntry(event2, event2.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );

            expect(store.getInboxCount()).toBe(2);

            const entry1 = store.getTimeline()[0];
            store.markAsRead(entry1.id);

            expect(store.getInboxCount()).toBe(1);
        });
    });
});
