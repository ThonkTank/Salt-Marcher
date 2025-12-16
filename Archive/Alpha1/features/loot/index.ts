// src/features/loot/index.ts
// Loot generation feature exports

export { generateLoot, formatGold, formatLootSummary } from "./loot-generator";
export { generateItems, calculateItemValue, groupItemsByRarity, EXAMPLE_LOOT_TABLES } from "./item-generator";
export type {
    ItemRarity,
    LootType,
    LootItem,
    LootBundle,
    LootGenerationContext,
    LootGenerationConfig,
    LootGenerationResult,
    LootTable,
    LootTableEntry,
    InherentCreatureLoot,
} from "./loot-types";
