// src/workmodes/almanac/data/faction-simulation-hook-factory.ts
// Factory for creating faction simulation hook with App instance (Phase 8.9)

import type { App } from "obsidian";
import type { FactionSimulationHook } from "./calendar-state-gateway";
import { runDailyFactionSimulation } from "../../../features/factions/faction-integration";
import { logger } from "../../../app/plugin-logger";

/**
 * Create a faction simulation hook bound to an Obsidian App instance
 *
 * This factory creates a FactionSimulationHook implementation that uses the
 * runDailyFactionSimulation function from the faction system. The hook is
 * automatically called when calendar time advances by days.
 *
 * Usage:
 * ```typescript
 * const factionHook = createFactionSimulationHook(app);
 * const gateway = new VaultCalendarStateGateway(
 *   calendarRepo,
 *   eventRepo,
 *   phenomenonRepo,
 *   vault,
 *   hookDispatcher,
 *   factionHook
 * );
 * ```
 *
 * @param app - Obsidian App instance for accessing vault files
 * @returns FactionSimulationHook implementation
 */
export function createFactionSimulationHook(app: App): FactionSimulationHook {
  return {
    async runSimulation(elapsedDays: number, currentDate: string) {
      logger.info("[faction-simulation-hook] Running faction simulation", {
        elapsedDays,
        currentDate,
      });

      try {
        const result = await runDailyFactionSimulation(app, currentDate, elapsedDays);

        logger.info("[faction-simulation-hook] Faction simulation complete", {
          factionsProcessed: result.factionsProcessed,
          eventsGenerated: result.events.length,
          warnings: result.warnings.length,
        });

        if (result.warnings.length > 0) {
          logger.warn("[faction-simulation-hook] Faction simulation warnings", {
            warnings: result.warnings,
          });
        }

        return result.events;
      } catch (error) {
        logger.error("[faction-simulation-hook] Faction simulation failed", {
          error: error.message,
          elapsedDays,
          currentDate,
        });
        // Return empty array on error - don't fail the time advancement
        return [];
      }
    },
  };
}
