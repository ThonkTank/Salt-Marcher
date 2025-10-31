/**
 * Advanced Economics - Production Chains, Resource Consumption, Trade Goods
 *
 * Phase 8.6: Extends basic economic simulation with production chains that convert
 * inputs to outputs over time, resource consumption tracking, and a catalog of trade goods.
 */

import type {
    FactionData,
    ProductionChain,
    TradeGood,
    ResourceConsumption,
} from "../../workmodes/library/factions/types";

// ============================================================================
// Production Chain System
// ============================================================================

/**
 * Common production chain templates
 */
export const PRODUCTION_CHAIN_TEMPLATES: Record<string, Omit<ProductionChain, "id" | "progress">> = {
    weapon_forging: {
        name: "Weapon Forging",
        inputs: { equipment: 10, gold: 50 },
        outputs: { equipment: 50 },
        duration: 7,
        required_building: "Smithy",
        workers: 3,
    },
    armor_crafting: {
        name: "Armor Crafting",
        inputs: { equipment: 15, gold: 75 },
        outputs: { equipment: 75 },
        duration: 10,
        required_building: "Armory",
        workers: 4,
    },
    bread_baking: {
        name: "Bread Baking",
        inputs: { food: 20, gold: 10 },
        outputs: { food: 100 },
        duration: 2,
        required_building: "Bakery",
        workers: 2,
    },
    ale_brewing: {
        name: "Ale Brewing",
        inputs: { food: 30, gold: 20 },
        outputs: { food: 50, gold: 40 },
        duration: 14,
        required_building: "Brewery",
        workers: 3,
    },
    potion_brewing: {
        name: "Potion Brewing",
        inputs: { magic: 10, gold: 100 },
        outputs: { magic: 30 },
        duration: 5,
        required_building: "Alchemy Lab",
        workers: 1,
    },
    scroll_scribing: {
        name: "Scroll Scribing",
        inputs: { magic: 5, gold: 50 },
        outputs: { magic: 15 },
        duration: 3,
        required_building: "Scriptorium",
        workers: 1,
    },
};

/**
 * Start a production chain
 */
export function startProductionChain(
    faction: FactionData,
    templateKey: keyof typeof PRODUCTION_CHAIN_TEMPLATES,
): { success: boolean; chain?: ProductionChain; error?: string } {
    const template = PRODUCTION_CHAIN_TEMPLATES[templateKey];
    if (!template) {
        return { success: false, error: "Unknown production chain template" };
    }

    // Check if faction has required resources
    if (!faction.resources) {
        return { success: false, error: "Faction has no resources" };
    }

    for (const [resource, amount] of Object.entries(template.inputs)) {
        if ((faction.resources[resource] || 0) < amount) {
            return { success: false, error: `Insufficient ${resource}` };
        }
    }

    // Consume input resources
    for (const [resource, amount] of Object.entries(template.inputs)) {
        faction.resources[resource] = (faction.resources[resource] || 0) - amount;
    }

    // Create production chain
    const chain: ProductionChain = {
        id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...template,
        progress: 0,
    };

    faction.production_chains = faction.production_chains || [];
    faction.production_chains.push(chain);

    return { success: true, chain };
}

/**
 * Process production chain (call daily)
 */
export function processProductionChains(faction: FactionData, daysElapsed: number = 1): void {
    if (!faction.production_chains || faction.production_chains.length === 0) return;

    faction.resources = faction.resources || {};

    for (let i = faction.production_chains.length - 1; i >= 0; i--) {
        const chain = faction.production_chains[i];

        // Advance progress based on workers
        const workerBonus = (chain.workers || 1) * 0.1; // 10% bonus per worker
        const progressPerDay = (100 / chain.duration) * (1 + workerBonus);
        chain.progress = (chain.progress || 0) + progressPerDay * daysElapsed;

        // Check if complete
        if (chain.progress >= 100) {
            // Produce outputs
            for (const [resource, amount] of Object.entries(chain.outputs)) {
                faction.resources[resource] = (faction.resources[resource] || 0) + amount;
            }

            // Remove completed chain
            faction.production_chains.splice(i, 1);
        }
    }
}

// ============================================================================
// Resource Consumption System
// ============================================================================

/**
 * Calculate daily resource consumption for a faction
 */
export function calculateDailyConsumption(faction: FactionData): ResourceConsumption[] {
    const consumption: ResourceConsumption[] = [];

    // Base consumption from members
    const memberCount = faction.members?.length || 0;
    if (memberCount > 0) {
        consumption.push({
            resource: "food",
            rate: memberCount * 1,
            reason: "Member upkeep",
        });
        consumption.push({
            resource: "gold",
            rate: memberCount * 2,
            reason: "Member wages",
        });
    }

    // Consumption from active production chains
    if (faction.production_chains) {
        for (const chain of faction.production_chains) {
            const workers = chain.workers || 1;
            consumption.push({
                resource: "food",
                rate: workers * 2,
                reason: `Production: ${chain.name}`,
            });
        }
    }

    // Consumption from military engagements
    if (faction.military_engagements) {
        for (const engagement of faction.military_engagements) {
            if (engagement.status === "ongoing") {
                const unitCount = engagement.committed_units.reduce(
                    (sum, u) => sum + u.quantity,
                    0,
                );
                consumption.push({
                    resource: "food",
                    rate: unitCount * 3,
                    reason: `Military: ${engagement.type}`,
                });
                consumption.push({
                    resource: "equipment",
                    rate: unitCount * 0.5,
                    reason: `Equipment wear: ${engagement.type}`,
                });
            }
        }
    }

    // Add custom consumption rates from faction data
    if (faction.resource_consumption) {
        consumption.push(...faction.resource_consumption);
    }

    return consumption;
}

