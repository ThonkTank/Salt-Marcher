// salt-marcher/tests/cartographer/modes/encounter-gateway.test.ts
// Stellt sicher, dass Encounter-Gateway manuelle Ereignisse korrekt veröffentlicht und Fehlerpfade signalisiert.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, WorkspaceLeaf } from "obsidian";

const { publishEncounterEvent, createEncounterEventFromTravel } = vi.hoisted(() => ({
    publishEncounterEvent: vi.fn(),
    createEncounterEventFromTravel: vi.fn(),
}));

const noticeSpy = vi.hoisted(() => vi.fn());

vi.mock("obsidian", async () => {
    const actual = await vi.importActual<typeof import("../../mocks/obsidian")>("../../mocks/obsidian");
    class CapturingNotice extends actual.Notice {
        constructor(message?: string) {
            super(message);
            noticeSpy(message);
        }
    }
    return { ...actual, Notice: CapturingNotice };
});

vi.mock("../../../src/apps/encounter/session-store", () => ({
    publishEncounterEvent,
}));

vi.mock("../../../src/apps/encounter/event-builder", () => ({
    createEncounterEventFromTravel,
}));

import {
    openEncounter,
    publishManualEncounter,
} from "../../../src/apps/cartographer/modes/travel-guide/encounter-gateway";

describe("openEncounter", () => {
    const revealLeaf = vi.fn();
    const getRightLeaf = vi.fn();
    const getLeaf = vi.fn();
    const app = {
        workspace: {
            revealLeaf,
            getRightLeaf,
            getLeaf,
        },
    } as unknown as App;

    beforeEach(() => {
        noticeSpy.mockClear();
        createEncounterEventFromTravel.mockReset();
        publishEncounterEvent.mockClear();
        revealLeaf.mockReset();
        getRightLeaf.mockReset();
        getLeaf.mockReset();

        const leaf = { setViewState: vi.fn().mockResolvedValue(undefined) } as unknown as WorkspaceLeaf;
        getRightLeaf.mockReturnValue(leaf);
        getLeaf.mockReturnValue(leaf);
    });

    it("meldet fehlende Kontextdaten", async () => {
        const result = await openEncounter(app, undefined);

        expect(result).toBe(true);
        expect(createEncounterEventFromTravel).not.toHaveBeenCalled();
        expect(noticeSpy).toHaveBeenCalledWith(
            "Begegnung konnte nicht geöffnet werden: Es liegen keine Reisedaten vor.",
        );
    });

    it("meldet fehlende Kartendatei", async () => {
        const result = await openEncounter(app, { mapFile: null, state: null as any });

        expect(result).toBe(true);
        expect(createEncounterEventFromTravel).not.toHaveBeenCalled();
        expect(noticeSpy).toHaveBeenCalledWith(
            "Begegnung enthält keine Kartendatei. Öffne die Karte erneut und versuche es nochmal.",
        );
    });

    it("meldet fehlenden Reisezustand", async () => {
        const fakeFile = { path: "maps/hex.json", basename: "hex" } as any;
        const result = await openEncounter(app, { mapFile: fakeFile, state: null });

        expect(result).toBe(true);
        expect(createEncounterEventFromTravel).not.toHaveBeenCalled();
        expect(noticeSpy).toHaveBeenCalledWith(
            "Begegnung enthält keinen Reisezustand. Aktualisiere den Travel-Guide und versuche es erneut.",
        );
    });

    it("veröffentlicht Begegnungen mit vollständigem Kontext", async () => {
        const fakeFile = { path: "maps/hex.json", basename: "hex" } as any;
        const state = { tokenRC: { r: 2, c: 4 } } as any;
        createEncounterEventFromTravel.mockResolvedValue({ id: "evt-1" } as any);

        const result = await openEncounter(app, { mapFile: fakeFile, state });

        expect(result).toBe(true);
        expect(createEncounterEventFromTravel).toHaveBeenCalledWith(app, { mapFile: fakeFile, state });
        expect(publishEncounterEvent).toHaveBeenCalledWith({ id: "evt-1" });
        expect(noticeSpy).not.toHaveBeenCalled();
    });
});

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
