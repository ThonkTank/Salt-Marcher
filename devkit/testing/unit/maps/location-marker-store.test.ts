// devkit/testing/unit/maps/location-marker-store.test.ts
// Unit tests for location marker store

import { describe, test, expect, beforeEach, vi } from "vitest";
import { App, TFile } from "obsidian";
import {
    getLocationMarkerStore,
    resetLocationMarkerStore,
    LOCATION_TYPE_ICONS,
    type LocationMarker,
} from "../../../../src/features/maps/state/location-marker-store";

// Mock normalizePath
vi.mock("obsidian", async () => {
    const actual = await vi.importActual<typeof import("obsidian")>("obsidian");
    return {
        ...actual,
        normalizePath: (path: string) => path,
    };
});

describe("getLocationMarkerStore", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("creates and returns a marker store for a map file", () => {
        const store = getLocationMarkerStore(app, mapFile);
        expect(store).toBeDefined();
        expect(store.state).toBeDefined();
        expect(store.setMarkers).toBeDefined();
        expect(store.get).toBeDefined();
        expect(store.list).toBeDefined();
        expect(store.getByLocationName).toBeDefined();
        expect(store.clear).toBeDefined();
    });

    test("returns the same store instance for the same map file", () => {
        const store1 = getLocationMarkerStore(app, mapFile);
        const store2 = getLocationMarkerStore(app, mapFile);
        expect(store1).toBe(store2);
    });

    test("returns different stores for different map files", () => {
        const mapFile2 = new TFile();
        mapFile2.path = "Maps/OtherMap.md";
        mapFile2.basename = "OtherMap";

        const store1 = getLocationMarkerStore(app, mapFile);
        const store2 = getLocationMarkerStore(app, mapFile2);
        expect(store1).not.toBe(store2);
    });
});

describe("LocationMarkerStore - setMarkers", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("sets markers and loads them correctly", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
            {
                coord: { r: 15, c: 25 },
                locationName: "Neverwinter",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const state = store.state.get();
        expect(state.loaded).toBe(true);
        expect(state.entries.size).toBe(2);
        expect(state.mapPath).toBe("Maps/TestMap.md");
    });

    test("uses default icon from LOCATION_TYPE_ICONS", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Dragon's Lair",
                locationType: "Dungeon",
            },
        ];

        store.setMarkers(markers);

        const marker = store.get({ r: 10, c: 20 });
        expect(marker).toBeDefined();
        expect(marker!.displayIcon).toBe(LOCATION_TYPE_ICONS["Dungeon"]);
    });

    test("uses custom icon if provided", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Custom Place",
                locationType: "Landmark",
                icon: "🌋",
            },
        ];

        store.setMarkers(markers);

        const marker = store.get({ r: 10, c: 20 });
        expect(marker).toBeDefined();
        expect(marker!.displayIcon).toBe("🌋");
    });

    test("handles empty marker list", () => {
        const store = getLocationMarkerStore(app, mapFile);
        store.setMarkers([]);

        const state = store.state.get();
        expect(state.loaded).toBe(true);
        expect(state.entries.size).toBe(0);
    });

    test("skips invalid markers with missing coords", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Valid",
                locationType: "Stadt",
            },
            {
                coord: { r: NaN, c: 20 } as any,
                locationName: "Invalid",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const state = store.state.get();
        expect(state.entries.size).toBe(1);
        expect(store.get({ r: 10, c: 20 })).toBeDefined();
        expect(store.get({ r: NaN, c: 20 } as any)).toBeNull();
    });

    test("skips duplicate coordinates (keeps first)", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "First",
                locationType: "Stadt",
            },
            {
                coord: { r: 10, c: 20 },
                locationName: "Second",
                locationType: "Dorf",
            },
        ];

        store.setMarkers(markers);

        const state = store.state.get();
        expect(state.entries.size).toBe(1);

        const marker = store.get({ r: 10, c: 20 });
        expect(marker!.locationName).toBe("First");
    });
});

describe("LocationMarkerStore - get", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("retrieves marker by coordinate", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const marker = store.get({ r: 10, c: 20 });
        expect(marker).toBeDefined();
        expect(marker!.locationName).toBe("Waterdeep");
        expect(marker!.locationType).toBe("Stadt");
        expect(marker!.key).toBe("10:20");
    });

    test("returns null for non-existent coordinate", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const marker = store.get({ r: 99, c: 99 });
        expect(marker).toBeNull();
    });

    test("returns null for invalid coordinates", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const marker1 = store.get({ r: NaN, c: 20 } as any);
        expect(marker1).toBeNull();

        const marker2 = store.get(null as any);
        expect(marker2).toBeNull();

        const marker3 = store.get(undefined as any);
        expect(marker3).toBeNull();
    });
});

describe("LocationMarkerStore - list", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("lists all markers", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
            {
                coord: { r: 15, c: 25 },
                locationName: "Neverwinter",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const list = store.list();
        expect(list).toHaveLength(2);
        expect(list.map(m => m.locationName).sort()).toEqual(["Neverwinter", "Waterdeep"]);
    });

    test("returns empty array when no markers set", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const list = store.list();
        expect(list).toEqual([]);
    });
});

describe("LocationMarkerStore - getByLocationName", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("finds marker by location name", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
            {
                coord: { r: 15, c: 25 },
                locationName: "Neverwinter",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const marker = store.getByLocationName("Neverwinter");
        expect(marker).toBeDefined();
        expect(marker!.locationName).toBe("Neverwinter");
        expect(marker!.coord).toEqual({ r: 15, c: 25 });
    });

    test("returns null for non-existent location name", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        const marker = store.getByLocationName("NonExistent");
        expect(marker).toBeNull();
    });

    test("handles whitespace trimming", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);

        // Should find "Waterdeep" even with extra whitespace
        const marker = store.getByLocationName("  Waterdeep  ");
        expect(marker).toBeDefined();
        expect(marker!.locationName).toBe("Waterdeep");
    });
});

describe("LocationMarkerStore - clear", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("clears all markers", () => {
        const store = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store.setMarkers(markers);
        expect(store.list()).toHaveLength(1);

        store.clear();

        const state = store.state.get();
        expect(state.loaded).toBe(false);
        expect(state.entries.size).toBe(0);
        expect(store.list()).toEqual([]);
    });
});

describe("resetLocationMarkerStore", () => {
    let app: App;
    let mapFile: TFile;

    beforeEach(() => {
        app = new App();
        mapFile = new TFile();
        mapFile.path = "Maps/TestMap.md";
        mapFile.basename = "TestMap";
    });

    test("resets store and removes it from registry", () => {
        const store1 = getLocationMarkerStore(app, mapFile);

        const markers: LocationMarker[] = [
            {
                coord: { r: 10, c: 20 },
                locationName: "Waterdeep",
                locationType: "Stadt",
            },
        ];

        store1.setMarkers(markers);
        expect(store1.list()).toHaveLength(1);

        resetLocationMarkerStore(app, mapFile);

        // Getting the store again should create a new instance with empty state
        const store2 = getLocationMarkerStore(app, mapFile);
        expect(store2).not.toBe(store1);
        expect(store2.list()).toEqual([]);
    });
});
