import type { ItemReference } from '../../shared/contracts/loot.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'

export type MaterializedTreasureContainer = Readonly<{
  draftId: string
  sourceContainerId: string | null
  catalogContainerId: string | null
  name: string
  capacity: number
}>

export type MaterializedTreasureItem = Readonly<{
  draftId: string
  sourceLineId: string | null
  itemReference: ItemReference
  quantity: number
  containerDraftId: string | null
}>

export type MaterializedTreasure = Readonly<{
  label: string
  containers: readonly MaterializedTreasureContainer[]
  items: readonly MaterializedTreasureItem[]
}>

export function materializeGeneratedTreasure(
  run: GeneratedRun,
  generated: GeneratedTreasure,
  label: string
): MaterializedTreasure {
  const definitionIds = new Set(
    run.itemDefinitions.flatMap((definition) =>
      definition.reference.kind === 'generated'
        ? [definition.reference.definitionId]
        : []
    )
  )
  for (const item of generated.items)
    if (
      item.itemReference.kind !== 'generated' ||
      item.itemReference.runId !== run.id ||
      !definitionIds.has(item.itemReference.definitionId)
    )
      throw new Error('Generated treasure item has no run-owned definition')
  return {
    label: label.trim(),
    containers: generated.containers.map((container) => ({
      draftId: container.id,
      sourceContainerId: container.id,
      catalogContainerId: container.catalogContainerId,
      name: container.name,
      capacity: container.capacity
    })),
    items: generated.items.map((item) => ({
      draftId: item.id,
      sourceLineId: item.id,
      itemReference: item.itemReference,
      quantity: item.quantity,
      containerDraftId: item.containerId
    }))
  }
}
