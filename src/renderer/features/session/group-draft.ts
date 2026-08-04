import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  SceneGroupDisposition,
  SceneGroupDraftEvaluation
} from '../../../shared/contracts/scene.js'

export const newGroupDraftKey = 'new'

export type DraftCreatureFact = {
  displayName: string
  cr: number
  xp: number
  available: boolean
}

export type GroupDraftState = {
  name: string
  note: string
  disposition: SceneGroupDisposition
  quantities: Record<string, number>
  facts: Record<string, DraftCreatureFact>
  baseline: string
  evaluation: SceneGroupDraftEvaluation | null
  seed: number
  message: string
}

export type GroupDraftAction =
  { kind: 'close' } | { kind: 'select'; selection: string | null }

export function creatureFact(creature: Creature): DraftCreatureFact {
  return {
    displayName: creature.name,
    cr: creature.cr,
    xp: creature.xp,
    available: true
  }
}

export function groupDraftEntries(quantities: Record<string, number>) {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([creatureId, quantity]) => ({ creatureId, quantity }))
    .sort((a, b) => a.creatureId.localeCompare(b.creatureId))
}

export function groupDraftSignature(
  name: string,
  note: string,
  disposition: SceneGroupDisposition,
  quantities: Record<string, number>
): string {
  return JSON.stringify({
    name,
    note,
    disposition,
    entries: groupDraftEntries(quantities)
  })
}
