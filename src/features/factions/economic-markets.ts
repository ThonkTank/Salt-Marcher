/**
 * Economic Markets - Real-time Market Simulation with Price Fluctuations
 *
 * Phase 8.7: Implements dynamic market simulation with real-time price changes,
 * market events, speculation, shortages, and economic cycles that affect all factions.
 */

import type { FactionData, MarketData, TradeRoute } from "../../workmodes/library/factions/types";

// ============================================================================
// Market Types
// ============================================================================

/**
 * Regional market that tracks multiple goods
 */
export interface RegionalMarket {
    /** Market ID */
    id: string;
    /** Market name/location */
    name: string;
    /** Goods being traded */
    goods: MarketData[];
    /** Participating factions */
    factions: string[];
    /** Market volatility (0-100) - affects price swings */
    volatility: number;
    /** Market health (0-100) - overall economic activity */
    health: number;
    /** Active market events */
    events: MarketEvent[];
}

/**
 * Market event that affects prices
 */
export interface MarketEvent {
    /** Event ID */
    id: string;
    /** Event type */
    type: "shortage" | "surplus" | "speculation" | "panic" | "boom" | "embargo" | "innovation";
    /** Affected resource */
    resource: string;
    /** Price impact multiplier */
    impact: number;
    /** Duration (days remaining) */
    duration: number;
    /** Description */
    description: string;
}

/**
 * Market transaction record
 */
export interface MarketTransaction {
    /** Transaction ID */
    id: string;
    /** Date */
    date: string;
    /** Buyer faction */
    buyer: string;
    /** Seller faction */
    seller: string;
    /** Resource */
    resource: string;
    /** Quantity */
    quantity: number;
    /** Price per unit */
    price: number;
    /** Total value */
    total: number;
}

/**
 * Price history tracking
 */
export interface PriceHistory {
    /** Resource name */
    resource: string;
    /** Historical prices (date → price) */
    prices: Array<{ date: string; price: number }>;
    /** Price trend (rising, falling, stable) */
    trend: "rising" | "falling" | "stable";
}

// ============================================================================
// Market Management
// ============================================================================

/**
 * Create a new regional market
 */
