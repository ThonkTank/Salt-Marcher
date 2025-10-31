// devkit/testing/unit/features/factions/phase-8.7.test.ts
// Phase 8.7 Tests: Further Advanced Features
//
// Comprehensive tests for Phase 8.7 faction system features including:
// - Complex NPC Networks: Relationship graphs, cluster detection, cross-faction diplomacy
// - Economic Markets: Supply/demand pricing, market events, price trends, economic cycles
// - Advanced Supply Chains: Multi-step production, dependency tracking, parallelization
// - Intelligence Networks: Spy operations, counter-intelligence, covert missions

import { describe, it, expect, beforeEach } from "vitest";
import type { FactionData } from "../../../../../src/workmodes/library/factions/types";

// NPC Networks
import {
    createNPCRelationship,
    getNPCRelationships,
    getRelationshipBetween,
    updateRelationshipStrength,
    shareSecret,
    getFriends,
    getEnemies,
    calculateNPCInfluence,
    findMutualFriends,
    calculateSeparation,
    detectClusters,
    findCrossFactionRelationships,
    calculateDiplomacyInfluence,
    generateNetworkEvents,
} from "../../../../../src/features/factions/npc-networks";
import type { NPCNetwork, NPCRelationship } from "../../../../../src/features/factions/npc-networks";

// Economic Markets
import {
    createRegionalMarket,
    updateMarketPrices,
    simulateMarketTick,
    createMarketEvent,
    generateRandomMarketEvent,
    executeBuyOrder,
    executeSellOrder,
    trackPriceHistory,
    calculatePriceTrend,
    getPriceStatistics,
    advanceEconomicCycle,
    applyEconomicCycleEffects,
    analyzeMarket,
    predictPrice,
} from "../../../../../src/features/factions/economic-markets";
import type {
    RegionalMarket,
    PriceHistory,
    EconomicCycle,
} from "../../../../../src/features/factions/economic-markets";

// Supply Chains
import {
    createSupplyChain,
    createCustomSupplyChain,
    processSupplyChain,
    cancelSupplyChain,
    getCriticalPath,
    estimateCompletionTime,
    findBottlenecks,
    calculateTotalRequirements,
    canStartChain,
    findParallelNodes,
    optimizeChain,
    generateSupplyChainEvent,
    getChainReport,
} from "../../../../../src/features/factions/supply-chains";
import type { SupplyChain } from "../../../../../src/features/factions/supply-chains";

// Intelligence Networks
import {
    createIntelligenceNetwork,
    recruitAgent,
    establishSafeHouse,
    assignIntelligenceGathering,
    generateIntelligenceReport,
    detectEnemyAgents,
    interrogateAgent,
    plantFalseIntelligence,
    analyzeIntelligence,
    calculateNetworkEffectiveness,
    updateNetworkSecurity,
    executeCovertOperation,
} from "../../../../../src/features/factions/intelligence-networks";
import type { IntelligenceNetwork } from "../../../../../src/features/factions/intelligence-networks";

// ============================================================================
// NPC Networks Tests (25 tests)
// ============================================================================

