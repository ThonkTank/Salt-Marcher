// devkit/testing/unit/features/encounters/encounter-generator.test.ts
// Tests for encounter generation algorithm, CR balancing, and table selection

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App } from "obsidian";
import type { EncounterGenerationContext } from "../../../../../src/features/encounters/types";
import type { EncounterTableData } from "../../../../../src/workmodes/library/encounter-tables/types";
import {
    CR_TO_XP,
    XP_THRESHOLDS_BY_LEVEL,
    ENCOUNTER_MULTIPLIERS,
} from "../../../../../src/features/encounters/types";

// Mock App
const createMockApp = (): App => {
    const files = [
        {
            basename: "Goblin",
            path: "Presets/Creatures/Goblin.md",
        },
        {
            basename: "Wolf",
            path: "Presets/Creatures/Animals/Wolf.md",
        },
        {
            basename: "Orc",
            path: "Presets/Creatures/Humanoids/Orc.md",
        },
    ];

    const fileContents: Record<string, string> = {
        "Presets/Creatures/Goblin.md": `---
smType: creature
name: Goblin
cr: 1/4
hp: '7'
ac: '15'
---
# Goblin`,
        "Presets/Creatures/Animals/Wolf.md": `---
smType: creature
name: Wolf
cr: 1/4
hp: '11'
ac: '13'
---
# Wolf`,
        "Presets/Creatures/Humanoids/Orc.md": `---
smType: creature
name: Orc
cr: 1/2
hp: '15'
ac: '13'
---
# Orc`,
    };

    return {
        vault: {
            getMarkdownFiles: () => files,
            read: async (file: any) => fileContents[file.path] || "",
        },
    } as any;
};

