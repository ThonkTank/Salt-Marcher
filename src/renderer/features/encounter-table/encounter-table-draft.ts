import type {
  EncounterTable,
  EncounterTableDraft
} from '../../../shared/contracts/encounter-source.js'

export type EncounterTableDraftState = {
  displayName: string
  description: string
  weights: Readonly<Record<string, number>>
  baseline: string
}

export type EncounterTableDraftAction =
  | { kind: 'name'; value: string }
  | { kind: 'description'; value: string }
  | { kind: 'add'; creatureId: string }
  | { kind: 'weight'; creatureId: string; value: number }
  | { kind: 'remove'; creatureId: string }

function signature(
  displayName: string,
  description: string,
  weights: Readonly<Record<string, number>>
): string {
  return JSON.stringify({
    displayName,
    description,
    entries: Object.entries(weights).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  })
}

export function createEncounterTableDraftState(
  table: EncounterTable | null
): EncounterTableDraftState {
  const displayName = table?.displayName ?? ''
  const description = table?.description ?? ''
  const weights = Object.fromEntries(
    table?.entries.map((entry) => [entry.creatureId, entry.weight]) ?? []
  )
  return {
    displayName,
    description,
    weights,
    baseline: signature(displayName, description, weights)
  }
}

export function encounterTableDraftReducer(
  state: EncounterTableDraftState,
  action: EncounterTableDraftAction
): EncounterTableDraftState {
  if (action.kind === 'name') return { ...state, displayName: action.value }
  if (action.kind === 'description')
    return { ...state, description: action.value }
  if (action.kind === 'add')
    return {
      ...state,
      weights: {
        ...state.weights,
        [action.creatureId]: state.weights[action.creatureId] ?? 1
      }
    }
  if (action.kind === 'weight')
    return {
      ...state,
      weights: {
        ...state.weights,
        [action.creatureId]: Math.max(1, Math.min(10, action.value))
      }
    }
  const weights = { ...state.weights }
  delete weights[action.creatureId]
  return { ...state, weights }
}

export function encounterTableDraftDirty(
  state: EncounterTableDraftState
): boolean {
  return (
    signature(state.displayName, state.description, state.weights) !==
    state.baseline
  )
}

export function encounterTableDraftValue(
  state: EncounterTableDraftState
): EncounterTableDraft {
  return {
    displayName: state.displayName,
    description: state.description,
    entries: Object.entries(state.weights).map(([creatureId, weight]) => ({
      creatureId,
      weight
    }))
  }
}
