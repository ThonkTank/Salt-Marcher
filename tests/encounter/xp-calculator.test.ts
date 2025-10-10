// salt-marcher/tests/encounter/xp-calculator.test.ts
// Testet Encounter-XP-Kalkulationen und Ableitungen für Party & Regeln.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    EncounterPresenter,
    calculateXpToNextLevel,
    type EncounterXpPartyMemberView,
} from "../../src/apps/encounter/presenter";
import { __resetEncounterEventStore } from "../../src/apps/encounter/session-store";

describe("calculateXpToNextLevel", () => {
    beforeEach(() => {
        __resetEncounterEventStore();
    });

    it("verwendet Level-Schwellen, wenn aktueller XP-Stand fehlt", () => {
        // Arrange
        const level = 3;

        // Act
        const xpToNext = calculateXpToNextLevel(level);

        // Assert
        expect(xpToNext).toBe(1800);
    });

    it("gibt null für Stufe 20 oder fehlende Schwellen zurück", () => {
        // Arrange
        const level = 20;

        // Act
        const xpToNext = calculateXpToNextLevel(level);

        // Assert
        expect(xpToNext).toBeNull();
    });

    it("normalisiert ungültige Level-Angaben auf die niedrigste Stufe", () => {
        // Arrange
        const negativeLevel = -2;

        // Act
        const xpToNext = calculateXpToNextLevel(negativeLevel, Number.POSITIVE_INFINITY);

        // Assert
        expect(xpToNext).toBe(300);
    });

    it("setzt XP bis zum nächsten Level auf 0, wenn der Wert bereits erreicht wurde", () => {
        // Arrange
        const level = 5;
        const currentXp = 20000;

        // Act
        const xpToNext = calculateXpToNextLevel(level, currentXp);

        // Assert
        expect(xpToNext).toBe(0);
    });
});

describe("Encounter XP View", () => {
    let presenter: EncounterPresenter;

    beforeEach(() => {
        __resetEncounterEventStore();
        presenter = new EncounterPresenter();
    });

    afterEach(() => {
        presenter.dispose();
    });

    it("verteilt Prozentregeln anhand des XP-Bedarfs bis zum Levelaufstieg gleichmäßig", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Kara", level: 5, currentXp: 7000 });
        presenter.addPartyMember({ id: "p2", name: "Lio", level: 3, currentXp: 1100 });
        presenter.setEncounterXp(400);
        presenter.addRule({
            id: "r-next",
            title: "Mentor Bonus",
            modifierType: "percentNextLevel",
            modifierValue: 10,
            enabled: true,
        });

        // Act
        const view = presenter.getState().xpView;
        const member1 = view.party.find((entry) => entry.member.id === "p1") as EncounterXpPartyMemberView;
        const member2 = view.party.find((entry) => entry.member.id === "p2") as EncounterXpPartyMemberView;
        const ruleView = view.rules.find((rule) => rule.rule.id === "r-next");

        // Assert
        expect(member1.baseXp).toBeCloseTo(200, 6);
        expect(member1.modifiersDelta).toBeCloseTo(430, 6);
        expect(member1.totalXp).toBeCloseTo(630, 6);
        expect(member2.modifiersDelta).toBeCloseTo(430, 6);
        expect(member2.totalXp).toBeCloseTo(630, 6);
        expect(ruleView?.totalDelta).toBeCloseTo(860, 6);
        expect(view.totalEncounterXp).toBeCloseTo(1260, 6);
    });

    it("stapelt globale Modifikatoren in Reihenfolge der Regeln", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Kara", level: 5 });
        presenter.addPartyMember({ id: "p2", name: "Lio", level: 5 });
        presenter.addPartyMember({ id: "p3", name: "Mira", level: 5 });
        presenter.setEncounterXp(600);
        presenter.addRule({
            id: "flat",
            title: "Loot",
            modifierType: "flat",
            modifierValue: 120,
            enabled: true,
        });
        presenter.addRule({
            id: "percent",
            title: "Morale",
            modifierType: "percentTotal",
            modifierValue: 10,
            enabled: true,
        });

        // Act
        const view = presenter.getState().xpView;
        const totals = view.party.map((entry) => ({
            id: entry.member.id,
            base: entry.baseXp,
            modifiers: entry.modifiersDelta,
            total: entry.totalXp,
        }));
        const flatRule = view.rules.find((rule) => rule.rule.id === "flat");
        const percentRule = view.rules.find((rule) => rule.rule.id === "percent");

        // Assert
        expect(totals).toMatchObject([
            { id: "p1", base: 200, modifiers: 64, total: 264 },
            { id: "p2", base: 200, modifiers: 64, total: 264 },
            { id: "p3", base: 200, modifiers: 64, total: 264 },
        ]);
        expect(flatRule?.totalDelta).toBeCloseTo(120, 6);
        expect(percentRule?.totalDelta).toBeCloseTo(72, 6);
        expect(view.totalEncounterXp).toBeCloseTo(792, 6);
    });

    it("skaliert encounter-weite Flat-pro-Level-Regeln mit dem Durchschnittslevel", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Kara", level: 2 });
        presenter.addPartyMember({ id: "p2", name: "Lio", level: 5 });
        presenter.addPartyMember({ id: "p3", name: "Mira", level: 7 });
        presenter.setEncounterXp(0);
        presenter.addRule({
            id: "avg-flat",
            title: "Scaling Reward",
            modifierType: "flatPerLevel",
            modifierValue: 10,
            enabled: true,
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleView = view.rules.find((rule) => rule.rule.id === "avg-flat");

        // Assert
        expect(view.party[0]?.modifiersDelta).toBeCloseTo(46.6666666667, 6);
        expect(view.party[1]?.modifiersDelta).toBeCloseTo(46.6666666667, 6);
        expect(view.party[2]?.modifiersDelta).toBeCloseTo(46.6666666667, 6);
        expect(ruleView?.totalDelta).toBeCloseTo(140, 6);
        expect(view.totalEncounterXp).toBeCloseTo(140, 6);
    });

    it("meldet Warnungen, wenn Prozent-auf-Level-Aufstieg-Regeln keine Schwelle finden", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Veteran", level: 20 });
        presenter.setEncounterXp(100);
        presenter.addRule({
            id: "next",
            title: "Epic Bonus",
            modifierType: "percentNextLevel",
            modifierValue: 15,
            enabled: true,
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleWarnings = view.rules.find((rule) => rule.rule.id === "next")?.warnings ?? [];

        // Assert
        expect(ruleWarnings).toContain("Veteran has no next-level XP threshold.");
        expect(view.warnings).toContain("Veteran has no next-level XP threshold.");
        expect(view.party[0]?.modifiersDelta).toBe(0);
    });

    it("warnt, wenn Encounter-XP ohne Party vergeben werden", () => {
        // Arrange
        presenter.setEncounterXp(250);

        // Act
        const view = presenter.getState().xpView;

        // Assert
        expect(view.warnings).toContain("Encounter XP assigned but no party members present.");
    });
});
