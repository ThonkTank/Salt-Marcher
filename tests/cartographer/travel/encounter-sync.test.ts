// salt-marcher/tests/cartographer/travel/encounter-sync.test.ts
// Testet Encounter-Sync-Service für Travel-Modus.
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createEncounterSync } from "../../../src/apps/cartographer/travel/infra/encounter-sync";
import {
    publishEncounterEvent,
    __resetEncounterEventStore,
    type EncounterEvent,
} from "../../../src/apps/encounter/session-store";

const baseEvent: EncounterEvent = {
    id: "manual-1",
    source: "manual",
    triggeredAt: "2024-01-01T00:00:00.000Z",
    coord: { r: 2, c: 3 },
};

beforeEach(() => {
    __resetEncounterEventStore();
});

describe("createEncounterSync", () => {
    it("pauses playback and opens encounter when travel triggers", async () => {
        const pausePlayback = vi.fn();
        const openEncounter = vi.fn().mockResolvedValue(true);
        const file = { path: "maps/test.md", basename: "Test" } as any;
        const state = {
            tokenRC: { r: 0, c: 0 },
            route: [],
            editIdx: null,
            tokenSpeed: 3,
            currentTile: null,
            playing: true,
        } as any;

        const sync = createEncounterSync({
            getMapFile: () => file,
            getState: () => state,
            pausePlayback,
            openEncounter,
        });

        await sync.handleTravelEncounter();

        expect(pausePlayback).toHaveBeenCalledTimes(1);
        expect(openEncounter).toHaveBeenCalledTimes(1);
        expect(openEncounter).toHaveBeenCalledWith({ mapFile: file, state });

        sync.dispose();
    });

    it("reacts to manual encounter events by pausing and revealing view", async () => {
        const pausePlayback = vi.fn();
        const openEncounter = vi.fn().mockResolvedValue(true);

        const sync = createEncounterSync({
            getMapFile: () => null,
            getState: () => ({}) as any,
            pausePlayback,
            openEncounter,
        });

        publishEncounterEvent(baseEvent);

        expect(pausePlayback).toHaveBeenCalledTimes(1);
        expect(openEncounter).toHaveBeenCalledWith();

        sync.dispose();
    });

    it("allows external hook to suppress view opening", () => {
        const pausePlayback = vi.fn();
        const openEncounter = vi.fn().mockResolvedValue(true);

        const sync = createEncounterSync({
            getMapFile: () => null,
            getState: () => ({}) as any,
            pausePlayback,
            openEncounter,
            onExternalEncounter: () => false,
        });

        publishEncounterEvent({ ...baseEvent, id: "manual-2" });

        expect(pausePlayback).toHaveBeenCalledTimes(1);
        expect(openEncounter).not.toHaveBeenCalled();

        sync.dispose();
    });

    it("ignores travel-origin events from other sources", () => {
        const pausePlayback = vi.fn();
        const openEncounter = vi.fn().mockResolvedValue(true);

        const sync = createEncounterSync({
            getMapFile: () => null,
            getState: () => ({}) as any,
            pausePlayback,
            openEncounter,
        });

        publishEncounterEvent({ ...baseEvent, id: "travel-1", source: "travel" });

        expect(pausePlayback).not.toHaveBeenCalled();
        expect(openEncounter).not.toHaveBeenCalled();

        sync.dispose();
    });
});
