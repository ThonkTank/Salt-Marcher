import type {
  GroupRewardTreasureDraft,
  LootRarity
} from '../../shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  CapabilityIssue,
  CapabilityIssueCode
} from '../../shared/errors/capability-issue.js'
import type { LootCatalogIndex } from './loot-catalog-index.js'

export type MaterializedGroupRewardContainer = Readonly<{
  draftId: string
  sourceContainerId: string | null
  catalogContainerId: string | null
  name: string
  capacity: number
}>

export type MaterializedGroupRewardItem = Readonly<{
  draftId: string
  sourceLineId: string | null
  catalogEntryKind: 'item' | 'magic_item' | null
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
  catalog: LootCatalogIndex | null
): MaterializedGroupRewardTreasureDraft {
  validateDraftIdentities(draft)
  const generatedContainers = new Map(
    generated.containers.map((container) => [container.id, container])
  )
  const generatedItems = new Map(generated.items.map((item) => [item.id, item]))
  const usedGeneratedContainers = new Set<string>()
  const usedGeneratedItems = new Set<string>()

  const containers = draft.containers.map((container) => {
    const path = ['containers', container.id, 'origin'] as const
    const origin = container.origin
    if (origin.kind === 'generator') {
      const source = generatedContainers.get(origin.sourceContainerId)
      if (!source)
        invalid('generator_container_unknown', path, {
          sourceContainerId: origin.sourceContainerId
        })
      if (usedGeneratedContainers.has(origin.sourceContainerId))
        invalid('generator_container_duplicate', path, {
          sourceContainerId: origin.sourceContainerId
        })
      usedGeneratedContainers.add(origin.sourceContainerId)
      return {
        draftId: container.id,
        sourceContainerId: source.id,
        catalogContainerId: source.catalogContainerId,
        name: container.name.trim(),
        capacity: container.capacity
      }
    }
    if (!catalog)
      throw new Error('Catalog index is required for catalog origins')
    const source = catalog.containers.get(origin.catalogContainerId)
    if (!source)
      invalid('catalog_container_unknown', path, {
        catalogContainerId: origin.catalogContainerId
      })
    if (source.hidden)
      invalid('catalog_container_hidden', path, {
        catalogContainerId: origin.catalogContainerId
      })
    return {
      draftId: container.id,
      sourceContainerId: null,
      catalogContainerId: source.id,
      name: container.name.trim(),
      capacity: container.capacity
    }
  })

  const containerDraftIds = new Set(
    containers.map((container) => container.draftId)
  )
  const items = draft.items.map((item) => {
    if (item.containerId && !containerDraftIds.has(item.containerId))
      invalid(
        'container_assignment_unknown',
        ['items', item.id, 'containerId'],
        { containerId: item.containerId }
      )
    const path = ['items', item.id, 'origin'] as const
    const origin = item.origin
    if (origin.kind === 'generator') {
      const source = generatedItems.get(origin.sourceLineId)
      if (!source)
        invalid('generator_item_unknown', path, {
          sourceLineId: origin.sourceLineId
        })
      if (usedGeneratedItems.has(origin.sourceLineId))
        invalid('generator_item_duplicate', path, {
          sourceLineId: origin.sourceLineId
        })
      usedGeneratedItems.add(origin.sourceLineId)
      return materializedItem(item, {
        sourceLineId: source.id,
        catalogEntryKind: source.catalogItemId
          ? source.magic
            ? 'magic_item'
            : 'item'
          : null,
        catalogItemId: source.catalogItemId,
        magic: source.magic,
        rarity: source.rarity,
        curseName: source.curseName
      })
    }
    if (!catalog)
      throw new Error('Catalog index is required for catalog origins')
    if (origin.entryKind === 'item') {
      const source = catalog.items.get(origin.catalogId)
      if (!source) {
        if (catalog.magicItems.has(origin.catalogId))
          invalid('catalog_entry_kind_mismatch', path, {
            catalogId: origin.catalogId,
            expectedKind: 'item'
          })
        invalid('catalog_entry_unknown', path, { catalogId: origin.catalogId })
      }
      if (!source.active)
        invalid('catalog_entry_inactive', path, { catalogId: origin.catalogId })
      return materializedItem(item, {
        sourceLineId: null,
        catalogEntryKind: 'item',
        catalogItemId: source.id,
        magic: false,
        rarity: null,
        curseName: null
      })
    }
    const source = catalog.magicItems.get(origin.catalogId)
    if (!source) {
      if (catalog.items.has(origin.catalogId))
        invalid('catalog_entry_kind_mismatch', path, {
          catalogId: origin.catalogId,
          expectedKind: 'magic_item'
        })
      invalid('catalog_entry_unknown', path, { catalogId: origin.catalogId })
    }
    if (!source.active)
      invalid('catalog_entry_inactive', path, { catalogId: origin.catalogId })
    return materializedItem(item, {
      sourceLineId: null,
      catalogEntryKind: 'magic_item',
      catalogItemId: source.id,
      magic: true,
      rarity: source.rarity,
      curseName: null
    })
  })

  return deepFreeze({ label: draft.label.trim(), containers, items })
}

function materializedItem(
  item: GroupRewardTreasureDraft['items'][number],
  authority: Pick<
    MaterializedGroupRewardItem,
    | 'sourceLineId'
    | 'catalogEntryKind'
    | 'catalogItemId'
    | 'magic'
    | 'rarity'
    | 'curseName'
  >
): MaterializedGroupRewardItem {
  return {
    draftId: item.id,
    ...authority,
    name: item.name.trim(),
    quantity: item.quantity,
    unitValueCp: item.unitValueCp,
    stackable: item.stackable,
    containerDraftId: item.containerId
  }
}

function validateDraftIdentities(draft: GroupRewardTreasureDraft): void {
  const ids = new Set<string>()
  for (const [kind, entries] of [
    ['containers', draft.containers],
    ['items', draft.items]
  ] as const)
    for (const entry of entries) {
      if (ids.has(entry.id))
        invalid('duplicate_draft_id', [kind, entry.id, 'id'], {
          draftId: entry.id
        })
      ids.add(entry.id)
    }
}

function invalid(
  code: CapabilityIssueCode,
  path: CapabilityIssue['path'],
  parameters: CapabilityIssue['parameters']
): never {
  throw new CapabilityError('validation_failed', false, [
    { code, path, parameters }
  ])
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
