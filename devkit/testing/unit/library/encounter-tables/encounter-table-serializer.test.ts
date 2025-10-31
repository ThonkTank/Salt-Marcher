// devkit/testing/unit/library/encounter-tables/encounter-table-serializer.test.ts
// Tests for encounter table serialization to Markdown format

import { describe, it, expect } from "vitest";
import { encounterTableToMarkdown, parseCR } from "../../../../../src/workmodes/library/encounter-tables/serializer";
import type { EncounterTableData } from "../../../../../src/workmodes/library/encounter-tables/types";

describe("Encounter Table Serializer", () => {
    describe("encounterTableToMarkdown", () => {
        it("should serialize minimal encounter table", () => {
            const table: EncounterTableData = {
                name: "test-table",
                entries: [
                    {
                        weight: 1,
                        creatures: ["Goblin"],
                        quantity: "1d4",
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("# test-table");
            expect(markdown).toContain("## Encounter Entries");
            expect(markdown).toContain("| Weight | Creatures | Quantity | Description |");
            expect(markdown).toContain("| 1 | Goblin | 1d4 | — |");
        });

        it("should serialize table with display name and description", () => {
            const table: EncounterTableData = {
                name: "forest-encounters",
                display_name: "Random Forest Encounters",
                description: "Encounters for dense forest hexes during daytime",
                entries: [
                    {
                        weight: 2,
                        creatures: ["Wolf"],
                        quantity: "2d4",
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("# Random Forest Encounters");
            expect(markdown).toContain("Encounters for dense forest hexes during daytime");
        });

        it("should serialize table with CR range", () => {
            const table: EncounterTableData = {
                name: "low-level",
                crRange: {
                    min: 0.25,
                    max: 2,
                },
                entries: [
                    {
                        weight: 1,
                        creatures: ["Kobold"],
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("**CR Range:** 1/4 to 2");
        });

        it("should serialize table with terrain tags", () => {
            const table: EncounterTableData = {
                name: "mountain",
                terrain_tags: [{ value: "Mountain" }, { value: "Hills" }],
                entries: [
                    {
                        weight: 1,
                        creatures: ["Giant Eagle"],
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("**Terrain:** Mountain, Hills");
        });

        it("should serialize table with multiple tag types", () => {
            const table: EncounterTableData = {
                name: "undead-night",
                terrain_tags: [{ value: "Ruins" }],
                time_of_day_tags: [{ value: "Night" }],
                faction_tags: [{ value: "Undead" }],
                situation_tags: [{ value: "Horror" }],
                entries: [
                    {
                        weight: 3,
                        creatures: ["Zombie", "Skeleton"],
                        quantity: "2d6",
                        description: "Shambling undead patrol",
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("**Terrain:** Ruins");
            expect(markdown).toContain("**Time:** Night");
            expect(markdown).toContain("**Faction:** Undead");
            expect(markdown).toContain("**Situation:** Horror");
            expect(markdown).toContain("| 3 | Zombie, Skeleton | 2d6 | Shambling undead patrol |");
        });

        it("should serialize table with multiple entries", () => {
            const table: EncounterTableData = {
                name: "forest-random",
                entries: [
                    {
                        weight: 5,
                        creatures: ["Wolf"],
                        quantity: "1d4",
                        description: "Hungry wolf pack",
                    },
                    {
                        weight: 3,
                        creatures: ["Bear"],
                        quantity: "1",
                        description: "Territorial bear",
                    },
                    {
                        weight: 1,
                        creatures: ["Owlbear"],
                        quantity: "1",
                        description: "Rare owlbear sighting",
                    },
                ],
            };

            const markdown = encounterTableToMarkdown(table);

            expect(markdown).toContain("| 5 | Wolf | 1d4 | Hungry wolf pack |");
            expect(markdown).toContain("| 3 | Bear | 1 | Territorial bear |");
            expect(markdown).toContain("| 1 | Owlbear | 1 | Rare owlbear sighting |");
        });
    });

    describe("parseCR", () => {
        it("should parse numeric CR", () => {
            expect(parseCR(1)).toBe(1);
            expect(parseCR(5)).toBe(5);
            expect(parseCR(20)).toBe(20);
        });

        it("should parse fractional CR strings", () => {
            expect(parseCR("1/8")).toBe(0.125);
            expect(parseCR("1/4")).toBe(0.25);
            expect(parseCR("1/2")).toBe(0.5);
        });

        it("should parse numeric strings", () => {
            expect(parseCR("1")).toBe(1);
            expect(parseCR("10")).toBe(10);
        });

        it("should handle invalid input", () => {
            expect(parseCR("invalid")).toBe(0);
            expect(parseCR("")).toBe(0);
        });
    });
});
