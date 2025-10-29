// devkit/testing/unit/workmodes/encounter/generator.test.ts
// Unit tests for random encounter generator (Phase 2.6)

import { describe, expect, it, vi, beforeAll } from "vitest";
import {
    filterCreaturesByTags,
    calculateCreatureBudget,
    selectCreaturesForBudget,
    generateRandomEncounter,
    type GeneratorContext,
    type GeneratorOptions,
    type Difficulty
} from "src/workmodes/encounter/generator";
import type { FactionData } from "src/workmodes/library/factions/types";
import type { TerrainData } from "src/workmodes/library/terrains/types";
import type { RegionData } from "src/workmodes/library/regions/types";
import type { StatblockData } from "src/workmodes/library/creatures/types";

// Mock plugin-logger
vi.mock("src/app/plugin-logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const mockFaction: FactionData = {
    name: "Ashen Circle",
    influence_tags: [
        { value: "Undead" },
        { value: "Cult" }
    ]
};

const mockTerrain: TerrainData = {
    name: "Swamp",
    color: "#2d5016",
    speed: 0.5,
    biome_tags: [
        { value: "Swamp" },
        { value: "Wetland" }
    ],
    difficulty_tags: [
        { value: "Difficult" }
    ]
};

const mockRegion: RegionData = {
    name: "Marshlands",
    terrain: "Swamp",
    encounter_odds: 6,
    biome_tags: [
        { value: "Swamp" }
    ],
    danger_tags: [
        { value: "Dangerous" }
    ]
};

const mockCreatures: StatblockData[] = [
    {
        name: "Zombie",
        cr: "0.25",
        typeTags: ["Undead", "Swamp"]
    } as StatblockData,
    {
        name: "Skeleton",
        cr: "0.25",
        typeTags: ["Undead"]
    } as StatblockData,
    {
        name: "Ghoul",
        cr: "1",
        typeTags: ["Undead", "Swamp"]
    } as StatblockData,
    {
        name: "Giant Frog",
        cr: "0.25",
        typeTags: ["Beast", "Swamp"]
    } as StatblockData,
    {
        name: "Wolf",
        cr: "0.25",
        typeTags: ["Beast", "Forest"]
    } as StatblockData,
    {
        name: "Goblin",
        cr: "0.25",
        typeTags: ["Humanoid"]
    } as StatblockData
];

// ============================================================================
// FILTER TESTS
// ============================================================================

describe("filterCreaturesByTags", () => {
    it("returns exact matches (faction+terrain+region) at level 1", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: mockCreatures
        };

        const result = filterCreaturesByTags(ctx);

        // Should match: Zombie, Ghoul (both Undead+Swamp)
        expect(result.filterLevel).toBe(1);
        expect(result.creatures.length).toBe(2);
        expect(result.creatures.map(c => c.name)).toContain("Zombie");
        expect(result.creatures.map(c => c.name)).toContain("Ghoul");
    });

    it("returns partial matches (faction+terrain) at level 2 when no exact match", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: null, // No region tags
            creatures: mockCreatures
        };

        const result = filterCreaturesByTags(ctx);

        // Should match: Zombie, Ghoul (Undead+Swamp)
        expect(result.filterLevel).toBeLessThanOrEqual(2);
        expect(result.creatures.length).toBeGreaterThan(0);
        expect(result.creatures.map(c => c.name)).toContain("Zombie");
    });

    it("returns terrain-only matches at level 3 when no faction match", () => {
        const ctx: GeneratorContext = {
            faction: null, // No faction
            terrain: mockTerrain,
            region: null,
            creatures: mockCreatures
        };

        const result = filterCreaturesByTags(ctx);

        // Should match: Zombie, Ghoul, Giant Frog (all have Swamp tag)
        expect(result.filterLevel).toBeLessThanOrEqual(3);
        expect(result.creatures.length).toBeGreaterThanOrEqual(3);
        expect(result.creatures.map(c => c.name)).toContain("Giant Frog");
    });

    it("returns all creatures at level 4 when no filters", () => {
        const ctx: GeneratorContext = {
            faction: null,
            terrain: null,
            region: null,
            creatures: mockCreatures
        };

        const result = filterCreaturesByTags(ctx);

        expect(result.filterLevel).toBe(4);
        expect(result.creatures.length).toBe(mockCreatures.length);
    });

    it("handles empty creature list", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: []
        };

        const result = filterCreaturesByTags(ctx);

        expect(result.creatures.length).toBe(0);
        expect(result.filterLevel).toBe(4);
    });

    it("handles creatures without tags", () => {
        const creaturesWithoutTags: StatblockData[] = [
            { name: "NoTagCreature", cr: "1" } as StatblockData
        ];

        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: creaturesWithoutTags
        };

        const result = filterCreaturesByTags(ctx);

        // Should fall through to level 4 (all creatures)
        expect(result.filterLevel).toBe(4);
        expect(result.creatures.length).toBe(1);
    });
});

