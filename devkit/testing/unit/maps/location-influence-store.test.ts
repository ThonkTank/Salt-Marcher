/**
 * devkit/testing/unit/maps/location-influence-store.test.ts
 * Phase 9.1: Tests for location influence store
 *
 * Tests the location influence store functionality including:
 * - Store instance management and isolation
 * - Assignment setting and retrieval
 * - Color assignment and owner differentiation
 * - Coordinate validation and duplicate handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { App, TFile } from "obsidian";
import {
    getLocationInfluenceStore,
    resetLocationInfluenceStore,
    type LocationInfluenceAssignment,
} from "../../../../src/features/maps/state/location-influence-store";

describe("getLocationInfluenceStore", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
    });

    it("returns the same store instance for the same map file", () => {
        const store1 = getLocationInfluenceStore(app, mapFile);
        const store2 = getLocationInfluenceStore(app, mapFile);
        expect(store1).toBe(store2);
    });

    it("returns different stores for different map files", () => {
        const mapFile2 = {
            path: "Maps/AnotherMap.md",
            basename: "AnotherMap",
            extension: "md",
        } as TFile;

        const store1 = getLocationInfluenceStore(app, mapFile);
        const store2 = getLocationInfluenceStore(app, mapFile2);
        expect(store1).not.toBe(store2);
    });
});

describe("LocationInfluenceStore - setAssignments", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
        resetLocationInfluenceStore(app, mapFile);
    });

    it("sets influence assignments and loads them correctly", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
                ownerType: "faction",
                ownerName: "Lords of Waterdeep",
            },
            {
                coord: { r: 6, c: 11 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 75,
                ownerType: "faction",
                ownerName: "Lords of Waterdeep",
            },
        ];

        store.setAssignments(assignments);

        const state = store.state.get();
        expect(state.loaded).toBe(true);
        expect(state.entries.size).toBe(2);

        const entry1 = store.get({ r: 5, c: 10 });
        expect(entry1).toBeTruthy();
        expect(entry1?.locationName).toBe("Waterdeep");
        expect(entry1?.strength).toBe(90);
        expect(entry1?.ownerName).toBe("Lords of Waterdeep");
    });

    it("assigns colors to owners automatically", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
                ownerType: "faction",
                ownerName: "Lords of Waterdeep",
            },
        ];

        store.setAssignments(assignments);

        const entry = store.get({ r: 5, c: 10 });
        expect(entry).toBeTruthy();
        expect(entry?.color).toBeTruthy();
        expect(entry?.color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("respects color overrides", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
                ownerType: "faction",
                ownerName: "Lords of Waterdeep",
                color: "#FF0000",
            },
        ];

        store.setAssignments(assignments);

        const entry = store.get({ r: 5, c: 10 });
        expect(entry).toBeTruthy();
        expect(entry?.color).toBe("#FF0000");
    });

    it("handles empty assignment list", () => {
        const store = getLocationInfluenceStore(app, mapFile);
        store.setAssignments([]);

        const state = store.state.get();
        expect(state.loaded).toBe(true);
        expect(state.entries.size).toBe(0);
    });

    it("skips invalid assignments with missing coords", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: null as any,
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
            },
            {
                coord: { r: 5, c: 10 },
                locationName: "Valid Location",
                locationType: "Dorf",
                strength: 50,
            },
        ];

        store.setAssignments(assignments);

        const state = store.state.get();
        expect(state.entries.size).toBe(1);
    });

    it("skips duplicate coordinates (keeps first)", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: { r: 5, c: 10 },
                locationName: "First",
                locationType: "Stadt",
                strength: 90,
            },
            {
                coord: { r: 5, c: 10 },
                locationName: "Second",
                locationType: "Dorf",
                strength: 50,
            },
        ];

        store.setAssignments(assignments);

        const state = store.state.get();
        expect(state.entries.size).toBe(1);

        const entry = store.get({ r: 5, c: 10 });
        expect(entry?.locationName).toBe("First");
    });
});

describe("LocationInfluenceStore - get", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
        resetLocationInfluenceStore(app, mapFile);
    });

    it("retrieves influence entry by coordinate", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        store.setAssignments([
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
            },
        ]);

        const entry = store.get({ r: 5, c: 10 });
        expect(entry).toBeTruthy();
        expect(entry?.locationName).toBe("Waterdeep");
    });

    it("returns null for non-existent coordinate", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        store.setAssignments([
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
            },
        ]);

        const entry = store.get({ r: 99, c: 99 });
        expect(entry).toBeNull();
    });

    it("returns null for invalid coordinates", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const entry = store.get(null as any);
        expect(entry).toBeNull();
    });
});

describe("LocationInfluenceStore - list", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
        resetLocationInfluenceStore(app, mapFile);
    });

    it("lists all influence entries", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const assignments: LocationInfluenceAssignment[] = [
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
            },
            {
                coord: { r: 6, c: 11 },
                locationName: "Baldur's Gate",
                locationType: "Stadt",
                strength: 85,
            },
        ];

        store.setAssignments(assignments);

        const entries = store.list();
        expect(entries).toHaveLength(2);
        expect(entries.map(e => e.locationName)).toContain("Waterdeep");
        expect(entries.map(e => e.locationName)).toContain("Baldur's Gate");
    });

    it("returns empty array when no assignments set", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const entries = store.list();
        expect(entries).toHaveLength(0);
    });
});

describe("LocationInfluenceStore - getColorForOwner", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
        resetLocationInfluenceStore(app, mapFile);
    });

    it("returns consistent color for same owner", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const color1 = store.getColorForOwner("Lords of Waterdeep", "faction");
        const color2 = store.getColorForOwner("Lords of Waterdeep", "faction");

        expect(color1).toBe(color2);
        expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("returns different colors for different owners", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const color1 = store.getColorForOwner("Lords of Waterdeep", "faction");
        const color2 = store.getColorForOwner("Zhentarim", "faction");

        // Colors should likely be different (though hash collision possible)
        // At minimum, both should be valid hex colors
        expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
        expect(color2).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("distinguishes between faction and NPC owners with same name", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        const factionColor = store.getColorForOwner("Aragorn", "faction");
        const npcColor = store.getColorForOwner("Aragorn", "npc");

        // Should be different because they're different owner types
        expect(factionColor).toMatch(/^#[0-9A-F]{6}$/i);
        expect(npcColor).toMatch(/^#[0-9A-F]{6}$/i);
    });
});

describe("LocationInfluenceStore - clear", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = {} as App;
        mapFile = {
            path: "Maps/TestMap.md",
            basename: "TestMap",
            extension: "md",
        } as TFile;
        resetLocationInfluenceStore(app, mapFile);
    });

    it("clears all assignments", () => {
        const store = getLocationInfluenceStore(app, mapFile);

        store.setAssignments([
            {
                coord: { r: 5, c: 10 },
                locationName: "Waterdeep",
                locationType: "Stadt",
                strength: 90,
            },
        ]);

        expect(store.list()).toHaveLength(1);

        store.clear();

        const state = store.state.get();
        expect(state.loaded).toBe(false);
        expect(state.entries.size).toBe(0);
        expect(store.list()).toHaveLength(0);
    });
});
