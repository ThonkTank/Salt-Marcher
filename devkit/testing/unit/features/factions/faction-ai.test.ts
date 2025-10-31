// devkit/testing/unit/features/factions/faction-ai.test.ts
// Unit tests for Faction AI Decision Engine

import { describe, it, expect } from "vitest";
import { evaluateFactionDecision } from "../../../../../src/features/factions/faction-ai";
import type { FactionAIContext } from "../../../../../src/features/factions/ai-types";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

describe("Faction AI", () => {
    const baseFaction: FactionData = {
        name: "Test Faction",
        headquarters: "Test HQ",
        resources: {
            gold: 1000,
            food: 500,
            equipment: 200,
            magic: 50,
            influence: 30,
        },
    };

    describe("evaluateFactionDecision", () => {
        it("prioritizes resource gathering when gold is critical", () => {
            const faction: FactionData = {
                ...baseFaction,
                resources: {
                    gold: 50, // Critical: < 200 (20% of 1000 minimum)
                    food: 500,
                },
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("gather_resources");
            expect(decision.priority).toBeGreaterThanOrEqual(90);
            expect(decision.params?.resourceType).toBe("gold");
        });

        it("prioritizes resource gathering when food is critical", () => {
            const faction: FactionData = {
                ...baseFaction,
                resources: {
                    gold: 1000,
                    food: 50, // Critical: < 100 (20% of 500 minimum)
                },
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("gather_resources");
            expect(decision.priority).toBeGreaterThanOrEqual(90);
            expect(decision.params?.resourceType).toBe("food");
        });

        it("generates expansion decisions for conquest-focused factions", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Conquest" }, { value: "Expansion" }],
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            // Should prioritize expansion or recruitment
            expect(["expand_territory", "recruit_units"]).toContain(decision.type);
            expect(decision.priority).toBeGreaterThan(50);
        });

        it("generates trade decisions for trade-focused factions", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Trade" }, { value: "Prosperity" }],
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            // Should consider trade or establishing camps
            expect(["trade_resources", "establish_camp"]).toContain(decision.type);
        });

        it("generates research decisions for knowledge-focused factions", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Knowledge" }, { value: "Research" }],
                resources: { ...baseFaction.resources, magic: 50 }, // Sufficient magic
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("research_magic");
        });

        it("generates defense decisions when threats exist", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Defense" }],
            };

            const context: FactionAIContext = {
                faction,
                threats: ["Hostile Faction"],
            };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("defend_territory");
            expect(decision.priority).toBeGreaterThan(80);
        });

        it("generates diplomacy decisions for nearby factions", () => {
            const faction: FactionData = {
                ...baseFaction,
                faction_relationships: [
                    {
                        faction_name: "Neutral Faction",
                        value: 0, // Neutral
                    },
                ],
            };

            const nearbyFaction: FactionData = {
                name: "Neutral Faction",
            };

            const context: FactionAIContext = {
                faction,
                nearbyFactions: [nearbyFaction],
            };
            const decision = evaluateFactionDecision(context);

            // Should consider forming alliance or trade
            expect(["form_alliance", "trade_resources"]).toContain(decision.type);
        });

        it("generates raid decisions for hostile relationships", () => {
            const faction: FactionData = {
                ...baseFaction,
                faction_relationships: [
                    {
                        faction_name: "Enemy Faction",
                        value: -70, // Hostile
                    },
                ],
            };

            const enemyFaction: FactionData = {
                name: "Enemy Faction",
            };

            const context: FactionAIContext = {
                faction,
                nearbyFactions: [enemyFaction],
            };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("raid_target");
            expect(decision.params?.targetFaction).toBe("Enemy Faction");
        });

        it("generates trade decisions for allied relationships", () => {
            const faction: FactionData = {
                ...baseFaction,
                faction_relationships: [
                    {
                        faction_name: "Allied Faction",
                        value: 60, // Allied
                    },
                ],
            };

            const alliedFaction: FactionData = {
                name: "Allied Faction",
            };

            const context: FactionAIContext = {
                faction,
                nearbyFactions: [alliedFaction],
            };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("trade_resources");
            expect(decision.params?.targetFaction).toBe("Allied Faction");
        });

        it("falls back to rest decision when no other options", () => {
            const faction: FactionData = {
                ...baseFaction,
                goal_tags: [], // No goals
            };

            const context: FactionAIContext = { faction };
            const decision = evaluateFactionDecision(context);

            expect(decision.type).toBe("rest_and_recover");
            expect(decision.priority).toBe(10);
        });

        it("includes reasoning in all decisions", () => {
            const context: FactionAIContext = { faction: baseFaction };
            const decision = evaluateFactionDecision(context);

            expect(decision.reasoning).toBeTruthy();
            expect(typeof decision.reasoning).toBe("string");
        });

        it("includes duration in all decisions", () => {
            const context: FactionAIContext = { faction: baseFaction };
            const decision = evaluateFactionDecision(context);

            expect(decision.duration).toBeDefined();
            expect(typeof decision.duration).toBe("number");
            expect(decision.duration).toBeGreaterThan(0);
        });

        it("respects goal weight influence on priorities", () => {
            const militaryFaction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Conquest" }],
                influence_tags: [{ value: "Military" }],
            };

            const tradeFaction: FactionData = {
                ...baseFaction,
                goal_tags: [{ value: "Trade" }],
                influence_tags: [{ value: "Economic" }],
            };

            const militaryContext: FactionAIContext = { faction: militaryFaction };
            const tradeContext: FactionAIContext = { faction: tradeFaction };

            const militaryDecision = evaluateFactionDecision(militaryContext);
            const tradeDecision = evaluateFactionDecision(tradeContext);

            // Military faction should prefer expansion/recruitment
            expect(["expand_territory", "recruit_units"]).toContain(militaryDecision.type);

            // Trade faction should prefer trade/establishment
            expect(["trade_resources", "establish_camp"]).toContain(tradeDecision.type);
        });
    });
});
