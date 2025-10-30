// devkit/testing/unit/events/timeline-view.test.ts
// Unit tests for Timeline View

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TimelineView, VIEW_TYPE_TIMELINE } from "../../../../src/features/events/timeline-view";
import { EventHistoryStore } from "../../../../src/features/events/event-history-store";
import { createTriggeredEventEntry, createTriggeredPhenomenonEntry } from "../../../../src/features/events/event-history-types";
import type { CalendarEvent, PhenomenonOccurrence } from "../../../../src/workmodes/almanac/domain";
import type { WorkspaceLeaf } from "obsidian";

// Mock createWorkmodeHeader
vi.mock("../../../../src/ui", () => ({
    createWorkmodeHeader: vi.fn(() => ({
        setSearchValue: vi.fn(),
        focusSearch: vi.fn(),
        destroy: vi.fn(),
    })),
}));

// Mock Obsidian HTMLElement extensions
const mockObsidianElement = (el: HTMLElement): HTMLElement => {
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
    (el as any).createDiv = function (options?: any) {
        const div = document.createElement("div");
        if (options?.cls) div.className = options.cls;
        if (options?.text) div.textContent = options.text;
        if (options?.attr) {
            Object.entries(options.attr).forEach(([key, value]) => {
                div.setAttribute(key, value as string);
            });
        }
        this.appendChild(div);
        return mockObsidianElement(div);
    };
    (el as any).createEl = function (tag: string, options?: any) {
        const elem = document.createElement(tag);
        if (options?.cls) elem.className = options.cls;
        if (options?.text) elem.textContent = options.text;
        if (options?.attr) {
            Object.entries(options.attr).forEach(([key, value]) => {
                elem.setAttribute(key, value as string);
            });
        }
        this.appendChild(elem);
        return mockObsidianElement(elem);
    };
    (el as any).createSpan = function (options?: any) {
        return (el as any).createEl("span", options);
    };
    (el as any).empty = function () {
        this.innerHTML = "";
        return this;
    };
    return el;
};

// Mock WorkspaceLeaf
const createMockLeaf = (): WorkspaceLeaf => {
    return {
        view: null,
        getViewState: () => ({ type: VIEW_TYPE_TIMELINE }),
        setViewState: async () => {},
    } as unknown as WorkspaceLeaf;
};

