// src/apps/encounter/event-builder.ts
// Translates travel mode context into encounter events that can be consumed by
// the session store.

import type { App, TFile } from "obsidian";
import type { LogicStateSnapshot } from "../cartographer/travel/domain/types";
import type { EncounterEvent, EncounterEventSource } from "./session-store";

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
    let encounterOdds: number | undefined;

    if (mapFile && coord) {
        try {
            const { loadTile } = await import("../../core/hex-mapper/hex-notes");
            const tile = await loadTile(app, mapFile, coord).catch(() => null);
            const tileRegion = typeof tile?.region === "string" ? tile.region : undefined;
            if (tileRegion) {
                regionName = tileRegion;
                try {
                    const { loadRegions } = await import("../../core/regions-store");
                    const regions = await loadRegions(app);
                    const region = regions.find((r: any) => typeof r?.name === "string" && r.name.toLowerCase() === tileRegion.toLowerCase());
                    const odds = region?.encounterOdds;
                    if (typeof odds === "number" && Number.isFinite(odds) && odds > 0) {
                        encounterOdds = odds;
                    }
                } catch (err) {
                    console.error("[encounter] failed to resolve region odds", err);
                }
            }
        } catch (err) {
            console.error("[encounter] failed to read tile metadata", err);
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
        mapPath: mapFile?.path,
        mapName: mapFile?.basename,
        encounterOdds,
        travelClockHours: typeof travelClock === "number" && Number.isFinite(travelClock) ? travelClock : undefined,
    };

    return event;
}
