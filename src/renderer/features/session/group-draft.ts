import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  SceneGroup,
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

export type GroupDraftRosterSnapshot = {
  quantities: Record<string, number>
  deadQuantities: Record<string, number>
}

export type GroupDraftHistory = {
  past: GroupDraftRosterSnapshot[]
  future: GroupDraftRosterSnapshot[]
}

export const emptyGroupDraftHistory = (): GroupDraftHistory => ({
  past: [],
  future: []
})

export type GroupDraftState = {
  name: string
  note: string
  disposition: SceneGroupDisposition
  quantities: Record<string, number>
  deadQuantities: Record<string, number>
  facts: Record<string, DraftCreatureFact>
  baseline: string
  evaluation: SceneGroupDraftEvaluation | null
  seed: number
  message: string
  generationSummary: string
  history: GroupDraftHistory
}

export type GroupDraftAction =
  { kind: 'close' } | { kind: 'select'; selection: string | null }

type DraftUpdate<T> = T | ((current: T) => T)

export type GroupDraftMutation =
  | { kind: 'replace'; state: GroupDraftState }
  | { kind: 'name'; update: DraftUpdate<string> }
  | { kind: 'note'; update: DraftUpdate<string> }
  | {
      kind: 'disposition'
      update: DraftUpdate<SceneGroupDisposition>
    }
  | { kind: 'quantities'; update: DraftUpdate<Record<string, number>> }
  | { kind: 'dead-quantities'; update: DraftUpdate<Record<string, number>> }
  | { kind: 'roster'; update: GroupDraftRosterSnapshot }
  | { kind: 'undo-roster' }
  | { kind: 'redo-roster' }
  | {
      kind: 'facts'
      update: DraftUpdate<Record<string, DraftCreatureFact>>
    }
  | { kind: 'baseline'; update: DraftUpdate<string> }
  | {
      kind: 'evaluation'
      update: DraftUpdate<SceneGroupDraftEvaluation | null>
    }
  | { kind: 'seed'; update: DraftUpdate<number> }
  | { kind: 'message'; update: DraftUpdate<string> }
  | { kind: 'generationSummary'; update: DraftUpdate<string> }

export function groupDraftReducer(
  state: GroupDraftState,
  action: GroupDraftMutation
): GroupDraftState {
  if (action.kind === 'replace') return action.state
  if (action.kind === 'roster')
    return {
      ...state,
      ...copyRoster(action.update),
      history: {
        past: [...state.history.past, rosterSnapshot(state)].slice(-20),
        future: []
      }
    }
  if (action.kind === 'undo-roster') {
    const previous = state.history.past.at(-1)
    if (!previous) return state
    return {
      ...state,
      ...copyRoster(previous),
      history: {
        past: state.history.past.slice(0, -1),
        future: [rosterSnapshot(state), ...state.history.future]
      }
    }
  }
  if (action.kind === 'redo-roster') {
    const next = state.history.future[0]
    if (!next) return state
    return {
      ...state,
      ...copyRoster(next),
      history: {
        past: [...state.history.past, rosterSnapshot(state)].slice(-20),
        future: state.history.future.slice(1)
      }
    }
  }
  const field =
    action.kind === 'dead-quantities' ? 'deadQuantities' : action.kind
  const current = state[field]
  const value =
    typeof action.update === 'function'
      ? (action.update as (value: typeof current) => typeof current)(current)
      : action.update
  return { ...state, [field]: value }
}

export function rosterSnapshot(
  state: Pick<GroupDraftState, 'quantities' | 'deadQuantities'>
): GroupDraftRosterSnapshot {
  return copyRoster(state)
}

function copyRoster(
  snapshot: GroupDraftRosterSnapshot
): GroupDraftRosterSnapshot {
  return {
    quantities: { ...snapshot.quantities },
    deadQuantities: { ...snapshot.deadQuantities }
  }
}

export function creatureFact(creature: Creature): DraftCreatureFact {
  return {
    displayName: creature.name,
    cr: creature.cr,
    xp: creature.xp,
    available: true
  }
}

export function groupDraftEntries(
  quantities: Record<string, number>,
  deadQuantities: Record<string, number> = {}
) {
  return Array.from(
    new Set([...Object.keys(quantities), ...Object.keys(deadQuantities)])
  )
    .map((creatureId) => ({
      creatureId,
      quantity: quantities[creatureId] ?? 0,
      deadQuantity: deadQuantities[creatureId] ?? 0
    }))
    .filter((entry) => entry.quantity + entry.deadQuantity > 0)
    .sort((a, b) => a.creatureId.localeCompare(b.creatureId))
}

export function groupDraftSignature(
  name: string,
  note: string,
  disposition: SceneGroupDisposition,
  quantities: Record<string, number>,
  deadQuantities: Record<string, number> = {}
): string {
  return JSON.stringify({
    name,
    note,
    disposition,
    entries: groupDraftEntries(quantities, deadQuantities)
  })
}

export function groupDraftStateFromGroup(
  group: SceneGroup | null | undefined
): GroupDraftState {
  const name = group?.name ?? ''
  const note = group?.note ?? ''
  const disposition = group?.disposition ?? 'hostile'
  const quantities = Object.fromEntries(
    group?.entries.map((entry) => [entry.creatureId, entry.aliveQuantity]) ?? []
  )
  const deadQuantities = Object.fromEntries(
    group?.entries.map((entry) => [entry.creatureId, entry.deadQuantity]) ?? []
  )
  return {
    name,
    note,
    disposition,
    quantities,
    deadQuantities,
    facts: Object.fromEntries(
      group?.entries.map((entry) => [
        entry.creatureId,
        {
          displayName: entry.displayName,
          cr: 0,
          xp: 0,
          available: entry.available
        }
      ]) ?? []
    ),
    baseline: groupDraftSignature(
      name,
      note,
      disposition,
      quantities,
      deadQuantities
    ),
    evaluation: null,
    seed: 0,
    message: '',
    generationSummary: '',
    history: emptyGroupDraftHistory()
  }
}

export function groupDraftStateDirty(draft: GroupDraftState): boolean {
  return (
    groupDraftSignature(
      draft.name,
      draft.note,
      draft.disposition,
      draft.quantities,
      draft.deadQuantities
    ) !== draft.baseline
  )
}
