// devkit/testing/unit/features/factions/npc-generator.test.ts
// Unit tests for NPC Name Generator

import { describe, it, expect } from "vitest";
import {
    generateNPCName,
    generateNPCProfile,
    generateFactionNPCs,
} from "../../../../../src/features/factions/npc-generator";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

describe("NPC Generator", () => {
    const testFaction: FactionData = {
        name: "The Emerald Enclave",
        motto: "Nature's balance must be preserved",
        headquarters: "Moonstone Hollow",
        influence_tags: [{ value: "Religious" }, { value: "Scholarly" }],
        culture_tags: [{ value: "Elven" }, { value: "Human" }],
        goal_tags: [{ value: "Defense" }, { value: "Stability" }],
        summary: "A druidic circle",
    };

    describe("generateNPCName", () => {
        it("generates a valid name", () => {
            const name = generateNPCName("elven", "elf", "Leader", testFaction);
            expect(name).toBeTruthy();
            expect(typeof name).toBe("string");
            expect(name.length).toBeGreaterThan(0);
        });

        it("generates different names on multiple calls", () => {
            const names = new Set();
            for (let i = 0; i < 20; i++) {
                names.add(generateNPCName("elven", "elf", "Scout"));
            }
            // Should have some variety (at least 10 different names out of 20)
            expect(names.size).toBeGreaterThan(10);
        });

        it("generates names for different cultures", () => {
            const elvenName = generateNPCName("elven");
            const dwarvenName = generateNPCName("dwarven");
            const orcishName = generateNPCName("orcish");

            expect(elvenName).toBeTruthy();
            expect(dwarvenName).toBeTruthy();
            expect(orcishName).toBeTruthy();
        });

        it("handles unknown culture by using mixed template", () => {
            const name = generateNPCName("unknown_culture");
            expect(name).toBeTruthy();
        });

        it("generates names without culture/species", () => {
            const name = generateNPCName();
            expect(name).toBeTruthy();
        });

        it("adds titles more often for leaders", () => {
            const leaderNames = [];
            const workerNames = [];

            for (let i = 0; i < 50; i++) {
                leaderNames.push(generateNPCName("human", "human", "Leader"));
                workerNames.push(generateNPCName("human", "human", "Worker"));
            }

            const leaderTitles = leaderNames.filter((n) =>
                n.includes("Captain") || n.includes("Ser") || n.includes("Lady") || n.includes("Lord") || n.includes("Master")
            ).length;

            const workerTitles = workerNames.filter((n) =>
                n.includes("Captain") || n.includes("Ser") || n.includes("Lady") || n.includes("Lord") || n.includes("Master")
            ).length;

            // Leaders should have more titles than workers (statistically)
            expect(leaderTitles).toBeGreaterThan(workerTitles);
        });
    });

    describe("generateNPCProfile", () => {
        it("generates a complete profile", () => {
            const profile = generateNPCProfile("elven", "elf", "Leader", testFaction);

            expect(profile.name).toBeTruthy();
            expect(profile.role).toBe("Leader");
            expect(profile.culture).toBe("elven");
            expect(profile.personality).toBeInstanceOf(Array);
            expect(profile.personality.length).toBe(3);
            expect(profile.appearance).toBeTruthy();
            expect(profile.background).toBeTruthy();
        });

        it("generates personality based on faction goals", () => {
            const conquestFaction: FactionData = {
                ...testFaction,
                goal_tags: [{ value: "Conquest" }, { value: "Expansion" }],
            };

            const profile = generateNPCProfile("human", "human", "Warrior", conquestFaction);

            // At least one trait should relate to conquest goals
            const hasConquestTrait = profile.personality.some((trait) =>
                ["Aggressive", "Ambitious", "Ruthless"].includes(trait)
            );

            expect(hasConquestTrait).toBe(true);
        });

        it("generates personality based on faction culture", () => {
            const dwarvenFaction: FactionData = {
                ...testFaction,
                culture_tags: [{ value: "Dwarven" }],
            };

            const profile = generateNPCProfile("dwarven", "dwarf", "Guard", dwarvenFaction);

            // At least one trait should relate to dwarven culture
            const hasDwarvenTrait = profile.personality.some((trait) =>
                ["Stubborn", "Honorable", "Hardy"].includes(trait)
            );

            expect(hasDwarvenTrait).toBe(true);
        });

        it("includes faction motto in background when present", () => {
            const profile = generateNPCProfile("human", "human", "Scout", testFaction);

            expect(profile.background).toContain(testFaction.motto);
        });

        it("generates appearance based on species", () => {
            const elfProfile = generateNPCProfile("elven", "elf", "Scout", testFaction);
            const dwarfProfile = generateNPCProfile("dwarven", "dwarf", "Scout", testFaction);

            // Appearance should be non-empty strings
            expect(elfProfile.appearance).toBeTruthy();
            expect(elfProfile.appearance.length).toBeGreaterThan(10); // Should be descriptive

            expect(dwarfProfile.appearance).toBeTruthy();
            expect(dwarfProfile.appearance.length).toBeGreaterThan(10); // Should be descriptive

            // They should be different (with high probability)
            expect(elfProfile.appearance).not.toBe(dwarfProfile.appearance);
        });
    });

    describe("generateFactionNPCs", () => {
        it("generates requested number of NPCs", () => {
            const npcs = generateFactionNPCs(testFaction, 5);

            expect(npcs.length).toBe(5);
        });

        it("generates NPCs with faction culture", () => {
            const npcs = generateFactionNPCs(testFaction, 3);

            for (const npc of npcs) {
                expect(npc.culture).toBe("Elven"); // Primary culture from faction
            }
        });

        it("uses provided roles when available", () => {
            const roles = ["Leader", "Scout", "Guard"];
            const npcs = generateFactionNPCs(testFaction, 3, roles);

            expect(npcs[0].role).toBe("Leader");
            expect(npcs[1].role).toBe("Scout");
            expect(npcs[2].role).toBe("Guard");
        });

        it("cycles through roles if more NPCs than roles", () => {
            const roles = ["Leader", "Scout"];
            const npcs = generateFactionNPCs(testFaction, 4, roles);

            expect(npcs[0].role).toBe("Leader");
            expect(npcs[1].role).toBe("Scout");
            expect(npcs[2].role).toBe("Leader"); // Cycles back
            expect(npcs[3].role).toBe("Scout");
        });

        it("uses default roles when none provided", () => {
            const npcs = generateFactionNPCs(testFaction, 5);

            const validRoles = ["Leader", "Scout", "Guard", "Worker", "Mage", "Warrior"];
            for (const npc of npcs) {
                expect(validRoles).toContain(npc.role);
            }
        });

        it("uses mixed culture when faction has no culture tags", () => {
            const noCultureFaction: FactionData = {
                name: "Test Faction",
                culture_tags: [],
            };

            const npcs = generateFactionNPCs(noCultureFaction, 2);

            expect(npcs[0].culture).toBe("Mixed");
        });
    });
});
