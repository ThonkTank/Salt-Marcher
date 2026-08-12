import type {
  TreasureContainerProvenance,
  TreasureItemProvenance
} from '../../shared/contracts/loot.js'

export function treasureContainerProvenance(
  sourceContainerId: string | null,
  catalogContainerId: string | null
): TreasureContainerProvenance {
  if (sourceContainerId)
    return {
      kind: 'generator',
      sourceContainerId,
      catalogContainerId
    }
  return catalogContainerId
    ? { kind: 'catalog', catalogContainerId }
    : { kind: 'manual' }
}

export function treasureItemProvenance(
  sourceLineId: string | null,
  catalogEntryKind: 'item' | 'magic_item' | null,
  catalogItemId: string | null
): TreasureItemProvenance {
  const catalogEntry =
    catalogEntryKind && catalogItemId
      ? { kind: catalogEntryKind, id: catalogItemId }
      : null
  if (sourceLineId) return { kind: 'generator', sourceLineId, catalogEntry }
  return catalogEntry ? { kind: 'catalog', catalogEntry } : { kind: 'manual' }
}
