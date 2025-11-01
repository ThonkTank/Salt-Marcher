// src/workmodes/almanac/view/almanac-mvp.ts
// MVP implementation of Almanac view - provides basic calendar time management and upcoming events

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { createAlmanacTimeDisplay, type AlmanacTimeDisplayHandle } from "./almanac-time-display";
import { createUpcomingEventsList, type UpcomingEventsListHandle } from "./upcoming-events-list";
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

    function handleAdvanceDay(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by days", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "day");
        currentTimestamp = result.timestamp;
        timeDisplay?.update(currentTimestamp, mockSchema);
        eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
    }

    function handleAdvanceHour(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by hours", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "hour");
        currentTimestamp = result.timestamp;
        timeDisplay?.update(currentTimestamp, mockSchema);
        eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
    }

    function handleAdvanceMinute(amount: number): void {
        logger.info("[almanac-mvp] Advancing time by minutes", { amount });
        const result = advanceTime(mockSchema, currentTimestamp, amount, "minute");
        currentTimestamp = result.timestamp;
        timeDisplay?.update(currentTimestamp, mockSchema);
        eventsList?.update(mockEvents, mockPhenomena, mockSchema, currentTimestamp);
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
    root.appendChild(eventsList.root);

    // Future integration notice
    const futureNotice = root.createDiv({ cls: "sm-almanac-mvp__future-notice" });
    futureNotice.createEl("h4", { text: "Coming Soon" });
    const featureList = futureNotice.createEl("ul");
    featureList.createEl("li", { text: "Month/Week/Timeline calendar views" });
    featureList.createEl("li", { text: "Event and phenomenon editor" });
    featureList.createEl("li", { text: "Astronomical cycles visualization" });
    featureList.createEl("li", { text: "Event inbox with priority sorting" });
    featureList.createEl("li", { text: "Integration with vault calendar data" });

    logger.info("[almanac-mvp] Almanac MVP rendered successfully");
}