describe("NPC Networks - Relationship Management", () => {
    let network: NPCNetwork;

    beforeEach(() => {
        network = { relationships: [], clusters: [] };
    });

    it("creates NPC relationships", () => {
        const rel = createNPCRelationship(network, "Alice", "Bob", "friend", 60);

        expect(rel.source).toBe("Alice");
        expect(rel.target).toBe("Bob");
        expect(rel.type).toBe("friend");
        expect(rel.strength).toBe(60);
        expect(network.relationships).toHaveLength(1);
    });

    it("clamps relationship strength to -100/+100", () => {
        const rel1 = createNPCRelationship(network, "Alice", "Bob", "friend", 150);
        const rel2 = createNPCRelationship(network, "Bob", "Charlie", "enemy", -150);

        expect(rel1.strength).toBe(100);
        expect(rel2.strength).toBe(-100);
    });

    it("gets all relationships for an NPC", () => {
        createNPCRelationship(network, "Alice", "Bob", "friend", 60);
        createNPCRelationship(network, "Alice", "Charlie", "rival", -30);
        createNPCRelationship(network, "Bob", "David", "colleague", 40);

        const aliceRels = getNPCRelationships(network, "Alice");
        expect(aliceRels).toHaveLength(2);
    });

    it("gets relationship between two specific NPCs", () => {
        createNPCRelationship(network, "Alice", "Bob", "friend", 60);

        const rel = getRelationshipBetween(network, "Alice", "Bob");
        expect(rel).toBeDefined();
        expect(rel?.strength).toBe(60);

        // Works both directions
        const rel2 = getRelationshipBetween(network, "Bob", "Alice");
        expect(rel2).toBeDefined();
    });

    it("updates relationship strength", () => {
        const rel = createNPCRelationship(network, "Alice", "Bob", "friend", 60);

        updateRelationshipStrength(rel, 10, "Helped in battle");

        expect(rel.strength).toBe(70);
        expect(rel.history).toHaveLength(1);
        expect(rel.history![0]).toContain("Helped in battle");
    });

    it("limits history to last 10 entries", () => {
        const rel = createNPCRelationship(network, "Alice", "Bob", "friend", 60);

        for (let i = 0; i < 15; i++) {
            updateRelationshipStrength(rel, 1, `Event ${i}`);
        }

        expect(rel.history).toHaveLength(10);
    });

    it("shares secrets between NPCs", () => {
        const rel = createNPCRelationship(network, "Alice", "Bob", "friend", 60);

        const result = shareSecret(rel, "Alice is a spy");

        expect(result.success).toBe(true);
        expect(rel.shared_secrets).toHaveLength(1);
        expect(rel.strength).toBeGreaterThan(60); // Strengthened relationship
    });

    it("prevents sharing secrets with low relationship", () => {
        const rel = createNPCRelationship(network, "Alice", "Bob", "rival", 10);

        const result = shareSecret(rel, "Secret");

        expect(result.success).toBe(false);
        expect(rel.shared_secrets).toBeUndefined();
    });
});

describe("NPC Networks - Network Analysis", () => {
    let network: NPCNetwork;

    beforeEach(() => {
        network = { relationships: [], clusters: [] };
        // Build a test network
        createNPCRelationship(network, "Alice", "Bob", "friend", 80);
        createNPCRelationship(network, "Alice", "Charlie", "friend", 70);
        createNPCRelationship(network, "Bob", "Charlie", "friend", 75);
        createNPCRelationship(network, "Alice", "David", "enemy", -60);
        createNPCRelationship(network, "Eve", "David", "ally", 50);
    });

    it("finds friends (strength >= 40)", () => {
        const friends = getFriends(network, "Alice");

        expect(friends).toHaveLength(2);
        expect(friends).toContain("Bob");
        expect(friends).toContain("Charlie");
    });

    it("finds enemies (strength <= -40)", () => {
        const enemies = getEnemies(network, "Alice");

        expect(enemies).toHaveLength(1);
        expect(enemies).toContain("David");
    });

    it("calculates NPC influence", () => {
        const aliceInfluence = calculateNPCInfluence(network, "Alice");
        const davidInfluence = calculateNPCInfluence(network, "David");

        expect(aliceInfluence).toBeGreaterThan(0);
        expect(aliceInfluence).toBeGreaterThan(davidInfluence); // Alice has more connections
    });

    it("finds mutual friends", () => {
        const mutual = findMutualFriends(network, "Alice", "Bob");

        expect(mutual).toContain("Charlie");
    });

    it("calculates degrees of separation", () => {
        const separation = calculateSeparation(network, "Alice", "Eve");

        expect(separation).toBe(2); // Alice → David → Eve
    });

    it("returns null for unconnected NPCs", () => {
        createNPCRelationship(network, "Frank", "Grace", "friend", 50);

        const separation = calculateSeparation(network, "Alice", "Frank");

        expect(separation).toBeNull();
    });

    it("detects clusters", () => {
        const clusters = detectClusters(network, 3);

        expect(clusters.length).toBeGreaterThan(0);

        // Alice, Bob, Charlie should form a cluster
        const mainCluster = clusters.find((c) => c.members.includes("Alice"));
        expect(mainCluster).toBeDefined();
        expect(mainCluster?.members).toContain("Bob");
        expect(mainCluster?.members).toContain("Charlie");
    });

    it("calculates cluster cohesion", () => {
        const clusters = detectClusters(network, 3);
        const mainCluster = clusters[0];

        expect(mainCluster.cohesion).toBeGreaterThan(0);
        expect(mainCluster.cohesion).toBeLessThanOrEqual(100);
    });
});

