// devkit/testing/unit/features/factions/phase-8.6.test.ts
// Unit tests for Phase 8.6: Advanced Faction Features (NPC personalities, economics, military, diplomacy)

import { describe, expect, it } from "vitest";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

// NPC Personalities
import {
    generateNPCPersonality,
    updateNPCLoyalty,
    isLikelyToBetray,
} from "../../../../../src/features/factions/npc-generator";

// Advanced Economics
import {
    startProductionChain,
    processProductionChains,
    calculateDailyConsumption,
    applyDailyConsumption,
    getTradeGoodsByCategory,
    generateTradeInventory,
} from "../../../../../src/features/factions/advanced-economics";

// Advanced Military
import {
    gainVeterancy,
    calculateVeterancyBonus,
    getVeterancyLevel,
    degradeEquipment,
    repairEquipment,
    establishSupplyLine,
    processSupplyLines,
    calculateMilitaryEffectiveness,
} from "../../../../../src/features/factions/advanced-military";

// Advanced Diplomacy
import {
    createSecretTreaty,
    isSecretTreaty,
    launchEspionageOperation,
    resolveEspionageOperation,
    createDiplomaticIncident,
    resolveDiplomaticIncident,
} from "../../../../../src/features/factions/advanced-diplomacy";

const testFaction: FactionData = {
    name: "Test Faction",
    motto: "Test Motto",
    goal_tags: [{ value: "Conquest" }],
    culture_tags: [{ value: "Human" }],
    resources: { gold: 1000, food: 500, equipment: 200, magic: 50, influence: 30 },
    members: [
        {
            name: "Test Unit",
            is_named: false,
            quantity: 10,
            statblock_ref: "Soldier",
            role: "Warrior",
            status: "Active",
        },
    ],
};

describe("Phase 8.6: NPC Personalities", () => {
    it("generates complete personality", () => {
        const personality = generateNPCPersonality(testFaction, "Leader");
        expect(personality.quirks).toBeDefined();
        expect(personality.loyalties).toBeDefined();
        expect(personality.trust).toBeGreaterThanOrEqual(0);
        expect(personality.ambition).toBeGreaterThanOrEqual(0);
    });

    it("updates loyalty correctly", () => {
        const personality = { trust: 50, ambition: 50 };
        const updated = updateNPCLoyalty(personality, 20);
        expect(updated.trust).toBe(70);
    });

    it("detects betrayal risk", () => {
        const loyal = { trust: 80, ambition: 30 };
        const disloyal = { trust: 15, ambition: 85 };

        // Run multiple times due to randomness
        const loyalResults = Array.from({ length: 5 }, () => isLikelyToBetray(loyal));
        const disloyalResults = Array.from({ length: 5 }, () => isLikelyToBetray(disloyal));

        expect(loyalResults.filter(b => b).length).toBeLessThan(3);
        expect(disloyalResults.filter(b => b).length).toBeGreaterThan(2);
    });
});

