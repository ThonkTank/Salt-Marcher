// devkit/testing/unit/features/factions/faction-simulation.test.ts
// Unit tests for Faction Simulation Engine

import { describe, it, expect } from "vitest";
import {
    simulateFactionTick,
    applySimulationResults,
    type SimulationTick,
} from "../../../../../src/features/factions/faction-simulation";
import type { FactionData, FactionMember } from "../../../../../src/workmodes/library/factions/types";

describe("Faction Simulation", () => {
    const baseTick: SimulationTick = {
        currentDate: "2024-01-15",
        elapsedDays: 1,
    };

    describe("simulateFactionTick", () => {
        it("processes crafting jobs and produces equipment", async () => {
            const member: FactionMember = {
                name: "Smith John",
                is_named: true,
                status: "Active",
                job: {
                    type: "crafting",
                    progress: 95, // Almost complete
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
                resources: { equipment: 100 },
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(1);
            expect(result.completedJobs[0].type).toBe("crafting");
            expect(result.resourceChanges.equipment).toBe(50);
            expect(result.events.length).toBeGreaterThan(0);
            expect(result.events[0].type).toBe("completion");
        });

        it("processes gathering jobs and produces resources", async () => {
            const member: FactionMember = {
                name: "Gatherer Jane",
                is_named: true,
                status: "Active",
                job: {
                    type: "gathering",
                    progress: 92,
                    resources: { food: 0 },
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
                resources: { food: 200 },
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(1);
            expect(result.resourceChanges.food).toBeDefined();
            expect(result.events.some((e) => e.type === "resource")).toBe(true);
        });

        it("processes research jobs and produces magic", async () => {
            const member: FactionMember = {
                name: "Wizard Merlin",
                is_named: true,
                status: "Active",
                job: {
                    type: "research",
                    progress: 95,
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
                resources: { magic: 50 },
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(1);
            expect(result.resourceChanges.magic).toBe(20);
            expect(result.events.some((e) => e.type === "discovery")).toBe(true);
        });

        it("advances job progress but doesn't complete if < 100%", async () => {
            const member: FactionMember = {
                name: "Worker",
                is_named: false,
                status: "Active",
                job: {
                    type: "crafting",
                    progress: 50, // Halfway
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(0);
            expect(member.job?.progress).toBe(60); // 50 + 10
        });

        it("skips members without jobs", async () => {
            const member: FactionMember = {
                name: "Idle Worker",
                is_named: false,
                status: "Active",
                // No job assigned
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(0);
        });

        it("skips inactive members", async () => {
            const member: FactionMember = {
                name: "Injured Worker",
                is_named: false,
                status: "Injured",
                job: {
                    type: "crafting",
                    progress: 90,
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.completedJobs.length).toBe(0);
        });

        it("calculates base resource production", async () => {
            const faction: FactionData = {
                name: "Test Faction",
                members: [],
                resources: { gold: 100 },
            };

            const result = await simulateFactionTick(faction, baseTick);

            // Base production: +10 gold, +5 food, +1 influence per day
            expect(result.resourceChanges.gold).toBeGreaterThanOrEqual(10);
            expect(result.resourceChanges.food).toBeDefined();
            expect(result.resourceChanges.influence).toBeDefined();
        });

        it("calculates resource consumption based on member count", async () => {
            const faction: FactionData = {
                name: "Test Faction",
                members: [
                    { name: "Member 1", is_named: true, status: "Active" },
                    { name: "Member 2", is_named: true, status: "Active" },
                    { name: "Member 3", is_named: true, status: "Active" },
                ],
                resources: { food: 500, gold: 1000 },
            };

            const result = await simulateFactionTick(faction, baseTick);

            // 3 members: -3 food, -6 gold per day
            // But also +5 food, +10 gold from production
            // Net: +2 food, +4 gold
            expect(result.resourceChanges.food).toBeLessThan(10); // < base production
            expect(result.resourceChanges.gold).toBeLessThan(15); // < base production
        });

        it("detects critical food shortage", async () => {
            const faction: FactionData = {
                name: "Starving Faction",
                members: [],
                resources: { food: 40 }, // Critical: < 50
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some((w) => w.includes("food"))).toBe(true);
            expect(result.events.some((e) => e.type === "crisis" && e.title.includes("Food"))).toBe(true);
        });

        it("detects critical gold shortage", async () => {
            const faction: FactionData = {
                name: "Bankrupt Faction",
                members: [],
                resources: { gold: 80 }, // Critical: < 100
            };

            const result = await simulateFactionTick(faction, baseTick);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some((w) => w.includes("gold"))).toBe(true);
            expect(result.events.some((e) => e.type === "crisis" && e.title.includes("Economic"))).toBe(true);
        });

        it("processes expeditions and generates random events", async () => {
            const member: FactionMember = {
                name: "Explorer",
                is_named: true,
                status: "Active",
                position: {
                    type: "expedition",
                    route: "Northern Border",
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
            };

            // Run multiple times to increase chance of random event
            let foundEvent = false;
            for (let i = 0; i < 50; i++) {
                const result = await simulateFactionTick(faction, baseTick);
                if (result.events.some((e) => ["discovery", "conflict", "resource"].includes(e.type))) {
                    foundEvent = true;
                    break;
                }
            }

            // With 50 iterations, we should hit at least one random event (5% chance per tick)
            expect(foundEvent).toBe(true);
        });

        it("handles multiple elapsed days correctly", async () => {
            const member: FactionMember = {
                name: "Worker",
                is_named: false,
                status: "Active",
                job: {
                    type: "crafting",
                    progress: 50,
                },
            };

            const faction: FactionData = {
                name: "Test Faction",
                members: [member],
            };

            const multiDayTick: SimulationTick = {
                currentDate: "2024-01-18",
                elapsedDays: 3,
            };

            const result = await simulateFactionTick(faction, multiDayTick);

            // Progress: 50 + (10 * 3) = 80
            expect(member.job?.progress).toBe(80);
        });
    });

    describe("applySimulationResults", () => {
        it("applies resource changes to faction", () => {
            const faction: FactionData = {
                name: "Test Faction",
                resources: {
                    gold: 100,
                    food: 50,
                },
            };

            const result = {
                factionName: "Test Faction",
                resourceChanges: {
                    gold: 50,
                    food: -20,
                },
                completedJobs: [],
                newMembers: [],
                removedMembers: [],
                events: [],
                warnings: [],
            };

            applySimulationResults(faction, result);

            expect(faction.resources?.gold).toBe(150);
            expect(faction.resources?.food).toBe(30);
        });

        it("prevents resources from going negative", () => {
            const faction: FactionData = {
                name: "Test Faction",
                resources: {
                    gold: 50,
                },
            };

            const result = {
                factionName: "Test Faction",
                resourceChanges: {
                    gold: -100, // Would make it negative
                },
                completedJobs: [],
                newMembers: [],
                removedMembers: [],
                events: [],
                warnings: [],
            };

            applySimulationResults(faction, result);

            expect(faction.resources?.gold).toBe(0); // Clamped to 0
        });

        it("adds new members", () => {
            const faction: FactionData = {
                name: "Test Faction",
                members: [
                    { name: "Existing Member", is_named: true },
                ],
            };

            const newMember: FactionMember = {
                name: "New Recruit",
                is_named: false,
                quantity: 5,
            };

            const result = {
                factionName: "Test Faction",
                resourceChanges: {},
                completedJobs: [],
                newMembers: [newMember],
                removedMembers: [],
                events: [],
                warnings: [],
            };

            applySimulationResults(faction, result);

            expect(faction.members?.length).toBe(2);
            expect(faction.members?.[1].name).toBe("New Recruit");
        });

        it("removes members", () => {
            const faction: FactionData = {
                name: "Test Faction",
                members: [
                    { name: "Member 1", is_named: true },
                    { name: "Member 2", is_named: true },
                    { name: "Member 3", is_named: true },
                ],
            };

            const result = {
                factionName: "Test Faction",
                resourceChanges: {},
                completedJobs: [],
                newMembers: [],
                removedMembers: ["Member 2"],
                events: [],
                warnings: [],
            };

            applySimulationResults(faction, result);

            expect(faction.members?.length).toBe(2);
            expect(faction.members?.map((m) => m.name)).not.toContain("Member 2");
        });

        it("initializes resources if not present", () => {
            const faction: FactionData = {
                name: "Test Faction",
                // No resources field
            };

            const result = {
                factionName: "Test Faction",
                resourceChanges: {
                    gold: 100,
                },
                completedJobs: [],
                newMembers: [],
                removedMembers: [],
                events: [],
                warnings: [],
            };

            applySimulationResults(faction, result);

            expect(faction.resources).toBeDefined();
            expect(faction.resources?.gold).toBe(100);
        });
    });
});
