// devkit/testing/unit/loot/loot-generator.test.ts
// Unit tests for Loot Generator gold calculation

import { describe, it, expect } from "vitest";
import { generateLoot, formatGold, formatLootSummary } from "../../../../src/features/loot/loot-generator";
import type { LootGenerationContext, LootGenerationConfig } from "../../../../src/features/loot/types";
import type { EncounterXpRule } from "../../../../src/workmodes/encounter/session-store";

describe("Loot Generator - Gold Calculation", () => {
    describe("Base Gold Calculation", () => {
        it("calculates base gold for level 1-4 party (multiplier 0.475)", () => {
            const context: LootGenerationContext = {
                partyLevel: 3,
                partySize: 4,
                encounterXp: 1000,
            };

            const result = generateLoot(context);

            // Base gold = 1000 * 0.475 = 475
            expect(result.breakdown.baseGold).toBeCloseTo(475, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(475, 2);
            expect(result.bundle.gold).toBe(475);
        });

        it("calculates base gold for level 5-10 party (multiplier 0.415)", () => {
            const context: LootGenerationContext = {
                partyLevel: 7,
                partySize: 4,
                encounterXp: 2000,
            };

            const result = generateLoot(context);

            // Base gold = 2000 * 0.415 = 830
            expect(result.breakdown.baseGold).toBeCloseTo(830, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(830, 2);
            expect(result.bundle.gold).toBe(830);
        });

        it("calculates base gold for level 11-16 party (multiplier 1.6)", () => {
            const context: LootGenerationContext = {
                partyLevel: 13,
                partySize: 4,
                encounterXp: 5000,
            };

            const result = generateLoot(context);

            // Base gold = 5000 * 1.6 = 8000
            expect(result.breakdown.baseGold).toBeCloseTo(8000, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(8000, 2);
            expect(result.bundle.gold).toBe(8000);
        });

        it("calculates base gold for level 17+ party (multiplier 3.2)", () => {
            const context: LootGenerationContext = {
                partyLevel: 18,
                partySize: 4,
                encounterXp: 10000,
            };

            const result = generateLoot(context);

            // Base gold = 10000 * 3.2 = 32000
            expect(result.breakdown.baseGold).toBeCloseTo(32000, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(32000, 2);
            expect(result.bundle.gold).toBe(32000);
        });

        it("applies gold modifier to base calculation", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
                goldModifier: 1.5, // 50% bonus
            };

            const result = generateLoot(context);

            // Base gold = 1000 * 0.415 * 1.5 = 622.5
            expect(result.breakdown.baseGold).toBeCloseTo(622.5, 2);
            expect(result.bundle.gold).toBe(623); // Rounded
        });

        it("returns zero gold for zero XP", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 0,
            };

            const result = generateLoot(context);

            expect(result.breakdown.baseGold).toBe(0);
            expect(result.breakdown.finalGold).toBe(0);
            expect(result.bundle.gold).toBe(0);
        });
    });

    describe("Gold Rule Modifiers", () => {
        it("applies flat gold modifier", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "flat-bonus",
                    title: "Treasure Bonus",
                    modifierType: "flat",
                    modifierValue: 200,
                    modifierValueMin: 200,
                    modifierValueMax: 200,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 1000 * 0.415 = 415
            // Modifier = 200
            // Total = 615
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2);
            expect(result.breakdown.goldModifiers).toBeCloseTo(200, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(615, 2);
        });

        it("applies flatPerAverageLevel modifier", () => {
            const context: LootGenerationContext = {
                partyLevel: 6,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "level-bonus",
                    title: "Level Bonus",
                    modifierType: "flatPerAverageLevel",
                    modifierValue: 50,
                    modifierValueMin: 50,
                    modifierValueMax: 50,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 1000 * 0.415 = 415
            // Modifier = 50 * 6 = 300
            // Total = 715
            expect(result.breakdown.goldModifiers).toBeCloseTo(300, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(715, 2);
        });

        it("applies flatPerTotalLevel modifier", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 3,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "total-level-bonus",
                    title: "Total Level Bonus",
                    modifierType: "flatPerTotalLevel",
                    modifierValue: 10,
                    modifierValueMin: 10,
                    modifierValueMax: 10,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 1000 * 0.415 = 415
            // Modifier = 10 * (5 * 3) = 10 * 15 = 150
            // Total = 565
            expect(result.breakdown.goldModifiers).toBeCloseTo(150, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(565, 2);
        });

        it("applies percentTotal modifier", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "percent-bonus",
                    title: "Percent Bonus",
                    modifierType: "percentTotal",
                    modifierValue: 25, // 25%
                    modifierValueMin: 25,
                    modifierValueMax: 25,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 1000 * 0.415 = 415
            // Modifier = 415 * 0.25 = 103.75
            // Total = 518.75
            expect(result.breakdown.goldModifiers).toBeCloseTo(103.75, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(518.75, 2);
        });

        it("applies percentNextLevel modifier", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "next-level-bonus",
                    title: "Next Level Bonus",
                    modifierType: "percentNextLevel",
                    modifierValue: 10, // 10%
                    modifierValueMin: 10,
                    modifierValueMax: 10,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // XP from level 5 to 6 = 14000 - 6500 = 7500
            // Aggregate XP for 4 members = 7500 * 4 = 30000
            // Modifier = 30000 * 0.10 = 3000
            // Base gold = 415
            // Total = 3415
            expect(result.breakdown.goldModifiers).toBeCloseTo(3000, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(3415, 2);
        });

        it("chains multiple modifiers correctly", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "flat",
                    title: "Flat Bonus",
                    modifierType: "flat",
                    modifierValue: 100,
                    modifierValueMin: 100,
                    modifierValueMax: 100,
                    enabled: true,
                    scope: "gold",
                },
                {
                    id: "percent",
                    title: "Percent Bonus",
                    modifierType: "percentTotal",
                    modifierValue: 10, // 10%
                    modifierValueMin: 10,
                    modifierValueMax: 10,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 1000 * 0.415 = 415
            // After flat: 415 + 100 = 515
            // After percent: 515 + (515 * 0.10) = 515 + 51.5 = 566.5
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2);
            expect(result.breakdown.goldModifiers).toBeCloseTo(151.5, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(566.5, 2);
        });

        it("ignores disabled gold rules", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "disabled",
                    title: "Disabled Rule",
                    modifierType: "flat",
                    modifierValue: 500,
                    modifierValueMin: 500,
                    modifierValueMax: 500,
                    enabled: false, // Disabled
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Only base gold, no modifiers
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2);
            expect(result.breakdown.goldModifiers).toBe(0);
            expect(result.breakdown.finalGold).toBeCloseTo(415, 2);
        });

        it("ignores xp-scoped rules for gold calculation", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "xp-rule",
                    title: "XP Rule",
                    modifierType: "flat",
                    modifierValue: 500,
                    modifierValueMin: 500,
                    modifierValueMax: 500,
                    enabled: true,
                    scope: "xp", // XP scope, not gold
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Only base gold, XP rules ignored
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2);
            expect(result.breakdown.goldModifiers).toBe(0);
            expect(result.breakdown.finalGold).toBeCloseTo(415, 2);
        });
    });

    describe("Edge Cases & Warnings", () => {
        it("warns when percentNextLevel is used with level 20 party", () => {
            const context: LootGenerationContext = {
                partyLevel: 20,
                partySize: 4,
                encounterXp: 10000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "next-level",
                    title: "Next Level Bonus",
                    modifierType: "percentNextLevel",
                    modifierValue: 10,
                    modifierValueMin: 10,
                    modifierValueMax: 10,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            expect(result.warnings).toBeDefined();
            expect(result.warnings).toContain(
                'Party level 20 has no next-level XP threshold; "Next Level Bonus" ignored.',
            );
            // Modifier should be 0
            expect(result.breakdown.goldModifiers).toBe(0);
        });

        it("warns when party size is 0", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 0,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "flat",
                    title: "Flat Bonus",
                    modifierType: "flat",
                    modifierValue: 100,
                    modifierValueMin: 100,
                    modifierValueMax: 100,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            expect(result.warnings).toBeDefined();
            expect(result.warnings).toContain('Gold rule "Flat Bonus" ignored because no party members are present.');
        });

        it("handles negative gold modifier gracefully", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "penalty",
                    title: "Gold Penalty",
                    modifierType: "flat",
                    modifierValue: -200, // Negative modifier
                    modifierValueMin: -200,
                    modifierValueMax: -200,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, {}, rules);

            // Base gold = 415
            // Modifier = -200
            // Total = 215
            expect(result.breakdown.goldModifiers).toBe(-200);
            expect(result.breakdown.finalGold).toBeCloseTo(215, 2);
        });
    });

    describe("Utility Functions", () => {
        it("formats gold correctly", () => {
            expect(formatGold(0)).toBe("0 gp");
            expect(formatGold(100)).toBe("100 gp");
            expect(formatGold(1000)).toBe("1,000 gp");
            expect(formatGold(1234567)).toBe("1,234,567 gp");
            expect(formatGold(123.456)).toBe("123 gp"); // Rounds
        });

        it("formats loot summary with only gold", () => {
            const bundle = {
                gold: 500,
                items: [],
                totalValue: 500,
            };

            expect(formatLootSummary(bundle)).toBe("500 gp");
        });

        it("formats loot summary with no loot", () => {
            const bundle = {
                gold: 0,
                items: [],
                totalValue: 0,
            };

            expect(formatLootSummary(bundle)).toBe("No loot");
        });

        it("formats loot summary with gold and items", () => {
            const bundle = {
                gold: 500,
                items: [
                    { type: "magic-item" as const, name: "Potion", quantity: 2 },
                    { type: "trade-good" as const, name: "Gems", quantity: 1 },
                ],
                totalValue: 700,
            };

            expect(formatLootSummary(bundle)).toBe("500 gp, 3 items");
        });
    });
});
