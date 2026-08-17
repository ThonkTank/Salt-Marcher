import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import { itemDefinitionLineValueCp } from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { RewardRandom } from './reward-random.js'
import type { GenerationCatalogIndex } from './generation-catalog-index.js'
import {
  evaluatePacking,
  packingAllowedContainerIds,
  type PackingPolicyInput
} from './packing-policy.js'
import type { LootContainer } from './loot-catalog.js'
import {
  freezeStage,
  type SelectedTreasureDraft
} from './reward-stage-types.js'

export type PackingStageInput = Readonly<{
  treasures: readonly SelectedTreasureDraft[]
  catalogIndex: GenerationCatalogIndex
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: item and magic selection are complete. Postconditions: item
 * and container positions are contiguous, every assignment resolves inside
 * its Treasure, and no input draft is mutated.
 */
export function packTreasures(
  input: PackingStageInput,
  random: RewardRandom
): readonly GeneratedTreasure[] {
  return freezeStage(
    input.treasures.map((draft) =>
      packTreasure(
        draft,
        input.catalogIndex,
        input.rules ?? defaultGeneratorLootRules,
        random
      )
    )
  )
}

function packTreasure(
  draft: SelectedTreasureDraft,
  catalogIndex: GenerationCatalogIndex,
  rules: GeneratorLootRules,
  random: RewardRandom
): GeneratedTreasure {
  const containers: Array<
    GeneratedTreasure['containers'][number] & {
      remaining: number
      mixable: boolean
    }
  > = []
  const items = draft.items.map((item, index) => {
    const source = item.definition.components.baseItemId
      ? catalogIndex.itemsById.get(item.definition.components.baseItemId)
      : null
    const coinProfileId = item.definition.components.coinProfileId
    const syntheticAllowed =
      item.definition.components.coinDenominations.length > 0 && coinProfileId
        ? (Object.entries(rules.coins.profiles).find(
            ([profileId]) => profileId === coinProfileId
          )?.[1].allowedContainerIds ?? [])
        : []
    const container = chooseContainer(
      {
        capacity: item.definition.unitCapacity * item.quantity,
        quantity: item.quantity,
        allowedContainerIds: source?.allowedContainerIds ?? syntheticAllowed,
        placement: source?.placement ?? null,
        unitKind: source?.unitKind ?? 'count'
      },
      containers,
      `${draft.id}:${index}`,
      catalogIndex.catalog.containers,
      rules,
      random
    )
    return {
      id: item.id,
      treasureId: item.treasureId,
      itemReference: item.itemReference,
      role: item.role,
      quantity: item.quantity,
      containerId: container?.id ?? null,
      position: index
    }
  })
  const publicContainers = containers.map((container) => ({
    id: container.id,
    catalogContainerId: container.catalogContainerId,
    name: container.name,
    capacity: container.capacity,
    position: container.position
  }))
  const actualValueCp = draft.items.reduce(
    (sum, item) =>
      sum + itemDefinitionLineValueCp(item.definition, item.quantity),
    0
  )
  return {
    id: draft.id,
    stockClass: draft.stockClass,
    rewardChannel: draft.rewardChannel,
    anchorEncounterNumber: draft.anchorEncounterNumber,
    themeId: draft.theme.id,
    theme: draft.theme.name,
    targetValueCp: String(draft.targetValueCp),
    actualValueCp,
    items,
    containers: publicContainers
  }
}

function chooseContainer(
  policyInput: PackingPolicyInput,
  existing: Array<
    GeneratedTreasure['containers'][number] & {
      remaining: number
      mixable: boolean
    }
  >,
  key: string,
  catalog: readonly LootContainer[],
  rules: GeneratorLootRules,
  random: RewardRandom
) {
  const capacity = policyInput.capacity
  if (capacity <= 0) return null
  const allowedIds = packingAllowedContainerIds(policyInput, rules)
  const reusable = existing.find(
    (container) =>
      container.mixable &&
      container.catalogContainerId !== null &&
      allowedIds.has(container.catalogContainerId) &&
      container.remaining >= capacity
  )
  if (reusable) {
    reusable.remaining -= capacity
    return reusable
  }
  if (evaluatePacking(policyInput, null, rules).valid) return null
  const allowed = catalog.filter(
    (container) => allowedIds.has(container.id) && !container.hidden
  )
  if (allowed.length === 0) return null
  const pool = allowed
  const candidates = pool.map((container) => ({
    container,
    count: Math.max(1, Math.ceil(capacity / Math.max(1, container.capacity))),
    fill:
      capacity /
      (Math.max(1, Math.ceil(capacity / Math.max(1, container.capacity))) *
        Math.max(1, container.capacity)),
    tie: random.unit(`container:${key}`, container.id)
  }))
  const bestCount = Math.min(...candidates.map((candidate) => candidate.count))
  const selected = candidates.toSorted(
    (left, right) =>
      Number(left.count > bestCount * rules.packing.containerMaxCountFactor) -
        Number(
          right.count > bestCount * rules.packing.containerMaxCountFactor
        ) ||
      Number(left.fill < rules.packing.minimumFillRatio) -
        Number(right.fill < rules.packing.minimumFillRatio) ||
      left.count - right.count ||
      left.container.priority - right.container.priority ||
      left.tie - right.tie
  )[0]
  if (!selected) return null
  const container = {
    id: `${key}:container`,
    catalogContainerId: selected.container.id,
    name:
      selected.count > 1
        ? `${String(selected.count)} ${selected.container.outputPlural}`
        : selected.container.outputSingular,
    capacity: selected.container.capacity * selected.count,
    position: existing.length,
    remaining: selected.container.capacity * selected.count - capacity,
    mixable: selected.container.mixable
  }
  existing.push(container)
  return container
}
