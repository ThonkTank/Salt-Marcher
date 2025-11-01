// src/workmodes/almanac/view/almanac-mvp.ts
// MVP implementation of Almanac view - provides basic calendar time management and upcoming events

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { createAlmanacTimeDisplay, type AlmanacTimeDisplayHandle } from "./almanac-time-display";
import { createUpcomingEventsList, type UpcomingEventsListHandle } from "./upcoming-events-list";
import { createMonthViewCalendar, type MonthViewCalendarHandle } from "./month-view-calendar";
import { createWeekViewCalendar, type WeekViewCalendarHandle } from "./week-view-calendar";
import { createTimelineViewCalendar, type TimelineViewCalendarHandle } from "./timeline-view-calendar";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "../domain";
import type { CalendarStateGateway } from "../data/calendar-state-gateway";
import { logger } from "../../../app/plugin-logger";
import { openEventEditor } from "./event-editor-modal";

/**
 * Almanac MVP Renderer
 *
 * Provides minimal viable product for Almanac:
 * - Current calendar time display
 * - Time advance controls (day/hour/minute)
 * - Upcoming events list (next 7 days)
 * - Month calendar grid with event indicators
 * - Week calendar grid with hourly slots (Phase 13 Priority 3)
 * - Timeline view with chronological entries (Phase 13 Priority 3)
 *
 * Phase 13 Implementation:
 * - Vault data integration via CalendarStateGateway
 * - Automatic persistence of time advances
 * - Load calendar schema and events from vault
 * - Multiple calendar view types (list, month, week, timeline)
 *
 * Future enhancements (deferred to later phases):
 * - Month navigation controls (prev/next month buttons)
 * - Full event editor modal
 * - Astronomical cycles UI
 * - Event inbox
 */
