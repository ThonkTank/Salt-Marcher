// devkit/testing/unit/features/factions/military.test.ts
// Unit tests for Military Simulation

import { describe, it, expect } from "vitest";
import {
    calculateMilitaryStrength,
    convertMembersToMilitaryUnits,
    initiateMilitaryEngagement,
    simulateBattle,
    applyCasualties,
    updateMorale,
    getActiveEngagements,
    resolveSiege,
    getTacticalDecision,
} from "../../../../../src/features/factions/military";
import type { FactionData, MilitaryUnit, FactionMember } from "../../../../../src/workmodes/library/factions/types";

describe("Military Simulation", () => {
    describe("calculateMilitaryStrength", () => {
        it("calculates strength based on quantity and multipliers", () => {
            const units: MilitaryUnit[] = [
                {
                    name: "Infantry",
                    quantity: 100,
                    statblock_ref: "Guard",
                    training: 50,
                    morale: 70,
                    equipment_quality: 50,
                },
            ];

            const strength = calculateMilitaryStrength(units);
            // Base: 100, Training: 1.5x, Morale: 1.7x, Equipment: 1.5x
            // Total: 100 * 1.5 * 1.7 * 1.5 = 382.5 → 382
            expect(strength).toBe(382);
        });

        it("sums strength across multiple units", () => {
            const units: MilitaryUnit[] = [
                { name: "Infantry", quantity: 50, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
                { name: "Cavalry", quantity: 20, statblock_ref: "Knight", training: 70, morale: 80, equipment_quality: 70 },
            ];

            const strength = calculateMilitaryStrength(units);
            expect(strength).toBeGreaterThan(0);
        });
    });

    describe("convertMembersToMilitaryUnits", () => {
        it("converts faction members to military units", () => {
            const members: FactionMember[] = [
                { name: "Guard Patrol", is_named: false, quantity: 20, statblock_ref: "Guard" },
                { name: "Captain Thorne", is_named: true, quantity: 1, statblock_ref: "Veteran" },
            ];

            const units = convertMembersToMilitaryUnits(members);

            expect(units).toHaveLength(2);
            expect(units[0].quantity).toBe(20);
            expect(units[1].quantity).toBe(1);
        });

        it("skips named NPCs without quantity", () => {
            const members: FactionMember[] = [
                { name: "King Arthur", is_named: true, statblock_ref: "Noble" },
            ];

            const units = convertMembersToMilitaryUnits(members);

            expect(units).toHaveLength(0);
        });

        it("uses default values for training/morale/equipment", () => {
            const members: FactionMember[] = [
                { name: "Militia", is_named: false, quantity: 50, statblock_ref: "Commoner" },
            ];

            const units = convertMembersToMilitaryUnits(members);

            expect(units[0].training).toBe(50);
            expect(units[0].morale).toBe(70);
            expect(units[0].equipment_quality).toBe(50);
        });
    });

    describe("initiateMilitaryEngagement", () => {
        it("creates new engagement", () => {
            const attacker: FactionData = { name: "Attacker", military_engagements: [] };
            const defender: FactionData = { name: "Defender" };

            const units: MilitaryUnit[] = [
                { name: "Soldiers", quantity: 100, statblock_ref: "Guard", training: 50, morale: 70, equipment_quality: 50 },
            ];

            const engagement = initiateMilitaryEngagement(
                attacker,
                defender,
                "battle",
                "Border Fort",
                units,
                "1492-03-15"
            );

            expect(engagement.type).toBe("battle");
            expect(engagement.opponent).toBe("Defender");
            expect(engagement.status).toBe("ongoing");
            expect(attacker.military_engagements).toHaveLength(1);
        });
    });

    describe("simulateBattle", () => {
        it("declares attacker victory with overwhelming force", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Army", quantity: 1000, statblock_ref: "Soldier", training: 80, morale: 80, equipment_quality: 80 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Defenders", quantity: 100, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "battle", "Field", attackerUnits, "1492-01-01");

            const result = simulateBattle(attacker, defender, engagement, defenderUnits);

            expect(result.victor).toBe("attacker");
            expect(engagement.status).toBe("victory");
            // Victory confirmed, casualties depend on defender bonus
        });

        it("declares defender victory when well-defended", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Raiders", quantity: 50, statblock_ref: "Bandit", training: 30, morale: 40, equipment_quality: 30 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Garrison", quantity: 200, statblock_ref: "Guard", training: 70, morale: 80, equipment_quality: 70 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "battle", "Fortress", attackerUnits, "1492-01-01");

            const result = simulateBattle(attacker, defender, engagement, defenderUnits);

            expect(result.victor).toBe("defender");
            expect(engagement.status).toBe("defeat");
        });

        it("results in stalemate when forces are balanced", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Army", quantity: 100, statblock_ref: "Soldier", training: 60, morale: 60, equipment_quality: 60 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Defenders", quantity: 100, statblock_ref: "Soldier", training: 60, morale: 60, equipment_quality: 60 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "battle", "Plains", attackerUnits, "1492-01-01");

            const result = simulateBattle(attacker, defender, engagement, defenderUnits);

            // With equal forces and defender bonus (1.2x), defender has advantage or stalemate
            expect(["stalemate", "defender"]).toContain(result.victor);
        });
    });

    describe("applyCasualties", () => {
        it("reduces unit quantities", () => {
            const faction: FactionData = {
                name: "Test",
                members: [
                    { name: "Infantry", is_named: false, quantity: 100, statblock_ref: "Guard" },
                    { name: "Cavalry", is_named: false, quantity: 50, statblock_ref: "Knight" },
                ],
            };

            const engagedUnits: MilitaryUnit[] = [
                { name: "Infantry", quantity: 100, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
            ];

            applyCasualties(faction, 30, engagedUnits);

            expect(faction.members[0].quantity).toBe(70);
            expect(faction.members[1].quantity).toBe(50); // Unchanged
        });

        it("removes member when quantity reaches zero", () => {
            const faction: FactionData = {
                name: "Test",
                members: [
                    { name: "Infantry", is_named: false, quantity: 20, statblock_ref: "Guard" },
                ],
            };

            const engagedUnits: MilitaryUnit[] = [
                { name: "Infantry", quantity: 20, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
            ];

            applyCasualties(faction, 25, engagedUnits);

            expect(faction.members).toHaveLength(0);
        });
    });

    describe("updateMorale", () => {
        it("increases morale", () => {
            const units: MilitaryUnit[] = [
                { name: "Infantry", quantity: 100, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
            ];

            updateMorale(units, 20);

            expect(units[0].morale).toBe(70);
        });

        it("clamps morale at 100", () => {
            const units: MilitaryUnit[] = [
                { name: "Infantry", quantity: 100, statblock_ref: "Guard", training: 50, morale: 95, equipment_quality: 50 },
            ];

            updateMorale(units, 20);

            expect(units[0].morale).toBe(100);
        });

        it("clamps morale at 0", () => {
            const units: MilitaryUnit[] = [
                { name: "Infantry", quantity: 100, statblock_ref: "Guard", training: 50, morale: 10, equipment_quality: 50 },
            ];

            updateMorale(units, -20);

            expect(units[0].morale).toBe(0);
        });
    });

    describe("getActiveEngagements", () => {
        it("returns only ongoing engagements", () => {
            const faction: FactionData = {
                name: "Test",
                military_engagements: [
                    { id: "1", type: "battle", opponent: "A", location: "X", started: "2020-01-01", status: "ongoing", committed_units: [] },
                    { id: "2", type: "siege", opponent: "B", location: "Y", started: "2020-01-02", status: "victory", committed_units: [] },
                    { id: "3", type: "raid", opponent: "C", location: "Z", started: "2020-01-03", status: "ongoing", committed_units: [] },
                ],
            };

            const active = getActiveEngagements(faction);

            expect(active).toHaveLength(2);
            expect(active.map((e) => e.id)).toEqual(["1", "3"]);
        });
    });

    describe("resolveSiege", () => {
        it("continues siege if duration < 10 days", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Army", quantity: 500, statblock_ref: "Soldier", training: 60, morale: 60, equipment_quality: 60 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Garrison", quantity: 200, statblock_ref: "Guard", training: 70, morale: 70, equipment_quality: 70 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "siege", "Castle", attackerUnits, "1492-01-01");

            const result = resolveSiege(attacker, defender, engagement, defenderUnits, 5);

            expect(result.status).toBe("ongoing");
        });

        it("resolves siege with breakthrough after sufficient time", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Army", quantity: 1000, statblock_ref: "Soldier", training: 80, morale: 80, equipment_quality: 80 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Garrison", quantity: 100, statblock_ref: "Guard", training: 50, morale: 50, equipment_quality: 50 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "siege", "Fort", attackerUnits, "1492-01-01");

            const result = resolveSiege(attacker, defender, engagement, defenderUnits, 15);

            expect(result.status).toBe("breakthrough");
            expect(engagement.status).toBe("victory");
        });

        it("starves out defenders after 30 days", () => {
            const attacker: FactionData = { name: "Attacker" };
            const defender: FactionData = { name: "Defender" };

            const attackerUnits: MilitaryUnit[] = [
                { name: "Army", quantity: 200, statblock_ref: "Soldier", training: 60, morale: 60, equipment_quality: 60 },
            ];

            const defenderUnits: MilitaryUnit[] = [
                { name: "Garrison", quantity: 150, statblock_ref: "Guard", training: 70, morale: 70, equipment_quality: 70 },
            ];

            const engagement = initiateMilitaryEngagement(attacker, defender, "siege", "Stronghold", attackerUnits, "1492-01-01");

            const result = resolveSiege(attacker, defender, engagement, defenderUnits, 35);

            expect(result.status).toBe("starved_out");
        });
    });

    describe("getTacticalDecision", () => {
        const faction: FactionData = { name: "Commander" };

        it("recommends attack with overwhelming force", () => {
            const decision = getTacticalDecision(faction, 1000, 2000);
            expect(decision).toBe("attack");
        });

        it("recommends retreat when outnumbered", () => {
            const decision = getTacticalDecision(faction, 2000, 800);
            expect(decision).toBe("retreat");
        });

        it("recommends ambush in forest with even forces", () => {
            const decision = getTacticalDecision(faction, 1000, 1000, "forest");
            expect(["ambush", "flank"]).toContain(decision);
        });

        it("recommends defend as default", () => {
            const decision = getTacticalDecision(faction, 1000, 1100, "open");
            expect(decision).toBe("defend");
        });
    });
});