/**
 * Apply daily consumption to faction resources
 */
export function applyDailyConsumption(faction: FactionData, daysElapsed: number = 1): void {
    const consumption = calculateDailyConsumption(faction);
    faction.resources = faction.resources || {};

    for (const item of consumption) {
        const totalConsumption = item.rate * daysElapsed;
        faction.resources[item.resource] = Math.max(
            0,
            (faction.resources[item.resource] || 0) - totalConsumption,
        );
    }
}

// ============================================================================
// Trade Goods Catalog
// ============================================================================

/**
 * Standard trade goods catalog
 */
export const TRADE_GOODS_CATALOG: TradeGood[] = [
    // Food
    { name: "Wheat", category: "food", base_value: 1, weight: 10, rarity: "common", tags: ["grain", "farming"] },
    { name: "Ale", category: "food", base_value: 4, weight: 8, rarity: "common", tags: ["drink", "brewing"] },
    { name: "Wine", category: "food", base_value: 10, weight: 6, rarity: "uncommon", tags: ["drink", "luxury"] },
    { name: "Spices", category: "food", base_value: 50, weight: 1, rarity: "rare", tags: ["luxury", "trade"] },

    // Equipment
    { name: "Iron Ore", category: "raw_materials", base_value: 5, weight: 20, rarity: "common", tags: ["metal", "mining"] },
    { name: "Steel Ingot", category: "raw_materials", base_value: 15, weight: 10, rarity: "uncommon", tags: ["metal", "crafted"] },
    { name: "Sword", category: "equipment", base_value: 25, weight: 3, rarity: "common", tags: ["weapon", "military"] },
    { name: "Armor", category: "equipment", base_value: 50, weight: 20, rarity: "uncommon", tags: ["armor", "military"] },
    { name: "Siege Engine", category: "equipment", base_value: 500, weight: 1000, rarity: "rare", tags: ["siege", "military"] },

    // Magic
    { name: "Spell Component", category: "magic", base_value: 10, weight: 0.5, rarity: "common", tags: ["magic", "reagent"] },
    { name: "Potion", category: "magic", base_value: 50, weight: 0.5, rarity: "uncommon", tags: ["magic", "consumable"] },
    { name: "Scroll", category: "magic", base_value: 100, weight: 0.1, rarity: "uncommon", tags: ["magic", "scroll"] },
    { name: "Wand", category: "magic", base_value: 200, weight: 1, rarity: "rare", tags: ["magic", "weapon"] },
    { name: "Arcane Tome", category: "magic", base_value: 1000, weight: 5, rarity: "very_rare", tags: ["magic", "knowledge"] },

    // Luxury
    { name: "Silk", category: "luxury", base_value: 100, weight: 2, rarity: "rare", tags: ["cloth", "luxury"] },
    { name: "Gems", category: "luxury", base_value: 500, weight: 0.1, rarity: "rare", tags: ["jewel", "luxury"] },
    { name: "Artwork", category: "luxury", base_value: 1000, weight: 10, rarity: "very_rare", tags: ["art", "luxury"] },

    // Raw Materials
    { name: "Wood", category: "raw_materials", base_value: 1, weight: 50, rarity: "common", tags: ["lumber", "building"] },
    { name: "Stone", category: "raw_materials", base_value: 2, weight: 100, rarity: "common", tags: ["masonry", "building"] },
    { name: "Leather", category: "raw_materials", base_value: 5, weight: 5, rarity: "common", tags: ["animal", "crafting"] },
];

/**
 * Find trade goods by category
 */
export function getTradeGoodsByCategory(category: string): TradeGood[] {
    return TRADE_GOODS_CATALOG.filter((g) => g.category === category);
}

/**
 * Find trade goods by tags
 */
export function getTradeGoodsByTags(tags: string[]): TradeGood[] {
    return TRADE_GOODS_CATALOG.filter((g) =>
        tags.some((tag) => g.tags?.includes(tag)),
    );
}

/**
 * Get trade good by name
 */
export function getTradeGood(name: string): TradeGood | undefined {
    return TRADE_GOODS_CATALOG.find((g) => g.name === name);
}

/**
 * Generate random trade goods for a faction's inventory
 */
export function generateTradeInventory(
    factionResources: number,
    rarityLimit: "common" | "uncommon" | "rare" | "very_rare" = "uncommon",
): TradeGood[] {
    const rarityValues = {
        common: 1,
        uncommon: 2,
        rare: 3,
        very_rare: 4,
    };

    const availableGoods = TRADE_GOODS_CATALOG.filter(
        (g) => rarityValues[g.rarity as keyof typeof rarityValues] <= rarityValues[rarityLimit],
    );

    const inventory: TradeGood[] = [];
    let remainingResources = factionResources;

    while (remainingResources > 0 && inventory.length < 20) {
        const good = availableGoods[Math.floor(Math.random() * availableGoods.length)];
        if (good.base_value <= remainingResources) {
            inventory.push(good);
            remainingResources -= good.base_value;
        } else {
            break;
        }
    }

    return inventory;
}