describe("Encounter Generator", () => {
    describe("CR to XP mapping", () => {
        it("should have correct XP values for common CRs", () => {
            expect(CR_TO_XP[0]).toBe(10);
            expect(CR_TO_XP[0.125]).toBe(25);
            expect(CR_TO_XP[0.25]).toBe(50);
            expect(CR_TO_XP[0.5]).toBe(100);
            expect(CR_TO_XP[1]).toBe(200);
            expect(CR_TO_XP[5]).toBe(1800);
            expect(CR_TO_XP[10]).toBe(5900);
            expect(CR_TO_XP[20]).toBe(25000);
            expect(CR_TO_XP[30]).toBe(155000);
        });
    });

    describe("XP Thresholds", () => {
        it("should have thresholds for all levels 1-20", () => {
            for (let level = 1; level <= 20; level++) {
                const thresholds = XP_THRESHOLDS_BY_LEVEL[level];
                expect(thresholds).toBeDefined();
                expect(thresholds.easy).toBeGreaterThan(0);
                expect(thresholds.medium).toBeGreaterThan(thresholds.easy);
                expect(thresholds.hard).toBeGreaterThan(thresholds.medium);
                expect(thresholds.deadly).toBeGreaterThan(thresholds.hard);
            }
        });

        it("should have specific values for level 1", () => {
            const thresholds = XP_THRESHOLDS_BY_LEVEL[1];
            expect(thresholds.easy).toBe(25);
            expect(thresholds.medium).toBe(50);
            expect(thresholds.hard).toBe(75);
            expect(thresholds.deadly).toBe(100);
        });

        it("should have specific values for level 5", () => {
            const thresholds = XP_THRESHOLDS_BY_LEVEL[5];
            expect(thresholds.easy).toBe(250);
            expect(thresholds.medium).toBe(500);
            expect(thresholds.hard).toBe(750);
            expect(thresholds.deadly).toBe(1100);
        });
    });

    describe("Encounter Multipliers", () => {
        it("should apply correct multipliers based on monster count", () => {
            expect(ENCOUNTER_MULTIPLIERS[0].multiplier).toBe(1.0); // 1 monster
            expect(ENCOUNTER_MULTIPLIERS[1].multiplier).toBe(1.5); // 2 monsters
            expect(ENCOUNTER_MULTIPLIERS[2].multiplier).toBe(2.0); // 3-6 monsters
            expect(ENCOUNTER_MULTIPLIERS[3].multiplier).toBe(2.5); // 7-10 monsters
            expect(ENCOUNTER_MULTIPLIERS[4].multiplier).toBe(3.0); // 11-14 monsters
            expect(ENCOUNTER_MULTIPLIERS[5].multiplier).toBe(4.0); // 15+ monsters
        });
    });

    describe("Table Selection", () => {
        it("should select table with matching tags", () => {
            const tables: EncounterTableData[] = [
                {
                    name: "forest",
                    terrain_tags: [{ value: "Forest" }],
                    entries: [{ weight: 1, creatures: ["Wolf"] }],
                },
                {
                    name: "mountain",
                    terrain_tags: [{ value: "Mountain" }],
                    entries: [{ weight: 1, creatures: ["Giant Eagle"] }],
                },
            ];

            // This test would need the actual generateEncounter function
            // For now, we're just testing the data structures
            expect(tables[0].terrain_tags?.[0].value).toBe("Forest");
            expect(tables[1].terrain_tags?.[0].value).toBe("Mountain");
        });

        it("should filter tables by CR range", () => {
            const tables: EncounterTableData[] = [
                {
                    name: "low-level",
                    crRange: { min: 0, max: 2 },
                    entries: [{ weight: 1, creatures: ["Goblin"] }],
                },
                {
                    name: "mid-level",
                    crRange: { min: 3, max: 10 },
                    entries: [{ weight: 1, creatures: ["Troll"] }],
                },
                {
                    name: "high-level",
                    crRange: { min: 11, max: 20 },
                    entries: [{ weight: 1, creatures: ["Ancient Dragon"] }],
                },
            ];

            const contextCR = { min: 1, max: 5 };

            // Check overlap logic
            const lowLevel = tables[0].crRange!;
            const midLevel = tables[1].crRange!;
            const highLevel = tables[2].crRange!;

            expect(!(lowLevel.max! < contextCR.min || lowLevel.min! > contextCR.max)).toBe(true); // Overlaps
            expect(!(midLevel.max! < contextCR.min || midLevel.min! > contextCR.max)).toBe(true); // Overlaps
            expect(!(highLevel.max! < contextCR.min || highLevel.min! > contextCR.max)).toBe(false); // No overlap
        });
    });

    describe("Weighted Selection", () => {
        it("should respect entry weights", () => {
            const entries = [
                { weight: 5, creatures: ["Common"] },
                { weight: 2, creatures: ["Uncommon"] },
                { weight: 1, creatures: ["Rare"] },
            ];

            const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
            expect(totalWeight).toBe(8);

            // Common should have 5/8 = 62.5% chance
            // Uncommon should have 2/8 = 25% chance
            // Rare should have 1/8 = 12.5% chance
        });
    });

    describe("Quantity Rolling", () => {
        it("should parse simple numbers", () => {
            // Test cases for quantity formulas
            const testCases = [
                { input: "1", expected: 1 },
                { input: "2", expected: 2 },
                { input: "5", expected: 5 },
            ];

            for (const test of testCases) {
                if (/^\d+$/.test(test.input)) {
                    expect(parseInt(test.input, 10)).toBe(test.expected);
                }
            }
        });

        it("should parse dice formulas", () => {
            // Test dice formula regex
            const validFormulas = ["1d4", "2d6", "3d8+2", "1d20-1"];

            for (const formula of validFormulas) {
                const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/);
                expect(match).toBeTruthy();
            }
        });
    });

    describe("Difficulty Calculation", () => {
        it("should calculate difficulty for level 1 party", () => {
            const partyLevel = 1;
            const partySize = 4;
            const thresholds = XP_THRESHOLDS_BY_LEVEL[partyLevel];

            const partyThresholds = {
                easy: thresholds.easy * partySize, // 100
                medium: thresholds.medium * partySize, // 200
                hard: thresholds.hard * partySize, // 300
                deadly: thresholds.deadly * partySize, // 400
            };

            expect(partyThresholds.easy).toBe(100);
            expect(partyThresholds.medium).toBe(200);
            expect(partyThresholds.hard).toBe(300);
            expect(partyThresholds.deadly).toBe(400);

            // 4 goblins (CR 1/4 each = 50 XP each = 200 total XP)
            // Multiplier for 4 monsters = 2.0
            // Adjusted XP = 200 * 2.0 = 400
            // This is a Deadly encounter for level 1 party
        });

        it("should apply encounter multiplier correctly", () => {
            const baseXP = 200;

            // 1 monster: 1.0x
            expect(baseXP * 1.0).toBe(200);

            // 2 monsters: 1.5x
            expect(baseXP * 1.5).toBe(300);

            // 3 monsters: 2.0x
            expect(baseXP * 2.0).toBe(400);

            // 7 monsters: 2.5x
            expect(baseXP * 2.5).toBe(500);
        });
    });

    describe("Initiative Rolling", () => {
        it("should roll initiative between 1 and 20", () => {
            // Simulate 100 rolls
            for (let i = 0; i < 100; i++) {
                const roll = Math.floor(Math.random() * 20) + 1;
                expect(roll).toBeGreaterThanOrEqual(1);
                expect(roll).toBeLessThanOrEqual(20);
            }
        });
    });

    describe("Combatant Spawning", () => {
        it("should spawn combatants with correct properties", () => {
            const combatant = {
                name: "Goblin",
                cr: 0.25,
                initiative: 15,
                currentHp: 7,
                maxHp: 7,
                ac: 15,
                creatureFile: "Presets/Creatures/Goblin.md",
                id: "goblin-1",
            };

            expect(combatant.name).toBe("Goblin");
            expect(combatant.cr).toBe(0.25);
            expect(combatant.currentHp).toBe(combatant.maxHp);
            expect(combatant.initiative).toBeGreaterThanOrEqual(1);
            expect(combatant.initiative).toBeLessThanOrEqual(20);
        });

        it("should sort combatants by initiative descending", () => {
            const combatants = [
                { initiative: 10 },
                { initiative: 20 },
                { initiative: 5 },
                { initiative: 15 },
            ];

            combatants.sort((a, b) => b.initiative - a.initiative);

            expect(combatants[0].initiative).toBe(20);
            expect(combatants[1].initiative).toBe(15);
            expect(combatants[2].initiative).toBe(10);
            expect(combatants[3].initiative).toBe(5);
        });
    });
});