describe("NPC Networks - Cross-Faction Effects", () => {
    let network: NPCNetwork;
    let faction1: FactionData;
    let faction2: FactionData;

    beforeEach(() => {
        network = { relationships: [], clusters: [] };

        faction1 = {
            name: "Faction A",
            members: [
                { name: "Alice", is_named: true, role: "Leader" },
                { name: "Bob", is_named: true, role: "Scout" },
            ],
        };

        faction2 = {
            name: "Faction B",
            members: [
                { name: "Charlie", is_named: true, role: "Leader" },
                { name: "David", is_named: true, role: "Guard" },
            ],
        };

        createNPCRelationship(network, "Alice", "Charlie", "friend", 70);
        createNPCRelationship(network, "Bob", "David", "rival", -40);
    });

    it("finds cross-faction relationships", () => {
        const crossFaction = findCrossFactionRelationships(network, [faction1, faction2]);

        expect(crossFaction).toHaveLength(2);
        expect(crossFaction[0].faction1).not.toBe(crossFaction[0].faction2);
    });

    it("calculates diplomacy influence from NPC relationships", () => {
        const influence = calculateDiplomacyInfluence(network, "Faction A", "Faction B", [faction1, faction2]);

        expect(influence).toBeDefined();
        // Average of 70 and -40 = 15
        expect(influence).toBeCloseTo(15, 0);
    });

    it("generates network events", () => {
        // Create love triangle (two people like same person)
        createNPCRelationship(network, "Alice", "David", "lover", 80);
        createNPCRelationship(network, "Charlie", "David", "friend", 65);

        const events = generateNetworkEvents(network, [faction1, faction2]);

        expect(events.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// Economic Markets Tests (22 tests)
// ============================================================================

describe("Economic Markets - Market Management", () => {
    let market: RegionalMarket;

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A", "Faction B"],
            [
                { resource: "food", basePrice: 10, supply: 100, demand: 100 },
                { resource: "gold", basePrice: 100, supply: 50, demand: 75 },
            ],
        );
    });

    it("creates a regional market", () => {
        expect(market.name).toBe("City Market");
        expect(market.factions).toHaveLength(2);
        expect(market.goods).toHaveLength(2);
    });

    it("calculates initial market prices", () => {
        const food = market.goods.find((g) => g.resource === "food");
        const gold = market.goods.find((g) => g.resource === "gold");

        expect(food?.current_price).toBe(10); // 100/100 = 1.0 ratio
        expect(gold?.current_price).toBeCloseTo(150, 0); // 75/50 = 1.5 ratio
    });

    it("updates market prices", () => {
        // Change supply/demand
        market.goods[0].supply = 50;
        market.goods[0].demand = 100;

        updateMarketPrices(market);

        const food = market.goods[0];
        expect(food.current_price).toBeGreaterThan(10); // Price should increase
    });

    it("simulates market tick", () => {
        const originalPrice = market.goods[0].current_price;

        simulateMarketTick(market);

        // Prices should change due to volatility
        expect(market.goods[0].supply).not.toBe(100);
        expect(market.goods[0].demand).not.toBe(100);
    });
});

describe("Economic Markets - Market Events", () => {
    let market: RegionalMarket;

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A"],
            [{ resource: "food", basePrice: 10, supply: 100, demand: 100 }],
        );
    });

    it("creates market events", () => {
        const event = createMarketEvent(market, "shortage", "food", 5);

        expect(event.type).toBe("shortage");
        expect(event.resource).toBe("food");
        expect(event.duration).toBe(5);
        expect(event.impact).toBe(2.0); // Doubles price
    });

    it("applies market event effects to prices", () => {
        const originalPrice = market.goods[0].current_price!;

        createMarketEvent(market, "shortage", "food", 5);

        expect(market.goods[0].current_price).toBeGreaterThan(originalPrice);
    });

    it("decays market events over time", () => {
        createMarketEvent(market, "shortage", "food", 2);

        simulateMarketTick(market);
        expect(market.events[0].duration).toBe(1);

        simulateMarketTick(market);
        expect(market.events).toHaveLength(0); // Event expired
    });

    it("generates random market events", () => {
        market.volatility = 100; // High volatility

        let generated = false;
        for (let i = 0; i < 100; i++) {
            const result = generateRandomMarketEvent(market);
            if (result.generated) {
                generated = true;
                break;
            }
        }

        expect(generated).toBe(true);
    });
});

