// src/features/loot/loot-generator.ts
// Loot generation engine with XP-based gold calculation and item selection

import { DND5E_XP_THRESHOLDS } from "@services/state/encounter-session-store";
import { generateItems, calculateItemValue, EXAMPLE_LOOT_TABLES } from "./item-generator";
import type {
    LootGenerationContext,
    LootGenerationConfig,
    LootGenerationResult,
    LootBundle,
    LootTable,
} from "./loot-types";
import type { EncounterXpRule } from "@services/domain/encounter-types";

/**
 * Generate loot bundle from encounter context
 */
export function generateLoot(
    context: LootGenerationContext,
    config: LootGenerationConfig = {},
    rules: ReadonlyArray<EncounterXpRule> = [],
    lootTables: ReadonlyArray<LootTable> = EXAMPLE_LOOT_TABLES,
): LootGenerationResult {
    const warnings: string[] = [];

    // Calculate gold
    const goldResult = calculateGold(context, rules, warnings);

    // Calculate magic item budget
    const itemBudget = calculateItemBudget(context, config);

    // Generate items
    const items = generateItems(context, config, itemBudget, lootTables);

    // Calculate item values
    const itemValue = calculateItemValue(items);
    const tradeGoodsValue = items
        .filter((item) => item.type === "trade-good")
        .reduce((sum, item) => sum + (item.value ?? 0) * item.quantity, 0);
    const magicItemValue = items
        .filter((item) => item.type === "magic-item")
        .reduce((sum, item) => sum + (item.value ?? 0) * item.quantity, 0);

    // Build final bundle
    const bundle: LootBundle = {
        gold: Math.round(goldResult.finalGold),
        items: Object.freeze(items),
        totalValue: Math.round(goldResult.finalGold + itemValue),
    };

    const breakdown = {
        baseGold: goldResult.baseGold,
        goldModifiers: goldResult.modifiers,
        finalGold: goldResult.finalGold,
        magicItemsGenerated: items.filter((item) => item.type === "magic-item").length,
        tradeGoodsValue,
        inherentLootValue: 0, // Will be implemented in Phase 5.4
    };

    return {
        bundle,
        breakdown,
        warnings: warnings.length > 0 ? Object.freeze(warnings) : undefined,
    };
}

interface GoldCalculationResult {
    baseGold: number;
    modifiers: number;
    finalGold: number;
}

/**
 * Calculate gold using XP-based formula with modifier rules
 * Formula: baseGold = encounterXP * levelMultiplier
 */
function calculateGold(
    context: LootGenerationContext,
    rules: ReadonlyArray<EncounterXpRule>,
    warnings: string[],
): GoldCalculationResult {
    const { encounterXp, partyLevel, partySize, goldModifier = 1.0 } = context;

    // Calculate base gold from XP and party level
    const baseMultiplier = getGoldBaseMultiplier(partyLevel);
    const baseGold = encounterXp * baseMultiplier * goldModifier;

    // Apply gold-scoped rules
    let runningGold = baseGold;
    let totalModifiers = 0;

    for (const rule of rules) {
        if (rule.scope !== "gold" || !rule.enabled) {
            continue;
        }

        if (partySize === 0) {
            warnings.push(`Gold rule "${rule.title}" ignored because no party members are present.`);
            continue;
        }

        const delta = applyGoldRule(rule, runningGold, context, warnings);
        totalModifiers += delta;
        runningGold += delta;
    }

    return {
        baseGold,
        modifiers: totalModifiers,
        finalGold: baseGold + totalModifiers,
    };
}

/**
 * Get gold multiplier based on average party level
 * Matches the formula from workspace-view.ts
 */
function getGoldBaseMultiplier(averageLevel: number): number {
    if (averageLevel >= 17) {
        return 3.2;
    }
    if (averageLevel >= 11) {
        return 1.6;
    }
    if (averageLevel >= 5) {
        return 0.415;
    }
    if (averageLevel > 0) {
        return 0.475;
    }
    return 0;
}

/**
 * Apply a single gold rule and return the delta
 */
function applyGoldRule(
    rule: EncounterXpRule,
    runningGold: number,
    context: LootGenerationContext,
    warnings: string[],
): number {
    const { partyLevel, partySize } = context;
    const totalLevels = partyLevel * partySize;

    switch (rule.modifierType) {
        case "flat": {
            return rule.modifierValue;
        }
        case "flatPerAverageLevel": {
            return rule.modifierValue * partyLevel;
        }
        case "flatPerTotalLevel": {
            return rule.modifierValue * totalLevels;
        }
        case "percentTotal": {
            return runningGold * (rule.modifierValue / 100);
        }
        case "percentNextLevel": {
            // Calculate XP needed to reach next level
            const xpToNext = calculateXpToNextLevel(partyLevel);
            if (xpToNext === null) {
                warnings.push(`Party level ${partyLevel} has no next-level XP threshold; "${rule.title}" ignored.`);
                return 0;
            }
            // Multiply by party size to get aggregate XP needed
            const aggregateXpToNext = xpToNext * partySize;
            return (aggregateXpToNext * rule.modifierValue) / 100;
        }
        default: {
            warnings.push(`Unknown modifier type "${rule.modifierType}" in rule "${rule.title}".`);
            return 0;
        }
    }
}

/**
 * Calculate XP needed to reach next level
 */
function calculateXpToNextLevel(level: number): number | null {
    const sanitizedLevel = Math.max(1, Math.floor(level));

    // Level 20 has no next level
    if (sanitizedLevel >= 20) {
        return null;
    }

    const currentThreshold = DND5E_XP_THRESHOLDS[sanitizedLevel];
    const nextThreshold = DND5E_XP_THRESHOLDS[sanitizedLevel + 1];

    if (typeof currentThreshold !== "number" || typeof nextThreshold !== "number") {
        return null;
    }

    return nextThreshold - currentThreshold;
}

/**
 * Calculate magic item budget based on encounter XP and party level
 * Placeholder implementation - will be expanded in Phase 5.3
 */
function calculateItemBudget(context: LootGenerationContext, config: LootGenerationConfig): number {
    if (!config.enableMagicItems) {
        return 0;
    }

    const { encounterXp, itemBudgetModifier = 1.0 } = context;
    // Simple placeholder: 10% of XP as item budget
    return encounterXp * 0.1 * itemBudgetModifier;
}

/**
 * Utility: Format gold value for display
 */
export function formatGold(gold: number): string {
    const rounded = Math.round(gold);
    if (rounded === 0) {
        return "0 gp";
    }
    return `${rounded.toLocaleString("en-US")} gp`;
}

/**
 * Utility: Format loot bundle summary
 */
export function formatLootSummary(bundle: LootBundle): string {
    const parts: string[] = [];

    if (bundle.gold > 0) {
        parts.push(formatGold(bundle.gold));
    }

    if (bundle.items.length > 0) {
        const itemCount = bundle.items.reduce((sum, item) => sum + item.quantity, 0);
        parts.push(`${itemCount} item${itemCount !== 1 ? "s" : ""}`);
    }

    if (parts.length === 0) {
        return "No loot";
    }

    return parts.join(", ");
}
