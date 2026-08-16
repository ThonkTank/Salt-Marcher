import type {
  EncounterAudit,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { LootRarity } from './loot-catalog.js'
import { freezeStage } from './reward-stage-types.js'

export type RewardAggregationInput = Readonly<{
  treasures: readonly GeneratedTreasure[]
  goldBudgetCp: number
  magicTargets: Readonly<Record<LootRarity, number>>
  expectedTreasureCount: number
  rules?: GeneratorLootRules
}>

export type RewardAggregationOutput = Readonly<{
  normalValueCp: number
  overstockValueCp: number
  magicCount: number
  audits: readonly EncounterAudit[]
}>

/**
 * Preconditions: packing is complete. Postconditions: all derived totals and
 * audit observations describe only the supplied immutable Treasures.
 */
export function aggregateReward(
  input: RewardAggregationInput
): RewardAggregationOutput {
  const rules = input.rules ?? defaultGeneratorLootRules
  const normal = input.treasures.filter(
    (treasure) => treasure.stockClass === 'normal'
  )
  const normalValueCp = normal.reduce(
    (sum, treasure) => sum + treasure.actualValueCp,
    0
  )
  const overstockValueCp = input.treasures
    .filter((treasure) => treasure.stockClass === 'overstock')
    .reduce((sum, treasure) => sum + treasure.actualValueCp, 0)
  const expectedMagic = Object.values(input.magicTargets).reduce(
    (sum, count) => sum + count,
    0
  )
  const magicCount = input.treasures.reduce(
    (sum, treasure) => sum + treasure.items.filter((item) => item.magic).length,
    0
  )
  const anchors = input.treasures
    .filter((treasure) => treasure.anchorEncounterNumber !== null)
    .map((treasure) => treasure.anchorEncounterNumber)
  const audits: EncounterAudit[] = [
    {
      code: 'treasure_count',
      passed: input.treasures.length === input.expectedTreasureCount,
      hard: true,
      parameters: {
        actual: input.treasures.length,
        expected: input.expectedTreasureCount
      }
    },
    {
      code: 'unique_encounter_anchors',
      passed: new Set(anchors).size === anchors.length,
      hard: true,
      parameters: {
        anchorCount: anchors.length,
        uniqueAnchorCount: new Set(anchors).size
      }
    },
    {
      code: 'treasure_assignment_complete',
      passed: input.treasures.every((treasure) => treasure.items.length > 0),
      hard: true,
      parameters: {
        treasureCount: input.treasures.length,
        emptyTreasureCount: input.treasures.filter(
          (treasure) => treasure.items.length === 0
        ).length
      }
    },
    {
      code: 'normal_loot_budget_tolerance',
      passed:
        Math.abs(normalValueCp - input.goldBudgetCp) <=
        input.goldBudgetCp * rules.audit.normalBudgetTolerance,
      hard: false,
      parameters: {
        actualCp: normalValueCp,
        targetCp: input.goldBudgetCp,
        tolerancePercent: rules.audit.normalBudgetTolerance * 100
      }
    },
    {
      code: 'magic_item_count',
      passed: magicCount === expectedMagic,
      hard: true,
      parameters: { actual: magicCount, expected: expectedMagic }
    },
    {
      code: 'packing_validity',
      passed: input.treasures.every((treasure) =>
        treasure.items.every(
          (item) =>
            item.containerId === null ||
            treasure.containers.some(
              (container) => container.id === item.containerId
            )
        )
      ),
      hard: true,
      parameters: {
        invalidAssignmentCount: input.treasures.reduce(
          (total, treasure) =>
            total +
            treasure.items.filter(
              (item) =>
                item.containerId !== null &&
                !treasure.containers.some(
                  (container) => container.id === item.containerId
                )
            ).length,
          0
        )
      }
    }
  ]
  return freezeStage({ normalValueCp, overstockValueCp, magicCount, audits })
}
