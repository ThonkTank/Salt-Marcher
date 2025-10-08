// salt-marcher/tests/encounter/presenter-xp.test.ts
// Testet Encounter-Presenter auf XP-CRUD, Normalisierung und Persistenz.
import { beforeEach, describe, expect, it } from "vitest";
import {
    EncounterPresenter,
    type EncounterPersistedState,
} from "../../src/apps/encounter/presenter";
import {
    __resetEncounterEventStore,
    getEncounterXpState,
} from "../../src/apps/encounter/session-store";

describe("EncounterPresenter XP-Verwaltung", () => {
    beforeEach(() => {
        __resetEncounterEventStore();
    });

    it("unterstützt Party-CRUD und normalisiert Werte", () => {
        // Arrange
        const presenter = new EncounterPresenter();
        const updates: unknown[] = [];
        presenter.subscribe((state) => {
            updates.push(state.xp.party.map((member) => ({
                id: member.id,
                name: member.name,
                level: member.level,
                currentXp: member.currentXp ?? null,
            })));
        });

        // Act
        presenter.addPartyMember({ id: "m1", name: "Kara", level: 3, currentXp: 900 });
        presenter.updatePartyMember("m1", { level: 0, currentXp: -200 });
        presenter.removePartyMember("m1");
        presenter.dispose();

        // Assert
        expect(updates.at(1)).toEqual([
            { id: "m1", name: "Kara", level: 3, currentXp: 900 },
        ]);
        expect(updates.at(2)).toEqual([
            { id: "m1", name: "Kara", level: 1, currentXp: 0 },
        ]);
        expect(updates.at(3)).toEqual([]);
    });

    it("setzt Encounter-XP auf 0, wenn negative Werte eingegeben werden", () => {
        // Arrange
        const presenter = new EncounterPresenter();

        // Act
        presenter.setEncounterXp(-250);
        const xpView = presenter.getState().xpView;
        presenter.dispose();

        // Assert
        expect(xpView.baseEncounterXp).toBe(0);
        expect(xpView.totalEncounterXp).toBe(0);
    });

    it("übernimmt persisted XP-State und gibt ihn an neue Presenter weiter", () => {
        // Arrange
        const persisted: EncounterPersistedState = {
            session: null,
            xp: {
                encounterXp: 450,
                party: [
                    { id: "a", name: "Anka", level: 4, currentXp: 2000 },
                    { id: "b", name: "Borin", level: 5 },
                ],
                rules: [
                    {
                        id: "boost",
                        title: "Story Bonus",
                        scope: "overall",
                        modifierType: "percentTotal",
                        modifierValue: 150,
                        enabled: true,
                    },
                ],
            },
        };

        // Act
        const firstPresenter = new EncounterPresenter();
        firstPresenter.restore(persisted);
        const firstState = firstPresenter.getState();
        firstPresenter.dispose();
        const secondPresenter = new EncounterPresenter();
        const secondState = secondPresenter.getState();
        const storeSnapshot = getEncounterXpState();
        secondPresenter.dispose();

        // Assert
        expect(firstState.xp.encounterXp).toBe(450);
        expect(firstState.xp.party).toHaveLength(2);
        expect(firstState.xp.rules[0]?.modifierValue).toBe(100);
        expect(secondState.xp.encounterXp).toBe(450);
        expect(storeSnapshot.rules[0]?.modifierValue).toBe(100);
    });
});