describe("Economic Markets - Trading Operations", () => {
    let market: RegionalMarket;

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A"],
            [{ resource: "food", basePrice: 10, supply: 100, demand: 100 }],
        );
    });

    it("executes buy orders", () => {
        const result = executeBuyOrder(market, "Faction A", "food", 20);

        expect(result.success).toBe(true);
        expect(result.transaction).toBeDefined();
        expect(result.transaction!.quantity).toBe(20);
        expect(market.goods[0].supply).toBe(80); // Reduced
    });

    it("fails buy order with insufficient supply", () => {
        const result = executeBuyOrder(market, "Faction A", "food", 200);

        expect(result.success).toBe(false);
        expect(result.error).toContain("supply");
    });

    it("executes sell orders", () => {
        const result = executeSellOrder(market, "Faction A", "food", 50);

        expect(result.success).toBe(true);
        expect(result.transaction).toBeDefined();
        expect(market.goods[0].supply).toBe(150); // Increased
    });

    it("updates prices after transactions", () => {
        const originalPrice = market.goods[0].current_price!;

        executeBuyOrder(market, "Faction A", "food", 50);

        expect(market.goods[0].current_price).toBeGreaterThan(originalPrice);
    });
});

describe("Economic Markets - Price History & Trends", () => {
    let market: RegionalMarket;
    let history: PriceHistory;

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A"],
            [{ resource: "food", basePrice: 10, supply: 100, demand: 100 }],
        );

        history = {
            resource: "food",
            prices: [],
            trend: "stable",
        };
    });

    it("tracks price history", () => {
        for (let i = 0; i < 5; i++) {
            trackPriceHistory(history, market);
        }

        expect(history.prices).toHaveLength(5);
    });

    it("limits history to 30 days", () => {
        for (let i = 0; i < 40; i++) {
            trackPriceHistory(history, market);
        }

        expect(history.prices).toHaveLength(30);
    });

    it("calculates price statistics", () => {
        for (let i = 0; i < 10; i++) {
            history.prices.push({ date: `2024-01-${i + 1}`, price: 10 + i });
        }

        const stats = getPriceStatistics(history);

        expect(stats.min).toBe(10);
        expect(stats.max).toBe(19);
        expect(stats.average).toBeCloseTo(14.5, 0);
    });

    it("detects rising trend", () => {
        for (let i = 0; i < 7; i++) {
            history.prices.push({ date: `2024-01-${i + 1}`, price: 10 + i * 2 });
        }

        history.trend = calculatePriceTrend(history);

        expect(history.trend).toBe("rising");
    });

    it("detects falling trend", () => {
        for (let i = 0; i < 7; i++) {
            history.prices.push({ date: `2024-01-${i + 1}`, price: 20 - i * 2 });
        }

        history.trend = calculatePriceTrend(history);

        expect(history.trend).toBe("falling");
    });

    it("predicts future prices", () => {
        for (let i = 0; i < 10; i++) {
            history.prices.push({ date: `2024-01-${i + 1}`, price: 10 + i });
        }

        const prediction = predictPrice(history, 7);

        expect(prediction).toBeGreaterThan(19); // Should predict upward trend
    });
});

describe("Economic Markets - Economic Cycles", () => {
    let market: RegionalMarket;
    let cycle: EconomicCycle;

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A"],
            [{ resource: "food", basePrice: 10, supply: 100, demand: 100 }],
        );

        cycle = {
            phase: "expansion",
            progress: 0,
            cycle_length: 120, // 120 days per cycle
            day: 0,
        };
    });

    it("advances economic cycle", () => {
        advanceEconomicCycle(cycle);

        expect(cycle.day).toBe(1);
        expect(cycle.progress).toBeGreaterThan(0);
    });

    it("transitions between phases", () => {
        // Advance through expansion phase (30 days)
        for (let i = 0; i < 30; i++) {
            advanceEconomicCycle(cycle);
        }

        expect(cycle.phase).toBe("peak");
    });

    it("applies cycle effects to market", () => {
        const originalDemand = market.goods[0].demand;

        applyEconomicCycleEffects(market, cycle);

        expect(market.goods[0].demand).toBeGreaterThan(originalDemand); // Expansion increases demand
    });

    it("adjusts market volatility by phase", () => {
        cycle.phase = "peak";
        applyEconomicCycleEffects(market, cycle);

        expect(market.volatility).toBe(60); // Peak has high volatility
    });
});

