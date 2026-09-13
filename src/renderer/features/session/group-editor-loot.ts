import type {
  GroupEditorTreasure,
  LootCatalogEntry,
  Treasure
} from '../../../shared/contracts/loot.js'
import { itemReferenceKey } from '../../../shared/values/item-definition-values.js'
import {
  createGroupLootDraftHistory,
  groupLootDraftSignature,
  type GroupLootDraft,
  type GroupLootDraftCommand,
  type GroupLootDraftItem
} from '../loot/group-loot-draft.js'
import type {
  GroupDraftSession,
  GroupManagerLootState
} from './group-editor-types.js'

export function emptyEditorLoot(): GroupManagerLootState {
  const history = createGroupLootDraftHistory({
    label: 'Loot',
    items: [],
    containers: []
  })
  return {
    run: null,
    history,
    committedSignature: groupLootDraftSignature(history.draft),
    seed: null,
    phase: 'ready',
    error: '',
    issues: [],
    persisted: null
  }
}
export function editorLootFromTreasure(t: Treasure): GroupManagerLootState {
  const draft: GroupLootDraft = {
    label: t.label,
    items: t.items.map((i) => ({
      coin: i.definition.components.coinDenominations.length > 0,
      draftId: i.id,
      persistedId: i.id,
      allocatedQuantity: i.allocatedQuantity,
      origin: {
        kind: 'catalog',
        entryKind: i.definition.magic ? 'magic_item' : 'item',
        catalogId: i.id
      },
      sourceLineId:
        i.provenance.kind === 'generator' ? i.provenance.sourceLineId : null,
      itemReference: i.itemReference,
      name: i.definition.name,
      quantity: i.quantity,
      unitValueCp: i.definition.unitValueCp,
      stackable: i.definition.stackable,
      containerId: i.containerId,
      magic: i.definition.magic,
      rarity: i.definition.rarity,
      curseName: i.definition.curse?.name ?? null,
      defaultName: i.definition.name,
      defaultUnitValueCp: i.definition.unitValueCp,
      defaultStackable: i.definition.stackable
    })),
    containers: t.containers.map((c) => ({
      draftId: c.id,
      catalogContainerId:
        c.provenance.kind === 'manual' ? null : c.provenance.catalogContainerId,
      name: c.name,
      capacity: c.capacity,
      origin: {
        kind: 'catalog',
        catalogContainerId:
          c.provenance.kind === 'manual'
            ? ''
            : (c.provenance.catalogContainerId ?? '')
      }
    }))
  }
  return {
    ...emptyEditorLoot(),
    history: createGroupLootDraftHistory(draft),
    committedSignature: groupLootDraftSignature(draft),
    persisted: t
  }
}
/** Rerolls replace only undistributed contents; allocations retain their instances. */
export function preserveAllocatedEditorLoot(
  loot: GroupManagerLootState,
  generated: GroupLootDraft
): GroupLootDraft {
  if (!loot.persisted) return generated
  const previous = editorLootFromTreasure(loot.persisted).history!.draft
  const protectedItems = previous.items
    .filter((i) => (i.allocatedQuantity ?? 0) > 0)
    .map((i) => ({ ...i, quantity: i.allocatedQuantity! }))
  const containers = previous.containers.filter((c) =>
    protectedItems.some((i) => i.containerId === c.draftId)
  )
  return {
    ...generated,
    items: [...protectedItems, ...generated.items],
    containers: [...containers, ...generated.containers]
  }
}
export function allEditorLoot(
  session: GroupDraftSession
): Readonly<Record<string, GroupManagerLootState>> {
  return {
    ...session.lootCache,
    [session.lootSelection ?? 'new']: session.loot
  }
}
export function editorLootPayload(
  key: string,
  loot: GroupManagerLootState
): GroupEditorTreasure | null {
  const d = loot.history?.draft
  if (!d) return null
  return {
    key,
    treasureId: loot.persisted?.id ?? null,
    expectedRevision: loot.persisted?.revision ?? null,
    label: d.label || 'Loot',
    generation: loot.run?.treasures[0]
      ? { runId: loot.run.id, treasureId: loot.run.treasures[0].id }
      : null,
    containers: d.containers.map((c) => ({
      id: c.draftId,
      sourceContainerId:
        c.origin.kind === 'generator' ? c.origin.sourceContainerId : null,
      catalogContainerId: c.catalogContainerId ?? null,
      name: c.name,
      capacity: c.capacity
    })),
    items: d.items.map((i) => ({
      ...(i.persistedId ? { id: i.persistedId } : {}),
      itemReference: i.itemReference,
      sourceLineId: i.sourceLineId,
      quantity: i.quantity,
      containerId: i.containerId
    }))
  }
}
export function editorLootChanges(session: GroupDraftSession) {
  return Object.entries(allEditorLoot(session)).flatMap(([key, loot]) => {
    const value = editorLootPayload(key, loot)
    return value &&
      loot.history &&
      groupLootDraftSignature(loot.history.draft) !== loot.committedSignature
      ? [value]
      : []
  })
}
export function addEditorCatalogEntry(
  entry: LootCatalogEntry,
  draft: GroupLootDraft
): GroupLootDraftCommand {
  if (entry.kind === 'container')
    return {
      kind: 'add-container',
      container: {
        draftId: crypto.randomUUID(),
        catalogContainerId: entry.id,
        origin: { kind: 'catalog', catalogContainerId: entry.id },
        name: entry.defaultName,
        capacity: entry.capacity
      }
    }
  const existing = entry.stackable
    ? draft.items.find(
        (i) =>
          i.containerId === null &&
          itemReferenceKey(i.itemReference) ===
            itemReferenceKey(entry.itemReference)
      )
    : null
  if (existing)
    return {
      kind: 'patch-item',
      id: existing.draftId,
      patch: { quantity: existing.quantity + 1 }
    }
  const d = entry.definition
  const item: GroupLootDraftItem = {
    coin: d.components.coinDenominations.length > 0,
    draftId: crypto.randomUUID(),
    origin: { kind: 'catalog', entryKind: entry.kind, catalogId: entry.id },
    sourceLineId: null,
    itemReference: entry.itemReference,
    name: d.name,
    quantity: 1,
    unitValueCp: d.unitValueCp,
    stackable: d.stackable,
    containerId: null,
    magic: d.magic,
    rarity: d.rarity,
    curseName: d.curse?.name ?? null,
    defaultName: d.name,
    defaultUnitValueCp: d.unitValueCp,
    defaultStackable: d.stackable
  }
  return { kind: 'add-item', item }
}
