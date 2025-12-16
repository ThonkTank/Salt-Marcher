// src/features/events/hooks/faction-handler.ts
// Hook handler for faction updates

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-hook-faction");
import type { HookDescriptor } from "@services/domain/calendar";
import type { HookHandler, HookExecutionContext } from "../hook-executor";

interface FactionUpdateConfig {
    factionName: string;
    action: "set_status" | "change_relationship" | "update_resources";
    status?: string; // e.g., "at_war", "peaceful", "hostile"
    targetFaction?: string; // For relationship changes
    relationshipValue?: number; // -100 to +100
    resources?: Record<string, number>; // Resource changes
}

/**
 * Handler for faction update hooks
 *
 * Config format:
 * {
 *   factionName: "Goblins of the Marsh",
 *   action: "set_status",
 *   status: "at_war"
 * }
 *
 * OR for relationships:
 * {
 *   factionName: "Kingdom of Saltmarsh",
 *   action: "change_relationship",
 *   targetFaction: "Sea Devils",
 *   relationshipValue: -50
 * }
 *
 * TODO: Integrate with Faction system when implemented
 */
export class FactionHandler implements HookHandler {
    readonly type = "faction_update";

    canHandle(descriptor: HookDescriptor): boolean {
        const config = descriptor.config as FactionUpdateConfig;
        return (
            descriptor.type === this.type &&
            typeof config.factionName === "string" &&
            typeof config.action === "string"
        );
    }

    async execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        const config = descriptor.config as FactionUpdateConfig;

        logger.info("Faction update triggered", {
            factionName: config.factionName,
            action: config.action,
            status: config.status,
            targetFaction: config.targetFaction,
            eventTitle: context.event?.title,
        });

        // TODO: Implement actual faction update logic
        // This should:
        // 1. Load faction data from Library
        // 2. Apply the update based on action type
        // 3. Save updated faction data
        // 4. Trigger UI refresh if faction view is open

        switch (config.action) {
            case "set_status":
                logger.info("Would set faction status", {
                    faction: config.factionName,
                    newStatus: config.status,
                });
                break;

            case "change_relationship":
                logger.info("Would change faction relationship", {
                    faction: config.factionName,
                    target: config.targetFaction,
                    value: config.relationshipValue,
                });
                break;

            case "update_resources":
                logger.info("Would update faction resources", {
                    faction: config.factionName,
                    resources: config.resources,
                });
                break;

            default:
                logger.warn("Unknown action type", {
                    action: config.action,
                });
        }
    }
}
