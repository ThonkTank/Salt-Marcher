import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { createEncounterEventFromTravel, type TravelEncounterContext } from "../../src/apps/encounter/event-builder";

const loadTile = vi.fn();
const loadRegions = vi.fn();

vi.mock("../../src/core/hex-mapper/hex-notes", () => ({
    loadTile,
}));

vi.mock("../../src/core/regions-store", () => ({
    loadRegions,
}));

describe("createEncounterEventFromTravel", () => {
    const app = {} as App;
    const mapFile = { path: "maps/world.map", basename: "world" } as unknown as TFile;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-06-05T08:30:00.000Z"));
        loadTile.mockReset();
        loadRegions.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("collects region metadata and odds", async () => {
        loadTile.mockResolvedValue({ region: "Highlands" });
        loadRegions.mockResolvedValue([
            { name: "Highlands", encounterOdds: 8 },
            { name: "Lowlands", encounterOdds: 10 },
        ]);

        const ctx: TravelEncounterContext = {
            mapFile,
            state: {
                tokenRC: { r: 2, c: 3 },
                route: [],
                editIdx: null,
                tokenSpeed: 3,
                currentTile: { r: 5, c: 7 },
                playing: false,
                tempo: 1,
                clockHours: 17.25,
            },
        };

        const event = await createEncounterEventFromTravel(app, ctx);
        expect(event).not.toBeNull();
        expect(event?.triggeredAt).toBe("2024-06-05T08:30:00.000Z");
        expect(loadTile).toHaveBeenCalledWith(app, mapFile, { r: 5, c: 7 });
        expect(loadRegions).toHaveBeenCalledTimes(1);
        expect(event?.regionName).toBe("Highlands");
        expect(event?.encounterOdds).toBe(8);
        expect(event?.mapPath).toBe("maps/world.map");
        expect(event?.mapName).toBe("world");
        expect(event?.travelClockHours).toBe(17.25);
    });

    it("falls back gracefully when metadata is missing", async () => {
        loadTile.mockResolvedValue({});
        loadRegions.mockResolvedValue([]);

        const ctx: TravelEncounterContext = {
            mapFile: null,
            state: {
                tokenRC: { r: 1, c: 1 },
                route: [],
                editIdx: null,
                tokenSpeed: 3,
                currentTile: null,
                playing: false,
            },
        } as unknown as TravelEncounterContext;

        const event = await createEncounterEventFromTravel(app, ctx);
        expect(event?.regionName).toBeUndefined();
        expect(event?.encounterOdds).toBeUndefined();
        expect(event?.coord).toEqual({ r: 1, c: 1 });
    });
});