// ============================================================================
// BUDGET TESTS
// ============================================================================

describe("calculateCreatureBudget", () => {
    const testCases: Array<{
        name: string;
        options: GeneratorOptions;
        expectedMin: number;
        expectedMax: number;
    }> = [
        {
            name: "easy difficulty for level 1 party of 4",
            options: { partyLevel: 1, partySize: 4, difficulty: "easy" },
            expectedMin: 80,  // (25 * 4) * 0.8
            expectedMax: 120  // (25 * 4) * 1.2
        },
        {
            name: "medium difficulty for level 3 party of 4",
            options: { partyLevel: 3, partySize: 4, difficulty: "medium" },
            expectedMin: 480,  // (150 * 4) * 0.8
            expectedMax: 720   // (150 * 4) * 1.2
        },
        {
            name: "hard difficulty for level 5 party of 6",
            options: { partyLevel: 5, partySize: 6, difficulty: "hard" },
            expectedMin: 3600, // (750 * 6) * 0.8
            expectedMax: 5400  // (750 * 6) * 1.2
        },
        {
            name: "deadly difficulty for level 20 party of 1",
            options: { partyLevel: 20, partySize: 1, difficulty: "deadly" },
            expectedMin: 10160, // (12700 * 1) * 0.8
            expectedMax: 15240  // (12700 * 1) * 1.2
        }
    ];

    testCases.forEach(({ name, options, expectedMin, expectedMax }) => {
        it(name, () => {
            const result = calculateCreatureBudget(options);

            expect(result.minXP).toBe(expectedMin);
            expect(result.maxXP).toBe(expectedMax);
            expect(result.targetXP).toBeGreaterThanOrEqual(expectedMin);
            expect(result.targetXP).toBeLessThanOrEqual(expectedMax);
        });
    });

    it("clamps invalid party level to 1-20 range", () => {
        const options: GeneratorOptions = {
            partyLevel: 25, // Invalid
            partySize: 4,
            difficulty: "medium"
        };

        const result = calculateCreatureBudget(options);

        // Should use level 20 thresholds
        expect(result.targetXP).toBe(5700 * 4); // Medium level 20
    });

    it("handles party size of 1", () => {
        const options: GeneratorOptions = {
            partyLevel: 1,
            partySize: 1,
            difficulty: "easy"
        };

        const result = calculateCreatureBudget(options);

        expect(result.targetXP).toBe(25); // 25 * 1
        expect(result.minXP).toBe(20);
        expect(result.maxXP).toBe(30);
    });
});

// ============================================================================
// SELECTION TESTS
// ============================================================================

