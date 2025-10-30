// src/features/loot/index.ts
// Loot generation feature exports

export { generateLoot, formatGold, formatLootSummary } from "./loot-generator";
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
} from "./types";
