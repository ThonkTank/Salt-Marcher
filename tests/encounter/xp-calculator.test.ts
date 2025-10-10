// salt-marcher/tests/encounter/xp-calculator.test.ts
// Testet Encounter-XP-Kalkulationen und Ableitungen für Party & Regeln.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        vi.restoreAllMocks();
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
            modifierValueMin: 10,
            modifierValueMax: 10,
            enabled: true,
            scope: "xp",
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
            modifierValueMin: 120,
            modifierValueMax: 120,
            enabled: true,
            scope: "xp",
        });
        presenter.addRule({
            id: "percent",
            title: "Morale",
            modifierType: "percentTotal",
            modifierValue: 10,
            modifierValueMin: 10,
            modifierValueMax: 10,
            enabled: true,
            scope: "xp",
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
            modifierType: "flatPerAverageLevel",
            modifierValue: 10,
            modifierValueMin: 10,
            modifierValueMax: 10,
            enabled: true,
            scope: "xp",
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleView = view.rules.find((rule) => rule.rule.id === "avg-flat");

        // Assert
        expect(view.party[0]?.modifiersDelta).toBeCloseTo(15.5555555556, 6);
        expect(view.party[1]?.modifiersDelta).toBeCloseTo(15.5555555556, 6);
        expect(view.party[2]?.modifiersDelta).toBeCloseTo(15.5555555556, 6);
        expect(ruleView?.totalDelta).toBeCloseTo(46.6666666667, 6);
        expect(view.totalEncounterXp).toBeCloseTo(46.6666666667, 6);
    });

    it("skaliert encounter-weite Flat-pro-Gesamtstufen-Regeln nach individuellem Level", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Kara", level: 2 });
        presenter.addPartyMember({ id: "p2", name: "Lio", level: 5 });
        presenter.addPartyMember({ id: "p3", name: "Mira", level: 7 });
        presenter.setEncounterXp(0);
        presenter.addRule({
            id: "total-flat",
            title: "Level Weighted Reward",
            modifierType: "flatPerTotalLevel",
            modifierValue: 5,
            modifierValueMin: 5,
            modifierValueMax: 5,
            enabled: true,
            scope: "xp",
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleView = view.rules.find((rule) => rule.rule.id === "total-flat");

        // Assert
        expect(view.party[0]?.modifiersDelta).toBeCloseTo(10, 6);
        expect(view.party[1]?.modifiersDelta).toBeCloseTo(25, 6);
        expect(view.party[2]?.modifiersDelta).toBeCloseTo(35, 6);
        expect(ruleView?.totalDelta).toBeCloseTo(70, 6);
        expect(view.totalEncounterXp).toBeCloseTo(70, 6);
    });

    it("würfelt Regelwerte innerhalb der Spannengrenzen neu aus", () => {
        // Arrange
        presenter.addRule({
            id: "random",
            title: "Lucky Roll",
            modifierType: "flat",
            modifierValue: 5,
            modifierValueMin: 5,
            modifierValueMax: 5,
            enabled: true,
            scope: "xp",
        });
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

        // Act
        presenter.updateRule("random", { modifierValueMin: 10, modifierValueMax: 20 });

        // Assert
        let rule = presenter.getState().xp.rules.find((entry) => entry.id === "random");
        expect(rule?.modifierValue).toBeCloseTo(15, 6);

        // Act
        randomSpy.mockReturnValue(0.2);
        presenter.updateRule("random", { modifierValueMin: 30, modifierValueMax: 30 });

        // Assert
        rule = presenter.getState().xp.rules.find((entry) => entry.id === "random");
        expect(rule?.modifierValue).toBe(30);
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
            modifierValueMin: 15,
            modifierValueMax: 15,
            enabled: true,
            scope: "xp",
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleWarnings = view.rules.find((rule) => rule.rule.id === "next")?.warnings ?? [];

        // Assert
        expect(ruleWarnings).toContain("Veteran has no next-level XP threshold.");
        expect(view.warnings).toContain("Veteran has no next-level XP threshold.");
        expect(view.party[0]?.modifiersDelta).toBe(0);
    });

    it("ignoriert Gold-Regeln für die XP-Berechnung", () => {
        // Arrange
        presenter.addPartyMember({ id: "p1", name: "Collector", level: 4 });
        presenter.setEncounterXp(200);
        presenter.addRule({
            id: "gold",
            title: "Treasure",
            modifierType: "flat",
            modifierValue: 150,
            modifierValueMin: 150,
            modifierValueMax: 150,
            enabled: true,
            scope: "gold",
        });

        // Act
        const view = presenter.getState().xpView;
        const ruleView = view.rules.find((rule) => rule.rule.id === "gold");

        // Assert
        expect(ruleView?.totalDelta).toBe(0);
        expect(view.totalEncounterXp).toBeCloseTo(200, 6);
        expect(view.party[0]?.totalXp).toBeCloseTo(200, 6);
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
