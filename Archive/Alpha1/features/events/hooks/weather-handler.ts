// src/features/events/hooks/weather-handler.ts
// Hook handler for weather updates

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-hook-weather");
import type { HookDescriptor } from "@services/domain/calendar";
import type { HookHandler, HookExecutionContext } from "../hook-executor";

interface WeatherUpdateConfig {
    weatherType?: string; // e.g., "sunny", "rainy", "stormy"
    temperature?: number; // Celsius
    windSpeed?: number; // km/h
    hexCoordinates?: { q: number; r: number }; // If specified, update specific hex; otherwise use current location
}

/**
 * Handler for weather update hooks
 *
 * Config format:
 * {
 *   weatherType: "rainy",
 *   temperature: 15,
 *   windSpeed: 20,
 *   hexCoordinates: { q: 12, r: 34 }
 * }
 *
 * TODO: Integrate with actual weather system when implemented
 */
export class WeatherHandler implements HookHandler {
    readonly type = "weather_update";

    canHandle(descriptor: HookDescriptor): boolean {
        return descriptor.type === this.type;
    }

    async execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        const config = descriptor.config as WeatherUpdateConfig;

        logger.info("Weather update triggered", {
            weatherType: config.weatherType,
            temperature: config.temperature,
            hexCoordinates: config.hexCoordinates,
            eventTitle: context.event?.title,
        });

        // TODO: Implement actual weather update logic
        // This should:
        // 1. Get current hex from travel context (if no hexCoordinates specified)
        // 2. Update weather data for that hex
        // 3. Trigger UI refresh in Session Runner
        // 4. Store weather state in appropriate store

        // For now, just log the intended update
        if (config.hexCoordinates) {
            logger.info("Would update weather at hex", config.hexCoordinates);
        } else {
            logger.info("Would update weather at current travel location");
        }
    }
}
