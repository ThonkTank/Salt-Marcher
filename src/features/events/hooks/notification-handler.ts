// src/features/events/hooks/notification-handler.ts
// Hook handler for showing notifications

import type { HookDescriptor } from "../../../workmodes/almanac/domain";
import type { HookHandler, HookExecutionContext } from "../hook-executor";
import { logger } from "../../../app/plugin-logger";

interface NotificationConfig {
    message: string;
    duration?: number; // ms, default 5000
    level?: "info" | "warning" | "error";
}

/**
 * Handler for notification hooks
 *
 * Config format:
 * {
 *   message: "Event triggered!",
 *   duration: 5000,
 *   level: "info"
 * }
 */
export class NotificationHandler implements HookHandler {
    readonly type = "notification";

    canHandle(descriptor: HookDescriptor): boolean {
        return descriptor.type === this.type && typeof descriptor.config.message === "string";
    }

    async execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        const config = descriptor.config as NotificationConfig;

        const message = this.formatMessage(config.message, context);
        const level = config.level || "info";

        logger.info("[notification-handler] Showing notification", {
            message,
            level,
            eventTitle: context.event?.title,
            phenomenonTitle: context.phenomenon?.title,
        });

        // TODO: Actually show notification in Obsidian UI
        // For now, just log it
        console.log(`[${level.toUpperCase()}] ${message}`);
    }

    /**
     * Format message with placeholders
     * Supports: {event.title}, {phenomenon.title}, {event.category}
     */
    private formatMessage(template: string, context: HookExecutionContext): string {
        let message = template;

        if (context.event) {
            message = message.replace(/{event\.title}/g, context.event.title || "");
            message = message.replace(/{event\.category}/g, context.event.category || "");
        }

        if (context.phenomenon) {
            message = message.replace(/{phenomenon\.title}/g, context.phenomenon.title || "");
        }

        return message;
    }
}
