// salt-marcher/tests/encounter/presenter.test.ts
// Testet Encounter-Presenter auf Event-Verarbeitung und Persistenz.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncounterPresenter, publishManualEncounter, type EncounterPersistedState } from "../../src/apps/encounter/presenter";
import { __resetEncounterEventStore, publishEncounterEvent, type EncounterEvent } from "../../src/apps/encounter/session-store";

const baseEvent: EncounterEvent = {
    id: "travel-1",
    source: "travel",
    triggeredAt: "2024-06-01T10:00:00.000Z",
    coord: { r: 4, c: 7 },
    regionName: "Foothills",
    mapName: "Foothills Map",
    mapPath: "regions/foothills.map",
    encounterOdds: 6,
    travelClockHours: 12.5,
};

describe("EncounterPresenter", () => {
    beforeEach(() => {
        __resetEncounterEventStore();
    });

    it("normalises persisted state on restore", () => {
        const persisted: EncounterPersistedState = {
            session: {
                event: baseEvent,
                notes: "Bring backup",
                status: "resolved",
                resolvedAt: "2024-06-01T11:00:00.000Z",
            },
        };
        const presenter = new EncounterPresenter();
        presenter.restore(persisted);
        const state = presenter.getState();
        expect(state.session?.event.id).toBe("travel-1");
        expect(state.session?.status).toBe("resolved");
        expect(state.session?.notes).toBe("Bring backup");
        expect(state.session?.resolvedAt).toBe("2024-06-01T11:00:00.000Z");
    });

    it("resets notes when a new event arrives", () => {
        const presenter = new EncounterPresenter();
        const updates: Array<EncounterPersistedState["session"]> = [];
        presenter.subscribe((state) => updates.push(state.session));
        publishEncounterEvent(baseEvent);
        expect(updates.at(-1)?.notes).toBe("");
        expect(updates.at(-1)?.status).toBe("pending");
        publishManualEncounter({
            ...baseEvent,
            id: "manual-2",
            triggeredAt: "2024-06-02T10:00:00.000Z",
        });
        expect(updates.at(-1)?.event.id).toBe("manual-2");
        expect(updates.at(-1)?.notes).toBe("");
    });

    it("keeps notes/resolution when the same event replays", () => {
        const presenter = new EncounterPresenter();
        publishEncounterEvent(baseEvent);
        presenter.setNotes("Hold position");
        presenter.markResolved();
        const resolvedAt = presenter.getState().session?.resolvedAt;
        publishEncounterEvent({ ...baseEvent, regionName: "Foothills" });
        const state = presenter.getState();
        expect(state.session?.notes).toBe("Hold position");
        expect(state.session?.status).toBe("resolved");
        expect(state.session?.resolvedAt).toBe(resolvedAt);
    });

    it("stamps resolution timestamp via dependency", () => {
        const now = vi.fn(() => "2024-06-01T11:15:00.000Z");
        const presenter = new EncounterPresenter(null, { now });
        publishEncounterEvent(baseEvent);
        presenter.markResolved();
        expect(now).toHaveBeenCalledTimes(1);
        const state = presenter.getState();
        expect(state.session?.status).toBe("resolved");
        expect(state.session?.resolvedAt).toBe("2024-06-01T11:15:00.000Z");
    });
});
