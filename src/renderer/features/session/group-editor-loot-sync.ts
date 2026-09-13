import type { Treasure } from '../../../shared/contracts/loot.js'
import {
  allEditorLoot,
  editorLootFromTreasure,
  emptyEditorLoot
} from './group-editor-loot.js'
import type {
  GroupDraftSession,
  GroupManagerLootState
} from './group-editor-types.js'
import { groupLootDraftSignature } from '../loot/group-loot-draft.js'
function groupManagerLootDirty(loot: GroupManagerLootState) {
  return Boolean(
    loot.history &&
    groupLootDraftSignature(loot.history.draft) !== loot.committedSignature
  )
}

export function synchronizeEditorLoot(
  session: GroupDraftSession,
  treasures: readonly Treasure[]
): GroupDraftSession {
  const cache = { ...allEditorLoot(session) }
  let conflict = session.externalConflict
  for (const [key, loot] of Object.entries(cache)) {
    if (!loot.persisted) continue
    const fresh = treasures.find((t) => t.id === loot.persisted?.id)
    if (!fresh || fresh.revision !== loot.persisted.revision) {
      if (groupManagerLootDirty(loot)) conflict = true
      else if (fresh) cache[key] = editorLootFromTreasure(fresh)
      else delete cache[key]
    }
  }
  for (const treasure of treasures)
    if (!Object.values(cache).some((l) => l.persisted?.id === treasure.id))
      cache[treasure.id] = editorLootFromTreasure(treasure)
  let selection = session.lootSelection ?? 'new'
  if (
    !session.lootLoaded &&
    selection === 'new' &&
    !groupManagerLootDirty(session.loot) &&
    treasures[0]
  )
    selection = treasures[0].id
  if (!cache[selection]) selection = Object.keys(cache)[0] ?? 'new'
  const loot = cache[selection] ?? emptyEditorLoot()
  return {
    ...session,
    lootLoaded: true,
    lootSelection: selection,
    lootCache: cache,
    loot,
    externalConflict: conflict
  }
}
export function editorBudgetSeed(key: string): number {
  let value = 2166136261
  for (const character of key)
    value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0
  return value
}