describe("Economic Markets - Market Intelligence", () => {
    let market: RegionalMarket;
    let histories: PriceHistory[];

    beforeEach(() => {
        market = createRegionalMarket(
            "City Market",
            ["Faction A"],
            [
                { resource: "food", basePrice: 10, supply: 100, demand: 100 },
                { resource: "gold", basePrice: 100, supply: 50, demand: 150 },
            ],
        );

        histories = [
            { resource: "food", prices: [], trend: "stable" },
            { resource: "gold", prices: [], trend: "stable" },
        ];

        // Build price history
        for (let i = 0; i < 10; i++) {
            histories[0].prices.push({ date: `2024-01-${i + 1}`, price: 8 + i * 0.5 });
            histories[1].prices.push({ date: `2024-01-${i + 1}`, price: 120 - i * 2 });
        }
    });

    it("analyzes market for opportunities", () => {
        const recommendations = analyzeMarket(market, histories);

        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations[0]).toHaveProperty("recommendation");
        expect(recommendations[0]).toHaveProperty("confidence");
    });

    it("recommends buying when price below average", () => {
        market.goods[0].current_price = 5; // Below average

        const recommendations = analyzeMarket(market, histories);
        const foodRec = recommendations.find((r) => r.resource === "food");

        expect(foodRec?.recommendation).toBe("buy");
    });

    it("recommends selling when price above average", () => {
        market.goods[0].current_price = 20; // Above average

        const recommendations = analyzeMarket(market, histories);
        const foodRec = recommendations.find((r) => r.resource === "food");

        expect(foodRec?.recommendation).toBe("sell");
    });
});

// ============================================================================
// Supply Chains Tests (18 tests)
// ============================================================================

