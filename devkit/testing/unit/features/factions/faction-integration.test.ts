// Tests for Faction Integration (Phase 8.4)
//
// These tests verify the integration helper functions that connect
// faction system with encounters, calendar, and map visualization.
// Phase 8.4 includes full YAML parsing, coordinate conversion, and persistence.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getFactionMembersAtHex, getAllFactionCamps, runDailyFactionSimulation } from "../../../../../src/features/factions/faction-integration";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

// Mock Obsidian App
const createMockApp = (factionFiles: Array<{ path: string; content: string }> = []) => {
    return {
        vault: {
            getMarkdownFiles: vi.fn(() => {
                return factionFiles.map(f => ({
                    path: f.path,
                    basename: f.path.split("/").pop()?.replace(".md", "") || "",
                }));
            }),
            read: vi.fn(async (file: any) => {
                const found = factionFiles.find(f => f.path === file.path);
                if (!found) throw new Error("File not found");
                return found.content;
            }),
            modify: vi.fn(async (file: any, content: string) => {
                // Mock persistence - in real implementation this writes to disk
                const found = factionFiles.find(f => f.path === file.path);
                if (found) {
                    found.content = content;
                }
            }),
        },
    } as any;
};

describe("getFactionMembersAtHex", () => {
    it("returns empty array when no factions exist", async () => {
        const app = createMockApp([]);
        const result = await getFactionMembersAtHex(app, { q: 0, r: 0, s: 0 });
        expect(result).toEqual([]);
    });

    it("returns empty array when hex has no faction members", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/TestFaction.md",
                content: `---
name: Test Faction
smType: faction
---`,
            },
        ]);
        const result = await getFactionMembersAtHex(app, { q: 5, r: -3, s: -2 });
        expect(result).toEqual([]);
    });

    it("filters members by hex coordinates", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/TestFaction.md",
                content: `---
name: Test Faction
smType: faction
members:
  - name: Scout Alpha
    position:
      type: hex
      coords:
        q: 5
        r: -3
        s: -2
---`,
            },
        ]);

        const result = await getFactionMembersAtHex(app, { q: 5, r: -3, s: -2 });

        // Phase 8.4: Full YAML parsing implemented
        expect(result).toHaveLength(1);
        expect(result[0].faction.name).toBe("Test Faction");
        expect(result[0].members).toHaveLength(1);
        expect(result[0].members[0].name).toBe("Scout Alpha");
    });

    it("handles errors gracefully", async () => {
        const app = createMockApp();
        app.vault.getMarkdownFiles = vi.fn(() => {
            throw new Error("Vault error");
        });

        const result = await getFactionMembersAtHex(app, { q: 0, r: 0, s: 0 });
        expect(result).toEqual([]);
    });
});

describe("getAllFactionCamps", () => {
    it("returns empty array when no factions exist", async () => {
        const app = createMockApp([]);
        const result = await getAllFactionCamps(app);
        expect(result).toEqual([]);
    });

    it("returns empty array when factions have no camps", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/TestFaction.md",
                content: `---
name: Test Faction
smType: faction
---`,
            },
        ]);

        const result = await getAllFactionCamps(app);
        expect(result).toEqual([]);
    });

    it("handles errors gracefully", async () => {
        const app = createMockApp();
        app.vault.getMarkdownFiles = vi.fn(() => {
            throw new Error("Vault error");
        });

        const result = await getAllFactionCamps(app);
        expect(result).toEqual([]);
    });

    it("identifies camps from hex positions with coordinate conversion", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/TestFaction.md",
                content: `---
name: Test Faction
smType: faction
members:
  - name: Guard Unit Alpha
    quantity: 5
    position:
      type: hex
      coords:
        q: 5
        r: -3
        s: -2
  - name: Guard Unit Beta
    quantity: 4
    position:
      type: hex
      coords:
        q: 5
        r: -3
        s: -2
---`,
            },
        ]);

        const result = await getAllFactionCamps(app);

        // Phase 8.4: Coordinate conversion implemented
        // Camp created because totalMembers (5+4=9) >= 3
        expect(result).toHaveLength(1);
        expect(result[0].locationName).toBe("Test Faction Camp");
        expect(result[0].locationType).toBe("Camp");
        expect(result[0].ownerType).toBe("faction");
        expect(result[0].ownerName).toBe("Test Faction");
        // Coordinate should be converted from cube to oddr
        expect(result[0].coord).toHaveProperty("r");
        expect(result[0].coord).toHaveProperty("c");
    });
});

