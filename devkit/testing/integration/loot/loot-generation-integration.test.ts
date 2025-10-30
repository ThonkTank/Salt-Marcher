// devkit/testing/integration/loot/loot-generation-integration.test.ts
// Integration tests for complete loot generation flow with rules

import { describe, it, expect } from "vitest";
import { generateLoot } from "../../../../src/features/loot/loot-generator";
import { EXAMPLE_LOOT_TABLES } from "../../../../src/features/loot/item-generator";
import type { LootGenerationContext, LootGenerationConfig } from "../../../../src/features/loot/types";
import type { EncounterXpRule } from "../../../../src/workmodes/encounter/session-store";

describe("Loot Generation Integration", () => {
    describe("Complete Flow: Context → Rules → Gold + Items", () => {
        it("generates complete loot bundle with gold and items", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
                tags: ["dungeon", "treasure"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 3,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "bonus",
                    title: "Treasure Bonus",
                    modifierType: "flat",
                    modifierValue: 100,
                    modifierValueMin: 100,
                    modifierValueMax: 100,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, config, rules, EXAMPLE_LOOT_TABLES);

            // Should have gold
            expect(result.bundle.gold).toBeGreaterThan(0);

            // Should have breakdown
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2); // 1000 * 0.415
            expect(result.breakdown.goldModifiers).toBe(100);
            expect(result.breakdown.finalGold).toBeCloseTo(515, 2);

            // Should have items
            expect(result.bundle.items.length).toBeGreaterThan(0);
            expect(result.breakdown.magicItemsGenerated).toBeGreaterThanOrEqual(0);

            // Total value should include gold + item values
            expect(result.bundle.totalValue).toBeGreaterThanOrEqual(result.bundle.gold);
        });

        it("scales gold with party level correctly", () => {
            const contextLevel5: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const contextLevel15: LootGenerationContext = {
                partyLevel: 15,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: false,
            };

            const resultLevel5 = generateLoot(contextLevel5, config);
            const resultLevel15 = generateLoot(contextLevel15, config);

            // Level 5 uses 0.415x multiplier, Level 15 uses 1.6x
            expect(resultLevel5.bundle.gold).toBeCloseTo(415, 2);
            expect(resultLevel15.bundle.gold).toBeCloseTo(1600, 2);

            // Level 15 should get significantly more gold
            expect(resultLevel15.bundle.gold).toBeGreaterThan(resultLevel5.bundle.gold * 3);
        });

        it("applies multiple rules correctly", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 3,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: false,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "flat",
                    title: "Flat Bonus",
                    modifierType: "flat",
                    modifierValue: 50,
                    modifierValueMin: 50,
                    modifierValueMax: 50,
                    enabled: true,
                    scope: "gold",
                },
                {
                    id: "percent",
                    title: "Percent Bonus",
                    modifierType: "percentTotal",
                    modifierValue: 20, // 20%
                    modifierValueMin: 20,
                    modifierValueMax: 20,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, config, rules);

            // Base gold = 1000 * 0.415 = 415
            // After flat: 415 + 50 = 465
            // After percent: 465 + (465 * 0.20) = 465 + 93 = 558
            expect(result.breakdown.baseGold).toBeCloseTo(415, 2);
            expect(result.breakdown.goldModifiers).toBeCloseTo(143, 2);
            expect(result.breakdown.finalGold).toBeCloseTo(558, 2);
        });

        it("filters items by context tags", () => {
            const dungeonContext: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
                tags: ["dungeon"], // Only dungeon items
            };

            const treasureContext: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
                tags: ["treasure"], // Only treasure items
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 10,
            };

            const dungeonResult = generateLoot(dungeonContext, config, [], EXAMPLE_LOOT_TABLES);
            const treasureResult = generateLoot(treasureContext, config, [], EXAMPLE_LOOT_TABLES);

            // Dungeon should get potions
            const dungeonItemNames = dungeonResult.bundle.items.map((item) => item.name);
            expect(dungeonItemNames.some((name) => name.includes("Potion"))).toBe(true);

            // Treasure should get gems
            const treasureItemNames = treasureResult.bundle.items.map((item) => item.name);
            expect(treasureItemNames.some((name) => name.includes("Gem"))).toBe(true);
        });

        it("respects item budget from XP", () => {
            const lowXpContext: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 500, // Low XP
            };

            const highXpContext: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 5000, // High XP
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 20,
            };

            const lowXpResult = generateLoot(lowXpContext, config, [], EXAMPLE_LOOT_TABLES);
            const highXpResult = generateLoot(highXpContext, config, [], EXAMPLE_LOOT_TABLES);

            // High XP should generate more items (within max limit)
            expect(highXpResult.bundle.items.length).toBeGreaterThanOrEqual(lowXpResult.bundle.items.length);
        });

        it("respects rarity limits based on party level", () => {
            const lowLevelContext: LootGenerationContext = {
                partyLevel: 3, // Below rare threshold (5)
                partySize: 4,
                encounterXp: 5000,
                tags: ["wizard", "library"],
            };

            const highLevelContext: LootGenerationContext = {
                partyLevel: 10, // Above rare threshold
                partySize: 4,
                encounterXp: 5000,
                tags: ["wizard", "library"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 20,
                rarityLevelLimits: {
                    common: 1,
                    uncommon: 5,
                    rare: 11,
                    "very-rare": 15,
                    legendary: 20,
                },
            };

            const lowLevelResult = generateLoot(lowLevelContext, config, [], EXAMPLE_LOOT_TABLES);
            const highLevelResult = generateLoot(highLevelContext, config, [], EXAMPLE_LOOT_TABLES);

            // Low level should only get common items
            for (const item of lowLevelResult.bundle.items) {
                if (item.rarity) {
                    expect(item.rarity).toBe("common");
                }
            }

            // High level can get uncommon items (but not rare yet)
            const highLevelRarities = highLevelResult.bundle.items
                .filter((item) => item.rarity)
                .map((item) => item.rarity);

            if (highLevelRarities.length > 0) {
                expect(highLevelRarities.every((r) => r === "common" || r === "uncommon")).toBe(true);
            }
        });
    });

    describe("Edge Cases & Error Handling", () => {
        it("handles zero party size gracefully", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 0, // No party
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "bonus",
                    title: "Bonus",
                    modifierType: "flat",
                    modifierValue: 100,
                    modifierValueMin: 100,
                    modifierValueMax: 100,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, config, rules);

            // Should generate warning
            expect(result.warnings).toBeDefined();
            expect(result.warnings?.some((w) => w.includes("no party members"))).toBe(true);

            // No modifiers should be applied
            expect(result.breakdown.goldModifiers).toBe(0);
        });

        it("handles empty loot tables gracefully", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
            };

            const result = generateLoot(context, config, [], []); // Empty tables

            // Should still generate gold
            expect(result.bundle.gold).toBeGreaterThan(0);

            // No items
            expect(result.bundle.items).toHaveLength(0);
        });

        it("handles disabled magic items correctly", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: false, // Disabled
            };

            const result = generateLoot(context, config, [], EXAMPLE_LOOT_TABLES);

            // Should have gold
            expect(result.bundle.gold).toBeGreaterThan(0);

            // No items
            expect(result.bundle.items).toHaveLength(0);
            expect(result.breakdown.magicItemsGenerated).toBe(0);
        });

        it("calculates total value including items", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 5000,
                tags: ["treasure"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 10,
            };

            const result = generateLoot(context, config, [], EXAMPLE_LOOT_TABLES);

            if (result.bundle.items.length > 0) {
                const itemValue = result.bundle.items.reduce((sum, item) => {
                    return sum + (item.value ?? 0) * item.quantity;
                }, 0);

                expect(result.bundle.totalValue).toBe(result.bundle.gold + itemValue);
            } else {
                expect(result.bundle.totalValue).toBe(result.bundle.gold);
            }
        });
    });

    describe("Realistic Encounter Scenarios", () => {
        it("low-level dungeon encounter (goblin ambush)", () => {
            const context: LootGenerationContext = {
                partyLevel: 2,
                partySize: 4,
                encounterXp: 200,
                tags: ["dungeon", "goblin"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 2,
            };

            const result = generateLoot(context, config, [], EXAMPLE_LOOT_TABLES);

            // Low-level encounter should have modest rewards
            expect(result.bundle.gold).toBeLessThan(200);
            expect(result.bundle.items.length).toBeLessThanOrEqual(2);
        });

        it("mid-level treasure hoard (dragon lair)", () => {
            const context: LootGenerationContext = {
                partyLevel: 12, // Level 11-16 range (1.6x multiplier)
                partySize: 5,
                encounterXp: 8000,
                tags: ["dragon", "treasure", "hoard"],
                goldModifier: 2.0, // Double gold for treasure hoard
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 5,
            };

            const result = generateLoot(context, config, [], EXAMPLE_LOOT_TABLES);

            // Should have substantial rewards
            // Level 12: 8000 * 1.6 * 2.0 = 25600 base gold
            expect(result.bundle.gold).toBeGreaterThan(20000);
            expect(result.bundle.items.length).toBeGreaterThan(0);
        });

        it("high-level boss encounter with rules", () => {
            const context: LootGenerationContext = {
                partyLevel: 18,
                partySize: 4,
                encounterXp: 50000,
                tags: ["boss", "treasure", "legendary"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 3,
            };

            const rules: EncounterXpRule[] = [
                {
                    id: "boss-bonus",
                    title: "Boss Bonus",
                    modifierType: "percentTotal",
                    modifierValue: 50, // 50% bonus
                    modifierValueMin: 50,
                    modifierValueMax: 50,
                    enabled: true,
                    scope: "gold",
                },
            ];

            const result = generateLoot(context, config, rules, EXAMPLE_LOOT_TABLES);

            // High-level encounter with boss bonus
            // Base: 50000 * 3.2 = 160000
            // After 50% bonus: 160000 * 1.5 = 240000
            expect(result.bundle.gold).toBeGreaterThan(200000);
            expect(result.bundle.totalValue).toBeGreaterThan(200000);
        });
    });
});
