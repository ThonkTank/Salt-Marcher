// src/features/loot/item-generator.ts
// Item generation engine with tag-based filtering and rarity limits

import type {
    LootItem,
    ItemRarity,
    LootGenerationContext,
    LootGenerationConfig,
    LootTable,
    LootTableEntry,
} from "./loot-types";

/**
 * Default rarity level limits by party level
 */
const DEFAULT_RARITY_LIMITS: Record<ItemRarity, number> = {
    common: 1,
    uncommon: 1,
    rare: 5,
    "very-rare": 11,
    legendary: 17,
    artifact: 20,
};

/**
 * Generate magic items based on context and budget
 */
export function generateItems(
    context: LootGenerationContext,
    config: LootGenerationConfig,
    itemBudget: number,
    lootTables: ReadonlyArray<LootTable>,
): LootItem[] {
    if (!config.enableMagicItems || itemBudget <= 0) {
        return [];
    }

    const items: LootItem[] = [];
    const { partyLevel, tags = [], excludeTags = [] } = context;
    const maxItems = config.maxMagicItemsPerEncounter ?? 3;

    // Filter available entries by tags and level
    const availableEntries = filterLootEntries(lootTables, tags, excludeTags, partyLevel, config);

    if (availableEntries.length === 0) {
        return [];
    }

    // Generate items up to budget and max count
    let remainingBudget = itemBudget;
    let attempts = 0;
    const maxAttempts = maxItems * 3; // Prevent infinite loops

    while (items.length < maxItems && remainingBudget > 0 && attempts < maxAttempts) {
        attempts++;

        // Select item using weighted random
        const entry = selectWeightedRandom(availableEntries);
        if (!entry) {
            break;
        }

        // Generate quantity
        const quantity = rollQuantity(entry.quantityRange);

        // Create loot item
        const item: LootItem = {
            type: entry.item.type,
            name: entry.item.name,
            quantity,
            value: entry.item.value,
            rarity: entry.item.rarity,
            description: entry.item.description,
            tags: entry.item.tags,
        };

        items.push(item);

        // Deduct from budget (if item has value)
        if (entry.item.value) {
            remainingBudget -= entry.item.value * quantity;
        }
    }

    return items;
}

/**
 * Filter loot entries by tags, excludeTags, and party level
 *
 * Filtering logic:
 * - Table tags: If context has tags, at least one table tag must match context tags (or table has no tags)
 * - Item tags: Optional secondary filter - if item has tags AND context has tags, at least one must match
 * - Exclude tags: If item has any excluded tags, skip it
 */
function filterLootEntries(
    lootTables: ReadonlyArray<LootTable>,
    tags: ReadonlyArray<string>,
    excludeTags: ReadonlyArray<string>,
    partyLevel: number,
    config: LootGenerationConfig,
): LootTableEntry[] {
    const rarityLimits = config.rarityLevelLimits ?? DEFAULT_RARITY_LIMITS;
    const filtered: LootTableEntry[] = [];

    for (const table of lootTables) {
        // Filter table by tags (if context has tags and table has tags, at least one must match)
        if (tags.length > 0 && table.tags && table.tags.length > 0) {
            const hasMatchingTag = table.tags.some((tag) => tags.includes(tag));
            if (!hasMatchingTag) {
                continue; // Skip entire table if tags don't match
            }
        }

        // Filter entries within table
        for (const entry of table.entries) {
            // Check rarity level limit
            if (entry.item.rarity) {
                const minLevel = rarityLimits[entry.item.rarity];
                if (partyLevel < minLevel) {
                    continue; // Party level too low for this rarity
                }
            }

            // Check exclude tags (item tags are primarily for categorization, not filtering)
            if (entry.item.tags && excludeTags.length > 0) {
                const hasExcludedTag = entry.item.tags.some((tag) => excludeTags.includes(tag));
                if (hasExcludedTag) {
                    continue; // Item has excluded tag
                }
            }

            filtered.push(entry);
        }
    }

    return filtered;
}

/**
 * Select entry using weighted random selection
 */
