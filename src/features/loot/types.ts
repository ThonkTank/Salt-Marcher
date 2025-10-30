// src/features/loot/types.ts
// Type definitions for loot generation system

/**
 * Rarity levels for items
 */
export type ItemRarity = "common" | "uncommon" | "rare" | "very-rare" | "legendary" | "artifact";

/**
 * Types of loot that can be generated
 */
export type LootType = "gold" | "trade-good" | "magic-item" | "consumable" | "inherent";

/**
 * A single item of loot
 */
export interface LootItem {
    readonly type: LootType;
    readonly name: string;
    readonly quantity: number;
    readonly value?: number; // Gold value (for trade goods)
    readonly rarity?: ItemRarity; // For magic items
    readonly description?: string;
    readonly tags?: ReadonlyArray<string>; // For filtering (terrain, creature-type, etc.)
}

/**
 * Complete loot bundle from an encounter
 */
export interface LootBundle {
    readonly gold: number;
    readonly items: ReadonlyArray<LootItem>;
    readonly totalValue: number; // Gold + item values
}

/**
 * Context for loot generation
 */
export interface LootGenerationContext {
    // Party info
    readonly partyLevel: number; // Average party level
    readonly partySize: number;

    // Encounter info
    readonly encounterXp: number;
    readonly encounterCr?: number; // Challenge rating (if applicable)

    // Filtering
    readonly tags?: ReadonlyArray<string>; // Tags to filter items (terrain, creature type, etc.)
    readonly excludeTags?: ReadonlyArray<string>; // Tags to exclude

    // Modifiers
    readonly goldModifier?: number; // Multiplier for gold (default 1.0)
    readonly itemBudgetModifier?: number; // Multiplier for magic item budget (default 1.0)
}

/**
 * Loot table entry for weighted selection
 */
export interface LootTableEntry {
    readonly weight: number;
    readonly item: Omit<LootItem, "quantity">;
    readonly quantityRange: { min: number; max: number };
}

/**
 * A loot table for a specific category
 */
export interface LootTable {
    readonly id: string;
    readonly name: string;
    readonly category: "magic-items" | "trade-goods" | "consumables";
    readonly entries: ReadonlyArray<LootTableEntry>;
    readonly tags?: ReadonlyArray<string>; // Tags for filtering
}

/**
 * Inherent loot from a creature
 */
export interface InherentCreatureLoot {
    readonly creatureName: string;
    readonly items: ReadonlyArray<LootItem>;
    readonly goldValueReplacement: number; // How much of the gold budget this replaces
}

/**
 * Configuration for loot generation
 */
export interface LootGenerationConfig {
    // Gold calculation
    readonly baseGoldMultiplier?: number; // Multiplier for base gold calculation
    readonly goldScaling?: "linear" | "exponential"; // How gold scales with level

    // Magic items
    readonly enableMagicItems?: boolean;
    readonly magicItemChance?: number; // 0-1 chance per tier
    readonly maxMagicItemsPerEncounter?: number;

    // Level limits for rarity
    readonly rarityLevelLimits?: {
        readonly uncommon: number; // Min level for uncommon
        readonly rare: number; // Min level for rare
        readonly veryRare: number; // Min level for very rare
        readonly legendary: number; // Min level for legendary
    };

    // Trade goods
    readonly tradeGoodsChance?: number; // Chance to include trade goods instead of pure gold
    readonly tradeGoodsPercentage?: number; // % of gold value as trade goods
}

/**
 * Result of loot generation with breakdown
 */
export interface LootGenerationResult {
    readonly bundle: LootBundle;
    readonly breakdown: {
        readonly baseGold: number;
        readonly goldModifiers: number;
        readonly finalGold: number;
        readonly magicItemsGenerated: number;
        readonly tradeGoodsValue: number;
        readonly inherentLootValue: number;
    };
    readonly warnings?: ReadonlyArray<string>;
}
