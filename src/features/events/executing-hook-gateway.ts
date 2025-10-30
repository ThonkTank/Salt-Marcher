// src/features/events/executing-hook-gateway.ts
// HookDispatchGateway implementation that executes hooks via HookExecutor

import type { CalendarEvent, PhenomenonOccurrence } from "../../workmodes/almanac/domain";
import type { HookDispatchGateway, HookDispatchContext } from "../../workmodes/almanac/data/calendar-state-gateway";
import { HookExecutor } from "./hook-executor";
import { NotificationHandler, WeatherHandler, FactionHandler, LocationHandler } from "./hooks";
import { logger } from "../../app/plugin-logger";

/**
 * Hook dispatch gateway that executes hooks using registered handlers
 */
export class ExecutingHookGateway implements HookDispatchGateway {
    private executor: HookExecutor;

    constructor(executor?: HookExecutor) {
        this.executor = executor || new HookExecutor();
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
        logger.info("[executing-hook-gateway] Dispatching hooks", {
            eventCount: events.length,
            phenomenonCount: phenomena.length,
            scope: context.scope,
            reason: context.reason,
        });

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
}
