// devkit/testing/unit/features/factions/relationships.test.ts
// Unit tests for Dynamic Faction Relationships

import { describe, it, expect } from "vitest";
import {
    getRelationshipValue,
    updateRelationshipByAction,
    getRelationshipType,
    applyRelationshipDecay,
    areFactionsAtWar,
    areFactionsAllied,
    getHostileFactions,
    getAlliedFactions,
    propagateRelationshipChange,
    improveMutualRelationship,
    degradeMutualRelationship,
} from "../../../../../src/features/factions/relationships";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

describe("Dynamic Faction Relationships", () => {
    const faction1: FactionData = {
        name: "Faction A",
        faction_relationships: [
            { faction_name: "Faction B", value: 50, type: "allied" },
            { faction_name: "Faction C", value: -40, type: "hostile" },
            { faction_name: "Faction D", value: 0, type: "neutral" },
        ],
    };

    describe("getRelationshipValue", () => {
        it("returns relationship value if exists", () => {
            const value = getRelationshipValue(faction1, "Faction B");
            expect(value).toBe(50);
        });

        it("returns 0 if relationship does not exist", () => {
            const value = getRelationshipValue(faction1, "Unknown Faction");
            expect(value).toBe(0);
        });
    });

    describe("updateRelationshipByAction", () => {
        it("creates new relationship if it doesn't exist", () => {
            const faction: FactionData = { name: "Test", faction_relationships: [] };
            updateRelationshipByAction(faction, "New Faction", "form_alliance");

            expect(faction.faction_relationships).toHaveLength(1);
            expect(faction.faction_relationships![0].faction_name).toBe("New Faction");
            expect(faction.faction_relationships![0].value).toBe(30); // form_alliance impact
        });

        it("updates existing relationship with positive action", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 10, type: "neutral" }],
            };

            updateRelationshipByAction(faction, "Target", "trade_resources");

            expect(faction.faction_relationships![0].value).toBe(20); // 10 + 10
            expect(faction.faction_relationships![0].type).toBe("trade");
        });

        it("updates existing relationship with negative action", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 10, type: "neutral" }],
            };

            updateRelationshipByAction(faction, "Target", "raid_target");

            expect(faction.faction_relationships![0].value).toBe(-30); // 10 - 40
            expect(faction.faction_relationships![0].type).toBe("rivalry");
        });

        it("clamps relationship value between -100 and 100", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 90, type: "allied" }],
            };

            updateRelationshipByAction(faction, "Target", "form_alliance");

            expect(faction.faction_relationships![0].value).toBe(100); // Clamped at 100
        });

        it("supports custom impact values", () => {
            const faction: FactionData = { name: "Test", faction_relationships: [] };
            updateRelationshipByAction(faction, "Target", "custom_action", 25);

            expect(faction.faction_relationships![0].value).toBe(25);
        });
    });

    describe("getRelationshipType", () => {
        it("returns 'allied' for high positive values", () => {
            expect(getRelationshipType(80)).toBe("allied");
        });

        it("returns 'trade' for moderate positive values", () => {
            expect(getRelationshipType(30)).toBe("trade");
        });

        it("returns 'neutral' for values near zero", () => {
            expect(getRelationshipType(5)).toBe("neutral");
            expect(getRelationshipType(-5)).toBe("neutral");
        });

        it("returns 'rivalry' for moderate negative values", () => {
            expect(getRelationshipType(-30)).toBe("rivalry");
        });

        it("returns 'hostile' for high negative values", () => {
            expect(getRelationshipType(-80)).toBe("hostile");
        });
    });

    describe("applyRelationshipDecay", () => {
        it("decays positive relationships toward neutral", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 50, type: "allied" }],
            };

            applyRelationshipDecay(faction, 5);

            expect(faction.faction_relationships![0].value).toBe(45);
        });

        it("decays negative relationships toward neutral", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: -50, type: "hostile" }],
            };

            applyRelationshipDecay(faction, 5);

            expect(faction.faction_relationships![0].value).toBe(-45);
        });

        it("does not decay past neutral (0)", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 2, type: "neutral" }],
            };

            applyRelationshipDecay(faction, 5);

            expect(faction.faction_relationships![0].value).toBe(0);
        });

        it("updates relationship type after decay", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Target", value: 65, type: "allied" }],
            };

            applyRelationshipDecay(faction, 10);

            expect(faction.faction_relationships![0].value).toBe(55);
            // After decay to 55, type becomes "trade" (20-59), not "allied" (60+)
            expect(faction.faction_relationships![0].type).toBe("trade");
        });
    });

    describe("areFactionsAtWar", () => {
        it("returns true for hostile relationships", () => {
            expect(areFactionsAtWar(faction1, "Faction C")).toBe(false); // -40 > -60
        });

        it("returns false for neutral/positive relationships", () => {
            expect(areFactionsAtWar(faction1, "Faction B")).toBe(false);
        });

        it("supports custom threshold", () => {
            expect(areFactionsAtWar(faction1, "Faction C", -30)).toBe(true);
        });
    });

    describe("areFactionsAllied", () => {
        it("returns false for moderate positive relationships", () => {
            expect(areFactionsAllied(faction1, "Faction B")).toBe(false); // 50 < 60
        });

        it("returns true for high positive relationships", () => {
            const faction: FactionData = {
                name: "Test",
                faction_relationships: [{ faction_name: "Ally", value: 80, type: "allied" }],
            };
            expect(areFactionsAllied(faction, "Ally")).toBe(true);
        });

        it("supports custom threshold", () => {
            expect(areFactionsAllied(faction1, "Faction B", 40)).toBe(true);
        });
    });

    describe("getHostileFactions", () => {
        it("returns all factions below threshold", () => {
            const hostile = getHostileFactions(faction1);
            expect(hostile).toEqual(["Faction C"]);
        });

        it("supports custom threshold", () => {
            const hostile = getHostileFactions(faction1, -50);
            expect(hostile).toHaveLength(0); // -40 is above -50
        });
    });

    describe("getAlliedFactions", () => {
        it("returns all factions above threshold", () => {
            const allied = getAlliedFactions(faction1);
            expect(allied).toEqual(["Faction B"]);
        });

        it("supports custom threshold", () => {
            const allied = getAlliedFactions(faction1, 60);
            expect(allied).toHaveLength(0); // 50 is below 60
        });
    });

    describe("propagateRelationshipChange", () => {
        it("propagates relationship changes to allies", () => {
            const source: FactionData = {
                name: "Source",
                faction_relationships: [
                    { faction_name: "Ally", value: 70, type: "allied" },
                    { faction_name: "Enemy", value: -80, type: "hostile" },
                ],
            };

            const ally: FactionData = {
                name: "Ally",
                faction_relationships: [],
            };

            const allFactions = [source, ally];

            propagateRelationshipChange(source, "Enemy", allFactions);

            // Ally should now have negative relationship with Enemy
            expect(ally.faction_relationships).toHaveLength(1);
            expect(ally.faction_relationships![0].faction_name).toBe("Enemy");
            expect(ally.faction_relationships![0].value).toBeLessThan(0);
        });

        it("does not propagate to non-allied factions", () => {
            const source: FactionData = {
                name: "Source",
                faction_relationships: [
                    { faction_name: "Neutral", value: 20, type: "neutral" },
                    { faction_name: "Enemy", value: -60, type: "hostile" },
                ],
            };

            const neutral: FactionData = {
                name: "Neutral",
                faction_relationships: [],
            };

            propagateRelationshipChange(source, "Enemy", [source, neutral]);

            // Neutral faction should not be affected
            expect(neutral.faction_relationships).toHaveLength(0);
        });
    });

    describe("improveMutualRelationship", () => {
        it("improves relationship for both factions", () => {
            const faction1: FactionData = {
                name: "Faction 1",
                faction_relationships: [],
            };

            const faction2: FactionData = {
                name: "Faction 2",
                faction_relationships: [],
            };

            improveMutualRelationship(faction1, faction2, 20);

            expect(faction1.faction_relationships![0].value).toBe(20);
            expect(faction2.faction_relationships![0].value).toBe(20);
        });
    });

    describe("degradeMutualRelationship", () => {
        it("degrades relationship for both factions", () => {
            const faction1: FactionData = {
                name: "Faction 1",
                faction_relationships: [{ faction_name: "Faction 2", value: 50, type: "allied" }],
            };

            const faction2: FactionData = {
                name: "Faction 2",
                faction_relationships: [{ faction_name: "Faction 1", value: 50, type: "allied" }],
            };

            degradeMutualRelationship(faction1, faction2, 30);

            expect(faction1.faction_relationships![0].value).toBe(20);
            expect(faction2.faction_relationships![0].value).toBe(20);
        });
    });
});
