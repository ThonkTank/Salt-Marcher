// salt-marcher/tests/cartographer/modes/encounter-gateway.test.ts
// Stellt sicher, dass Encounter-Gateway manuelle Ereignisse korrekt veröffentlicht.
import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";

const { publishEncounterEvent, createEncounterEventFromTravel } = vi.hoisted(() => ({
    publishEncounterEvent: vi.fn(),
    createEncounterEventFromTravel: vi.fn(),
}));

vi.mock("../../../src/apps/encounter/session-store", () => ({
    publishEncounterEvent,
}));

vi.mock("../../../src/apps/encounter/event-builder", () => ({
    createEncounterEventFromTravel,
}));

import { publishManualEncounter } from "../../../src/apps/cartographer/modes/travel-guide/encounter-gateway";

describe("publishManualEncounter", () => {
    const app = {} as App;

    it("forwards manual encounter events with overrides", async () => {
        createEncounterEventFromTravel.mockResolvedValue({
            id: "manual-1",
            source: "manual",
            triggeredAt: "2024-07-01T12:00:00.000Z",
            coord: { r: 9, c: 9 },
        });

        await publishManualEncounter(
            app,
            { mapFile: null, state: null },
            { coordOverride: { r: 9, c: 9 }, triggeredAt: "2024-07-01T12:00:00.000Z" },
        );

        expect(createEncounterEventFromTravel).toHaveBeenCalledWith(app, { mapFile: null, state: null }, {
            source: "manual",
            idPrefix: "manual",
            coordOverride: { r: 9, c: 9 },
            triggeredAt: "2024-07-01T12:00:00.000Z",
        });
        expect(publishEncounterEvent).toHaveBeenCalledWith({
            id: "manual-1",
            source: "manual",
            triggeredAt: "2024-07-01T12:00:00.000Z",
            coord: { r: 9, c: 9 },
        });
    });

    it("ignores builder failures", async () => {
        publishEncounterEvent.mockClear();
        createEncounterEventFromTravel.mockReset();
        createEncounterEventFromTravel.mockRejectedValueOnce(new Error("boom"));

        await expect(
            publishManualEncounter(app, { mapFile: null, state: null }, { coordOverride: { r: 1, c: 1 } }),
        ).resolves.toBeUndefined();

        expect(publishEncounterEvent).not.toHaveBeenCalled();
    });
});
