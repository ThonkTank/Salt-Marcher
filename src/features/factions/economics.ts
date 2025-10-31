/**
 * Economic Simulation - Supply/Demand, Trade Routes, Markets
 *
 * Simulates economic activity between factions including trade routes,
 * market pricing based on supply/demand, and resource exchange.
 */

import type { FactionData, TradeRoute, MarketData } from "../../workmodes/library/factions/types";

/**
 * Calculate market price based on supply and demand
 * Uses basic economic model: price = base_price * (demand / supply)
 */
export function calculateMarketPrice(market: MarketData): number {
    if (market.supply === 0) {
        return market.base_price * 10; // Scarcity premium
    }

    if (market.demand === 0) {
        return market.base_price * 0.1; // Fire sale
    }

    // Price increases when demand > supply, decreases when supply > demand
    const ratio = market.demand / market.supply;
    return Math.max(market.base_price * 0.1, market.base_price * ratio);
}

/**
 * Update market prices for all markets in a faction
 */
export function updateMarketPrices(faction: FactionData): void {
    if (!faction.markets) return;

    for (const market of faction.markets) {
        market.current_price = calculateMarketPrice(market);
    }
}

/**
 * Process trade route exchange (transfer goods and gold)
 */
export function processTradeRoute(
    faction1: FactionData,
    faction2: FactionData,
    route: TradeRoute
): { success: boolean; profit: number; error?: string } {
    if (route.status !== "active") {
        return { success: false, profit: 0, error: "Trade route not active" };
    }

    // Ensure both factions have resources initialized
    if (!faction1.resources) faction1.resources = {};
    if (!faction2.resources) faction2.resources = {};

    // Calculate total value exchanged
    const value = route.value;

    // Simple model: both factions gain gold from trade (mutual benefit)
    // In practice, goods would be exchanged for gold
    const profit = Math.floor(value * 0.1); // 10% profit per trade cycle

    faction1.resources.gold = (faction1.resources.gold || 0) + profit;
    faction2.resources.gold = (faction2.resources.gold || 0) + profit;

    return { success: true, profit };
}

/**
 * Establish a new trade route between factions
 */
export function establishTradeRoute(
    faction1: FactionData,
    faction2Name: string,
    goods: string[],
    value: number
): TradeRoute {
    const route: TradeRoute = {
        partner_faction: faction2Name,
        goods,
        value,
        status: "active",
    };

    faction1.trade_routes = faction1.trade_routes || [];
    faction1.trade_routes.push(route);

    return route;
}

/**
 * Suspend trade route (e.g., due to conflict or resource shortage)
 */
export function suspendTradeRoute(faction: FactionData, partnerFaction: string): boolean {
    const route = faction.trade_routes?.find((r) => r.partner_faction === partnerFaction);
    if (!route) return false;

    route.status = "suspended";
    return true;
}

/**
 * Sever trade route permanently (e.g., war declared)
 */
export function severTradeRoute(faction: FactionData, partnerFaction: string): boolean {
    const route = faction.trade_routes?.find((r) => r.partner_faction === partnerFaction);
    if (!route) return false;

    route.status = "severed";
    return true;
}

/**
 * Resume a suspended trade route
 */
export function resumeTradeRoute(faction: FactionData, partnerFaction: string): boolean {
    const route = faction.trade_routes?.find((r) => r.partner_faction === partnerFaction);
    if (!route || route.status === "severed") return false;

    route.status = "active";
    return true;
}

/**
 * Get total trade income per cycle
 */
export function getTotalTradeIncome(faction: FactionData): number {
    if (!faction.trade_routes) return 0;

    return faction.trade_routes
        .filter((r) => r.status === "active")
        .reduce((sum, route) => sum + route.value * 0.1, 0);
}

/**
 * Create or update market for a resource
 */
export function updateMarket(
    faction: FactionData,
    resource: string,
    basePrice: number,
    supply: number,
    demand: number
): MarketData {
    faction.markets = faction.markets || [];
    let market = faction.markets.find((m) => m.resource === resource);

    if (!market) {
        market = {
            resource,
            base_price: basePrice,
            supply,
            demand,
        };
        faction.markets.push(market);
    } else {
        market.supply = supply;
        market.demand = demand;
    }

    market.current_price = calculateMarketPrice(market);
    return market;
}

/**
 * Buy resource from market (increases supply, decreases demand)
 */
export function buyFromMarket(
    faction: FactionData,
    resource: string,
    quantity: number
): { success: boolean; cost: number; error?: string } {
    const market = faction.markets?.find((m) => m.resource === resource);
    if (!market) {
        return { success: false, cost: 0, error: "Market not found" };
    }

    if (market.supply < quantity) {
        return { success: false, cost: 0, error: "Insufficient supply" };
    }

    const cost = (market.current_price || market.base_price) * quantity;

    if (!faction.resources || (faction.resources.gold || 0) < cost) {
        return { success: false, cost, error: "Insufficient gold" };
    }

    // Update market
    market.supply -= quantity;
    market.demand -= quantity;
    market.current_price = calculateMarketPrice(market);

    // Update faction resources
    faction.resources.gold = (faction.resources.gold || 0) - cost;
    // Add purchased resource (generic handling)
    if (resource in faction.resources) {
        (faction.resources as any)[resource] = ((faction.resources as any)[resource] || 0) + quantity;
    }

    return { success: true, cost };
}

/**
 * Sell resource to market (decreases supply, increases demand)
 */
export function sellToMarket(
    faction: FactionData,
    resource: string,
    quantity: number
): { success: boolean; revenue: number; error?: string } {
    const market = faction.markets?.find((m) => m.resource === resource);
    if (!market) {
        return { success: false, revenue: 0, error: "Market not found" };
    }

    // Check if faction has enough of the resource
    if (!faction.resources || !((faction.resources as any)[resource] >= quantity)) {
        return { success: false, revenue: 0, error: "Insufficient resource" };
    }

    const revenue = (market.current_price || market.base_price) * quantity;

    // Update market
    market.supply += quantity;
    market.demand += quantity;
    market.current_price = calculateMarketPrice(market);

    // Update faction resources
    (faction.resources as any)[resource] -= quantity;
    faction.resources.gold = (faction.resources.gold || 0) + revenue;

    return { success: true, revenue };
}

/**
 * Simulate market fluctuation (random supply/demand changes)
 */
export function simulateMarketFluctuation(faction: FactionData, volatility: number = 0.1): void {
    if (!faction.markets) return;

    for (const market of faction.markets) {
        // Random fluctuation in supply and demand
        const supplyChange = Math.floor(market.supply * volatility * (Math.random() * 2 - 1));
        const demandChange = Math.floor(market.demand * volatility * (Math.random() * 2 - 1));

        market.supply = Math.max(0, market.supply + supplyChange);
        market.demand = Math.max(0, market.demand + demandChange);

        market.current_price = calculateMarketPrice(market);
    }
}
