import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  Treasure,
  TreasureContainerDraft,
  TreasureItemDraft,
  ParsedUpdateTreasureInput
} from '../../shared/contracts/loot.js'
import { itemReferenceKey } from '../../shared/contracts/loot.js'

export type PositionedItemDraft = Readonly<{
  draft: TreasureItemDraft
  position: number
}>

export type PositionedContainerDraft = Readonly<{
  draft: TreasureContainerDraft
  position: number
}>

export type TreasureAggregateDiff = Readonly<{
  retained: readonly PositionedItemDraft[]
  inserted: readonly PositionedItemDraft[]
  updated: readonly PositionedItemDraft[]
  deleted: readonly string[]
  retainedContainers: readonly PositionedContainerDraft[]
  insertedContainers: readonly PositionedContainerDraft[]
  updatedContainers: readonly PositionedContainerDraft[]
  deletedContainers: readonly string[]
  containerReassignments: readonly Readonly<{
    itemId: string
    fromContainerId: string | null
    toContainerId: string | null
  }>[]
}>

/**
 * Builds and validates the complete child diff before SQL is touched. Existing
 * allocated quantities cannot disappear or shrink; every item-container edge
 * must resolve in the proposed aggregate.
 */
export function buildTreasureAggregateDiff(
  current: Treasure,
  input: Pick<ParsedUpdateTreasureInput, 'items' | 'containers'>
): TreasureAggregateDiff {
  assertUnique(input.items.flatMap((item) => (item.id ? [item.id] : [])))
  assertUnique(input.containers.map((container) => container.id))
  const proposedContainerIds = new Set(
    input.containers.map((container) => container.id)
  )
  if (
    input.items.some(
      (item) => item.containerId && !proposedContainerIds.has(item.containerId)
    )
  )
    invalid()

  const currentItems = new Map(current.items.map((item) => [item.id, item]))
  const currentContainers = new Map(
    current.containers.map((container) => [container.id, container])
  )
  const retained: PositionedItemDraft[] = []
  const inserted: PositionedItemDraft[] = []
  const updated: PositionedItemDraft[] = []
  const containerReassignments: Array<{
    itemId: string
    fromContainerId: string | null
    toContainerId: string | null
  }> = []
  for (const [position, draft] of input.items.entries()) {
    if (!draft.id) {
      inserted.push({ draft, position })
      continue
    }
    const existing = currentItems.get(draft.id)
    if (!existing) invalid()
    if (draft.quantity < existing.allocatedQuantity) invalid()
    const same =
      itemReferenceKey(draft.itemReference) ===
        itemReferenceKey(existing.itemReference) &&
      draft.quantity === existing.quantity &&
      draft.containerId === existing.containerId &&
      position === existing.position
    ;(same ? retained : updated).push({ draft, position })
    if (draft.containerId !== existing.containerId)
      containerReassignments.push({
        itemId: existing.id,
        fromContainerId: existing.containerId,
        toContainerId: draft.containerId
      })
  }
  const proposedItemIds = new Set(
    input.items.flatMap((item) => (item.id ? [item.id] : []))
  )
  const deleted = current.items
    .filter((item) => !proposedItemIds.has(item.id))
    .map((item) => {
      if (item.allocatedQuantity > 0) invalid()
      return item.id
    })

  const retainedContainers: PositionedContainerDraft[] = []
  const insertedContainers: PositionedContainerDraft[] = []
  const updatedContainers: PositionedContainerDraft[] = []
  for (const [position, draft] of input.containers.entries()) {
    const existing = currentContainers.get(draft.id)
    if (!existing) insertedContainers.push({ draft, position })
    else {
      const same =
        draft.catalogContainerId === catalogContainerId(existing) &&
        draft.name.trim() === existing.name &&
        draft.capacity === existing.capacity &&
        position === existing.position
      ;(same ? retainedContainers : updatedContainers).push({ draft, position })
    }
  }
  const deletedContainers = current.containers
    .filter((container) => !proposedContainerIds.has(container.id))
    .map((container) => container.id)

  return deepFreeze({
    retained,
    inserted,
    updated,
    deleted,
    retainedContainers,
    insertedContainers,
    updatedContainers,
    deletedContainers,
    containerReassignments
  })
}

function catalogContainerId(
  container: Treasure['containers'][number]
): string | null {
  return container.provenance.kind === 'manual'
    ? null
    : container.provenance.catalogContainerId
}

function assertUnique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) invalid()
}

function invalid(): never {
  throw new CapabilityError('validation_failed', false)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
