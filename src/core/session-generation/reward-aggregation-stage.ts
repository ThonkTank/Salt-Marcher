import type {
  EncounterAudit,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import {
  itemDefinitionLineValueCp,
  itemReferenceKey,
  type ItemDefinition
} from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { GenerationCatalogIndex } from './generation-catalog-index.js'
import type { LootRarity } from './loot-catalog.js'
import { freezeStage } from './reward-stage-types.js'
import { evaluatePacking } from './packing-policy.js'

export type RewardAggregationInput = Readonly<{
  treasures: readonly GeneratedTreasure[]
  itemDefinitions: readonly ItemDefinition[]
  goldBudgetCp: number
  magicTargets: Readonly<Record<LootRarity, number>>
  expectedTreasureCount: number
  profile?: 'session' | 'group_reward'
  rules?: GeneratorLootRules
  catalogIndex: GenerationCatalogIndex
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
  const definitions = new Map(
    input.itemDefinitions.map((definition) => [
      itemReferenceKey(definition.reference),
      definition
    ])
  )
  const magicCount = input.treasures.reduce(
    (sum, treasure) =>
      sum +
      treasure.items.reduce(
        (count, item) =>
          count +
          (definitions.get(itemReferenceKey(item.itemReference))?.magic
            ? item.quantity
            : 0),
        0
      ),
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
        treasure.items.every((item) =>
          packingAssignmentValid(item, treasure, definitions, input)
        )
      ),
      hard: true,
      parameters: {
        invalidAssignmentCount: input.treasures.reduce(
          (total, treasure) =>
            total +
            treasure.items.filter(
              (item) =>
                !packingAssignmentValid(item, treasure, definitions, input)
            ).length,
          0
        )
      }
    },
    {
      code: 'item_definition_complete',
      passed: input.treasures.every((treasure) =>
        treasure.items.every((item) =>
          definitions.has(itemReferenceKey(item.itemReference))
        )
      ),
      hard: true,
      parameters: {
        definitionCount: definitions.size,
        itemCount: input.treasures.reduce(
          (count, treasure) => count + treasure.items.length,
          0
        )
      }
    },
    {
      code: 'item_value_consistency',
      passed: input.treasures.every(
        (treasure) =>
          treasure.actualValueCp ===
          treasure.items.reduce(
            (sum, item) => sum + definitionLineValue(definitions, item),
            0
          )
      ),
      hard: true,
      parameters: {
        invalidTreasureCount: input.treasures.filter(
          (treasure) =>
            treasure.actualValueCp !==
            treasure.items.reduce(
              (sum, item) => sum + definitionLineValue(definitions, item),
              0
            )
        ).length
      }
    },
    {
      code: 'container_capacity',
      passed: input.treasures.every((treasure) =>
        treasure.containers.every(
          (container) =>
            treasure.items
              .filter((item) => item.containerId === container.id)
              .reduce(
                (used, item) =>
                  used +
                  item.quantity *
                    (definitions.get(itemReferenceKey(item.itemReference))
                      ?.unitCapacity ?? 0),
                0
              ) <=
            container.capacity + 1e-9
        )
      ),
      hard: true,
      parameters: {
        containerCount: input.treasures.reduce(
          (count, treasure) => count + treasure.containers.length,
          0
        )
      }
    },
    {
      code: 'coin_denomination_integrity',
      passed: [...definitions.values()].every((definition) => {
        if (definition.components.coinDenominations.length === 0) return true
        return (
          definition.components.coinDenominations.reduce(
            (sum, coin) =>
              sum +
              coin.quantity *
                rules.coins.denominations[coin.denominationId].valueCp,
            0
          ) === definition.unitValueCp
        )
      }),
      hard: true,
      parameters: {
        coinDefinitionCount: [...definitions.values()].filter(
          (definition) => definition.components.coinDenominations.length > 0
        ).length
      }
    },
    {
      code: 'role_magic_consistency',
      passed: input.treasures.every((treasure) =>
        treasure.items.every(
          (item) =>
            (item.role === 'magic') ===
            Boolean(
              definitions.get(itemReferenceKey(item.itemReference))?.magic
            )
        )
      ),
      hard: true,
      parameters: {}
    },
    {
      code: 'stock_class_policy',
      passed:
        input.profile !== 'group_reward' ||
        input.treasures.every((treasure) => treasure.stockClass === 'normal'),
      hard: true,
      parameters: {
        overstockCount: input.treasures.filter(
          (treasure) => treasure.stockClass === 'overstock'
        ).length
      }
    }
  ]
  return freezeStage({ normalValueCp, overstockValueCp, magicCount, audits })
}

function definitionLineValue(
  definitions: ReadonlyMap<string, ItemDefinition>,
  item: GeneratedTreasure['items'][number]
): number {
  const definition = definitions.get(itemReferenceKey(item.itemReference))
  return definition ? itemDefinitionLineValueCp(definition, item.quantity) : 0
}

function packingAssignmentValid(
  item: GeneratedTreasure['items'][number],
  treasure: GeneratedTreasure,
  definitions: ReadonlyMap<string, ItemDefinition>,
  input: RewardAggregationInput
): boolean {
  const definition = definitions.get(itemReferenceKey(item.itemReference))
  if (!definition) return false
  const catalogContainerId = item.containerId
    ? (treasure.containers.find(
        (candidate) => candidate.id === item.containerId
      )?.catalogContainerId ?? null)
    : null
  if (item.containerId !== null && catalogContainerId === null) return false
  const rules = input.rules ?? defaultGeneratorLootRules
  if (definition.components.coinDenominations.length > 0) {
    const profile = Object.entries(rules.coins.profiles).find(
      ([profileId]) => profileId === definition.components.coinProfileId
    )?.[1]
    if (!profile) return false
    return evaluatePacking(
      {
        capacity: definition.unitCapacity * item.quantity,
        quantity: item.quantity,
        allowedContainerIds: profile.allowedContainerIds,
        placement: null,
        unitKind: 'count'
      },
      catalogContainerId,
      rules
    ).valid
  }
  const source = definition.components.baseItemId
    ? input.catalogIndex.itemsById.get(definition.components.baseItemId)
    : null
  if (!source)
    return evaluatePacking(
      {
        capacity: definition.unitCapacity * item.quantity,
        quantity: item.quantity,
        allowedContainerIds: [],
        placement: null,
        unitKind: 'count'
      },
      catalogContainerId,
      rules
    ).valid
  return evaluatePacking(
    {
      capacity: definition.unitCapacity * item.quantity,
      quantity: item.quantity,
      allowedContainerIds: source.allowedContainerIds,
      placement: source.placement,
      unitKind: source.unitKind
    },
    catalogContainerId,
    rules
  ).valid
}
