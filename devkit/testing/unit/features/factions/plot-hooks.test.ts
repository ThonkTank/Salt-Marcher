// devkit/testing/unit/features/factions/plot-hooks.test.ts
// Unit tests for Plot Hook Generator

import { describe, it, expect } from "vitest";
import {
    generatePlotHooksFromDecision,
    generatePlotHooksFromEvent,
    generatePlotHooksFromRelationships,
    generateFactionPlotHooks,
} from "../../../../../src/features/factions/plot-hooks";
import type { FactionDecision } from "../../../../../src/features/factions/ai-types";
import type { SimulationEvent } from "../../../../../src/features/factions/faction-simulation";
import type { FactionData, FactionRelationship } from "../../../../../src/workmodes/library/factions/types";

describe("Plot Hook Generator", () => {
    const baseFaction: FactionData = {
        name: "Test Faction",
        headquarters: "Test HQ",
        goal_tags: [{ value: "Conquest" }],
        culture_tags: [{ value: "Human" }],
        resources: {
            gold: 1000,
            food: 500,
        },
    };

    describe("generatePlotHooksFromDecision", () => {
        it("generates expansion conflict hook", () => {
            const decision: FactionDecision = {
                type: "expand_territory",
                priority: 60,
                reasoning: "Faction goal",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("conflict");
            expect(hooks[0].title).toContain("Expansion");
            expect(hooks[0].factions).toContain("Test Faction");
            expect(hooks[0].objectives).toBeDefined();
            expect(hooks[0].objectives!.length).toBeGreaterThan(0);
        });

        it("generates camp opportunity hook", () => {
            const decision: FactionDecision = {
                type: "establish_camp",
                priority: 50,
                reasoning: "Strategic positioning",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("opportunity");
            expect(hooks[0].title).toContain("Outpost");
            expect(hooks[0].rewards).toBeDefined();
        });

        it("generates raid conflict hook with target faction", () => {
            const decision: FactionDecision = {
                type: "raid_target",
                priority: 70,
                reasoning: "Hostile faction",
                params: {
                    targetFaction: "Enemy Faction",
                },
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("conflict");
            expect(hooks[0].title).toContain("Raid");
            expect(hooks[0].factions).toContain("Test Faction");
            expect(hooks[0].factions).toContain("Enemy Faction");
            expect(hooks[0].urgency).toBeGreaterThanOrEqual(4);
        });

        it("generates alliance hook", () => {
            const decision: FactionDecision = {
                type: "form_alliance",
                priority: 40,
                reasoning: "Diplomatic opportunity",
                params: {
                    targetFaction: "Neutral Faction",
                },
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("alliance");
            expect(hooks[0].title).toContain("Alliance");
            expect(hooks[0].factions.length).toBe(2);
        });

        it("generates research mystery hook", () => {
            const decision: FactionDecision = {
                type: "research_magic",
                priority: 50,
                reasoning: "Knowledge pursuit",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("mystery");
            expect(hooks[0].title).toContain("Research");
            expect(hooks[0].complications).toBeDefined();
        });

        it("generates expedition opportunity hook", () => {
            const decision: FactionDecision = {
                type: "send_expedition",
                priority: 45,
                reasoning: "Exploration",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("opportunity");
            expect(hooks[0].title).toContain("Expedition");
            expect(hooks[0].rewards).toBeDefined();
        });

        it("generates recruitment opportunity hook", () => {
            const decision: FactionDecision = {
                type: "recruit_units",
                priority: 50,
                reasoning: "Building strength",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("opportunity");
            expect(hooks[0].title).toContain("Recruiting");
        });

        it("generates defense crisis hook", () => {
            const decision: FactionDecision = {
                type: "defend_territory",
                priority: 80,
                reasoning: "Under threat",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("crisis");
            expect(hooks[0].title).toContain("Under Threat");
            expect(hooks[0].urgency).toBeGreaterThanOrEqual(4);
        });

        it("returns empty array for unsupported decision types", () => {
            const decision: FactionDecision = {
                type: "rest_and_recover",
                priority: 10,
                reasoning: "Consolidating",
            };

            const hooks = generatePlotHooksFromDecision(baseFaction, decision);

            expect(hooks.length).toBe(0);
        });
    });

    describe("generatePlotHooksFromEvent", () => {
        it("generates crisis hook from crisis event", () => {
            const event: SimulationEvent = {
                title: "Food Shortage",
                description: "Faction running low on food",
                type: "crisis",
                importance: 5,
                date: "2024-01-15",
                factionName: "Test Faction",
            };

            const hook = generatePlotHooksFromEvent(event);

            expect(hook).not.toBeNull();
            expect(hook!.category).toBe("crisis");
            expect(hook!.urgency).toBe(5);
            expect(hook!.factions).toContain("Test Faction");
        });

        it("generates discovery hook from discovery event", () => {
            const event: SimulationEvent = {
                title: "Ancient Ruins Found",
                description: "Expedition discovered ruins",
                type: "discovery",
                importance: 4,
                date: "2024-01-15",
                factionName: "Test Faction",
            };

            const hook = generatePlotHooksFromEvent(event);

            expect(hook).not.toBeNull();
            expect(hook!.category).toBe("discovery");
            expect(hook!.rewards).toBeDefined();
        });

        it("generates conflict hook from conflict event", () => {
            const event: SimulationEvent = {
                title: "Border Dispute",
                description: "Factions clash at border",
                type: "conflict",
                importance: 3,
                date: "2024-01-15",
                factionName: "Test Faction",
            };

            const hook = generatePlotHooksFromEvent(event);

            expect(hook).not.toBeNull();
            expect(hook!.category).toBe("conflict");
        });

        it("returns null for resource/completion events", () => {
            const resourceEvent: SimulationEvent = {
                title: "Resources gathered",
                description: "Food collected",
                type: "resource",
                importance: 2,
                date: "2024-01-15",
                factionName: "Test Faction",
            };

            const completionEvent: SimulationEvent = {
                title: "Job completed",
                description: "Crafting finished",
                type: "completion",
                importance: 2,
                date: "2024-01-15",
                factionName: "Test Faction",
            };

            expect(generatePlotHooksFromEvent(resourceEvent)).toBeNull();
            expect(generatePlotHooksFromEvent(completionEvent)).toBeNull();
        });
    });

    describe("generatePlotHooksFromRelationships", () => {
        const faction2: FactionData = {
            name: "Other Faction",
        };

        it("generates war hook for deep hostility", () => {
            const relationship: FactionRelationship = {
                faction_name: "Other Faction",
                value: -70,
                type: "hostile",
            };

            const hooks = generatePlotHooksFromRelationships(baseFaction, faction2, relationship);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("conflict");
            expect(hooks[0].title).toContain("War");
            expect(hooks[0].urgency).toBe(5);
            expect(hooks[0].factions).toContain("Test Faction");
            expect(hooks[0].factions).toContain("Other Faction");
        });

        it("generates tension hook for mild hostility", () => {
            const relationship: FactionRelationship = {
                faction_name: "Other Faction",
                value: -30,
            };

            const hooks = generatePlotHooksFromRelationships(baseFaction, faction2, relationship);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("conflict");
            expect(hooks[0].title).toContain("Tensions");
            expect(hooks[0].urgency).toBe(3);
        });

        it("generates alliance hook for strong positive relationship", () => {
            const relationship: FactionRelationship = {
                faction_name: "Other Faction",
                value: 70,
                type: "allied",
            };

            const hooks = generatePlotHooksFromRelationships(baseFaction, faction2, relationship);

            expect(hooks.length).toBeGreaterThan(0);
            expect(hooks[0].category).toBe("alliance");
            expect(hooks[0].title).toContain("Alliance");
            expect(hooks[0].rewards).toBeDefined();
        });

        it("returns empty array for neutral relationships", () => {
            const relationship: FactionRelationship = {
                faction_name: "Other Faction",
                value: 0,
            };

            const hooks = generatePlotHooksFromRelationships(baseFaction, faction2, relationship);

            expect(hooks.length).toBe(0);
        });
    });

    describe("generateFactionPlotHooks", () => {
        it("generates economic crisis hook for low gold", () => {
            const faction: FactionData = {
                ...baseFaction,
                resources: {
                    gold: 150, // < 200
                    food: 500,
                },
            };

            const hooks = generateFactionPlotHooks(faction, []);

            const economicHook = hooks.find((h) => h.title.includes("Economic"));
            expect(economicHook).toBeDefined();
            expect(economicHook!.category).toBe("crisis");
        });

        it("generates food shortage hook for low food", () => {
            const faction: FactionData = {
                ...baseFaction,
                resources: {
                    gold: 1000,
                    food: 80, // < 100
                },
            };

            const hooks = generateFactionPlotHooks(faction, []);

            const foodHook = hooks.find((h) => h.title.includes("Food"));
            expect(foodHook).toBeDefined();
            expect(foodHook!.category).toBe("crisis");
            expect(foodHook!.urgency).toBe(4);
        });

        it("generates conquest hook from goal tags", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Conquest" }],
            };

            const hooks = generateFactionPlotHooks(faction, []);

            const conquestHook = hooks.find((h) => h.title.includes("Expansionist"));
            expect(conquestHook).toBeDefined();
            expect(conquestHook!.category).toBe("conflict");
        });

        it("generates knowledge hook from goal tags", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Knowledge" }, { value: "Research" }],
            };

            const hooks = generateFactionPlotHooks(faction, []);

            const knowledgeHook = hooks.find((h) => h.title.includes("Knowledge"));
            expect(knowledgeHook).toBeDefined();
            expect(knowledgeHook!.category).toBe("mystery");
        });

        it("includes relationship hooks", () => {
            const faction: FactionData = {
                ...baseFaction,
                faction_relationships: [
                    {
                        faction_name: "Enemy Faction",
                        value: -70,
                        type: "hostile",
                    },
                ],
            };

            const otherFaction: FactionData = {
                name: "Enemy Faction",
            };

            const hooks = generateFactionPlotHooks(faction, [otherFaction]);

            const warHook = hooks.find((h) => h.title.includes("War"));
            expect(warHook).toBeDefined();
        });

        it("returns empty array for well-resourced faction with no goals", () => {
            const faction: FactionData = {
                name: "Peaceful Faction",
                resources: {
                    gold: 5000,
                    food: 2000,
                },
                goal_tags: [],
                faction_relationships: [],
            };

            const hooks = generateFactionPlotHooks(faction, []);

            expect(hooks.length).toBe(0);
        });
    });
});
