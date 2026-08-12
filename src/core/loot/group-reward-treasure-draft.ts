import type {
  GroupRewardTreasureDraft,
  LootRarity
} from '../../shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { FullSessionGenerationCatalog } from '../session-generation/loot-catalog.js'

export type MaterializedGroupRewardContainer = Readonly<{
  draftId: string
  catalogContainerId: string | null
  name: string
  capacity: number
}>

export type MaterializedGroupRewardItem = Readonly<{
  draftId: string
  sourceLineId: string | null
  catalogItemId: string | null
  name: string
  quantity: number
  unitValueCp: number
  stackable: boolean
  magic: boolean
  rarity: LootRarity | null
  curseName: string | null
  containerDraftId: string | null
}>

export type MaterializedGroupRewardTreasureDraft = Readonly<{
  label: string
  containers: readonly MaterializedGroupRewardContainer[]
  items: readonly MaterializedGroupRewardItem[]
}>

export function materializeGroupRewardTreasureDraft(
  generated: GeneratedTreasure,
  draft: GroupRewardTreasureDraft,
  catalog: FullSessionGenerationCatalog | null,
  catalogContentHash: string
): MaterializedGroupRewardTreasureDraft {
  const needsCatalog =
    draft.items.some((item) => item.origin.kind === 'catalog') ||
    draft.containers.some((container) => container.origin.kind === 'catalog')
  if (needsCatalog) {
    if (!catalog) invalid()
    if (catalog.encounter.catalogContentHash !== catalogContentHash)
      throw new CapabilityError('stale', true)
  }

  const generatedContainers = new Map(
    generated.containers.map((container) => [container.id, container])
  )
  const generatedItems = new Map(generated.items.map((item) => [item.id, item]))
  const usedGeneratedContainers = new Set<string>()
  const usedGeneratedItems = new Set<string>()

  const containers = draft.containers.map((container) => {
    const origin = container.origin
    if (origin.kind === 'generator') {
      const source = generatedContainers.get(origin.sourceContainerId)
      if (!source || usedGeneratedContainers.has(origin.sourceContainerId))
        invalid()
      usedGeneratedContainers.add(origin.sourceContainerId)
      return {
        draftId: container.id,
        catalogContainerId: source.catalogContainerId,
        name: container.name.trim(),
        capacity: container.capacity
      }
    }
    const source = catalog?.containers.find(
      (candidate) =>
        candidate.id === origin.catalogContainerId && !candidate.hidden
    )
    if (!source) invalid()
    return {
      draftId: container.id,
      catalogContainerId: source.id,
      name: container.name.trim(),
      capacity: container.capacity
    }
  })

  const items = draft.items.map((item) => {
    const origin = item.origin
    if (origin.kind === 'generator') {
      const source = generatedItems.get(origin.sourceLineId)
      if (!source || usedGeneratedItems.has(origin.sourceLineId)) invalid()
      usedGeneratedItems.add(origin.sourceLineId)
      return {
        draftId: item.id,
        sourceLineId: source.id,
        catalogItemId: source.catalogItemId,
        name: item.name.trim(),
        quantity: item.quantity,
        unitValueCp: item.unitValueCp,
        stackable: item.stackable,
        magic: source.magic,
        rarity: source.rarity,
        curseName: source.curseName,
        containerDraftId: item.containerId
      }
    }
    if (origin.entryKind === 'item') {
      const source = catalog?.items.find(
        (candidate) => candidate.id === origin.catalogId && candidate.active
      )
      if (!source) invalid()
      return {
        draftId: item.id,
        sourceLineId: null,
        catalogItemId: source.id,
        name: item.name.trim(),
        quantity: item.quantity,
        unitValueCp: item.unitValueCp,
        stackable: item.stackable,
        magic: false,
        rarity: null,
        curseName: null,
        containerDraftId: item.containerId
      }
    }
    const source = catalog?.magicItems.find(
      (candidate) => candidate.id === origin.catalogId && candidate.active
    )
    if (!source) invalid()
    return {
      draftId: item.id,
      sourceLineId: null,
      catalogItemId: source.id,
      name: item.name.trim(),
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
      magic: true,
      rarity: source.rarity,
      curseName: null,
      containerDraftId: item.containerId
    }
  })

  return Object.freeze({
    label: draft.label.trim(),
    containers: Object.freeze(containers.map((entry) => Object.freeze(entry))),
    items: Object.freeze(items.map((entry) => Object.freeze(entry)))
  })
}

function invalid(): never {
  throw new CapabilityError('validation_failed', false)
}
