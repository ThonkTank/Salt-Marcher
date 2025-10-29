// devkit/testing/unit/library/locations/dungeon-serializer.test.ts
// Tests for dungeon serialization functionality

import { describe, it, expect } from "vitest";
import { locationToMarkdown } from "../../../../../src/workmodes/library/locations/serializer";
import type { LocationData, DungeonRoom } from "../../../../../src/workmodes/library/locations/types";

describe("locationToMarkdown - Dungeon Support", () => {
    it("serializes basic location without dungeon fields", () => {
        const location: LocationData = {
            name: "Waterdeep",
            type: "Stadt",
            description: "A bustling city",
        };

        const markdown = locationToMarkdown(location);

        expect(markdown).toContain("# Waterdeep");
        expect(markdown).toContain("**Type:** Stadt");
        expect(markdown).toContain("## Description");
        expect(markdown).toContain("A bustling city");
        expect(markdown).not.toContain("Grid Size");
        expect(markdown).not.toContain("## Rooms");
    });

    it("serializes dungeon with non-default cell size", () => {
        const dungeon: LocationData = {
            name: "Goblin Cave",
            type: "Dungeon",
            description: "A dark cave system",
            grid_width: 30,
            grid_height: 20,
            cell_size: 50, // Non-default value
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("# Goblin Cave");
        expect(markdown).toContain("**Type:** Dungeon");
        expect(markdown).toContain("**Grid Size:** 30×20");
        expect(markdown).toContain("**Cell Size:** 50px");
    });

    it("serializes dungeon without cell_size if default", () => {
        const dungeon: LocationData = {
            name: "Goblin Cave",
            type: "Dungeon",
            grid_width: 30,
            grid_height: 20,
            // cell_size omitted (default 40)
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("**Grid Size:** 30×20");
        expect(markdown).not.toContain("Cell Size");
    });

    it("serializes dungeon with single room", () => {
        const room: DungeonRoom = {
            id: "R1",
            name: "Entrance Hall",
            description: "A large hall with vaulted ceilings.",
            grid_bounds: { x: 0, y: 0, width: 10, height: 8 },
            doors: [],
            features: [],
        };

        const dungeon: LocationData = {
            name: "Test Dungeon",
            type: "Dungeon",
            grid_width: 30,
            grid_height: 20,
            rooms: [room],
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("## Rooms");
        expect(markdown).toContain("### Room R1: Entrance Hall");
        expect(markdown).toContain("**Bounds:** (0,0) → (10,8)");
        expect(markdown).toContain("**Description:**");
        expect(markdown).toContain("A large hall with vaulted ceilings.");
    });

    it("serializes room with doors", () => {
        const room: DungeonRoom = {
            id: "R1",
            name: "Main Chamber",
            grid_bounds: { x: 0, y: 0, width: 10, height: 10 },
            doors: [
                {
                    id: "T1",
                    position: { x: 5, y: 0 },
                    leads_to: "R2",
                    locked: false,
                },
                {
                    id: "T2",
                    position: { x: 10, y: 5 },
                    leads_to: "R3",
                    locked: true,
                    description: "Heavy iron door",
                },
            ],
            features: [],
        };

        const dungeon: LocationData = {
            name: "Test Dungeon",
            type: "Dungeon",
            grid_width: 20,
            grid_height: 20,
            rooms: [room],
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("**Doors:**");
        expect(markdown).toContain("**T1** (5,0) → R2");
        expect(markdown).toContain("**T2** (10,5) 🔒 → R3: Heavy iron door");
    });

    it("serializes room with features", () => {
        const room: DungeonRoom = {
            id: "R1",
            name: "Treasury",
            grid_bounds: { x: 0, y: 0, width: 8, height: 6 },
            doors: [],
            features: [
                {
                    id: "F1",
                    type: "secret",
                    position: { x: 2, y: 3 },
                    description: "Hidden door behind tapestry",
                },
                {
                    id: "F2",
                    type: "trap",
                    position: { x: 4, y: 4 },
                    description: "Pressure plate triggers spikes",
                },
                {
                    id: "F3",
                    type: "treasure",
                    position: { x: 6, y: 3 },
                    description: "Ornate chest with 500gp",
                },
            ],
        };

        const dungeon: LocationData = {
            name: "Test Dungeon",
            type: "Dungeon",
            grid_width: 20,
            grid_height: 20,
            rooms: [room],
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("**Features:**");
        expect(markdown).toContain("**GF1** (Secret, 2,3): Hidden door behind tapestry");
        expect(markdown).toContain("**HF2** (Trap, 4,4): Pressure plate triggers spikes");
        expect(markdown).toContain("**SF3** (Treasure, 6,3): Ornate chest with 500gp");
    });

    it("serializes dungeon with multiple rooms", () => {
        const rooms: DungeonRoom[] = [
            {
                id: "R1",
                name: "Entrance",
                grid_bounds: { x: 0, y: 0, width: 5, height: 5 },
                doors: [
                    {
                        id: "T1",
                        position: { x: 5, y: 2 },
                        leads_to: "R2",
                        locked: false,
                    },
                ],
                features: [],
            },
            {
                id: "R2",
                name: "Main Hall",
                grid_bounds: { x: 5, y: 0, width: 10, height: 10 },
                doors: [
                    {
                        id: "T2",
                        position: { x: 5, y: 5 },
                        leads_to: "R1",
                        locked: false,
                    },
                ],
                features: [],
            },
        ];

        const dungeon: LocationData = {
            name: "Multi-Room Dungeon",
            type: "Dungeon",
            grid_width: 30,
            grid_height: 20,
            rooms,
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("### Room R1: Entrance");
        expect(markdown).toContain("### Room R2: Main Hall");
    });

    it("handles empty rooms array gracefully", () => {
        const dungeon: LocationData = {
            name: "Empty Dungeon",
            type: "Dungeon",
            grid_width: 10,
            grid_height: 10,
            rooms: [],
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).not.toContain("## Rooms");
        expect(markdown).toContain("**Grid Size:** 10×10");
    });

    it("preserves all location fields for dungeons", () => {
        const dungeon: LocationData = {
            name: "Dragon's Lair",
            type: "Dungeon",
            description: "An ancient lair",
            parent: "Mountains",
            owner_type: "faction",
            owner_name: "Red Dragons",
            region: "Northern Peaks",
            coordinates: "42,17",
            notes: "Beware of traps",
            grid_width: 40,
            grid_height: 30,
        };

        const markdown = locationToMarkdown(dungeon);

        expect(markdown).toContain("# Dragon's Lair");
        expect(markdown).toContain("**Type:** Dungeon");
        expect(markdown).toContain("**Parent Location:** Mountains");
        expect(markdown).toContain("**Owner:** Fraktion (Red Dragons)"); // "Fraktion" is German for "Faction"
        expect(markdown).toContain("**Region:** Northern Peaks");
        expect(markdown).toContain("**Coordinates:** 42,17");
        expect(markdown).toContain("**Grid Size:** 40×30");
        expect(markdown).toContain("## Description");
        expect(markdown).toContain("An ancient lair");
        expect(markdown).toContain("## Notes");
        expect(markdown).toContain("Beware of traps");
    });
});