function selectWeightedRandom(entries: ReadonlyArray<LootTableEntry>): LootTableEntry | null {
    if (entries.length === 0) {
        return null;
    }

    // Calculate total weight
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) {
        return null;
    }

    // Roll random value
    const roll = Math.random() * totalWeight;

    // Find selected entry
    let accumulator = 0;
    for (const entry of entries) {
        accumulator += entry.weight;
        if (roll < accumulator) {
            return entry;
        }
    }

    // Fallback (should not reach here)
    return entries[entries.length - 1] ?? null;
}

/**
 * Roll quantity within range
 */
function rollQuantity(range: { min: number; max: number }): number {
    if (range.max <= range.min) {
        return range.min;
    }
    return Math.floor(range.min + Math.random() * (range.max - range.min + 1));
}

/**
 * Utility: Calculate total value of items
 */
export function calculateItemValue(items: ReadonlyArray<LootItem>): number {
    return items.reduce((total, item) => {
        return total + (item.value ?? 0) * item.quantity;
    }, 0);
}

/**
 * Utility: Group items by rarity
 */
export function groupItemsByRarity(items: ReadonlyArray<LootItem>): Map<ItemRarity | "none", LootItem[]> {
    const groups = new Map<ItemRarity | "none", LootItem[]>();

    for (const item of items) {
        const rarity = item.rarity ?? "none";
        const group = groups.get(rarity) ?? [];
        group.push(item);
        groups.set(rarity, group);
    }

    return groups;
}

/**
 * Example loot tables (placeholder - will be expanded with full item database)
 */
export const EXAMPLE_LOOT_TABLES: LootTable[] = [
    {
        id: "potions-common",
        name: "Common Potions",
        category: "consumables",
        entries: [
            {
                weight: 10,
                item: {
                    type: "consumable",
                    name: "Potion of Healing",
                    value: 50,
                    rarity: "common",
                    description: "Heals 2d4+2 HP",
                    tags: ["healing", "potion"],
                },
                quantityRange: { min: 1, max: 3 },
            },
            {
                weight: 5,
                item: {
                    type: "consumable",
                    name: "Potion of Climbing",
                    value: 50,
                    rarity: "common",
                    description: "Gain climbing speed for 1 hour",
                    tags: ["potion", "utility"],
                },
                quantityRange: { min: 1, max: 1 },
            },
        ],
        tags: ["dungeon", "forest", "mountain"],
    },
    {
        id: "scrolls-uncommon",
        name: "Uncommon Scrolls",
        category: "consumables",
        entries: [
            {
                weight: 8,
                item: {
                    type: "consumable",
                    name: "Spell Scroll (Level 1)",
                    value: 100,
                    rarity: "common",
                    description: "Contains a 1st-level spell",
                    tags: ["scroll", "magic"],
                },
                quantityRange: { min: 1, max: 2 },
            },
            {
                weight: 4,
                item: {
                    type: "consumable",
                    name: "Spell Scroll (Level 2)",
                    value: 200,
                    rarity: "uncommon",
                    description: "Contains a 2nd-level spell",
                    tags: ["scroll", "magic"],
                },
                quantityRange: { min: 1, max: 1 },
            },
        ],
        tags: ["wizard", "library", "temple"],
    },
    {
        id: "gems-trade",
        name: "Precious Gems",
        category: "trade-goods",
        entries: [
            {
                weight: 20,
                item: {
                    type: "trade-good",
                    name: "Small Gem",
                    value: 10,
                    description: "Small semi-precious stone",
                    tags: ["gem", "trade"],
                },
                quantityRange: { min: 1, max: 5 },
            },
            {
                weight: 10,
                item: {
                    type: "trade-good",
                    name: "Large Gem",
                    value: 50,
                    description: "Large precious stone",
                    tags: ["gem", "trade"],
                },
                quantityRange: { min: 1, max: 3 },
            },
            {
                weight: 5,
                item: {
                    type: "trade-good",
                    name: "Rare Gem",
                    value: 100,
                    description: "Rare and valuable gemstone",
                    tags: ["gem", "trade", "valuable"],
                },
                quantityRange: { min: 1, max: 2 },
            },
        ],
        tags: ["dragon", "treasure", "noble"],
    },
];
