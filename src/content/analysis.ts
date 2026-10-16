import { type DungeonContent, type DungeonRoute } from "../model";

export interface DungeonAnalysis {
  readonly definitions: number;
  readonly occurrences: number;
  readonly totalQuantity: number;
  readonly xp: number;
  readonly lootValue: number;
  readonly encounters: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly xp: number;
  }[];
  readonly bossGoals: readonly DungeonRoute[];
}

export function analyzeDungeon(content: DungeonContent): DungeonAnalysis {
  const definitions = new Map(
      content.definitions.map((value) => [value.id, value]),
    ),
    encounterTotals = new Map<string, { quantity: number; xp: number }>();
  let totalQuantity = 0,
    xp = 0,
    lootValue = 0;
  for (const occurrence of content.occurrences) {
    const definition = definitions.get(occurrence.definitionId);
    if (!definition) continue;
    totalQuantity += occurrence.quantity;
    xp += definition.xp * occurrence.quantity;
    lootValue += definition.lootValue * occurrence.quantity;
    if (definition.encounter) {
      const total = encounterTotals.get(definition.encounter) ?? {
        quantity: 0,
        xp: 0,
      };
      total.quantity += occurrence.quantity;
      total.xp += definition.xp * occurrence.quantity;
      encounterTotals.set(definition.encounter, total);
    }
  }
  return {
    definitions: content.definitions.length,
    occurrences: content.occurrences.length,
    totalQuantity,
    xp,
    lootValue,
    encounters: [...encounterTotals]
      .map(([name, total]) => ({ name, ...total }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    bossGoals: content.routes
      .filter((route) => route.bossGoalOrder !== undefined)
      .sort((a, b) => a.bossGoalOrder! - b.bossGoalOrder!),
  };
}
