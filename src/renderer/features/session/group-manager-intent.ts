import type { Creature } from '../../../shared/contracts/encounter.js'

export type GroupManagerIntent =
  | { kind: 'close' }
  | { kind: 'add-creature'; creature: Creature }
  | {
      kind: 'change-quantity'
      creatureId: string
      delta: number
      quantityKind: 'alive' | 'dead'
    }
  | { kind: 'remove-creature'; creatureId: string }
  | { kind: 'roster-history'; direction: 'undo-roster' | 'redo-roster' }
  | { kind: 'generate-roster'; mode: 'fill' | 'replace' }
  | { kind: 'regenerate-loot'; mode: 'retry' | 'reroll' }
  | { kind: 'save' }
  | { kind: 'archive' }
  | { kind: 'join-combat' }

export type GroupManagerGuard = 'close' | 'current-loot' | 'all-loot'

export type PendingGroupManagerIntent = Readonly<{
  intent: GroupManagerIntent
  guard: GroupManagerGuard
}>

export type GroupManagerDirtyState = Readonly<{
  anyGroup: boolean
  currentLoot: boolean
  anyLoot: boolean
}>

export function groupManagerIntentNeedsConfirmation(
  guard: GroupManagerGuard,
  dirty: GroupManagerDirtyState
): boolean {
  if (guard === 'close') return dirty.anyGroup || dirty.anyLoot
  if (guard === 'all-loot') return dirty.anyLoot
  return dirty.currentLoot
}
