// Ziel: Loot-Typen für Budget-Tracking und Item-Auswahl
// Siehe: docs/services/Loot.md
//
// TASKS:
// |  # | Status | Domain | Layer | Beschreibung                                                                   |  Prio  | MVP? | Deps | Spec                    | Imp.                |
// |--:|:----:|:-----|:----|:-----------------------------------------------------------------------------|:----:|:--:|:---|:----------------------|:------------------|
// | 68 |   ✅    | Loot   | types | LootBudgetState Interface definieren (accumulated, distributed, balance, debt) | mittel | Nein | -    | Loot.md#lootbudgetstate | types/loot.ts [neu] |
// | 80 |   ⬜    | Loot   | types | GeneratedLoot Interface (items: SelectedItem[], totalValue: number)            | mittel | Nein | #81  | Loot.md#generatedloot   | types/loot.ts [neu] |
// | 81 |   ✅    | Loot   | types | SelectedItem Interface (item: Item, quantity: number)                          | mittel | Nein | -    | Loot.md#selecteditem    | types/loot.ts [neu] |

import { z } from 'zod';

// ============================================================================
// ITEM (Placeholder bis entities/item.ts existiert)
// ============================================================================

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  tags: z.array(z.string()).optional(),
});
export type Item = z.infer<typeof itemSchema>;

// ============================================================================
// #81: SelectedItem Interface
// ============================================================================

export const selectedItemSchema = z.object({
  item: itemSchema,
  quantity: z.number(),
});
export type SelectedItem = z.infer<typeof selectedItemSchema>;

// ============================================================================
// #80: GeneratedLoot Interface (entblockt durch #81)
// ============================================================================

export const generatedLootSchema = z.object({
  items: z.array(selectedItemSchema),
  totalValue: z.number(),
});
export type GeneratedLoot = z.infer<typeof generatedLootSchema>;

// ============================================================================
// #68: LootBudgetState Interface
// ============================================================================

export const lootBudgetStateSchema = z.object({
  // Akkumuliertes Budget aus XP-Gewinnen
  accumulated: z.number(),
  // Bereits ausgegebenes Loot
  distributed: z.number(),
  // accumulated - distributed (kann negativ sein!)
  balance: z.number(),
  // Schulden aus teurem defaultLoot
  debt: z.number(),
});
export type LootBudgetState = z.infer<typeof lootBudgetStateSchema>;
