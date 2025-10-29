// devkit/testing/unit/library/locations-tree.test.ts
// Unit tests for location tree builder and hierarchy functions

import { describe, test, expect } from "vitest";
import { buildLocationTree, flattenTree, findNodeByName, buildBreadcrumbs } from "../../../../src/workmodes/library/locations/tree-builder";
import type { LocationData } from "../../../../src/workmodes/library/locations/types";

describe("buildLocationTree", () => {
    test("builds simple one-level hierarchy", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
            { name: "Child1", type: "Gebäude", parent: "Root" },
            { name: "Child2", type: "Gebäude", parent: "Root" },
        ];

        const tree = buildLocationTree(locations);

        expect(tree).toHaveLength(1);
        expect(tree[0].location.name).toBe("Root");
        expect(tree[0].children).toHaveLength(2);
        expect(tree[0].depth).toBe(0);
        expect(tree[0].children[0].depth).toBe(1);
        expect(tree[0].children[1].depth).toBe(1);
    });

    test("builds multi-level hierarchy", () => {
        const locations: LocationData[] = [
            { name: "City", type: "Stadt" },
            { name: "District", type: "Dorf", parent: "City" },
            { name: "Building", type: "Gebäude", parent: "District" },
            { name: "Room", type: "Gebäude", parent: "Building" },
        ];

        const tree = buildLocationTree(locations);

        expect(tree).toHaveLength(1);
        expect(tree[0].location.name).toBe("City");
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].location.name).toBe("District");
        expect(tree[0].children[0].children).toHaveLength(1);
        expect(tree[0].children[0].children[0].location.name).toBe("Building");
        expect(tree[0].children[0].children[0].children).toHaveLength(1);
        expect(tree[0].children[0].children[0].children[0].location.name).toBe("Room");

        // Verify depths
        expect(tree[0].depth).toBe(0);
        expect(tree[0].children[0].depth).toBe(1);
        expect(tree[0].children[0].children[0].depth).toBe(2);
        expect(tree[0].children[0].children[0].children[0].depth).toBe(3);
    });

    test("handles orphans (missing parents) as roots", () => {
        const locations: LocationData[] = [
            { name: "Orphan", type: "Gebäude", parent: "NonExistent" },
            { name: "Root", type: "Stadt" },
        ];

        const tree = buildLocationTree(locations);

        expect(tree).toHaveLength(2);
        expect(tree.map(n => n.location.name).sort()).toEqual(["Orphan", "Root"]);
    });

    test("handles locations with empty parent as roots", () => {
        const locations: LocationData[] = [
            { name: "Loc1", type: "Stadt", parent: "" },
            { name: "Loc2", type: "Stadt", parent: "   " },
            { name: "Loc3", type: "Stadt" }, // undefined parent
        ];

        const tree = buildLocationTree(locations);

        expect(tree).toHaveLength(3);
    });

    test("detects cycles and breaks them", () => {
        const locations: LocationData[] = [
            { name: "A", type: "Stadt", parent: "C" },
            { name: "B", type: "Dorf", parent: "A" },
            { name: "C", type: "Gebäude", parent: "B" },
        ];

        const tree = buildLocationTree(locations);

        // With cycle detection, one of them becomes root and others are children
        // The exact behavior depends on which one is treated as orphan (C's parent A exists but forms cycle)
        expect(tree.length).toBeGreaterThanOrEqual(1);

        // Verify no infinite loops occurred (test completes successfully)
        expect(tree).toBeDefined();
    });

    test("returns empty array for empty input", () => {
        const tree = buildLocationTree([]);
        expect(tree).toEqual([]);
    });

    test("handles multiple root trees", () => {
        const locations: LocationData[] = [
            { name: "Root1", type: "Stadt" },
            { name: "Root1Child", type: "Gebäude", parent: "Root1" },
            { name: "Root2", type: "Stadt" },
            { name: "Root2Child", type: "Gebäude", parent: "Root2" },
        ];

        const tree = buildLocationTree(locations);

        expect(tree).toHaveLength(2);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[1].children).toHaveLength(1);
    });
});

describe("flattenTree", () => {
    test("flattens tree into depth-first list", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
            { name: "Child1", type: "Gebäude", parent: "Root" },
            { name: "Child2", type: "Gebäude", parent: "Root" },
            { name: "Grandchild", type: "Gebäude", parent: "Child1" },
        ];

        const tree = buildLocationTree(locations);
        const flat = flattenTree(tree);

        expect(flat).toHaveLength(4);
        expect(flat[0].location.name).toBe("Root");
        expect(flat[1].location.name).toBe("Child1");
        expect(flat[2].location.name).toBe("Grandchild");
        expect(flat[3].location.name).toBe("Child2");
    });

    test("returns empty array for empty tree", () => {
        const flat = flattenTree([]);
        expect(flat).toEqual([]);
    });
});

describe("findNodeByName", () => {
    test("finds node in tree", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
            { name: "Child", type: "Gebäude", parent: "Root" },
            { name: "Grandchild", type: "Gebäude", parent: "Child" },
        ];

        const tree = buildLocationTree(locations);

        const foundRoot = findNodeByName(tree, "Root");
        expect(foundRoot).not.toBeNull();
        expect(foundRoot?.location.name).toBe("Root");

        const foundGrandchild = findNodeByName(tree, "Grandchild");
        expect(foundGrandchild).not.toBeNull();
        expect(foundGrandchild?.location.name).toBe("Grandchild");
        expect(foundGrandchild?.depth).toBe(2);
    });

    test("returns null for non-existent node", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
        ];

        const tree = buildLocationTree(locations);
        const found = findNodeByName(tree, "NonExistent");

        expect(found).toBeNull();
    });

    test("returns null for empty tree", () => {
        const found = findNodeByName([], "AnyName");
        expect(found).toBeNull();
    });
});

describe("buildBreadcrumbs", () => {
    test("builds breadcrumb path from root to target", () => {
        const locations: LocationData[] = [
            { name: "City", type: "Stadt" },
            { name: "District", type: "Dorf", parent: "City" },
            { name: "Building", type: "Gebäude", parent: "District" },
            { name: "Room", type: "Gebäude", parent: "Building" },
        ];

        const breadcrumbs = buildBreadcrumbs(locations, "Room");

        expect(breadcrumbs).toEqual(["City", "District", "Building", "Room"]);
    });

    test("returns single item for root location", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
        ];

        const breadcrumbs = buildBreadcrumbs(locations, "Root");

        expect(breadcrumbs).toEqual(["Root"]);
    });

    test("returns empty array for non-existent location", () => {
        const locations: LocationData[] = [
            { name: "Root", type: "Stadt" },
        ];

        const breadcrumbs = buildBreadcrumbs(locations, "NonExistent");

        expect(breadcrumbs).toEqual([]);
    });

    test("handles orphan (missing parent) gracefully", () => {
        const locations: LocationData[] = [
            { name: "Orphan", type: "Gebäude", parent: "NonExistent" },
        ];

        const breadcrumbs = buildBreadcrumbs(locations, "Orphan");

        expect(breadcrumbs).toEqual(["Orphan"]);
    });

    test("detects cycle and stops traversal", () => {
        const locations: LocationData[] = [
            { name: "A", type: "Stadt", parent: "C" },
            { name: "B", type: "Dorf", parent: "A" },
            { name: "C", type: "Gebäude", parent: "B" },
        ];

        const breadcrumbs = buildBreadcrumbs(locations, "A");

        // Should stop at cycle detection
        expect(breadcrumbs.length).toBeGreaterThan(0);
        expect(breadcrumbs.length).toBeLessThanOrEqual(3);
    });
});
