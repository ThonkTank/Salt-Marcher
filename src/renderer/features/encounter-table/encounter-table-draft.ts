import type {
  EncounterTable,
  EncounterTableDraft
} from '../../../shared/contracts/encounter-source.js'

export type EncounterTableDraftState = {
  displayName: string
  description: string
  weights: Readonly<Record<string, number>>
  order: readonly string[]
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
  weights: Readonly<Record<string, number>>,
  order: readonly string[]
): string {
  return JSON.stringify({
    displayName,
    description,
    entries: order.map((creatureId) => [creatureId, weights[creatureId]])
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
  const order = table?.entries.map((entry) => entry.creatureId) ?? []
  return {
    displayName,
    description,
    weights,
    order,
    baseline: signature(displayName, description, weights, order)
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
      },
      order: state.order.includes(action.creatureId)
        ? state.order
        : [...state.order, action.creatureId]
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
  return {
    ...state,
    weights,
    order: state.order.filter((creatureId) => creatureId !== action.creatureId)
  }
}

export function encounterTableDraftDirty(
  state: EncounterTableDraftState
): boolean {
  return (
    signature(
      state.displayName,
      state.description,
      state.weights,
      state.order
    ) !== state.baseline
  )
}

export function encounterTableDraftValue(
  state: EncounterTableDraftState
): EncounterTableDraft {
  return {
    displayName: state.displayName,
    description: state.description,
    entries: state.order.map((creatureId) => ({
      creatureId,
      weight: state.weights[creatureId]!
    }))
  }
}
