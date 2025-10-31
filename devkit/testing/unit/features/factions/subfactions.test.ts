// devkit/testing/unit/features/factions/subfactions.test.ts
// Unit tests for Subfaction System

import { describe, it, expect } from "vitest";
import {
    validateSubfactionHierarchy,
    inheritParentResources,
    inheritCultureTags,
    isSubfaction,
    getSubfactions,
    getRootParent,
    getHierarchy,
    getHierarchyResources,
    transferResources,
} from "../../../../../src/features/factions/subfactions";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

describe("Subfaction System", () => {
    const rootFaction: FactionData = {
        name: "Kingdom of Valoris",
        culture_tags: [{ value: "Human" }, { value: "Noble" }],
        resources: {
            gold: 10000,
            food: 5000,
            equipment: 2000,
            influence: 100,
        },
    };

    const subfaction1: FactionData = {
        name: "Royal Guard",
        parent_faction: "Kingdom of Valoris",
        culture_tags: [{ value: "Military" }],
        resources: {
            gold: 1000,
            equipment: 500,
        },
    };

    const subfaction2: FactionData = {
        name: "Court Mages",
        parent_faction: "Kingdom of Valoris",
        culture_tags: [{ value: "Arcane" }],
        resources: {
            gold: 500,
            magic: 200,
        },
    };

    const allFactions = [rootFaction, subfaction1, subfaction2];

    describe("validateSubfactionHierarchy", () => {
        it("validates root faction (no parent)", () => {
            const result = validateSubfactionHierarchy(rootFaction, allFactions);
            expect(result.valid).toBe(true);
        });

        it("validates subfaction with existing parent", () => {
            const result = validateSubfactionHierarchy(subfaction1, allFactions);
            expect(result.valid).toBe(true);
        });

        it("rejects subfaction with missing parent", () => {
            const invalidSubfaction: FactionData = {
                name: "Orphaned Faction",
                parent_faction: "Nonexistent Parent",
            };
            const result = validateSubfactionHierarchy(invalidSubfaction, allFactions);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("not found");
        });

        it("detects circular dependencies", () => {
            const faction1: FactionData = {
                name: "Faction A",
                parent_faction: "Faction B",
            };
            const faction2: FactionData = {
                name: "Faction B",
                parent_faction: "Faction A",
            };
            const result = validateSubfactionHierarchy(faction1, [faction1, faction2]);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Circular dependency");
        });

        it("validates multi-level hierarchy", () => {
            const level2Subfaction: FactionData = {
                name: "Elite Royal Guard",
                parent_faction: "Royal Guard",
            };
            const factionsWithLevel2 = [...allFactions, level2Subfaction];
            const result = validateSubfactionHierarchy(level2Subfaction, factionsWithLevel2);
            expect(result.valid).toBe(true);
        });
    });

    describe("inheritParentResources", () => {
        it("inherits 10% of parent resources by default", () => {
            const inherited = inheritParentResources(subfaction1, rootFaction);
            expect(inherited.gold).toBe(1000); // 10% of 10000
            expect(inherited.food).toBe(500); // 10% of 5000
            expect(inherited.equipment).toBe(200); // 10% of 2000
            expect(inherited.influence).toBe(10); // 10% of 100
        });

        it("supports custom inheritance rate", () => {
            const inherited = inheritParentResources(subfaction1, rootFaction, 0.2);
            expect(inherited.gold).toBe(2000); // 20% of 10000
        });

        it("returns empty object if parent has no resources", () => {
            const parentWithoutResources: FactionData = { name: "Poor Parent" };
            const inherited = inheritParentResources(subfaction1, parentWithoutResources);
            expect(Object.keys(inherited)).toHaveLength(0);
        });
    });

    describe("inheritCultureTags", () => {
        it("combines parent and subfaction culture tags", () => {
            const combined = inheritCultureTags(subfaction1, rootFaction);
            const values = combined.map((t) => t.value);
            expect(values).toContain("Human");
            expect(values).toContain("Noble");
            expect(values).toContain("Military");
        });

        it("deduplicates tags", () => {
            const subfactionWithDuplicate: FactionData = {
                name: "Test",
                parent_faction: "Kingdom of Valoris",
                culture_tags: [{ value: "Human" }, { value: "Military" }],
            };
            const combined = inheritCultureTags(subfactionWithDuplicate, rootFaction);
            const values = combined.map((t) => t.value);
            expect(values.filter((v) => v === "Human")).toHaveLength(1);
        });

        it("handles parent without culture tags", () => {
            const parentWithoutTags: FactionData = { name: "Parent" };
            const combined = inheritCultureTags(subfaction1, parentWithoutTags);
            expect(combined.map((t) => t.value)).toEqual(["Military"]);
        });
    });

    describe("isSubfaction", () => {
        it("identifies subfactions", () => {
            expect(isSubfaction(subfaction1)).toBe(true);
        });

        it("identifies root factions", () => {
            expect(isSubfaction(rootFaction)).toBe(false);
        });
    });

    describe("getSubfactions", () => {
        it("returns all direct subfactions", () => {
            const subfactions = getSubfactions(rootFaction, allFactions);
            expect(subfactions).toHaveLength(2);
            expect(subfactions.map((s) => s.name)).toEqual(["Royal Guard", "Court Mages"]);
        });

        it("returns empty array if no subfactions", () => {
            const subfactions = getSubfactions(subfaction1, allFactions);
            expect(subfactions).toHaveLength(0);
        });
    });

    describe("getRootParent", () => {
        it("returns self if already a root faction", () => {
            const root = getRootParent(rootFaction, allFactions);
            expect(root.name).toBe("Kingdom of Valoris");
        });

        it("returns root parent of subfaction", () => {
            const root = getRootParent(subfaction1, allFactions);
            expect(root.name).toBe("Kingdom of Valoris");
        });

        it("traverses multi-level hierarchy", () => {
            const level2Subfaction: FactionData = {
                name: "Elite Royal Guard",
                parent_faction: "Royal Guard",
            };
            const factionsWithLevel2 = [...allFactions, level2Subfaction];
            const root = getRootParent(level2Subfaction, factionsWithLevel2);
            expect(root.name).toBe("Kingdom of Valoris");
        });

        it("handles missing parent gracefully", () => {
            const orphan: FactionData = {
                name: "Orphan",
                parent_faction: "Missing Parent",
            };
            const root = getRootParent(orphan, [orphan]);
            expect(root.name).toBe("Orphan");
        });
    });

    describe("getHierarchy", () => {
        it("returns root faction and all descendants", () => {
            const hierarchy = getHierarchy(rootFaction, allFactions);
            expect(hierarchy).toHaveLength(3);
            expect(hierarchy.map((f) => f.name)).toEqual([
                "Kingdom of Valoris",
                "Royal Guard",
                "Court Mages",
            ]);
        });

        it("handles multi-level hierarchy", () => {
            const level2Subfaction: FactionData = {
                name: "Elite Royal Guard",
                parent_faction: "Royal Guard",
            };
            const factionsWithLevel2 = [...allFactions, level2Subfaction];
            const hierarchy = getHierarchy(rootFaction, factionsWithLevel2);
            expect(hierarchy).toHaveLength(4);
        });

        it("returns only root for factions without subfactions", () => {
            const hierarchy = getHierarchy(subfaction1, allFactions);
            expect(hierarchy).toHaveLength(1);
            expect(hierarchy[0].name).toBe("Royal Guard");
        });
    });

    describe("getHierarchyResources", () => {
        it("combines resources across entire hierarchy", () => {
            const combined = getHierarchyResources(rootFaction, allFactions);
            expect(combined.gold).toBe(11500); // 10000 + 1000 + 500
            expect(combined.food).toBe(5000); // Only root has food
            expect(combined.equipment).toBe(2500); // 2000 + 500
            expect(combined.magic).toBe(200); // Only Court Mages has magic
        });

        it("handles root without subfactions", () => {
            const combined = getHierarchyResources(subfaction1, allFactions);
            expect(combined.gold).toBe(1000);
            expect(combined.equipment).toBe(500);
        });
    });

    describe("transferResources", () => {
        it("transfers resources successfully", () => {
            const from = { ...rootFaction, resources: { ...rootFaction.resources } };
            const to = { ...subfaction1, resources: { ...subfaction1.resources } };

            const result = transferResources(from, to, { gold: 500, food: 100 });

            expect(result.success).toBe(true);
            expect(from.resources?.gold).toBe(9500); // 10000 - 500
            expect(from.resources?.food).toBe(4900); // 5000 - 100
            expect(to.resources?.gold).toBe(1500); // 1000 + 500
            expect(to.resources?.food).toBe(100); // 0 + 100
        });

        it("rejects transfer if insufficient resources", () => {
            const from = { ...rootFaction, resources: { gold: 100 } };
            const to = { ...subfaction1 };

            const result = transferResources(from, to, { gold: 500 });

            expect(result.success).toBe(false);
            expect(result.error).toContain("Insufficient");
        });

        it("rejects transfer if parent has no resources", () => {
            const from: FactionData = { name: "Poor Parent" };
            const to = { ...subfaction1 };

            const result = transferResources(from, to, { gold: 100 });

            expect(result.success).toBe(false);
            expect(result.error).toContain("no resources");
        });

        it("initializes resources for recipient if needed", () => {
            const from = { ...rootFaction, resources: { ...rootFaction.resources } };
            const to: FactionData = { name: "New Subfaction" };

            const result = transferResources(from, to, { gold: 500 });

            expect(result.success).toBe(true);
            expect(to.resources?.gold).toBe(500);
        });
    });
});