describe("Phase 8.6: Advanced Economics", () => {
    describe("Production Chains", () => {
        it("starts production chain with valid resources", () => {
            const faction = { ...testFaction };
            const result = startProductionChain(faction, "weapon_forging");

            expect(result.success).toBe(true);
            expect(result.chain).toBeDefined();
            expect(faction.production_chains).toHaveLength(1);
        });

        it("fails with insufficient resources", () => {
            const faction = { ...testFaction, resources: { gold: 10 } };
            const result = startProductionChain(faction, "weapon_forging");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("processes production chains over time", () => {
            const faction = { ...testFaction };
            startProductionChain(faction, "bread_baking");

            const initialEquipment = faction.resources?.equipment || 0;
            processProductionChains(faction, 3); // 3 days (duration is 2)

            expect(faction.production_chains).toHaveLength(0); // Completed
            expect(faction.resources?.food).toBeGreaterThan(500); // Gained outputs
        });
    });

    describe("Resource Consumption", () => {
        it("calculates daily consumption from members", () => {
            const consumption = calculateDailyConsumption(testFaction);

            expect(consumption.length).toBeGreaterThan(0);
            expect(consumption.some(c => c.resource === "food")).toBe(true);
        });

        it("applies daily consumption", () => {
            const faction = { ...testFaction };
            const initialFood = faction.resources?.food || 0;

            applyDailyConsumption(faction, 1);

            expect(faction.resources?.food).toBeLessThan(initialFood);
        });
    });

    describe("Trade Goods", () => {
        it("finds goods by category", () => {
            const food = getTradeGoodsByCategory("food");
            expect(food.length).toBeGreaterThan(0);
            expect(food.every(g => g.category === "food")).toBe(true);
        });

        it("generates trade inventory", () => {
            const inventory = generateTradeInventory(500, "uncommon");
            expect(inventory.length).toBeGreaterThan(0);
            const totalValue = inventory.reduce((sum, g) => sum + g.base_value, 0);
            expect(totalValue).toBeLessThanOrEqual(500);
        });
    });
});

describe("Phase 8.6: Advanced Military", () => {
    describe("Veterancy System", () => {
        it("gains veterancy from experience", () => {
            const member = { name: "Test", is_named: false, veterancy: 0 };
            gainVeterancy(member, 20);
            expect(member.veterancy).toBe(20);
        });

        it("calculates veterancy bonus", () => {
            const bonus0 = calculateVeterancyBonus(0);
            const bonus50 = calculateVeterancyBonus(50);
            const bonus100 = calculateVeterancyBonus(100);

            expect(bonus0).toBe(1);
            expect(bonus50).toBeGreaterThan(1);
            expect(bonus100).toBe(1.5); // 50% bonus at max
        });

        it("describes veterancy levels", () => {
            expect(getVeterancyLevel(10)).toBe("Green");
            expect(getVeterancyLevel(30)).toBe("Trained");
            expect(getVeterancyLevel(50)).toBe("Experienced");
            expect(getVeterancyLevel(70)).toBe("Veteran");
            expect(getVeterancyLevel(90)).toBe("Elite");
        });
    });

    describe("Equipment Degradation", () => {
        it("degrades equipment", () => {
            const member = { name: "Test", is_named: false, equipment_condition: 100 };
            degradeEquipment(member, 30);
            expect(member.equipment_condition).toBe(70);
        });

        it("repairs equipment with cost", () => {
            const faction = { ...testFaction };
            const member = { name: "Test", is_named: false, equipment_condition: 50 };
            faction.members = [member];

            const result = repairEquipment(faction, member, 30);

            expect(result.success).toBe(true);
            expect(member.equipment_condition).toBe(80);
            expect(faction.resources?.equipment).toBeLessThan(200); // Cost deducted
        });
    });

    describe("Supply Lines", () => {
        it("establishes supply line", () => {
            const faction = { ...testFaction };
            const line = establishSupplyLine(faction, "Camp A", "Camp B", "food", 50);

            expect(faction.supply_lines).toHaveLength(1);
            expect(line.status).toBe("active");
        });

        it("processes supply lines with raid risk", () => {
            const faction = { ...testFaction };
            establishSupplyLine(faction, "Camp A", "Camp B", "food", 50, 90); // High security

            const result = processSupplyLines(faction);

            expect(result.delivered + result.disrupted).toBeGreaterThan(0);
        });
    });

    describe("Combined Effectiveness", () => {
        it("calculates military effectiveness", () => {
            const member = {
                name: "Test",
                is_named: false,
                veterancy: 50,
                equipment_condition: 80,
            };

            const effectiveness = calculateMilitaryEffectiveness(member);
            expect(effectiveness).toBeGreaterThan(1); // Bonuses from veterancy
        });
    });
});

describe("Phase 8.6: Advanced Diplomacy", () => {
    describe("Secret Treaties", () => {
        it("creates secret treaty", () => {
            const faction = { ...testFaction };
            const treaty = createSecretTreaty(faction, ["Faction B"], "alliance", "Secret pact");

            expect(treaty.is_secret).toBe(true);
            expect(isSecretTreaty(treaty)).toBe(true);
            expect(faction.treaties).toHaveLength(1);
        });
    });

    describe("Espionage Operations", () => {
        it("launches espionage operation", () => {
            const faction = { ...testFaction };
            const result = launchEspionageOperation(faction, "Enemy Faction", "infiltrate");

            expect(result.success).toBe(true);
            expect(result.operation).toBeDefined();
            expect(faction.espionage_operations).toHaveLength(1);
            expect(faction.resources?.gold).toBeLessThan(1000); // Cost deducted
        });

        it("fails with insufficient resources", () => {
            const faction = { ...testFaction, resources: { gold: 10 } };
            const result = launchEspionageOperation(faction, "Enemy Faction", "assassinate");

            expect(result.success).toBe(false);
        });

        it("resolves espionage operation", () => {
            const faction = { ...testFaction };
            const { operation } = launchEspionageOperation(faction, "Enemy Faction", "steal_secrets");

            const result = resolveEspionageOperation(faction, operation!.id);

            expect(["success", "failure", "discovered"]).toContain(result.outcome);
            expect(operation!.status).not.toBe("active");
        });
    });

    describe("Diplomatic Incidents", () => {
        it("creates diplomatic incident", () => {
            const faction = { ...testFaction };
            const incident = createDiplomaticIncident(
                faction,
                "border_dispute",
                ["Enemy Faction"],
                -20,
                "Territorial dispute"
            );

            expect(faction.diplomatic_incidents).toHaveLength(1);
            expect(incident.status).toBe("unresolved");
        });

        it("resolves incident through negotiation", () => {
            const faction = { ...testFaction };
            const incident = createDiplomaticIncident(
                faction,
                "trade_disagreement",
                ["Trade Partner"],
                -30,
                "Tariff dispute"
            );

            const result = resolveDiplomaticIncident(faction, incident.id, "negotiated");

            expect(result.success).toBe(true);
            expect(incident.status).toBe("resolved");
            expect(Math.abs(incident.relationship_impact)).toBeLessThan(30); // Reduced
        });

        it("escalates incident", () => {
            const faction = { ...testFaction };
            const incident = createDiplomaticIncident(
                faction,
                "insult",
                ["Rival Faction"],
                -10,
                "Diplomatic insult"
            );

            const result = resolveDiplomaticIncident(faction, incident.id, "escalated");

            expect(result.success).toBe(true);
            expect(incident.status).toBe("escalated");
            expect(Math.abs(incident.relationship_impact)).toBeGreaterThan(10); // Doubled
        });
    });
});
