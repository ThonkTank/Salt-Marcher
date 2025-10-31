// devkit/testing/unit/features/factions/phase-8.6-npc-personalities.test.ts
// Unit tests for Phase 8.6: NPC Personality System (quirks, loyalties, secrets, trust, ambition)

import { describe, expect, it } from "vitest";
import type { FactionData, NPCPersonality } from "../../../../../src/workmodes/library/factions/types";
import {
    generateNPCPersonality,
    updateNPCLoyalty,
    isLikelyToBetray,
} from "../../../../../src/features/factions/npc-generator";

describe("Phase 8.6: NPC Personalities", () => {
    const testFaction: FactionData = {
        name: "Test Faction",
        motto: "Test Motto",
        goal_tags: [{ value: "Conquest" }, { value: "Trade" }],
        culture_tags: [{ value: "Elven" }],
    };

    describe("generateNPCPersonality", () => {
        it("generates personality with quirks", () => {
            const personality = generateNPCPersonality(testFaction, "Leader");

            expect(personality.quirks).toBeDefined();
            expect(personality.quirks!.length).toBeGreaterThan(0);
            expect(personality.quirks!.length).toBeLessThanOrEqual(2);
        });

        it("generates personality with loyalties", () => {
            const personality = generateNPCPersonality(testFaction, "Leader");

            expect(personality.loyalties).toBeDefined();
            expect(personality.loyalties!.length).toBeGreaterThan(0);
            // Leaders should always have faction loyalty
            expect(personality.loyalties!.some((l) => l.includes(testFaction.name))).toBe(true);
        });

        it("generates personality with trust level", () => {
            const personality = generateNPCPersonality(testFaction, "Leader");

            expect(personality.trust).toBeDefined();
            expect(personality.trust).toBeGreaterThanOrEqual(0);
            expect(personality.trust).toBeLessThanOrEqual(100);
        });

        it("generates personality with ambition level", () => {
            const personality = generateNPCPersonality(testFaction, "Leader");

            expect(personality.ambition).toBeDefined();
            expect(personality.ambition).toBeGreaterThanOrEqual(0);
            expect(personality.ambition).toBeLessThanOrEqual(100);
        });

        it("generates secrets (probabilistic)", () => {
            const personality = generateNPCPersonality(testFaction, "Leader");

            expect(personality.secrets).toBeDefined();
            // Secrets may or may not be generated
            expect(Array.isArray(personality.secrets)).toBe(true);
        });

        it("generates individual loyalties when other NPCs provided", () => {
            const otherNPCs = ["Captain Smith", "Wizard Jones"];
            const personality = generateNPCPersonality(testFaction, "Scout", otherNPCs);

            expect(personality.loyalties).toBeDefined();
            // May or may not have individual loyalty (probabilistic)
        });
    });

    describe("updateNPCLoyalty", () => {
        it("increases trust when loyalty improved", () => {
            const personality: NPCPersonality = {
                trust: 50,
                ambition: 50,
                quirks: [],
                loyalties: [],
                secrets: [],
            };

            const updated = updateNPCLoyalty(personality, 20, "saved the faction");

            expect(updated.trust).toBe(70);
            expect(updated.loyalties?.some((l) => l.includes("Grateful"))).toBe(true);
        });

        it("decreases trust when loyalty damaged", () => {
            const personality: NPCPersonality = {
                trust: 50,
                ambition: 50,
                quirks: [],
                loyalties: [],
                secrets: [],
            };

            const updated = updateNPCLoyalty(personality, -30, "betrayed by leader");

            expect(updated.trust).toBe(20);
            expect(updated.loyalties?.some((l) => l.includes("Resentful"))).toBe(true);
        });

        it("clamps trust at 0-100", () => {
            let personality: NPCPersonality = {
                trust: 95,
                ambition: 50,
            };

            personality = updateNPCLoyalty(personality, 50);
            expect(personality.trust).toBe(100);

            personality = updateNPCLoyalty(personality, -150);
            expect(personality.trust).toBe(0);
        });

        it("adds disloyal secret when trust drops very low", () => {
            const personality: NPCPersonality = {
                trust: 50,
                ambition: 50,
                secrets: [],
            };

            const updated = updateNPCLoyalty(personality, -30);

            expect(updated.trust).toBe(20);
            expect(updated.secrets!.length).toBeGreaterThan(0);
        });
    });

    describe("isLikelyToBetray", () => {
        it("high betrayal risk with low trust and high ambition", () => {
            const personality: NPCPersonality = {
                trust: 20,
                ambition: 80,
            };

            // Probabilistic, but should be high chance
            const results = Array.from({ length: 10 }, () => isLikelyToBetray(personality));
            const betrayals = results.filter((b) => b).length;

            expect(betrayals).toBeGreaterThan(3); // At least 30% should betray
        });

        it("low betrayal risk with high trust", () => {
            const personality: NPCPersonality = {
                trust: 80,
                ambition: 50,
            };

            // Should be very unlikely
            const results = Array.from({ length: 10 }, () => isLikelyToBetray(personality));
            const betrayals = results.filter((b) => b).length;

            expect(betrayals).toBeLessThan(3); // Less than 30% should betray
        });

        it("medium betrayal risk with very low trust", () => {
            const personality: NPCPersonality = {
                trust: 15,
                ambition: 40,
            };

            // Should have moderate risk
            const results = Array.from({ length: 10 }, () => isLikelyToBetray(personality));
            const betrayals = results.filter((b) => b).length;

            expect(betrayals).toBeGreaterThan(2); // Some should betray
        });

        it("high betrayal risk with disloyal secret", () => {
            const personality: NPCPersonality = {
                trust: 60,
                ambition: 50,
                secrets: ["Planning to overthrow leadership"],
            };

            // Should have elevated risk due to secret
            const results = Array.from({ length: 10 }, () => isLikelyToBetray(personality));
            const betrayals = results.filter((b) => b).length;

            expect(betrayals).toBeGreaterThan(2); // Elevated risk
        });

        it("no betrayal risk with high trust and low ambition", () => {
            const personality: NPCPersonality = {
                trust: 90,
                ambition: 20,
            };

            // Should be very unlikely
            const results = Array.from({ length: 10 }, () => isLikelyToBetray(personality));
            const betrayals = results.filter((b) => b).length;

            expect(betrayals).toBe(0); // Virtually no betrayals
        });
    });
});