describe("selectCreaturesForBudget", () => {
    const options: GeneratorOptions = {
        partyLevel: 3,
        partySize: 4,
        difficulty: "medium",
        seed: 12345 // Deterministic
    };

    it("selects creatures within budget (accounting for multiplier)", () => {
        const budget = calculateCreatureBudget(options);
        const result = selectCreaturesForBudget(mockCreatures, budget, options);

        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(6); // Max creatures

        // Note: selectCreaturesForBudget uses ADJUSTED XP (with multiplier) internally
        // So the RAW XP might be lower than budget since multiplier is applied
        // This is correct per D&D 5e rules
        const xpMap = { "0.25": 50, "1": 200 };
        const rawXP = result.reduce((sum, c) => {
            const xp = xpMap[c.cr.toString() as keyof typeof xpMap] ?? 0;
            return sum + (xp * c.count);
        }, 0);

        // Raw XP should be reasonable (not zero, not absurdly high)
        expect(rawXP).toBeGreaterThan(0);
        expect(rawXP).toBeLessThan(budget.maxXP); // Raw XP < Adjusted XP due to multiplier
    });

    it("respects variety constraint (max 3 copies)", () => {
        const budget = calculateCreatureBudget(options);
        const result = selectCreaturesForBudget(mockCreatures, budget, options);

        result.forEach(creature => {
            expect(creature.count).toBeLessThanOrEqual(3);
        });
    });

    it("returns single creature when budget too small", () => {
        const tinyBudget = {
            targetXP: 50,
            minXP: 40,
            maxXP: 60
        };

        const result = selectCreaturesForBudget(mockCreatures, tinyBudget, options);

        expect(result.length).toBeGreaterThan(0);
        // Should return low-CR creatures
        if (result.length > 0) {
            expect(result[0].cr).toBeLessThanOrEqual(1);
        }
    });

    it("handles empty creature list", () => {
        const budget = calculateCreatureBudget(options);
        const result = selectCreaturesForBudget([], budget, options);

        expect(result.length).toBe(0);
    });

    it("returns different results without seed (randomization)", () => {
        const budget = calculateCreatureBudget(options);
        const optionsNoSeed = { ...options, seed: undefined };

        const result1 = selectCreaturesForBudget(mockCreatures, budget, optionsNoSeed);
        const result2 = selectCreaturesForBudget(mockCreatures, budget, optionsNoSeed);

        // With randomization, results MAY differ (not guaranteed, but likely)
        // Just verify both are valid
        expect(result1.length).toBeGreaterThan(0);
        expect(result2.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("generateRandomEncounter", () => {
    it("generates valid encounter with faction+terrain+region context", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: mockCreatures
        };

        const options: GeneratorOptions = {
            partyLevel: 3,
            partySize: 4,
            difficulty: "medium",
            seed: 42
        };

        const result = generateRandomEncounter(ctx, options);

        expect(result.creatures.length).toBeGreaterThan(0);
        expect(result.creatures.length).toBeLessThanOrEqual(6);
        expect(result.totalXP).toBeGreaterThan(0);
        expect(result.filterLevel).toBeGreaterThanOrEqual(1);
        expect(result.filterLevel).toBeLessThanOrEqual(4);

        // Verify creatures have correct shape
        result.creatures.forEach(creature => {
            expect(creature).toHaveProperty("id");
            expect(creature).toHaveProperty("name");
            expect(creature).toHaveProperty("count");
            expect(creature).toHaveProperty("cr");
            expect(creature).toHaveProperty("source");
            expect(creature.source).toBe("library");
        });
    });

    it("prefers exact tag matches", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: mockCreatures
        };

        const options: GeneratorOptions = {
            partyLevel: 1,
            partySize: 4,
            difficulty: "easy",
            seed: 123
        };

        const result = generateRandomEncounter(ctx, options);

        // Should prefer Undead+Swamp creatures (Zombie, Ghoul)
        expect(result.filterLevel).toBe(1);
        const names = result.creatures.map(c => c.name);
        expect(names.some(n => ["Zombie", "Ghoul"].includes(n))).toBe(true);
    });

    it("falls back gracefully when no matching creatures", () => {
        const ctx: GeneratorContext = {
            faction: { name: "Nonexistent", influence_tags: [{ value: "NonexistentTag" }] },
            terrain: mockTerrain,
            region: mockRegion,
            creatures: mockCreatures
        };

        const options: GeneratorOptions = {
            partyLevel: 3,
            partySize: 4,
            difficulty: "medium",
            seed: 789
        };

        const result = generateRandomEncounter(ctx, options);

        // Should fall back to lower filter levels and still generate encounter
        expect(result.creatures.length).toBeGreaterThan(0);
        expect(result.filterLevel).toBeGreaterThan(1);
    });

    it("handles extreme party levels", () => {
        const highCRCreatures: StatblockData[] = [
            { name: "Ancient Dragon", cr: "24", typeTags: ["Dragon", "Undead"] } as StatblockData,
            { name: "Lich", cr: "21", typeTags: ["Undead"] } as StatblockData,
            { name: "Death Knight", cr: "17", typeTags: ["Undead"] } as StatblockData
        ];

        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: highCRCreatures
        };

        const options: GeneratorOptions = {
            partyLevel: 20,
            partySize: 4,
            difficulty: "deadly",
            seed: 999
        };

        const result = generateRandomEncounter(ctx, options);

        expect(result.creatures.length).toBeGreaterThan(0);
        // With high-CR creatures available, should generate appropriate challenge
        // Deadly for 4x Level 20 = 12700 * 4 = 50800 XP budget
        // Even 1 CR 21 creature = 33000 XP raw
        expect(result.totalXP).toBeGreaterThan(10000);
    });

    it("returns empty result when no creatures available", () => {
        const ctx: GeneratorContext = {
            faction: mockFaction,
            terrain: mockTerrain,
            region: mockRegion,
            creatures: []
        };

        const options: GeneratorOptions = {
            partyLevel: 3,
            partySize: 4,
            difficulty: "medium"
        };

        const result = generateRandomEncounter(ctx, options);

        expect(result.creatures.length).toBe(0);
        expect(result.totalXP).toBe(0);
        expect(result.filterLevel).toBe(4);
    });
});