export function createRegionalMarket(
    name: string,
    factions: string[],
    initialGoods: Array<{ resource: string; basePrice: number; supply: number; demand: number }>,
): RegionalMarket {
    return {
        id: `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        factions,
        goods: initialGoods.map((g) => ({
            resource: g.resource,
            base_price: g.basePrice,
            supply: g.supply,
            demand: g.demand,
            current_price: calculateMarketPrice(g.basePrice, g.supply, g.demand),
        })),
        volatility: 50,
        health: 75,
        events: [],
    };
}

/**
 * Calculate current market price based on supply/demand
 */
function calculateMarketPrice(basePrice: number, supply: number, demand: number): number {
    if (supply === 0) return basePrice * 10; // Scarcity premium
    if (demand === 0) return basePrice * 0.1; // Fire sale

    const ratio = demand / supply;
    let price = basePrice * ratio;

    // Price floor at 10% of base
    price = Math.max(price, basePrice * 0.1);

    return Math.round(price * 100) / 100;
}

/**
 * Update market prices based on current supply/demand
 */
export function updateMarketPrices(market: RegionalMarket): void {
    for (const good of market.goods) {
        good.current_price = calculateMarketPrice(good.base_price, good.supply, good.demand);

        // Apply market event modifiers
        for (const event of market.events) {
            if (event.resource === good.resource || event.resource === "all") {
                good.current_price! *= event.impact;
            }
        }

        good.current_price = Math.round(good.current_price! * 100) / 100;
    }
}

/**
 * Simulate market tick (daily price fluctuations)
 */
export function simulateMarketTick(market: RegionalMarket): void {
    const volatilityFactor = market.volatility / 100;

    for (const good of market.goods) {
        // Random supply/demand changes based on volatility
        const supplyChange = (Math.random() - 0.5) * 2 * volatilityFactor * good.supply;
        const demandChange = (Math.random() - 0.5) * 2 * volatilityFactor * good.demand;

        good.supply = Math.max(0, good.supply + supplyChange);
        good.demand = Math.max(0, good.demand + demandChange);
    }

    // Decay market events
    market.events = market.events.filter((event) => {
        event.duration--;
        return event.duration > 0;
    });

    // Update prices
    updateMarketPrices(market);

    // Update market health based on transaction volume
    const avgPrice = market.goods.reduce((sum, g) => sum + (g.current_price || 0), 0) / market.goods.length;
    const priceStability = 1 - Math.abs(avgPrice - 100) / 100;
    market.health = market.health * 0.9 + priceStability * 10; // Moving average
}

// ============================================================================
// Market Events
// ============================================================================

/**
 * Create a market event
 */
export function createMarketEvent(
    market: RegionalMarket,
    type: MarketEvent["type"],
    resource: string,
    duration: number,
): MarketEvent {
    const impactMap: Record<MarketEvent["type"], number> = {
        shortage: 2.0, // Doubles price
        surplus: 0.5, // Halves price
        speculation: 1.5, // 50% increase
        panic: 2.5, // 150% increase
        boom: 1.3, // 30% increase
        embargo: 3.0, // Triples price
        innovation: 0.7, // 30% decrease
    };

    const descriptionMap: Record<MarketEvent["type"], string> = {
        shortage: `Severe shortage of ${resource} in ${market.name}`,
        surplus: `Market flooded with ${resource} in ${market.name}`,
        speculation: `Speculators driving up ${resource} prices in ${market.name}`,
        panic: `Panic buying of ${resource} in ${market.name}`,
        boom: `Economic boom increasing ${resource} demand in ${market.name}`,
        embargo: `Trade embargo on ${resource} in ${market.name}`,
        innovation: `New production methods lower ${resource} costs in ${market.name}`,
    };

    const event: MarketEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        resource,
        impact: impactMap[type],
        duration,
        description: descriptionMap[type],
    };

    market.events.push(event);
    updateMarketPrices(market);

    return event;
}

/**
 * Random market event generation
 */
export function generateRandomMarketEvent(
    market: RegionalMarket,
): { generated: boolean; event?: MarketEvent } {
    // Base 5% chance per day
    const eventChance = 0.05 + (market.volatility / 1000);

    if (Math.random() > eventChance) {
        return { generated: false };
    }

    const eventTypes: MarketEvent["type"][] = [
        "shortage",
        "surplus",
        "speculation",
        "panic",
        "boom",
        "embargo",
        "innovation",
    ];

    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const resource = market.goods[Math.floor(Math.random() * market.goods.length)].resource;
    const duration = 3 + Math.floor(Math.random() * 7); // 3-10 days

    const event = createMarketEvent(market, type, resource, duration);

    return { generated: true, event };
}

// ============================================================================
// Trading Operations
// ============================================================================

/**
 * Execute a buy order
 */
export function executeBuyOrder(
    market: RegionalMarket,
    buyer: string,
    resource: string,
    quantity: number,
): { success: boolean; transaction?: MarketTransaction; error?: string } {
    const good = market.goods.find((g) => g.resource === resource);
    if (!good) {
        return { success: false, error: "Resource not found in market" };
    }

    if (good.supply < quantity) {
        return { success: false, error: "Insufficient supply" };
    }

    const price = good.current_price || good.base_price;
    const total = price * quantity;

    // Reduce supply, increase demand
    good.supply -= quantity;
    good.demand += quantity * 0.1; // Buying signals demand

    updateMarketPrices(market);

    const transaction: MarketTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString().split("T")[0],
        buyer,
        seller: market.name,
        resource,
        quantity,
        price,
        total,
    };

    return { success: true, transaction };
}

/**
 * Execute a sell order
 */
export function executeSellOrder(
    market: RegionalMarket,
    seller: string,
    resource: string,
    quantity: number,
): { success: boolean; transaction?: MarketTransaction; error?: string } {
    const good = market.goods.find((g) => g.resource === resource);
    if (!good) {
        return { success: false, error: "Resource not found in market" };
    }

    const price = good.current_price || good.base_price;
    const total = price * quantity;

    // Increase supply, reduce demand
    good.supply += quantity;
    good.demand = Math.max(0, good.demand - quantity * 0.1); // Selling reduces demand signal

    updateMarketPrices(market);

    const transaction: MarketTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString().split("T")[0],
        buyer: market.name,
        seller,
        resource,
        quantity,
        price,
        total,
    };

    return { success: true, transaction };
}

// ============================================================================
// Price History & Trends
// ============================================================================

/**
 * Calculate price trend from history
 */
export function calculatePriceTrend(history: PriceHistory): "rising" | "falling" | "stable" {
    if (history.prices.length < 7) {
        return "stable";
    }

    const recentPrices = history.prices.slice(-7);
    const firstPrice = recentPrices[0].price;
    const lastPrice = recentPrices[recentPrices.length - 1].price;

    const change = (lastPrice - firstPrice) / firstPrice;

    if (change > 0.1) {
        return "rising";
    } else if (change < -0.1) {
        return "falling";
    } else {
        return "stable";
    }
}

/**
 * Track price over time
 */
export function trackPriceHistory(
    history: PriceHistory,
    market: RegionalMarket,
): void {
    const good = market.goods.find((g) => g.resource === history.resource);
    if (!good) return;

    const today = new Date().toISOString().split("T")[0];
    const price = good.current_price || good.base_price;

    history.prices.push({ date: today, price });

    // Keep only last 30 days
    if (history.prices.length > 30) {
        history.prices = history.prices.slice(-30);
    }

    // Calculate trend
    history.trend = calculatePriceTrend(history);
}

/**
 * Get price statistics
 */
export function getPriceStatistics(history: PriceHistory): {
    current: number;
    min: number;
    max: number;
    average: number;
    volatility: number;
} {
    if (history.prices.length === 0) {
        return { current: 0, min: 0, max: 0, average: 0, volatility: 0 };
    }

    const prices = history.prices.map((p) => p.price);
    const current = prices[prices.length - 1];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Calculate standard deviation as volatility measure
    const variance =
        prices.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / average;

    return {
        current: Math.round(current * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        average: Math.round(average * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
    };
}

// ============================================================================
// Economic Cycles
// ============================================================================

/**
 * Economic cycle phase
 */
export type EconomicPhase = "expansion" | "peak" | "contraction" | "trough";

/**
 * Economic cycle tracking
 */
export interface EconomicCycle {
    /** Current phase */
    phase: EconomicPhase;
    /** Progress within phase (0-100) */
    progress: number;
    /** Cycle length (days per full cycle) */
    cycle_length: number;
    /** Current day in cycle */
    day: number;
}

/**
 * Advance economic cycle
 */
export function advanceEconomicCycle(cycle: EconomicCycle): void {
    cycle.day++;

    const phaseLength = cycle.cycle_length / 4;
    const dayInPhase = cycle.day % phaseLength;
    const phaseIndex = Math.floor(cycle.day / phaseLength) % 4;

    const phases: EconomicPhase[] = ["expansion", "peak", "contraction", "trough"];
    cycle.phase = phases[phaseIndex];
    cycle.progress = (dayInPhase / phaseLength) * 100;
}

/**
 * Apply economic cycle effects to market
 */
export function applyEconomicCycleEffects(
    market: RegionalMarket,
    cycle: EconomicCycle,
): void {
    const effectMap: Record<EconomicPhase, { demandMultiplier: number; volatility: number }> = {
        expansion: { demandMultiplier: 1.2, volatility: 40 },
        peak: { demandMultiplier: 1.5, volatility: 60 },
        contraction: { demandMultiplier: 0.8, volatility: 50 },
        trough: { demandMultiplier: 0.5, volatility: 30 },
    };

    const effect = effectMap[cycle.phase];

    for (const good of market.goods) {
        good.demand *= effect.demandMultiplier;
    }

    market.volatility = effect.volatility;
    updateMarketPrices(market);
}

// ============================================================================
// Market Intelligence
// ============================================================================

/**
 * Analyze market for investment opportunities
 */
export function analyzeMarket(
    market: RegionalMarket,
    priceHistories: PriceHistory[],
): Array<{
    resource: string;
    recommendation: "buy" | "sell" | "hold";
    confidence: number;
    reason: string;
}> {
    const recommendations: ReturnType<typeof analyzeMarket> = [];

    for (const good of market.goods) {
        const history = priceHistories.find((h) => h.resource === good.resource);
        if (!history || history.prices.length < 7) continue;

        const stats = getPriceStatistics(history);
        const currentPrice = good.current_price || good.base_price;

        let recommendation: "buy" | "sell" | "hold" = "hold";
        let confidence = 50;
        let reason = "Market stable";

        // Buy signals
        if (currentPrice < stats.average * 0.8) {
            recommendation = "buy";
            confidence = 70;
            reason = "Price 20% below average";
        } else if (history.trend === "falling" && currentPrice < stats.average * 0.9) {
            recommendation = "buy";
            confidence = 60;
            reason = "Falling trend nearing bottom";
        }

        // Sell signals
        if (currentPrice > stats.average * 1.2) {
            recommendation = "sell";
            confidence = 70;
            reason = "Price 20% above average";
        } else if (history.trend === "rising" && currentPrice > stats.average * 1.1) {
            recommendation = "sell";
            confidence = 60;
            reason = "Rising trend may be peaking";
        }

        // Market events override
        for (const event of market.events) {
            if (event.resource === good.resource) {
                if (event.type === "shortage" || event.type === "embargo") {
                    recommendation = "buy";
                    confidence = 80;
                    reason = `Market event: ${event.description}`;
                } else if (event.type === "surplus" || event.type === "innovation") {
                    recommendation = "sell";
                    confidence = 80;
                    reason = `Market event: ${event.description}`;
                }
            }
        }

        recommendations.push({ resource: good.resource, recommendation, confidence, reason });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Predict future price (simple moving average)
 */
export function predictPrice(
    history: PriceHistory,
    daysAhead: number = 7,
): number | null {
    if (history.prices.length < 7) return null;

    const recentPrices = history.prices.slice(-7).map((p) => p.price);
    const average = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;

    // Simple trend projection
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const trend = (lastPrice - firstPrice) / 7; // Price change per day

    const prediction = average + trend * daysAhead;

    return Math.max(0, Math.round(prediction * 100) / 100);
}
