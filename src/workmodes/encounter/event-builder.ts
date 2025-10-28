// src/workmodes/encounter/event-builder.ts
// Translates travel mode context into encounter events that can be consumed by
// the session store.

import type { App, TFile } from "obsidian";
import type { LogicStateSnapshot } from "../session-runner/travel/domain/types";
import type { EncounterEvent, EncounterEventSource } from "./session-store";
import { logger } from "../../app/plugin-logger";

export interface TravelEncounterContext {
    mapFile: TFile | null;
    state: LogicStateSnapshot | null;
}

export interface EncounterEventBuildOptions {
    source?: EncounterEventSource;
    idPrefix?: string;
    coordOverride?: LogicStateSnapshot["currentTile"];
    triggeredAt?: string;
}

export async function createEncounterEventFromTravel(
    app: App,
    ctx: TravelEncounterContext | null,
    options: EncounterEventBuildOptions = {},
): Promise<EncounterEvent | null> {
    const triggeredAt = options.triggeredAt ?? new Date().toISOString();
    const coord = options.coordOverride ?? ctx?.state?.currentTile ?? ctx?.state?.tokenRC ?? null;
    const mapFile = ctx?.mapFile ?? null;
    let regionName: string | undefined;
    let factionName: string | undefined;
    let encounterOdds: number | undefined;

    if (mapFile && coord) {
        try {
            const { loadTile } = await import("../../features/maps/data/tile-repository");
            const tile = await loadTile(app, mapFile, coord).catch(() => null);
            const tileRegion = typeof tile?.region === "string" ? tile.region : undefined;
            const tileFaction = typeof tile?.faction === "string" ? tile.faction : undefined;

            if (tileRegion) {
                regionName = tileRegion;
                try {
                    const { loadRegions } = await import("../../features/maps/data/region-repository");
                    const regions = await loadRegions(app);
                    const region = regions.find((r: any) => typeof r?.name === "string" && r.name.toLowerCase() === tileRegion.toLowerCase());
                    const odds = region?.encounterOdds;
                    if (typeof odds === "number" && Number.isFinite(odds) && odds > 0) {
                        encounterOdds = odds;
                    }
                } catch (err) {
                    logger.error("[encounter] failed to resolve region odds", err);
                }
            }

            if (tileFaction) {
                factionName = tileFaction;
            }
        } catch (err) {
            logger.error("[encounter] failed to read tile metadata", err);
        }
    }

    const travelClock = ctx?.state?.clockHours;
    const source = options.source ?? "travel";
    const idPrefix = options.idPrefix ?? source;

    const event: EncounterEvent = {
        id: `${idPrefix}-${Date.now()}`,
        source,
        triggeredAt,
        coord,
        regionName,
        factionName,
        mapPath: mapFile?.path,
        mapName: mapFile?.basename,
        encounterOdds,
        travelClockHours: typeof travelClock === "number" && Number.isFinite(travelClock) ? travelClock : undefined,
    };

    return event;
}