export async function renderAlmanacMVP(app: App, container: HTMLElement, gateway: CalendarStateGateway): Promise<void> {
    logger.info("[almanac-mvp] Rendering Almanac MVP with vault integration");

    const root = container.createDiv({ cls: "sm-almanac-mvp" });

    // Load calendar state from vault via gateway
    const snapshot = await gateway.loadSnapshot();

    if (!snapshot.activeCalendar || !snapshot.currentTimestamp) {
        // No calendar configured - show setup notice
        const setupNotice = root.createDiv({ cls: "sm-almanac-mvp__setup-notice" });
        setupNotice.createEl("h3", { text: "Calendar Setup Required" });
        setupNotice.createEl("p", {
            text: "No calendar is configured. Please create a calendar in the Library or import a calendar preset first.",
        });
        logger.warn("[almanac-mvp] No active calendar or current timestamp available");
        return;
    }

    const activeCalendar = snapshot.activeCalendar as CalendarSchema;
    let currentTimestamp = snapshot.currentTimestamp;

    let timeDisplay: AlmanacTimeDisplayHandle | null = null;
    let eventsList: UpcomingEventsListHandle | null = null;
    let monthView: MonthViewCalendarHandle | null = null;
    let weekView: WeekViewCalendarHandle | null = null;
    let timelineView: TimelineViewCalendarHandle | null = null;
    let currentView: "list" | "month" | "week" | "timeline" = "list";

    function updateAllViews(): void {
        timeDisplay?.update(currentTimestamp, activeCalendar);
        eventsList?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        monthView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        weekView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        timelineView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
    }

    async function handleAdvanceDay(amount: number): Promise<void> {
        logger.info("[almanac-mvp] Advancing time by days", { amount });
        try {
            const result = await gateway.advanceTimeBy(amount, "day");
            currentTimestamp = result.timestamp;
            updateAllViews();
        } catch (error) {
            logger.error("[almanac-mvp] Failed to advance time by days", { error, amount });
            new Notice("Failed to advance time. Check console for details.");
        }
    }

    async function handleAdvanceHour(amount: number): Promise<void> {
        logger.info("[almanac-mvp] Advancing time by hours", { amount });
        try {
            const result = await gateway.advanceTimeBy(amount, "hour");
            currentTimestamp = result.timestamp;
            updateAllViews();
        } catch (error) {
            logger.error("[almanac-mvp] Failed to advance time by hours", { error, amount });
            new Notice("Failed to advance time. Check console for details.");
        }
    }

    async function handleAdvanceMinute(amount: number): Promise<void> {
        logger.info("[almanac-mvp] Advancing time by minutes", { amount });
        try {
            const result = await gateway.advanceTimeBy(amount, "minute");
            currentTimestamp = result.timestamp;
            updateAllViews();
        } catch (error) {
            logger.error("[almanac-mvp] Failed to advance time by minutes", { error, amount });
            new Notice("Failed to advance time. Check console for details.");
        }
    }

    // Render time display
    timeDisplay = createAlmanacTimeDisplay({
        currentTimestamp,
        schema: activeCalendar,
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
    const weekViewBtn = viewSwitcher.createEl("button", {
        text: "Week View",
        cls: "sm-almanac-mvp__view-btn",
    });
    const timelineViewBtn = viewSwitcher.createEl("button", {
        text: "Timeline View",
        cls: "sm-almanac-mvp__view-btn",
    });

    const viewContainer = root.createDiv({ cls: "sm-almanac-mvp__view-container" });

    function switchView(view: "list" | "month" | "week" | "timeline"): void {
        currentView = view;
        logger.info("[almanac-mvp] Switching view", { view });

        // Update button states
        listViewBtn.classList.toggle("is-active", view === "list");
        monthViewBtn.classList.toggle("is-active", view === "month");
        weekViewBtn.classList.toggle("is-active", view === "week");
        timelineViewBtn.classList.toggle("is-active", view === "timeline");

        // Clear container
        viewContainer.replaceChildren();

        if (view === "list") {
            // Render list view
            if (eventsList) {
                viewContainer.appendChild(eventsList.root);
            }
        } else if (view === "month") {
            // Render month view
            if (monthView) {
                viewContainer.appendChild(monthView.root);
            }
        } else if (view === "week") {
            // Render week view
            if (weekView) {
                viewContainer.appendChild(weekView.root);
            }
        } else if (view === "timeline") {
            // Render timeline view
            if (timelineView) {
                viewContainer.appendChild(timelineView.root);
            }
        }
    }

    listViewBtn.addEventListener("click", () => switchView("list"));
    monthViewBtn.addEventListener("click", () => switchView("month"));
    weekViewBtn.addEventListener("click", () => switchView("week"));
    timelineViewBtn.addEventListener("click", () => switchView("timeline"));

    // Render upcoming events list
    eventsList = createUpcomingEventsList({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked", { eventId: event.id });
            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
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
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onDayClick: (timestamp) => {
            logger.info("[almanac-mvp] Day clicked", { timestamp });
            // Future: Jump to day in timeline view or show day events
        },
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked in month view", { eventId: event.id });
            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("[almanac-mvp] Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Render week view
    weekView = createWeekViewCalendar({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onDayClick: (timestamp) => {
            logger.info("[almanac-mvp] Day clicked in week view", { timestamp });
            // Future: Jump to day in timeline view or show day events
        },
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked in week view", { eventId: event.id });
            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("[almanac-mvp] Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Render timeline view
    timelineView = createTimelineViewCalendar({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        daysAhead: 30,
        onEventClick: (event) => {
            logger.info("[almanac-mvp] Event clicked in timeline view", { eventId: event.id });
            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
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
    featureList.createEl("li", { text: "Month navigation (prev/next month buttons)" });
    featureList.createEl("li", { text: "Astronomical cycles visualization" });
    featureList.createEl("li", { text: "Event inbox with priority sorting" });
    featureList.createEl("li", { text: "Search functionality" });

    logger.info("[almanac-mvp] Almanac MVP rendered successfully with vault integration");
}
