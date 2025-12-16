// src/features/events/executing-hook-gateway.ts
// HookDispatchGateway implementation that executes hooks via HookExecutor

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-executing-gateway");
import { getEventAnchorTimestamp } from "@services/domain/calendar";
import { EventHistoryStore } from "./event-history-store";
import { createTriggeredEventEntry, createTriggeredPhenomenonEntry } from "./event-history-types";
import { HookExecutor } from "./hook-executor";
import { NotificationHandler, WeatherHandler, FactionHandler, LocationHandler } from "./hooks";
import type { CalendarEvent, PhenomenonOccurrence } from "@services/domain/calendar";
import type { HookDispatchGateway, HookDispatchContext } from "./types/hook-dispatch";

/**
 * Hook dispatch gateway that executes hooks using registered handlers
 */
export class ExecutingHookGateway implements HookDispatchGateway {
    private executor: HookExecutor;
    private historyStore: EventHistoryStore;

    constructor(executor?: HookExecutor, historyStore?: EventHistoryStore) {
        this.executor = executor || new HookExecutor();
        this.historyStore = historyStore || new EventHistoryStore();
        this.registerDefaultHandlers();
    }

    /**
     * Register default hook handlers
     */
    private registerDefaultHandlers(): void {
        this.executor.registerHandler(new NotificationHandler());
        this.executor.registerHandler(new WeatherHandler());
        this.executor.registerHandler(new FactionHandler());
        this.executor.registerHandler(new LocationHandler());
    }

    /**
     * Dispatch hooks from triggered events and phenomena
     */
    async dispatchHooks(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        context: HookDispatchContext,
    ): Promise<void> {
        logger.info("Dispatching hooks", {
            eventCount: events.length,
            phenomenonCount: phenomena.length,
            scope: context.scope,
            reason: context.reason,
        });

        // Add events to history timeline
        for (const event of events) {
            const timestamp = getEventAnchorTimestamp(event) ?? event.date;
            const entry = createTriggeredEventEntry(event, timestamp, {
                scope: context.scope,
                travelId: context.travelId,
                reason: context.reason,
            });
            this.historyStore.addEvent(entry);
        }

        // Add phenomena to history timeline
        for (const phenomenon of phenomena) {
            const entry = createTriggeredPhenomenonEntry(phenomenon, {
                scope: context.scope,
                travelId: context.travelId,
                reason: context.reason,
            });
            this.historyStore.addPhenomenon(entry);
        }

        // Execute hooks
        await this.executor.executeHooks(events, phenomena, {
            scope: context.scope,
            travelId: context.travelId,
            reason: context.reason,
        });
    }

    /**
     * Get the underlying executor (for testing/extension)
     */
    getExecutor(): HookExecutor {
        return this.executor;
    }

    /**
     * Get the event history store (for testing/UI access)
     */
    getHistoryStore(): EventHistoryStore {
        return this.historyStore;
    }
}
