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

export type GroupManagerGuard = 'current-loot' | 'all-drafts'

export type PendingGroupManagerIntent = Readonly<{
  intent: GroupManagerIntent
  guard: GroupManagerGuard
}>

export type GroupManagerDirtyState = Readonly<{
  anyDraft: boolean
  currentLoot: boolean
}>

export function groupManagerIntentNeedsConfirmation(
  guard: GroupManagerGuard,
  dirty: GroupManagerDirtyState
): boolean {
  if (guard === 'all-drafts') return dirty.anyDraft
  return dirty.currentLoot
}

export function groupManagerIntentGuard(
  intent: GroupManagerIntent
): GroupManagerGuard {
  switch (intent.kind) {
    case 'close':
    case 'save':
    case 'archive':
    case 'join-combat':
      return 'all-drafts'
    case 'add-creature':
    case 'change-quantity':
    case 'remove-creature':
    case 'roster-history':
    case 'generate-roster':
    case 'regenerate-loot':
      return 'current-loot'
  }
}
