// devkit/testing/integration/events/event-system-integration.test.ts
// Integration tests for complete Event System flow: Hook Execution → Timeline Recording

import { describe, it, expect, beforeEach } from "vitest";
import { ExecutingHookGateway } from "../../../../src/features/events/executing-hook-gateway";
import { EventHistoryStore } from "../../../../src/features/events/event-history-store";
import { HookExecutor } from "../../../../src/features/events/hook-executor";
import type { CalendarEvent, PhenomenonOccurrence } from "../../../../src/workmodes/almanac/domain";
import type { HookDispatchContext } from "../../../../src/workmodes/almanac/data/calendar-state-gateway";

describe("Event System Integration", () => {
    let gateway: ExecutingHookGateway;
    let executor: HookExecutor;
    let store: EventHistoryStore;

    beforeEach(() => {
        // Create isolated store for each test
        store = new EventHistoryStore(`test-integration-${Date.now()}`);
        executor = new HookExecutor();
        gateway = new ExecutingHookGateway(executor, store);
    });

    afterEach(() => {
        store.clear();
    });

    describe("Hook Execution to Timeline Recording", () => {
        it("records calendar events to timeline", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Festival of Lights",
                date: { year: 2025, monthId: "jan", day: 15 },
                allDay: true,
                timePrecision: "day",
                category: "festival",
                priority: 75,
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Initially timeline should be empty
            expect(store.getTimeline()).toHaveLength(0);

            // Dispatch hooks
            await gateway.dispatchHooks([mockEvent], [], context);

            // Timeline should now contain the event
            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);

            const entry = timeline[0];
            expect(entry).toMatchObject({
                eventId: "evt-1",
                title: "Festival of Lights",
                category: "festival",
                priority: 75,
                scope: "global",
                reason: "advance",
            });
        });

        it("records phenomena to timeline", async () => {
            const mockPhenomenon: PhenomenonOccurrence = {
                phenomenonId: "full-moon",
                title: "Full Moon",
                timestamp: { year: 2025, monthId: "jan", day: 20 },
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "jump",
            };

            // Dispatch hooks
            await gateway.dispatchHooks([], [mockPhenomenon], context);

            // Timeline should contain the phenomenon
            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);

            const entry = timeline[0];
            expect(entry).toMatchObject({
                phenomenonId: "full-moon",
                title: "Full Moon",
                scope: "global",
                reason: "jump",
            });
        });

        it("records both events and phenomena in same dispatch", async () => {
            const mockEvent: CalendarEvent = {
                kind: "recurring",
                id: "evt-market",
                calendarId: "cal-1",
                title: "Weekly Market",
                date: { year: 2025, monthId: "feb", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const mockPhenomenon: PhenomenonOccurrence = {
                phenomenonId: "new-moon",
                title: "New Moon",
                timestamp: { year: 2025, monthId: "feb", day: 1 },
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            await gateway.dispatchHooks([mockEvent], [mockPhenomenon], context);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(2);

            // Check that we have one event and one phenomenon
            const eventEntry = timeline.find((e) => "eventId" in e);
            const phenomenonEntry = timeline.find((e) => "phenomenonId" in e);

            expect(eventEntry).toBeTruthy();
            expect(phenomenonEntry).toBeTruthy();
        });

        it("records travel-scoped events correctly", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-encounter",
                calendarId: "cal-1",
                title: "Bandit Ambush",
                date: { year: 2025, monthId: "mar", day: 5 },
                allDay: true,
                timePrecision: "day",
            };

            const context: HookDispatchContext = {
                scope: "travel",
                travelId: "travel-123",
                reason: "advance",
            };

            await gateway.dispatchHooks([mockEvent], [], context);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);

            const entry = timeline[0];
            expect(entry).toMatchObject({
                scope: "travel",
                travelId: "travel-123",
            });
        });
    });

    describe("Inbox Population", () => {
        it("adds events to inbox as unread", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-urgent",
                calendarId: "cal-1",
                title: "Urgent Meeting",
                date: { year: 2025, monthId: "apr", day: 10 },
                allDay: true,
                timePrecision: "day",
                priority: 90,
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Initially inbox should be empty
            expect(store.getInbox()).toHaveLength(0);
            expect(store.getInboxCount()).toBe(0);

            // Dispatch hooks
            await gateway.dispatchHooks([mockEvent], [], context);

            // Inbox should now contain the event as unread
            const inbox = store.getInbox();
            expect(inbox).toHaveLength(1);
            expect(store.getInboxCount()).toBe(1);

            const inboxItem = inbox[0];
            expect(inboxItem).toMatchObject({
                type: "event",
                title: "Urgent Meeting",
                priority: 90,
                read: false,
            });
        });

        it("sorts inbox items by priority (high to low)", async () => {
            const lowPriorityEvent: CalendarEvent = {
                kind: "single",
                id: "evt-low",
                calendarId: "cal-1",
                title: "Low Priority",
                date: { year: 2025, monthId: "may", day: 1 },
                allDay: true,
                timePrecision: "day",
                priority: 30,
            };

            const highPriorityEvent: CalendarEvent = {
                kind: "single",
                id: "evt-high",
                calendarId: "cal-1",
                title: "High Priority",
                date: { year: 2025, monthId: "may", day: 2 },
                allDay: true,
                timePrecision: "day",
                priority: 95,
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Dispatch low priority first, then high priority
            await gateway.dispatchHooks([lowPriorityEvent], [], context);
            await gateway.dispatchHooks([highPriorityEvent], [], context);

            const inbox = store.getInbox();
            expect(inbox).toHaveLength(2);

            // High priority should be first
            expect(inbox[0].title).toBe("High Priority");
            expect(inbox[1].title).toBe("Low Priority");
        });

        it("removes items from inbox when marked as read", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-read-test",
                calendarId: "cal-1",
                title: "Read Test Event",
                date: { year: 2025, monthId: "jun", day: 15 },
                allDay: true,
                timePrecision: "day",
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            await gateway.dispatchHooks([mockEvent], [], context);

            // Verify item is in inbox
            expect(store.getInboxCount()).toBe(1);

            // Get the entry ID
            const timeline = store.getTimeline();
            const entry = timeline[0];

            // Mark as read
            store.markAsRead(entry.id);

            // Inbox should now be empty
            expect(store.getInboxCount()).toBe(0);
            expect(store.getInbox()).toHaveLength(0);
        });
    });

    describe("Handler Execution", () => {
        it("executes hooks from dispatched events", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-with-hooks",
                calendarId: "cal-1",
                title: "Event with Hooks",
                date: { year: 2025, monthId: "jul", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [
                    {
                        id: "hook-1",
                        type: "notification",
                        config: {
                            message: "Test notification",
                        },
                    },
                ],
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Dispatch hooks - should not throw
            await expect(gateway.dispatchHooks([mockEvent], [], context)).resolves.not.toThrow();

            // Timeline should record the event with hook count
            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);

            const entry = timeline[0];
            if ("hooks" in entry) {
                expect(entry.hooks).toBe(1);
            }
        });

        it("handles events without hooks gracefully", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-no-hooks",
                calendarId: "cal-1",
                title: "Event without Hooks",
                date: { year: 2025, monthId: "aug", day: 1 },
                allDay: true,
                timePrecision: "day",
                // No hooks property
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Should not throw
            await expect(gateway.dispatchHooks([mockEvent], [], context)).resolves.not.toThrow();

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(1);
        });
    });

    describe("Multiple Dispatch Scenarios", () => {
        it("handles sequential dispatches correctly", async () => {
            const event1: CalendarEvent = {
                kind: "single",
                id: "evt-seq-1",
                calendarId: "cal-1",
                title: "First Event",
                date: { year: 2025, monthId: "sep", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const event2: CalendarEvent = {
                kind: "single",
                id: "evt-seq-2",
                calendarId: "cal-1",
                title: "Second Event",
                date: { year: 2025, monthId: "sep", day: 2 },
                allDay: true,
                timePrecision: "day",
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            await gateway.dispatchHooks([event1], [], context);
            await gateway.dispatchHooks([event2], [], context);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(2);

            const inbox = store.getInbox();
            expect(inbox).toHaveLength(2);
        });

        it("maintains unique IDs for all entries", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-same",
                calendarId: "cal-1",
                title: "Same Event",
                date: { year: 2025, monthId: "oct", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            // Dispatch the same event twice (simulating recurring event)
            await gateway.dispatchHooks([event], [], context);
            await gateway.dispatchHooks([event], [], context);

            const timeline = store.getTimeline();
            expect(timeline).toHaveLength(2);

            // All IDs should be unique
            const ids = timeline.map((e) => e.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(2);
        });
    });

    describe("Timeline Filtering and Sorting", () => {
        it("filters timeline by scope", async () => {
            const globalEvent: CalendarEvent = {
                kind: "single",
                id: "evt-global",
                calendarId: "cal-1",
                title: "Global Event",
                date: { year: 2025, monthId: "nov", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const travelEvent: CalendarEvent = {
                kind: "single",
                id: "evt-travel",
                calendarId: "cal-1",
                title: "Travel Event",
                date: { year: 2025, monthId: "nov", day: 2 },
                allDay: true,
                timePrecision: "day",
            };

            await gateway.dispatchHooks([globalEvent], [], { scope: "global", reason: "advance" });
            await gateway.dispatchHooks([travelEvent], [], { scope: "travel", travelId: "t1", reason: "advance" });

            const globalFiltered = store.getFilteredTimeline({ scope: "global" });
            expect(globalFiltered).toHaveLength(1);
            expect(globalFiltered[0]).toMatchObject({ title: "Global Event" });

            const travelFiltered = store.getFilteredTimeline({ scope: "travel" });
            expect(travelFiltered).toHaveLength(1);
            expect(travelFiltered[0]).toMatchObject({ title: "Travel Event" });
        });

        it("filters timeline by category", async () => {
            const festivalEvent: CalendarEvent = {
                kind: "single",
                id: "evt-festival",
                calendarId: "cal-1",
                title: "Festival",
                date: { year: 2025, monthId: "dec", day: 1 },
                allDay: true,
                timePrecision: "day",
                category: "festival",
            };

            const meetingEvent: CalendarEvent = {
                kind: "single",
                id: "evt-meeting",
                calendarId: "cal-1",
                title: "Meeting",
                date: { year: 2025, monthId: "dec", day: 2 },
                allDay: true,
                timePrecision: "day",
                category: "meeting",
            };

            const context: HookDispatchContext = {
                scope: "global",
                reason: "advance",
            };

            await gateway.dispatchHooks([festivalEvent, meetingEvent], [], context);

            const festivalFiltered = store.getFilteredTimeline({ category: "festival" });
            expect(festivalFiltered).toHaveLength(1);
            expect(festivalFiltered[0]).toMatchObject({ title: "Festival" });
        });
    });
});
