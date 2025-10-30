// devkit/testing/unit/events/inbox-status-bar.test.ts
// Unit tests for Inbox StatusBar Widget

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InboxStatusBar } from "../../../../src/features/events/inbox-status-bar";
import { EventHistoryStore } from "../../../../src/features/events/event-history-store";
import { createTriggeredEventEntry } from "../../../../src/features/events/event-history-types";
import type { CalendarEvent } from "../../../../src/workmodes/almanac/domain";
import type { App } from "obsidian";

// Mock Obsidian App
const createMockApp = (): App => {
    return {} as App;
};

// Mock HTMLElement with Obsidian extensions
const createMockStatusBarItem = (): HTMLElement => {
    const el = document.createElement("div");
    (el as any).addClass = function (cls: string) {
        this.classList.add(cls);
        return this;
    };
    (el as any).removeClass = function (cls: string) {
        this.classList.remove(cls);
        return this;
    };
    (el as any).setText = function (text: string) {
        this.textContent = text;
        return this;
    };
    (el as any).empty = function () {
        this.innerHTML = "";
        return this;
    };
    return el;
};

describe("InboxStatusBar", () => {
    let app: App;
    let store: EventHistoryStore;
    let statusBarItem: HTMLElement;
    let widget: InboxStatusBar;

    beforeEach(() => {
        app = createMockApp();
        store = new EventHistoryStore(`test-inbox-${Date.now()}`);
        statusBarItem = createMockStatusBarItem();
        document.body.appendChild(statusBarItem);
    });

    afterEach(() => {
        widget?.destroy();
        statusBarItem.remove();
        store.clear();
    });

    describe("Initialization", () => {
        it("creates widget successfully", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);
            expect(widget).toBeTruthy();
        });

        it("adds statusbar class to element", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);
            expect(statusBarItem.classList.contains("sm-inbox-statusbar")).toBe(true);
        });

        it("sets aria-label", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);
            expect(statusBarItem.getAttribute("aria-label")).toBe("Event Inbox");
        });

        it("displays default state with no unread events", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);
            expect(statusBarItem.textContent).toBe("📬 Inbox");
            expect(statusBarItem.classList.contains("sm-inbox-statusbar--has-unread")).toBe(false);
        });
    });

    describe("Display Updates", () => {
        it("updates display when event is added", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

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

            // Wait for subscription callback
            expect(statusBarItem.textContent).toBe("📬 Inbox (1)");
            expect(statusBarItem.classList.contains("sm-inbox-statusbar--has-unread")).toBe(true);
        });

        it("updates count when multiple events are added", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

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

            expect(statusBarItem.textContent).toBe("📬 Inbox (2)");
        });

        it("updates display when event is marked as read", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

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
            expect(statusBarItem.textContent).toBe("📬 Inbox (1)");

            store.markAsRead(entry.id);
            expect(statusBarItem.textContent).toBe("📬 Inbox");
            expect(statusBarItem.classList.contains("sm-inbox-statusbar--has-unread")).toBe(false);
        });

        it("updates display when all events are marked as read", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

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

            expect(statusBarItem.textContent).toBe("📬 Inbox (2)");

            store.markAllAsRead();

            expect(statusBarItem.textContent).toBe("📬 Inbox");
            expect(statusBarItem.classList.contains("sm-inbox-statusbar--has-unread")).toBe(false);
        });
    });

    describe("Cleanup", () => {
        it("cleans up on destroy", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

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

            expect(statusBarItem.textContent).toBe("📬 Inbox (1)");

            widget.destroy();

            // StatusBar item should be emptied
            expect(statusBarItem.textContent).toBe("");

            // Adding new event should not update display (unsubscribed)
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
                createTriggeredEventEntry(event2, event2.date, {
                    scope: "global",
                    reason: "advance",
                }),
            );

            // Should still be empty (unsubscribed)
            expect(statusBarItem.textContent).toBe("");
        });
    });

    describe("Reactive Updates", () => {
        it("reacts to store changes in real-time", () => {
            widget = new InboxStatusBar(app, store, statusBarItem);

            expect(statusBarItem.textContent).toBe("📬 Inbox");

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

            // Add event
            store.addEvent(entry);
            expect(statusBarItem.textContent).toBe("📬 Inbox (1)");

            // Mark as read
            store.markAsRead(entry.id);
            expect(statusBarItem.textContent).toBe("📬 Inbox");

            // Mark as unread
            store.markAsUnread(entry.id);
            expect(statusBarItem.textContent).toBe("📬 Inbox (1)");
        });
    });
});
