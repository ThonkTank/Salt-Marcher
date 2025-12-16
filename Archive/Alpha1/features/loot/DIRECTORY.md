# Loot Feature

## Purpose

Procedural loot generation based on creature CR, encounter context, and configurable loot tables.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Types

```typescript
import type {
  ItemRarity,           // "common" | "uncommon" | "rare" | "very_rare" | "legendary"
  LootType,             // "gold" | "item" | "consumable" | "special"
  LootItem,
  LootBundle,
  LootGenerationContext,
  LootGenerationConfig,
  LootGenerationResult,
  LootTable,
  LootTableEntry,
  InherentCreatureLoot,
} from "src/features/loot";
```

### Loot Generation

```typescript
import {
  generateLoot,
  formatGold,
  formatLootSummary,
} from "src/features/loot";
```

### Item Generation

```typescript
import {
  generateItems,
  calculateItemValue,
  groupItemsByRarity,
  EXAMPLE_LOOT_TABLES,
} from "src/features/loot";
```

## Dependencies

- **Encounters Feature** - Creature CR for loot scaling
- **Library** - Item/equipment data

## Usage Example

```typescript
import { generateLoot, formatLootSummary } from "src/features/loot";

const context: LootGenerationContext = {
  cr: 5,
  partySize: 4,
  terrain: "dungeon",
};

const result = generateLoot(context, {
  goldMultiplier: 1.5,
  itemChance: 0.3,
});

console.log(formatLootSummary(result));
// "250 gp, Potion of Healing, +1 Longsword"
```

## Internal Structure

- `types.ts` - Loot type definitions
- `loot-generator.ts` - Gold and bundle generation
- `item-generator.ts` - Magic item generation with rarity tables
