// src/features/events/hooks/location-handler.ts
// Hook handler for location updates

import type { HookDescriptor } from "../../../workmodes/almanac/domain";
import type { HookHandler, HookExecutionContext } from "../hook-executor";
import { logger } from "../../../app/plugin-logger";

interface LocationUpdateConfig {
    locationName: string;
    action: "set_state" | "change_owner" | "update_description";
    state?: string; // e.g., "occupied", "abandoned", "destroyed"
    ownerFaction?: string; // For owner changes
    ownerType?: "faction" | "npc" | "none"; // Owner type
    description?: string; // New description
}

/**
 * Handler for location update hooks
 *
 * Config format:
 * {
 *   locationName: "Saltmarsh Harbor",
 *   action: "set_state",
 *   state: "occupied"
 * }
 *
 * OR for owner changes:
 * {
 *   locationName: "Old Keep",
 *   action: "change_owner",
 *   ownerFaction: "Goblins of the Marsh",
 *   ownerType: "faction"
 * }
 *
 * TODO: Integrate with Location system
 */
export class LocationHandler implements HookHandler {
    readonly type = "location_update";

    canHandle(descriptor: HookDescriptor): boolean {
        const config = descriptor.config as LocationUpdateConfig;
        return (
            descriptor.type === this.type &&
            typeof config.locationName === "string" &&
            typeof config.action === "string"
        );
    }

    async execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        const config = descriptor.config as LocationUpdateConfig;

        logger.info("[location-handler] Location update triggered", {
            locationName: config.locationName,
            action: config.action,
            state: config.state,
            ownerFaction: config.ownerFaction,
            eventTitle: context.event?.title,
        });

        // TODO: Implement actual location update logic
        // This should:
        // 1. Load location data from Library
        // 2. Apply the update based on action type
        // 3. Save updated location data
        // 4. Update map markers if location is on map
        // 5. Trigger UI refresh if location view is open

        switch (config.action) {
            case "set_state":
                logger.info("[location-handler] Would set location state", {
                    location: config.locationName,
                    newState: config.state,
                });
                break;

            case "change_owner":
                logger.info("[location-handler] Would change location owner", {
                    location: config.locationName,
                    newOwner: config.ownerFaction,
                    ownerType: config.ownerType,
                });
                break;

            case "update_description":
                logger.info("[location-handler] Would update location description", {
                    location: config.locationName,
                    descriptionLength: config.description?.length,
                });
                break;

            default:
                logger.warn("[location-handler] Unknown action type", {
                    action: config.action,
                });
        }
    }
}
