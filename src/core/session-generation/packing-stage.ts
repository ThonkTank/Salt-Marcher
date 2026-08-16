import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { EncounterEntropy } from './deterministic-order.js'
import { packingStream } from './entropy-streams.js'
import type {
  FullSessionGenerationCatalog,
  LootContainer
} from './loot-catalog.js'
import {
  freezeStage,
  type SelectedTreasureDraft
} from './reward-stage-types.js'

export type PackingStageInput = Readonly<{
  seed: number
  treasures: readonly SelectedTreasureDraft[]
  catalog: FullSessionGenerationCatalog
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: item and magic selection are complete. Postconditions: item
 * and container positions are contiguous, every assignment resolves inside
 * its Treasure, and no input draft is mutated.
 */
export function packTreasures(
  input: PackingStageInput,
  entropy: EncounterEntropy
): readonly GeneratedTreasure[] {
  return freezeStage(
    input.treasures.map((draft) =>
      packTreasure(
        draft,
        input.seed,
        input.catalog,
        input.rules ?? defaultGeneratorLootRules,
        entropy
      )
    )
  )
}

function packTreasure(
  draft: SelectedTreasureDraft,
  seed: number,
  catalog: FullSessionGenerationCatalog,
  rules: GeneratorLootRules,
  entropy: EncounterEntropy
): GeneratedTreasure {
  const containers: Array<
    GeneratedTreasure['containers'][number] & {
      remaining: number
      mixable: boolean
    }
  > = []
  const items = draft.items.map((item, index) => {
    const source = item.definition.components.baseItemId
      ? catalog.items.find(
          (candidate) => candidate.id === item.definition.components.baseItemId
        )
      : null
    const syntheticAllowed =
      item.definition.components.coinDenominations.length > 0
        ? [
            ...new Set(
              Object.values(rules.coins.profiles).flatMap(
                (profile) => profile.allowedContainers
              )
            )
          ]
        : []
    const container = chooseContainer(
      item.definition.unitCapacity * item.quantity,
      item.quantity,
      source?.allowedContainerNames ?? syntheticAllowed,
      containers,
      seed,
      `${draft.id}:${index}`,
      catalog.containers,
      rules,
      entropy
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
    (sum, item) => sum + item.definition.unitValueCp * item.quantity,
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
  capacity: number,
  quantity: number,
  allowedNames: readonly string[],
  existing: Array<
    GeneratedTreasure['containers'][number] & {
      remaining: number
      mixable: boolean
    }
  >,
  seed: number,
  key: string,
  catalog: readonly LootContainer[],
  rules: GeneratorLootRules,
  entropy: EncounterEntropy
) {
  if (capacity <= 0) return null
  const reusable = existing.find(
    (container) => container.mixable && container.remaining >= capacity
  )
  if (reusable) {
    reusable.remaining -= capacity
    return reusable
  }
  const allowed = catalog.filter(
    (container) =>
      (allowedNames.includes(container.name) ||
        (quantity >= rules.packing.pileMinQty && container.name === 'Pile')) &&
      (!container.hidden || capacity <= container.capacity)
  )
  if (
    allowed.length === 0 &&
    quantity <= rules.packing.loosePlacementMaxQty &&
    capacity <= rules.packing.contextBulkMinLb
  )
    return null
  const pool =
    allowed.length > 0
      ? allowed
      : catalog.filter((entry) => entry.name === 'Pile')
  const candidates = pool.map((container) => ({
    container,
    count: Math.max(1, Math.ceil(capacity / Math.max(1, container.capacity))),
    fill:
      capacity /
      (Math.max(1, Math.ceil(capacity / Math.max(1, container.capacity))) *
        Math.max(1, container.capacity)),
    tie: entropy.unit(packingStream(seed, key, container.id))
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
  if (selected.container.hidden) return null
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
