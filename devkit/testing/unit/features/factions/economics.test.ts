// devkit/testing/unit/features/factions/economics.test.ts
// Unit tests for Economic Simulation

import { describe, it, expect } from "vitest";
import {
    calculateMarketPrice,
    updateMarketPrices,
    processTradeRoute,
    establishTradeRoute,
    suspendTradeRoute,
    severTradeRoute,
    resumeTradeRoute,
    getTotalTradeIncome,
    updateMarket,
    buyFromMarket,
    sellToMarket,
    simulateMarketFluctuation,
} from "../../../../../src/features/factions/economics";
import type { FactionData, MarketData, TradeRoute } from "../../../../../src/workmodes/library/factions/types";

describe("Economic Simulation", () => {
    describe("calculateMarketPrice", () => {
        it("increases price when demand exceeds supply", () => {
            const market: MarketData = {
                resource: "Iron",
                base_price: 100,
                supply: 50,
                demand: 100,
            };

            const price = calculateMarketPrice(market);
            expect(price).toBe(200); // base_price * (demand/supply) = 100 * 2
        });

        it("decreases price when supply exceeds demand", () => {
            const market: MarketData = {
                resource: "Grain",
                base_price: 50,
                supply: 200,
                demand: 100,
            };

            const price = calculateMarketPrice(market);
            expect(price).toBe(25); // base_price * (demand/supply) = 50 * 0.5
        });

        it("handles zero supply with scarcity premium", () => {
            const market: MarketData = {
                resource: "Diamond",
                base_price: 1000,
                supply: 0,
                demand: 10,
            };

            const price = calculateMarketPrice(market);
            expect(price).toBe(10000); // base_price * 10
        });

        it("handles zero demand with fire sale", () => {
            const market: MarketData = {
                resource: "Spoiled Food",
                base_price: 20,
                supply: 100,
                demand: 0,
            };

            const price = calculateMarketPrice(market);
            expect(price).toBe(2); // base_price * 0.1
        });
    });

    describe("updateMarketPrices", () => {
        it("updates all market prices", () => {
            const faction: FactionData = {
                name: "Test",
                markets: [
                    { resource: "Iron", base_price: 100, supply: 50, demand: 100 },
                    { resource: "Wood", base_price: 20, supply: 200, demand: 100 },
                ],
            };

            updateMarketPrices(faction);

            expect(faction.markets![0].current_price).toBe(200);
            expect(faction.markets![1].current_price).toBe(10);
        });
    });

    describe("processTradeRoute", () => {
        it("generates profit for both factions", () => {
            const faction1: FactionData = {
                name: "Trader 1",
                resources: { gold: 1000 },
            };

            const faction2: FactionData = {
                name: "Trader 2",
                resources: { gold: 1000 },
            };

            const route: TradeRoute = {
                partner_faction: "Trader 2",
                goods: ["Spices", "Silk"],
                value: 500,
                status: "active",
            };

            const result = processTradeRoute(faction1, faction2, route);

            expect(result.success).toBe(true);
            expect(result.profit).toBe(50); // 10% of 500
            expect(faction1.resources.gold).toBe(1050);
            expect(faction2.resources.gold).toBe(1050);
        });

        it("fails if trade route not active", () => {
            const faction1: FactionData = {
                name: "Trader 1",
                resources: { gold: 1000 },
            };

            const faction2: FactionData = {
                name: "Trader 2",
                resources: { gold: 1000 },
            };

            const route: TradeRoute = {
                partner_faction: "Trader 2",
                goods: ["Spices"],
                value: 500,
                status: "suspended",
            };

            const result = processTradeRoute(faction1, faction2, route);

            expect(result.success).toBe(false);
            expect(result.error).toContain("not active");
        });
    });

    describe("establishTradeRoute", () => {
        it("creates new trade route", () => {
            const faction: FactionData = {
                name: "Merchant",
                trade_routes: [],
            };

            const route = establishTradeRoute(faction, "Partner", ["Silk", "Spices"], 300);

            expect(faction.trade_routes).toHaveLength(1);
            expect(route.partner_faction).toBe("Partner");
            expect(route.goods).toEqual(["Silk", "Spices"]);
            expect(route.value).toBe(300);
            expect(route.status).toBe("active");
        });
    });

    describe("trade route status changes", () => {
        const faction: FactionData = {
            name: "Test",
            trade_routes: [
                { partner_faction: "Partner", goods: ["Goods"], value: 100, status: "active" },
            ],
        };

        it("suspends trade route", () => {
            const result = suspendTradeRoute(faction, "Partner");
            expect(result).toBe(true);
            expect(faction.trade_routes![0].status).toBe("suspended");
        });

        it("severs trade route", () => {
            const result = severTradeRoute(faction, "Partner");
            expect(result).toBe(true);
            expect(faction.trade_routes![0].status).toBe("severed");
        });

        it("resumes trade route", () => {
            faction.trade_routes![0].status = "suspended";
            const result = resumeTradeRoute(faction, "Partner");
            expect(result).toBe(true);
            expect(faction.trade_routes![0].status).toBe("active");
        });

        it("cannot resume severed route", () => {
            faction.trade_routes![0].status = "severed";
            const result = resumeTradeRoute(faction, "Partner");
            expect(result).toBe(false);
        });
    });

    describe("getTotalTradeIncome", () => {
        it("sums income from all active routes", () => {
            const faction: FactionData = {
                name: "Merchant Guild",
                trade_routes: [
                    { partner_faction: "A", goods: [], value: 500, status: "active" },
                    { partner_faction: "B", goods: [], value: 300, status: "active" },
                    { partner_faction: "C", goods: [], value: 200, status: "suspended" },
                ],
            };

            const income = getTotalTradeIncome(faction);
            expect(income).toBe(80); // (500 + 300) * 0.1
        });
    });

    describe("updateMarket", () => {
        it("creates new market if it doesn't exist", () => {
            const faction: FactionData = {
                name: "Test",
                markets: [],
            };

            updateMarket(faction, "Iron", 100, 50, 100);

            expect(faction.markets).toHaveLength(1);
            expect(faction.markets![0].resource).toBe("Iron");
            expect(faction.markets![0].current_price).toBe(200);
        });

        it("updates existing market", () => {
            const faction: FactionData = {
                name: "Test",
                markets: [
                    { resource: "Iron", base_price: 100, supply: 50, demand: 100 },
                ],
            };

            updateMarket(faction, "Iron", 100, 200, 100);

            expect(faction.markets).toHaveLength(1);
            expect(faction.markets![0].supply).toBe(200);
            expect(faction.markets![0].current_price).toBe(50); // Price drops
        });
    });

    describe("buyFromMarket", () => {
        it("successfully buys from market", () => {
            const faction: FactionData = {
                name: "Buyer",
                resources: { gold: 1000, food: 0 },
                markets: [
                    { resource: "food", base_price: 10, supply: 100, demand: 50, current_price: 5 },
                ],
            };

            const result = buyFromMarket(faction, "food", 20);

            expect(result.success).toBe(true);
            expect(result.cost).toBe(100); // 20 * 5
            expect(faction.resources.gold).toBe(900);
            expect(faction.resources.food).toBe(20);
            expect(faction.markets![0].supply).toBe(80);
        });

        it("fails if insufficient supply", () => {
            const faction: FactionData = {
                name: "Buyer",
                resources: { gold: 1000 },
                markets: [
                    { resource: "food", base_price: 10, supply: 10, demand: 50 },
                ],
            };

            const result = buyFromMarket(faction, "food", 20);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Insufficient supply");
        });

        it("fails if insufficient gold", () => {
            const faction: FactionData = {
                name: "Buyer",
                resources: { gold: 50 },
                markets: [
                    { resource: "food", base_price: 10, supply: 100, demand: 50, current_price: 10 },
                ],
            };

            const result = buyFromMarket(faction, "food", 20);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Insufficient gold");
        });
    });

    describe("sellToMarket", () => {
        it("successfully sells to market", () => {
            const faction: FactionData = {
                name: "Seller",
                resources: { gold: 500, food: 50 },
                markets: [
                    { resource: "food", base_price: 10, supply: 100, demand: 50, current_price: 5 },
                ],
            };

            const result = sellToMarket(faction, "food", 20);

            expect(result.success).toBe(true);
            expect(result.revenue).toBe(100); // 20 * 5
            expect(faction.resources.gold).toBe(600);
            expect(faction.resources.food).toBe(30);
            expect(faction.markets![0].supply).toBe(120);
        });

        it("fails if insufficient resource", () => {
            const faction: FactionData = {
                name: "Seller",
                resources: { food: 10 },
                markets: [
                    { resource: "food", base_price: 10, supply: 100, demand: 50 },
                ],
            };

            const result = sellToMarket(faction, "food", 20);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Insufficient resource");
        });
    });

    describe("simulateMarketFluctuation", () => {
        it("randomly fluctuates supply and demand", () => {
            const faction: FactionData = {
                name: "Market",
                markets: [
                    { resource: "Iron", base_price: 100, supply: 100, demand: 100 },
                ],
            };

            const originalSupply = faction.markets![0].supply;
            const originalDemand = faction.markets![0].demand;

            simulateMarketFluctuation(faction, 0.1);

            // Supply and demand should have changed (with high probability)
            const supplyChanged = faction.markets![0].supply !== originalSupply;
            const demandChanged = faction.markets![0].demand !== originalDemand;

            // At least one should have changed (statistically very likely)
            expect(supplyChanged || demandChanged).toBe(true);
        });

        it("never goes negative", () => {
            const faction: FactionData = {
                name: "Market",
                markets: [
                    { resource: "Iron", base_price: 100, supply: 1, demand: 1 },
                ],
            };

            // Run many fluctuations
            for (let i = 0; i < 100; i++) {
                simulateMarketFluctuation(faction, 0.5);
            }

            expect(faction.markets![0].supply).toBeGreaterThanOrEqual(0);
            expect(faction.markets![0].demand).toBeGreaterThanOrEqual(0);
        });
    });
});
