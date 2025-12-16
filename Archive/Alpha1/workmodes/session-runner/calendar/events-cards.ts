// src/workmodes/session-runner/calendar/events-cards.ts
// Separate cards for current and upcoming events

import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-events-cards");
import { createCurrentEvents } from "./current-events";
import { createUpcomingEvents, type UpcomingEventItem } from "./upcoming-events";
import type { CalendarStateGateway, CalendarStateSnapshot } from "@services/orchestration";
import type { CalendarEvent } from "@domain";

export interface EventsCardsOptions {
    readonly host: HTMLElement;
    readonly app: App;
    readonly gateway: CalendarStateGateway;
    readonly travelId: string | null;
    readonly onOpenAlmanac?: () => void;
}

export interface EventsCardsHandle {
    readonly root: HTMLElement;
    refresh(): Promise<void>;
    destroy(): void;
}

/**
 * Creates two separate collapsible cards for current and upcoming events.
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────┐
 * │ ▸ Current Events                    │
 * ├─────────────────────────────────────┤
 * │ ─── NOW (2) ────────────────────── │
 * │ ⏺ Event 1 • until 15:00            │
 * │ ⏺ Event 2 • ongoing                │
 * └─────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────┐
 * │ ▸ Upcoming Events                   │
 * ├─────────────────────────────────────┤
 * │ ─── UPCOMING (5) ──────────────────│
 * │ ▸ Tomorrow • Event 3                │
 * │ ▸ In 2 days • Event 4               │
 * │                                      │
 * │        → Open Almanac                │
 * └─────────────────────────────────────┘
 * ```
 */
export function createEventsCards(options: EventsCardsOptions): EventsCardsHandle {
    const { host, app, gateway, travelId, onOpenAlmanac } = options;

    // Root container
    const root = host.createDiv({ cls: "sm-events-cards" });

    // Current Events Card
    const currentCard = root.createDiv({ cls: "sm-panel-card is-expanded" });
    const currentHeader = currentCard.createDiv({ cls: "sm-panel-card__header" });
    const currentHeaderLeft = currentHeader.createDiv({ cls: "sm-panel-card__header-left" });
    const currentIcon = currentHeaderLeft.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    currentHeaderLeft.createDiv({ cls: "sm-panel-card__title", text: "Current Events" });
    const currentBody = currentCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle current events card
    currentHeader.addEventListener("click", () => {
        if (currentCard.hasClass("is-expanded")) {
            currentCard.removeClass("is-expanded");
            currentCard.addClass("is-collapsed");
        } else {
            currentCard.removeClass("is-collapsed");
            currentCard.addClass("is-expanded");
        }
    });

    const currentEvents = createCurrentEvents({
        host: currentBody,
        onClickEvent: (eventId) => {
            logger.info("[events-cards] Open event", { eventId });
        },
    });

    // Upcoming Events Card
    const upcomingCard = root.createDiv({ cls: "sm-panel-card is-expanded" });
    const upcomingHeader = upcomingCard.createDiv({ cls: "sm-panel-card__header" });
    const upcomingHeaderLeft = upcomingHeader.createDiv({ cls: "sm-panel-card__header-left" });
    const upcomingIcon = upcomingHeaderLeft.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    upcomingHeaderLeft.createDiv({ cls: "sm-panel-card__title", text: "Upcoming Events" });
    const upcomingBody = upcomingCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle upcoming events card
    upcomingHeader.addEventListener("click", () => {
        if (upcomingCard.hasClass("is-expanded")) {
            upcomingCard.removeClass("is-expanded");
            upcomingCard.addClass("is-collapsed");
        } else {
            upcomingCard.removeClass("is-collapsed");
            upcomingCard.addClass("is-expanded");
        }
    });

    const upcomingEvents = createUpcomingEvents({
        host: upcomingBody,
        limit: 5,
        onClickEvent: (eventId) => {
            logger.info("[events-cards] Open event", { eventId });
        },
    });

    // Almanac link (after upcoming events)
    if (onOpenAlmanac) {
        const linkSection = upcomingBody.createDiv({ cls: "sm-calendar-panel__link-section" });
        const link = linkSection.createEl("a", {
            cls: "sm-calendar-panel__almanac-link",
            text: "→ Open Almanac",
        });
        link.addEventListener("click", (e) => {
            e.preventDefault();
            onOpenAlmanac();
        });
    }

    // Internal state
    let snapshot: CalendarStateSnapshot | null = null;
    let isDestroyed = false;

    /**
     * Refreshes the events cards with latest data.
     */
    async function refresh(): Promise<void> {
        if (isDestroyed) {
            return;
        }

        try {
            snapshot = await gateway.loadSnapshot({ travelId });

            if (snapshot.activeCalendar && snapshot.currentTimestamp) {
                // Merge events and phenomena for current events
                const allEventsForCurrent = [
                    ...snapshot.upcomingEvents,
                ] as CalendarEvent[];

                // Merge for upcoming events
                const upcomingItems: UpcomingEventItem[] = [
                    ...snapshot.upcomingEvents.map(e => ({
                        id: e.id,
                        kind: "event" as const,
                        title: e.title,
                        timestamp: e.date,
                        category: e.category,
                        priority: e.priority,
                    })),
                    ...snapshot.upcomingPhenomena.map(p => ({
                        id: p.phenomenonId,
                        kind: "phenomenon" as const,
                        title: p.name,
                        timestamp: p.timestamp,
                        category: undefined,
                        priority: undefined,
                    })),
                ];

                // Update current events (filter for today)
                currentEvents.setEvents(
                    allEventsForCurrent,
                    snapshot.activeCalendar,
                    snapshot.currentTimestamp,
                );

                // Update upcoming events (shows future events)
                upcomingEvents.setEvents(
                    upcomingItems,
                    snapshot.activeCalendar,
                    snapshot.currentTimestamp,
                );
            } else {
                // No active calendar - clear all event displays
                currentEvents.setEvents([], null, null);
                upcomingEvents.setEvents([], null, null);
            }
        } catch (error) {
            logger.error("[events-cards] Failed to refresh", error);
            currentEvents.setEvents([], null, null);
            upcomingEvents.setEvents([], null, null);
        }
    }

    // Initial load
    void refresh();

    // Public API
    return {
        root,
        refresh,
        destroy() {
            isDestroyed = true;
            currentEvents.destroy();
            upcomingEvents.destroy();
            root.empty();
        },
    };
}