describe("TimelineView", () => {
    let store: EventHistoryStore;
    let view: TimelineView;
    let mockLeaf: WorkspaceLeaf;
    let container: HTMLElement;

    beforeEach(() => {
        // Create unique storage key for each test
        store = new EventHistoryStore(`test-timeline-${Date.now()}`);
        mockLeaf = createMockLeaf();

        // Create container element with Obsidian extensions
        container = mockObsidianElement(document.createElement("div"));
        document.body.appendChild(container);

        view = new TimelineView(mockLeaf, store);
        // Set contentEl to our container
        (view as any).contentEl = container;
    });

    afterEach(() => {
        view.onClose();
        container.remove();
        store.clear();
    });

    describe("View Metadata", () => {
        it("returns correct view type", () => {
            expect(view.getViewType()).toBe(VIEW_TYPE_TIMELINE);
        });

        it("returns correct display text", () => {
            expect(view.getDisplayText()).toBe("Event Timeline");
        });

        it("returns correct icon", () => {
            expect(view.getIcon()).toBe("clock");
        });
    });

    describe("View Lifecycle", () => {
        it("initializes view on open", async () => {
            await view.onOpen();

            // Check that container has correct class
            expect(container.classList.contains("sm-timeline-view")).toBe(true);

            // Check that main sections are created
            const timelineContainer = container.querySelector(".sm-timeline-container");
            expect(timelineContainer).toBeTruthy();

            const filterBar = container.querySelector(".sm-timeline-filters");
            expect(filterBar).toBeTruthy();

            const sortBar = container.querySelector(".sm-timeline-sort");
            expect(sortBar).toBeTruthy();

            const timelineList = container.querySelector(".sm-timeline-list");
            expect(timelineList).toBeTruthy();
        });

        it("cleans up on close", async () => {
            await view.onOpen();
            await view.onClose();

            // Check that class is removed
            expect(container.classList.contains("sm-timeline-view")).toBe(false);
        });
    });

    describe("Empty State", () => {
        it("shows empty state when no events", async () => {
            await view.onOpen();

            const emptyState = container.querySelector(".sm-timeline-empty");
            expect(emptyState).toBeTruthy();
            expect(emptyState?.classList.contains("sm-timeline-hidden")).toBe(false);
        });

        it("hides empty state when events exist", async () => {
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

            await view.onOpen();

            const emptyState = container.querySelector(".sm-timeline-empty");
            expect(emptyState?.classList.contains("sm-timeline-hidden")).toBe(true);
        });
    });

    describe("Event Rendering", () => {
        it("renders event entries in timeline", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Important Meeting",
                date: { year: 2025, monthId: "jan", day: 15 },
                allDay: true,
                timePrecision: "day",
                category: "meeting",
                priority: 80,
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);

            await view.onOpen();

            // Check that entry is rendered
            const entries = container.querySelectorAll(".sm-timeline-entry");
            expect(entries.length).toBe(1);

            // Check entry title
            const titleEl = container.querySelector(".sm-timeline-entry-title");
            expect(titleEl?.textContent).toBe("Important Meeting");

            // Check category badge
            const categoryEl = container.querySelector(".sm-timeline-entry-category");
            expect(categoryEl?.textContent).toBe("meeting");

            // Check priority
            const priorityEl = container.querySelector(".sm-timeline-entry-priority");
            expect(priorityEl?.textContent).toContain("80");
        });

        it("renders phenomenon entries in timeline", async () => {
            const mockPhenomenon: PhenomenonOccurrence = {
                phenomenonId: "full-moon",
                title: "Full Moon",
                timestamp: { year: 2025, monthId: "jan", day: 20 },
            };

            const entry = createTriggeredPhenomenonEntry(mockPhenomenon, {
                scope: "global",
                reason: "advance",
            });

            store.addPhenomenon(entry);

            await view.onOpen();

            // Check that entry is rendered
            const entries = container.querySelectorAll(".sm-timeline-entry");
            expect(entries.length).toBe(1);

            // Check phenomenon type badge
            const typeEl = container.querySelector(".sm-timeline-entry-type--phenomenon");
            expect(typeEl).toBeTruthy();

            // Check entry title
            const titleEl = container.querySelector(".sm-timeline-entry-title");
            expect(titleEl?.textContent).toBe("Full Moon");
        });

        it("renders multiple entries", async () => {
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

            await view.onOpen();

            const entries = container.querySelectorAll(".sm-timeline-entry");
            expect(entries.length).toBe(2);
        });
    });

    describe("Read/Unread State", () => {
        it("marks unread entries with unread class", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Unread Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
            };

            const entry = createTriggeredEventEntry(mockEvent, mockEvent.date, {
                scope: "global",
                reason: "advance",
            });

            store.addEvent(entry);

            await view.onOpen();

            const entryEl = container.querySelector(".sm-timeline-entry");
            expect(entryEl?.classList.contains("sm-timeline-entry--unread")).toBe(true);
        });

        it("does not mark read entries with unread class", async () => {
            const mockEvent: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Read Event",
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

            await view.onOpen();

            const entryEl = container.querySelector(".sm-timeline-entry");
            expect(entryEl?.classList.contains("sm-timeline-entry--unread")).toBe(false);
        });
    });

    describe("Filter Controls", () => {
        it("renders filter controls", async () => {
            await view.onOpen();

            const filterBar = container.querySelector(".sm-timeline-filters");
            expect(filterBar).toBeTruthy();

            // Check for scope filter
            const scopeSelect = container.querySelector(".sm-timeline-filters select");
            expect(scopeSelect).toBeTruthy();

            // Check for category filter
            const categoryInput = container.querySelector(".sm-timeline-filters input");
            expect(categoryInput).toBeTruthy();

            // Check for clear button
            const clearButton = container.querySelector(".sm-timeline-filter-clear");
            expect(clearButton).toBeTruthy();
        });
    });

    describe("Sort Controls", () => {
        it("renders sort controls", async () => {
            await view.onOpen();

            const sortBar = container.querySelector(".sm-timeline-sort");
            expect(sortBar).toBeTruthy();

            // Check for sort field select
            const sortSelects = container.querySelectorAll(".sm-timeline-sort select");
            expect(sortSelects.length).toBe(2); // Field + Order

            // Check that sort controls have options
            const sortFieldSelect = sortSelects[0] as HTMLSelectElement;
            expect(sortFieldSelect.options.length).toBeGreaterThan(0);

            const sortOrderSelect = sortSelects[1] as HTMLSelectElement;
            expect(sortOrderSelect.options.length).toBeGreaterThan(0);
        });
    });
});
