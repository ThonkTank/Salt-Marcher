// src/workmodes/almanac/view/almanac-mvp.ts
// MVP implementation of Almanac view - provides basic calendar time management and upcoming events

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { createAlmanacTimeDisplay, type AlmanacTimeDisplayHandle } from "./almanac-time-display";
import { createUpcomingEventsList, type UpcomingEventsListHandle } from "./upcoming-events-list";
import { createMonthViewCalendar, type MonthViewCalendarHandle } from "./month-view-calendar";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "../domain";
import { advanceTime } from "../domain";
import { logger } from "../../../app/plugin-logger";
import { openEventEditor } from "./event-editor-modal";

/**
 * Almanac MVP Renderer
 *
 * Provides minimal viable product for Almanac:
 * - Current calendar time display
 * - Time advance controls (day/hour/minute)
 * - Upcoming events list (next 7 days)
 *
 * Future enhancements (deferred to later phases):
 * - Month/week/timeline calendar views
 * - Event editor modal
 * - Astronomical cycles UI
 * - Event inbox
 */
export async function renderAlmanacMVP(app: App, container: HTMLElement): Promise<void> {
    logger.info("[almanac-mvp] Rendering Almanac MVP");

    const root = container.createDiv({ cls: "sm-almanac-mvp" });

    // Phase notice - inform users this is MVP
    const notice = root.createDiv({ cls: "sm-almanac-mvp__notice" });
    notice.createEl("h3", { text: "Almanac MVP" });
    notice.createEl("p", {
        text: "This is a minimal viable implementation. Full calendar views (month/week/timeline) and event editor are planned for future updates.",
    });

    // Load calendar state (using hardcoded defaults for MVP)
    // In future, this will load from vault
    const mockSchema: CalendarSchema = {
        id: "gregorian-standard",
        name: "Gregorian Calendar",
        description: "Standard Gregorian calendar for testing",
        daysPerWeek: 7,
        months: [
            { id: "jan", name: "January", length: 31 },
            { id: "feb", name: "February", length: 28 },
            { id: "mar", name: "March", length: 31 },
            { id: "apr", name: "April", length: 30 },
            { id: "may", name: "May", length: 31 },
            { id: "jun", name: "June", length: 30 },
            { id: "jul", name: "July", length: 31 },
            { id: "aug", name: "August", length: 31 },
            { id: "sep", name: "September", length: 30 },
            { id: "oct", name: "October", length: 31 },
            { id: "nov", name: "November", length: 30 },
            { id: "dec", name: "December", length: 31 },
        ],
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60,
        minuteStep: 1,
        epoch: {
            year: 1,
            monthId: "jan",
            day: 1,
        },
        schemaVersion: "1.0.0",
    };

    // Start at a reasonable default
    let currentTimestamp: CalendarTimestamp = {
        calendarId: "gregorian-standard",
        year: 2025,
        monthId: "jan",
        day: 1,
        hour: 12,
        minute: 0,
        precision: "minute",
    };

    const mockEvents: CalendarEvent[] = [];
    const mockPhenomena: any[] = [];

    let timeDisplay: AlmanacTimeDisplayHandle | null = null;
    let eventsList: UpcomingEventsListHandle | null = null;
    let monthView: MonthViewCalendarHandle | null = null;
    let currentView: "list" | "month" = "list";

    function updateAllViews(): void {
        timeDisplay?.update(currentTimestamp, mockSchema);
        eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
        monthView?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
    }

    function handleAdvanceDay(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by days", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "day");
        currentTimestamp = result.timestamp;
        updateAllViews();
    }

    function handleAdvanceHour(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by hours", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "hour");
        currentTimestamp = result.timestamp;
        updateAllViews();
    }

    function handleAdvanceMinute(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by minutes", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "minute");
        currentTimestamp = result.timestamp;
        updateAllViews();
    }

    // Render time display
    timeDisplay = createAlmanacTimeDisplay({
        currentTimestamp,
        schema: mockSchema,
        onAdvanceDay: handleAdvanceDay,
        onAdvanceHour: handleAdvanceHour,
        onAdvanceMinute: handleAdvanceMinute,
    });
    root.appendChild(timeDisplay.root);

    // View switcher
    const viewSwitcher = root.createDiv({ cls: "sm-almanac-mvp__view-switcher" });
    const listViewBtn = viewSwitcher.createEl("button", {
        text: "List View",
        cls: "sm-almanac-mvp__view-btn is-active",
    });
    const monthViewBtn = viewSwitcher.createEl("button", {
        text: "Month View",
        cls: "sm-almanac-mvp__view-btn",
    });

    const viewContainer = root.createDiv({ cls: "sm-almanac-mvp__view-container" });

    function switchView(view: "list" | "month"): void {
        currentView = view;
        logger.info("[almanac-mvp] Switching view", { view });

        // Update button states
        listViewBtn.classList.toggle("is-active", view === "list");
        monthViewBtn.classList.toggle("is-active", view === "month");

        // Clear container
        viewContainer.replaceChildren();

        if (view === "list") {
            // Render list view
            if (eventsList) {
                viewContainer.appendChild(eventsList.root);
            }
        } else {
            // Render month view
            if (monthView) {
                viewContainer.appendChild(monthView.root);
            }
        }
    }

    listViewBtn.addEventListener("click", () => switchView("list"));
    monthViewBtn.addEventListener("click", () => switchView("month"));

    // Render upcoming events list
    eventsList = createUpcomingEventsList({
        events: mockEvents,
        phenomena: mockPhenomena,
        schema: mockSchema,
        currentTimestamp,
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked", { eventId: event.id });
            openEventEditor(app, {
                event,
                onSave: (updatedEvent) => {
                    logger.info("[almanac-mvp] Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh event list with updated data
                },
            });
        },
    });

    // Render month view
    monthView = createMonthViewCalendar({
        events: mockEvents,
        phenomena: mockPhenomena,
        schema: mockSchema,
        currentTimestamp,
        onDayClick: (timestamp) => {
            logger.info("[almanac-mvp] Day clicked", { timestamp });
            // Future: Jump to day in timeline view or show day events
        },
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked in month view", { eventId: event.id });
            openEventEditor(app, {
                event,
                onSave: (updatedEvent) => {
                    logger.info("[almanac-mvp] Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Initialize with list view
    switchView("list");

    // Future integration notice
    const futureNotice = root.createDiv({ cls: "sm-almanac-mvp__future-notice" });
    futureNotice.createEl("h4", { text: "Coming Soon" });
    const featureList = futureNotice.createEl("ul");
    featureList.createEl("li", { text: "Week/Timeline calendar views" });
    featureList.createEl("li", { text: "Event and phenomenon editor" });
    featureList.createEl("li", { text: "Astronomical cycles visualization" });
    featureList.createEl("li", { text: "Event inbox with priority sorting" });
    featureList.createEl("li", { text: "Integration with vault calendar data" });

    logger.info("[almanac-mvp] Almanac MVP rendered successfully with month view");
}
