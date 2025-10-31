// salt-marcher/tests/encounter/presenter.test.ts
// Testet Encounter-Presenter auf Event-Verarbeitung und Persistenz.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncounterPresenter, publishManualEncounter, type EncounterPersistedState } from "src/workmodes/encounter/presenter";
import { __resetEncounterEventStore, publishEncounterEvent, type EncounterEvent } from "src/workmodes/encounter/session-store";

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

    describe("manual encounter composition", () => {
        it("creates default manual session when adding creature without session", () => {
            const now = vi.fn(() => "2024-06-01T10:00:00.000Z");
            const presenter = new EncounterPresenter(null, { now });

            // Initially no session
            expect(presenter.getState().session).toBeNull();

            // Add a creature
            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            // Session should now exist with manual source
            const state = presenter.getState();
            expect(state.session).not.toBeNull();
            expect(state.session?.event.source).toBe("manual");
            expect(state.session?.event.triggeredAt).toBe("2024-06-01T10:00:00.000Z");
            expect(state.session?.event.coord).toBeNull();
            expect(state.session?.creatures).toHaveLength(1);
            expect(state.session?.creatures[0].name).toBe("Goblin");
            expect(state.session?.creatures[0].count).toBe(3);
        });

        it("adds multiple creatures to manual session", () => {
            const presenter = new EncounterPresenter();

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            presenter.addCreature({
                id: "creature-2",
                name: "Hobgoblin",
                count: 1,
                cr: 1,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Hobgoblin.md",
            });

            const state = presenter.getState();
            expect(state.session?.creatures).toHaveLength(2);
            expect(state.session?.creatures[0].name).toBe("Goblin");
            expect(state.session?.creatures[1].name).toBe("Hobgoblin");
        });

        it("increments count when adding same creature twice", () => {
            const presenter = new EncounterPresenter();

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 2,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            const state = presenter.getState();
            expect(state.session?.creatures).toHaveLength(1);
            expect(state.session?.creatures[0].count).toBe(5);
        });

        it("can remove creatures from manual session", () => {
            const presenter = new EncounterPresenter();

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            presenter.removeCreature("creature-1");

            const state = presenter.getState();
            expect(state.session?.creatures).toHaveLength(0);
        });

        it("can update creature count in manual session", () => {
            const presenter = new EncounterPresenter();

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            presenter.updateCreature("creature-1", { count: 5 });

            const state = presenter.getState();
            expect(state.session?.creatures[0].count).toBe(5);
        });

        it("manual session persists through view lifecycle", () => {
            const presenter = new EncounterPresenter();

            presenter.addCreature({
                id: "creature-1",
                name: "Goblin",
                count: 3,
                cr: 0.25,
                source: "library",
                statblockPath: "SaltMarcher/Creatures/Goblin.md",
            });

            // Simulate persisting and restoring
            const persisted = presenter.getState();
            const restored = new EncounterPresenter(persisted);
            const state = restored.getState();

            expect(state.session?.event.source).toBe("manual");
            expect(state.session?.creatures).toHaveLength(1);
            expect(state.session?.creatures[0].name).toBe("Goblin");
        });
    });
});
