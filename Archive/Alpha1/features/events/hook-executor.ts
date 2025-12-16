// src/features/events/hook-executor.ts
// Executes event hooks based on HookDescriptor type

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-hook-executor");
import type { CalendarEvent, HookDescriptor , PhenomenonOccurrence } from "@services/domain/calendar";

/**
 * Context provided to hook handlers during execution
 */
export interface HookExecutionContext {
    readonly event?: CalendarEvent;
    readonly phenomenon?: PhenomenonOccurrence;
    readonly scope: "global" | "travel";
    readonly travelId?: string | null;
    readonly reason: "advance" | "jump";
}

/**
 * Handler for a specific hook type
 */
export interface HookHandler {
    readonly type: string;
    canHandle(descriptor: HookDescriptor): boolean;
    execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void>;
}

/**
 * Registry of hook handlers
 */
class HookHandlerRegistry {
    private handlers = new Map<string, HookHandler>();

    register(handler: HookHandler): void {
        this.handlers.set(handler.type, handler);
        logger.info("Registered hook handler", { type: handler.type });
    }

    get(type: string): HookHandler | undefined {
        return this.handlers.get(type);
    }

    getAll(): HookHandler[] {
        return Array.from(this.handlers.values());
    }

    clear(): void {
        this.handlers.clear();
    }
}

/**
 * Executes hooks from events and phenomena
 */
export class HookExecutor {
    private registry = new HookHandlerRegistry();

    /**
     * Register a hook handler
     */
    registerHandler(handler: HookHandler): void {
        this.registry.register(handler);
    }

    /**
     * Execute hooks from triggered events and phenomena
     */
    async executeHooks(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        context: Omit<HookExecutionContext, "event" | "phenomenon">,
    ): Promise<void> {
        logger.info("Executing hooks", {
            eventCount: events.length,
            phenomenonCount: phenomena.length,
            scope: context.scope,
        });

        // Execute hooks from events
        for (const event of events) {
            if (!event.hooks || event.hooks.length === 0) continue;

            const eventContext: HookExecutionContext = {
                ...context,
                event,
            };

            for (const hookDesc of event.hooks) {
                await this.executeHook(hookDesc, eventContext);
            }
        }

        // Execute hooks from phenomena
        for (const phenomenon of phenomena) {
            // @ts-expect-error - PhenomenonOccurrence doesn't have hooks in type, but might at runtime
            const hooks = phenomenon.hooks as HookDescriptor[] | undefined;
            if (!hooks || hooks.length === 0) continue;

            const phenomenonContext: HookExecutionContext = {
                ...context,
                phenomenon,
            };

            for (const hookDesc of hooks) {
                await this.executeHook(hookDesc, phenomenonContext);
            }
        }
    }

    /**
     * Execute a single hook descriptor
     */
    private async executeHook(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        const handler = this.registry.get(descriptor.type);

        if (!handler) {
            logger.warn("No handler registered for hook type", {
                type: descriptor.type,
                hookId: descriptor.id,
            });
            return;
        }

        if (!handler.canHandle(descriptor)) {
            logger.warn("Handler cannot handle hook", {
                type: descriptor.type,
                hookId: descriptor.id,
            });
            return;
        }

        try {
            logger.info("Executing hook", {
                type: descriptor.type,
                hookId: descriptor.id,
                config: descriptor.config,
            });

            await handler.execute(descriptor, context);

            logger.info("Hook executed successfully", {
                type: descriptor.type,
                hookId: descriptor.id,
            });
        } catch (error) {
            logger.error("Hook execution failed", {
                type: descriptor.type,
                hookId: descriptor.id,
                error,
            });
        }
    }

    /**
     * Clear all registered handlers (for testing)
     */
    clear(): void {
        this.registry.clear();
    }
}

/**
 * Global hook executor instance
 */
export const globalHookExecutor = new HookExecutor();