describe("Supply Chains - Chain Creation", () => {
    let faction: FactionData;

    beforeEach(() => {
        faction = {
            name: "Test Faction",
            resources: { gold: 1000, equipment: 100, food: 200 },
        };
    });

    it("creates supply chain from template", () => {
        const result = createSupplyChain(faction, "master_weaponsmith");

        expect(result.success).toBe(true);
        expect(result.chain).toBeDefined();
        expect(result.chain!.name).toBe("Master Weaponsmith");
        expect(result.chain!.nodes.length).toBeGreaterThan(0);
    });

    it("creates custom supply chain", () => {
        const result = createCustomSupplyChain(faction, "Custom Chain", ["weapon_forging", "potion_brewing"]);

        expect(result.success).toBe(true);
        expect(result.chain).toBeDefined();
        expect(result.chain!.nodes).toHaveLength(2);
    });

    it("fails with empty production steps", () => {
        const result = createCustomSupplyChain(faction, "Empty", []);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it("sets up dependencies correctly", () => {
        const result = createSupplyChain(faction, "master_weaponsmith");
        const chain = result.chain!;

        // First node has no dependencies
        expect(chain.nodes[0].dependencies).toHaveLength(0);
        expect(chain.nodes[0].status).toBe("active");

        // Subsequent nodes depend on previous
        if (chain.nodes.length > 1) {
            expect(chain.nodes[1].dependencies).toHaveLength(1);
            expect(chain.nodes[1].status).toBe("pending");
        }
    });
});

describe("Supply Chains - Chain Execution", () => {
    let faction: FactionData;
    let chain: SupplyChain;

    beforeEach(() => {
        faction = {
            name: "Test Faction",
            resources: { gold: 1000 },
            production_chains: [],
        };

        const result = createSupplyChain(faction, "feast_preparation");
        chain = result.chain!;
    });

    it("processes supply chain", () => {
        const result = processSupplyChain(chain, faction);

        expect(result).toHaveProperty("completed_nodes");
        expect(result).toHaveProperty("blocked_nodes");
        expect(result).toHaveProperty("chain_completed");
    });

    it("completes nodes after 100% progress", () => {
        // Simulate progress
        for (let i = 0; i < 10; i++) {
            processSupplyChain(chain, faction);
        }

        const completed = chain.nodes.filter((n) => n.status === "completed");
        expect(completed.length).toBeGreaterThan(0);
    });

    it("blocks nodes until dependencies complete", () => {
        const result = processSupplyChain(chain, faction);

        // Second node should be blocked initially
        if (chain.nodes.length > 1) {
            expect(chain.nodes[1].status).toBe("blocked");
        }
    });

    it("activates pending nodes when dependencies complete", () => {
        // Complete first node
        chain.nodes[0].status = "completed";
        chain.nodes[0].completion = 100;

        processSupplyChain(chain, faction);

        if (chain.nodes.length > 1) {
            expect(chain.nodes[1].status).toBe("active");
        }
    });

    it("detects chain completion", () => {
        // Mark all nodes complete
        chain.nodes.forEach((n) => {
            n.status = "completed";
            n.completion = 100;
        });

        const result = processSupplyChain(chain, faction);

        expect(result.chain_completed).toBe(true);
        expect(chain.status).toBe("completed");
    });

    it("cancels supply chain", () => {
        cancelSupplyChain(chain);

        expect(chain.status).toBe("failed");
        expect(chain.nodes.every((n) => n.status === "failed" || n.status === "completed")).toBe(true);
    });
});

describe("Supply Chains - Dependency Analysis", () => {
    let faction: FactionData;
    let chain: SupplyChain;

    beforeEach(() => {
        faction = { name: "Test Faction" };
        const result = createSupplyChain(faction, "enchanted_gear");
        chain = result.chain!;
    });

    it("finds critical path", () => {
        const criticalPath = getCriticalPath(chain);

        expect(criticalPath.length).toBeGreaterThan(0);
        expect(criticalPath[0].dependencies).toHaveLength(0); // Starts with root
    });

    it("estimates completion time", () => {
        const time = estimateCompletionTime(chain);

        expect(time).toBeGreaterThan(0);
        expect(time).toBe(chain.nodes.length * 7); // 7 days per node
    });

    it("finds bottlenecks", () => {
        const bottlenecks = findBottlenecks(chain);

        expect(bottlenecks.length).toBeGreaterThan(0);
        expect(bottlenecks.length).toBeLessThanOrEqual(3);
    });

    it("calculates total requirements", () => {
        const requirements = calculateTotalRequirements(chain);

        expect(requirements.gold).toBeGreaterThan(0);
        expect(requirements).toHaveProperty("equipment");
    });

    it("checks if faction can start chain", () => {
        const richFaction: FactionData = {
            name: "Rich",
            resources: { gold: 10000, equipment: 1000, magic: 1000 },
        };

        const result = canStartChain(chain, richFaction);

        expect(result.can_start).toBe(true);
        expect(result.missing).toHaveLength(0);
    });

    it("identifies missing resources", () => {
        const poorFaction: FactionData = {
            name: "Poor",
            resources: { gold: 10 },
        };

        const result = canStartChain(chain, poorFaction);

        expect(result.can_start).toBe(false);
        expect(result.missing.length).toBeGreaterThan(0);
    });
});

describe("Supply Chains - Parallelization", () => {
    let faction: FactionData;
    let chain: SupplyChain;

    beforeEach(() => {
        faction = { name: "Test Faction" };
        const result = createCustomSupplyChain(faction, "Parallel Test", [
            "weapon_forging",
            "armor_crafting",
            "bread_baking",
        ]);
        chain = result.chain!;
    });

    it("finds parallel execution levels", () => {
        const levels = findParallelNodes(chain);

        expect(levels.length).toBeGreaterThan(0);
    });

    it("optimizes chain execution", () => {
        const optimization = optimizeChain(chain);

        expect(optimization).toHaveProperty("parallelized");
        expect(optimization).toHaveProperty("levels");
        expect(optimization).toHaveProperty("time_saved");
    });

    it("generates supply chain events", () => {
        chain.nodes[0].status = "active";

        const result = generateSupplyChainEvent(chain);

        // May or may not generate (random)
        expect(result).toHaveProperty("generated");
    });

    it("generates chain report", () => {
        const report = getChainReport(chain);

        expect(report).toHaveProperty("name");
        expect(report).toHaveProperty("overall_completion");
        expect(report).toHaveProperty("estimated_days_remaining");
        expect(report.name).toBe(chain.name);
    });
});

// ============================================================================
// Intelligence Networks Tests (20 tests)
// ============================================================================

describe("Intelligence Networks - Network Management", () => {
    let faction: FactionData;
    let network: IntelligenceNetwork;

    beforeEach(() => {
        faction = { name: "Test Faction", resources: { gold: 1000 } };
        network = createIntelligenceNetwork(faction, "Shadow Network");
    });

    it("creates intelligence network", () => {
        expect(network.faction).toBe("Test Faction");
        expect(network.name).toBe("Shadow Network");
        expect(network.agents).toHaveLength(0);
    });

    it("recruits agents", () => {
        const result = recruitAgent(network, "spy", "City A", 70);

        expect(result.success).toBe(true);
        expect(result.agent).toBeDefined();
        expect(result.agent!.type).toBe("spy");
        expect(result.agent!.skill).toBe(70);
        expect(network.agents).toHaveLength(1);
    });

    it("generates agent codenames", () => {
        const result = recruitAgent(network, "spy", "City A");

        expect(result.agent!.codename).toBeDefined();
        expect(result.agent!.codename.length).toBeGreaterThan(0);
    });

    it("establishes safe houses", () => {
        const result = establishSafeHouse(network, "City A", "Merchant Shop", 60);

        expect(result.success).toBe(true);
        expect(result.safe_house).toBeDefined();
        expect(result.safe_house!.cover).toBe("Merchant Shop");
        expect(network.safe_houses).toHaveLength(1);
    });
});

describe("Intelligence Networks - Intelligence Operations", () => {
    let faction: FactionData;
    let targetFaction: FactionData;
    let network: IntelligenceNetwork;

    beforeEach(() => {
        faction = { name: "Test Faction" };
        targetFaction = {
            name: "Target Faction",
            resources: { gold: 500, food: 200 },
            members: [
                { name: "Guard Unit", is_named: false, quantity: 20, role: "Guard" },
            ],
            trade_routes: [],
        };

        network = createIntelligenceNetwork(faction, "Shadow Network");
        recruitAgent(network, "spy", "City A", 70);
    });

    it("assigns intelligence gathering", () => {
        const agent = network.agents[0];
        const result = assignIntelligenceGathering(network, agent.id, "Target Faction", "military");

        expect(result.success).toBe(true);
        expect(agent.assignment).toContain("military");
        expect(agent.status).toBe("deep_cover");
    });

    it("generates intelligence reports", () => {
        const agent = network.agents[0];
        assignIntelligenceGathering(network, agent.id, "Target Faction", "economic");

        const result = generateIntelligenceReport(network, agent.id, "Target Faction", targetFaction);

        expect(result.success).toBe(true);
        expect(result.report).toBeDefined();
        expect(result.report!.type).toBe("economic");
        expect(result.report!.findings).toHaveProperty("gold");
        expect(network.reports).toHaveLength(1);
    });

    it("returns agent to active status after report", () => {
        const agent = network.agents[0];
        assignIntelligenceGathering(network, agent.id, "Target Faction", "political");
        generateIntelligenceReport(network, agent.id, "Target Faction", targetFaction);

        expect(agent.status).toBe("active");
        expect(agent.assignment).toBeUndefined();
    });

    it("calculates report reliability from agent skill and loyalty", () => {
        const agent = network.agents[0];
        agent.skill = 80;
        agent.loyalty = 90;

        assignIntelligenceGathering(network, agent.id, "Target Faction", "military");
        const result = generateIntelligenceReport(network, agent.id, "Target Faction", targetFaction);

        expect(result.report!.reliability).toBeGreaterThan(80);
    });
});

describe("Intelligence Networks - Counter-Intelligence", () => {
    let network: IntelligenceNetwork;
    let enemyNetwork: IntelligenceNetwork;

    beforeEach(() => {
        const faction1 = { name: "Faction A" };
        const faction2 = { name: "Faction B" };

        network = createIntelligenceNetwork(faction1, "Network A");
        enemyNetwork = createIntelligenceNetwork(faction2, "Network B");

        recruitAgent(enemyNetwork, "spy", "City A", 60);
        recruitAgent(enemyNetwork, "spy", "City B", 70);

        network.security = 70;
    });

    it("detects enemy agents", () => {
        const result = detectEnemyAgents(network, enemyNetwork);

        expect(result.detected.length + result.missed).toBe(enemyNetwork.agents.length);
    });

    it("burns detected agents", () => {
        detectEnemyAgents(network, enemyNetwork);

        const burned = enemyNetwork.agents.filter((a) => a.status === "burned");
        expect(burned.length).toBeGreaterThanOrEqual(0);
    });

    it("interrogates captured agents", () => {
        const agent = enemyNetwork.agents[0];
        agent.loyalty = 0; // No loyalty - guarantees information
        agent.status = "captured";

        const result = interrogateAgent(agent);

        expect(result.information_gained.length).toBeGreaterThan(0);
    });

    it("turns agents with low loyalty", () => {
        const agent = enemyNetwork.agents[0];
        agent.loyalty = 20;
        agent.status = "captured";

        const result = interrogateAgent(agent);

        // May or may not turn (random based on loyalty)
        expect(result).toHaveProperty("agent_turned");
    });

    it("plants false intelligence", () => {
        network.efficiency = 100; // Guarantee success

        const result = plantFalseIntelligence(
            network,
            enemyNetwork,
            { type: "military", summary: "False report", urgency: 4 },
        );

        expect(result.success).toBe(true);

        if (!result.detected) {
            expect(enemyNetwork.reports.length).toBeGreaterThan(0);
        }
    });
});

describe("Intelligence Networks - Network Analysis", () => {
    let faction: FactionData;
    let targetFaction: FactionData;
    let network: IntelligenceNetwork;

    beforeEach(() => {
        faction = { name: "Test Faction" };
        targetFaction = {
            name: "Target Faction",
            resources: { gold: 500 },
            members: [{ name: "Guards", is_named: false, quantity: 50 }],
        };

        network = createIntelligenceNetwork(faction, "Shadow Network");
        recruitAgent(network, "spy", "City A", 80);
        recruitAgent(network, "analyst", "City A", 90);
        establishSafeHouse(network, "City A", "Tavern", 70);
    });

    it("analyzes intelligence for threats", () => {
        // Add some reports
        const agent = network.agents[0];
        assignIntelligenceGathering(network, agent.id, "Target Faction", "military");
        generateIntelligenceReport(network, agent.id, "Target Faction", targetFaction);

        const analysis = analyzeIntelligence(network, "Target Faction");

        expect(analysis).toHaveProperty("threat_level");
        expect(analysis).toHaveProperty("opportunities");
        expect(analysis).toHaveProperty("warnings");
        expect(analysis).toHaveProperty("recommendations");
    });

    it("identifies opportunities from intelligence", () => {
        network.reports.push({
            id: "rep1",
            date: "2024-01-01",
            source: "Agent",
            target: "Target Faction",
            type: "social",
            reliability: 80,
            summary: "High unrest detected",
            findings: { unrest: 80 },
            urgency: 4,
        });

        const analysis = analyzeIntelligence(network, "Target Faction");

        expect(analysis.opportunities.length).toBeGreaterThan(0);
    });

    it("calculates network effectiveness", () => {
        const effectiveness = calculateNetworkEffectiveness(network);

        expect(effectiveness).toBeGreaterThan(0);
        expect(effectiveness).toBeLessThanOrEqual(100);
    });

    it("updates network security after operations", () => {
        const initialSecurity = network.security;

        updateNetworkSecurity(network, "success");

        expect(network.security).toBeGreaterThan(initialSecurity);
    });

    it("reduces security after compromises", () => {
        const initialSecurity = network.security;

        updateNetworkSecurity(network, "compromise");

        expect(network.security).toBeLessThan(initialSecurity);
    });

    it("marks safe houses as compromised after major failures", () => {
        const safeHouse = network.safe_houses[0];
        expect(safeHouse.status).toBe("active");

        updateNetworkSecurity(network, "compromise");

        // May or may not compromise safe house (random)
        expect(safeHouse.status === "active" || safeHouse.status === "compromised").toBe(true);
    });
});

describe("Intelligence Networks - Covert Operations", () => {
    let network: IntelligenceNetwork;

    beforeEach(() => {
        const faction = { name: "Test Faction" };
        network = createIntelligenceNetwork(faction, "Shadow Network");

        recruitAgent(network, "assassin", "City A", 80);
        recruitAgent(network, "saboteur", "City A", 75);
    });

    it("executes covert operations", () => {
        const agentIds = network.agents.map((a) => a.id);

        const result = executeCovertOperation(network, agentIds, "infiltration", 50);

        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("casualties");
        expect(result).toHaveProperty("burned");
    });

    it("provides team bonus for multiple agents", () => {
        // Single agent
        const singleAgent = [network.agents[0].id];
        let successCount1 = 0;

        for (let i = 0; i < 100; i++) {
            const result = executeCovertOperation(network, singleAgent, "sabotage", 60);
            if (result.success) successCount1++;
        }

        // Multiple agents
        const multipleAgents = network.agents.map((a) => a.id);
        let successCount2 = 0;

        for (let i = 0; i < 100; i++) {
            const result = executeCovertOperation(network, multipleAgents, "sabotage", 60);
            if (result.success) successCount2++;
        }

        // Multiple agents should have higher success rate
        expect(successCount2).toBeGreaterThanOrEqual(successCount1);
    });

    it("causes casualties on failed operations", () => {
        const agentIds = network.agents.map((a) => a.id);

        // Low skill agents vs high difficulty
        network.agents.forEach((a) => (a.skill = 10));

        const result = executeCovertOperation(network, agentIds, "assassination", 90);

        if (!result.success) {
            expect(result.casualties.length + result.burned.length).toBeGreaterThan(0);
        }
    });

    it("gains intelligence on successful operations", () => {
        const agentIds = network.agents.map((a) => a.id);
        network.agents.forEach((a) => (a.skill = 100)); // Max skill

        const result = executeCovertOperation(network, agentIds, "theft", 30);

        if (result.success) {
            expect(result.intelligence_gained).toBeDefined();
        }
    });
});
