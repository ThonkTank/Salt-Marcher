import type { LootRarity } from '../../shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'

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

export type MaterializedTreasure = Readonly<{
  label: string
  containers: readonly MaterializedTreasureContainer[]
  items: readonly MaterializedTreasureItem[]
}>

export function materializeGeneratedTreasure(
  generated: GeneratedTreasure,
  label: string
): MaterializedTreasure {
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
      catalogEntryKind: item.catalogItemId
        ? item.magic
          ? 'magic_item'
          : 'item'
        : null,
      catalogItemId: item.catalogItemId,
      name: item.name,
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
      magic: item.magic,
      rarity: item.rarity,
      curseName: item.curseName,
      containerDraftId: item.containerId
    }))
  }
}
