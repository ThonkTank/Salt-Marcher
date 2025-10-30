// devkit/testing/unit/loot/item-generator.test.ts
// Unit tests for Item Generator with tag-based filtering and rarity limits

import { describe, it, expect } from "vitest";
import {
    generateItems,
    calculateItemValue,
    groupItemsByRarity,
    EXAMPLE_LOOT_TABLES,
} from "../../../../src/features/loot/item-generator";
import type { LootGenerationContext, LootGenerationConfig, LootTable } from "../../../../src/features/loot/types";

describe("Item Generator", () => {
    describe("Item Generation", () => {
        it("generates no items when magic items disabled", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: false,
            };

            const items = generateItems(context, config, 1000, EXAMPLE_LOOT_TABLES);

            expect(items).toHaveLength(0);
        });

        it("generates no items when budget is zero", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
            };

            const items = generateItems(context, config, 0, EXAMPLE_LOOT_TABLES);

            expect(items).toHaveLength(0);
        });

        it("generates items up to max count", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 5000,
                tags: ["dungeon", "forest"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 2,
            };

            const items = generateItems(context, config, 10000, EXAMPLE_LOOT_TABLES);

            expect(items.length).toBeLessThanOrEqual(2);
        });

        it("generates items from matching tables", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
                tags: ["dungeon"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 5,
            };

            const items = generateItems(context, config, 10000, EXAMPLE_LOOT_TABLES);

            // Should generate items from "potions-common" table (has dungeon tag)
            expect(items.length).toBeGreaterThan(0);
            const itemNames = items.map((item) => item.name);
            expect(itemNames.some((name) => name.includes("Potion"))).toBe(true);
        });

        it("filters items by rarity level limits", () => {
            const context: LootGenerationContext = {
                partyLevel: 3, // Below rare (5) and uncommon (1)
                partySize: 4,
                encounterXp: 1000,
                tags: ["wizard", "library"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 10,
                rarityLevelLimits: {
                    common: 1,
                    uncommon: 5,
                    rare: 11,
                    "very-rare": 15,
                    legendary: 20,
                },
            };

            const items = generateItems(context, config, 1000, EXAMPLE_LOOT_TABLES);

            // Should only get common items (uncommon requires level 5)
            for (const item of items) {
                if (item.rarity) {
                    expect(item.rarity).toBe("common");
                }
            }
        });

        it("includes items matching context tags", () => {
            const context: LootGenerationContext = {
                partyLevel: 10,
                partySize: 4,
                encounterXp: 5000,
                tags: ["dragon", "treasure"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 5,
            };

            const items = generateItems(context, config, 1000, EXAMPLE_LOOT_TABLES);

            // Should include gems from "gems-trade" table
            expect(items.length).toBeGreaterThan(0);
            const hasGems = items.some((item) => item.name.includes("Gem"));
            expect(hasGems).toBe(true);
        });

        it("excludes items with excluded tags", () => {
            const testTable: LootTable = {
                id: "test-table",
                name: "Test Table",
                category: "magic-items",
                entries: [
                    {
                        weight: 10,
                        item: {
                            type: "magic-item",
                            name: "Fire Sword",
                            value: 500,
                            rarity: "rare",
                            tags: ["fire", "weapon"],
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                    {
                        weight: 10,
                        item: {
                            type: "magic-item",
                            name: "Ice Sword",
                            value: 500,
                            rarity: "rare",
                            tags: ["ice", "weapon"],
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                ],
            };

            const context: LootGenerationContext = {
                partyLevel: 10,
                partySize: 4,
                encounterXp: 5000,
                tags: ["weapon"],
                excludeTags: ["fire"], // Exclude fire items
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 10,
            };

            const items = generateItems(context, config, 5000, [testTable]);

            // Should only get Ice Sword, not Fire Sword
            for (const item of items) {
                expect(item.name).not.toContain("Fire");
            }
        });

        it("respects budget limits", () => {
            const context: LootGenerationContext = {
                partyLevel: 10,
                partySize: 4,
                encounterXp: 5000,
                tags: ["treasure"],
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 100, // High limit
            };

            const budget = 200; // Limited budget
            const items = generateItems(context, config, budget, EXAMPLE_LOOT_TABLES);

            // Total value should not exceed budget (significantly)
            const totalValue = calculateItemValue(items);
            // Allow some tolerance for the last item
            expect(totalValue).toBeLessThan(budget * 2);
        });
    });

    describe("Item Quantities", () => {
        it("generates quantities within specified range", () => {
            const testTable: LootTable = {
                id: "quantity-test",
                name: "Quantity Test",
                category: "consumables",
                entries: [
                    {
                        weight: 10,
                        item: {
                            type: "consumable",
                            name: "Test Potion",
                            value: 10,
                            rarity: "common",
                        },
                        quantityRange: { min: 2, max: 5 },
                    },
                ],
            };

            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 10,
            };

            const items = generateItems(context, config, 1000, [testTable]);

            // Check that all quantities are within range
            for (const item of items) {
                expect(item.quantity).toBeGreaterThanOrEqual(2);
                expect(item.quantity).toBeLessThanOrEqual(5);
            }
        });

        it("handles single-quantity items correctly", () => {
            const testTable: LootTable = {
                id: "single-test",
                name: "Single Test",
                category: "magic-items",
                entries: [
                    {
                        weight: 10,
                        item: {
                            type: "magic-item",
                            name: "Unique Artifact",
                            value: 1000,
                            rarity: "legendary",
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                ],
            };

            const context: LootGenerationContext = {
                partyLevel: 20,
                partySize: 4,
                encounterXp: 10000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 5,
            };

            const items = generateItems(context, config, 5000, [testTable]);

            for (const item of items) {
                expect(item.quantity).toBe(1);
            }
        });
    });

    describe("Utility Functions", () => {
        it("calculates total item value correctly", () => {
            const items = [
                {
                    type: "consumable" as const,
                    name: "Potion",
                    quantity: 3,
                    value: 50,
                },
                {
                    type: "magic-item" as const,
                    name: "Sword",
                    quantity: 1,
                    value: 500,
                },
                {
                    type: "trade-good" as const,
                    name: "Gem",
                    quantity: 5,
                    value: 10,
                },
            ];

            const totalValue = calculateItemValue(items);

            // 3*50 + 1*500 + 5*10 = 150 + 500 + 50 = 700
            expect(totalValue).toBe(700);
        });

        it("handles items without value", () => {
            const items = [
                {
                    type: "consumable" as const,
                    name: "Mystery Item",
                    quantity: 1,
                },
                {
                    type: "magic-item" as const,
                    name: "Priceless Artifact",
                    quantity: 1,
                    value: 1000,
                },
            ];

            const totalValue = calculateItemValue(items);

            expect(totalValue).toBe(1000); // Only counts item with value
        });

        it("groups items by rarity correctly", () => {
            const items = [
                {
                    type: "consumable" as const,
                    name: "Common Potion",
                    quantity: 1,
                    rarity: "common" as const,
                },
                {
                    type: "magic-item" as const,
                    name: "Rare Sword",
                    quantity: 1,
                    rarity: "rare" as const,
                },
                {
                    type: "magic-item" as const,
                    name: "Another Rare Item",
                    quantity: 1,
                    rarity: "rare" as const,
                },
                {
                    type: "trade-good" as const,
                    name: "Mundane Gem",
                    quantity: 1,
                },
            ];

            const groups = groupItemsByRarity(items);

            expect(groups.get("common")).toHaveLength(1);
            expect(groups.get("rare")).toHaveLength(2);
            expect(groups.get("none")).toHaveLength(1);
        });
    });

    describe("Weighted Random Selection", () => {
        it("selects items from available entries", () => {
            const testTable: LootTable = {
                id: "weighted-test",
                name: "Weighted Test",
                category: "consumables",
                entries: [
                    {
                        weight: 100, // Very high weight
                        item: {
                            type: "consumable",
                            name: "Common Item",
                            value: 10,
                            rarity: "common",
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                    {
                        weight: 1, // Very low weight
                        item: {
                            type: "consumable",
                            name: "Rare Drop",
                            value: 1000,
                            rarity: "rare",
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                ],
            };

            const context: LootGenerationContext = {
                partyLevel: 10,
                partySize: 4,
                encounterXp: 5000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 20,
            };

            // Generate many items
            const items = generateItems(context, config, 10000, [testTable]);

            // With high sample size, common item should be much more frequent
            const commonCount = items.filter((item) => item.name === "Common Item").length;
            const rareCount = items.filter((item) => item.name === "Rare Drop").length;

            expect(items.length).toBeGreaterThan(0);
            expect(commonCount).toBeGreaterThan(rareCount);
        });
    });

    describe("Edge Cases", () => {
        it("handles empty loot tables", () => {
            const context: LootGenerationContext = {
                partyLevel: 5,
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
            };

            const items = generateItems(context, config, 1000, []);

            expect(items).toHaveLength(0);
        });

        it("handles tables with no matching entries", () => {
            const testTable: LootTable = {
                id: "no-match",
                name: "No Match Table",
                category: "magic-items",
                entries: [
                    {
                        weight: 10,
                        item: {
                            type: "magic-item",
                            name: "Level 20 Item",
                            value: 10000,
                            rarity: "legendary",
                        },
                        quantityRange: { min: 1, max: 1 },
                    },
                ],
            };

            const context: LootGenerationContext = {
                partyLevel: 1, // Too low for legendary
                partySize: 4,
                encounterXp: 1000,
            };

            const config: LootGenerationConfig = {
                enableMagicItems: true,
                maxMagicItemsPerEncounter: 5,
            };

            const items = generateItems(context, config, 10000, [testTable]);

            expect(items).toHaveLength(0);
        });
    });
});