describe("runDailyFactionSimulation", () => {
    it("returns empty result when no factions exist", async () => {
        const app = createMockApp([]);
        const result = await runDailyFactionSimulation(app);

        expect(result.factionsProcessed).toBe(0);
        expect(result.events).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it("processes all factions", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/Faction1.md",
                content: `---
name: Faction One
smType: faction
---`,
            },
            {
                path: "SaltMarcher/Factions/Faction2.md",
                content: `---
name: Faction Two
smType: faction
---`,
            },
        ]);

        const result = await runDailyFactionSimulation(app);

        expect(result.factionsProcessed).toBe(2);
        expect(result.warnings).toEqual([]);
    });

    it("collects high-importance events", async () => {
        // Note: This test demonstrates architecture
        // Actual events depend on faction state and simulation logic
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/TestFaction.md",
                content: `---
name: Test Faction
smType: faction
resources:
  food: 10
---`,
            },
        ]);

        const result = await runDailyFactionSimulation(app);

        expect(result.factionsProcessed).toBe(1);
        // Events array may be empty or contain events depending on simulation
        expect(Array.isArray(result.events)).toBe(true);
    });

    it("handles errors gracefully", async () => {
        const app = createMockApp();
        app.vault.getMarkdownFiles = vi.fn(() => {
            throw new Error("Vault error");
        });

        const result = await runDailyFactionSimulation(app);

        // Errors in faction loading are caught and logged, but simulation returns empty result
        expect(result.factionsProcessed).toBe(0);
        expect(result.events).toEqual([]);
    });

    it("skips non-faction files", async () => {
        const app = createMockApp([
            {
                path: "SaltMarcher/Factions/NotAFaction.md",
                content: `---
name: Not A Faction
smType: creature
---`,
            },
            {
                path: "SaltMarcher/Factions/Faction.md",
                content: `---
name: Real Faction
smType: faction
---`,
            },
        ]);

        const result = await runDailyFactionSimulation(app);

        expect(result.factionsProcessed).toBe(1);
    });

    it("ignores preset factions", async () => {
        const app = createMockApp([
            {
                path: "Presets/Factions/PresetFaction.md",
                content: `---
name: Preset Faction
smType: faction
---`,
            },
            {
                path: "SaltMarcher/Factions/UserFaction.md",
                content: `---
name: User Faction
smType: faction
---`,
            },
        ]);

        const result = await runDailyFactionSimulation(app);

        expect(result.factionsProcessed).toBe(1);
    });
});

describe("faction loading (architecture tests)", () => {
    it("demonstrates expected faction data structure", async () => {
        // This test documents the expected structure when full YAML parsing is implemented
        const expectedFaction: FactionData = {
            name: "The Emerald Enclave",
            motto: "Nature's balance must be preserved",
            headquarters: "Moonstone Hollow",
            members: [
                {
                    name: "Archdruid Silvara",
                    is_named: true,
                    statblock_ref: "Archdruid",
                    role: "Leader",
                    status: "Active",
                    position: {
                        type: "poi",
                        location_name: "Moonstone Hollow",
                    },
                },
                {
                    name: "Ranger Patrol",
                    is_named: false,
                    quantity: 12,
                    statblock_ref: "Scout",
                    role: "Scout",
                    status: "Active",
                    position: {
                        type: "hex",
                        coords: { q: 5, r: -3, s: -2 },
                    },
                },
            ],
            resources: {
                gold: 5000,
                food: 2000,
                equipment: 500,
                magic: 150,
                influence: 75,
            },
            faction_relationships: [
                {
                    faction_name: "The Zhentarim",
                    value: -60,
                    type: "hostile",
                },
            ],
        };

        // Verify structure is valid
        expect(expectedFaction.name).toBe("The Emerald Enclave");
        expect(expectedFaction.members).toHaveLength(2);
        expect(expectedFaction.members?.[0].is_named).toBe(true);
        expect(expectedFaction.members?.[1].quantity).toBe(12);
    });
});
