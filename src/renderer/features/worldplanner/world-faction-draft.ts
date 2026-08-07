import type {
  WorldFaction,
  WorldFactionDraft
} from '../../../shared/contracts/encounter-source.js'

export type WorldFactionDraftState = Readonly<{
  displayName: string
  notes: string
  disposition: number
  primaryEncounterTableId: string | null
  inventory: Readonly<Record<string, number>>
  baseline: string
}>

export type WorldFactionDraftAction =
  | Readonly<{ kind: 'name'; value: string }>
  | Readonly<{ kind: 'notes'; value: string }>
  | Readonly<{ kind: 'disposition'; value: number }>
  | Readonly<{
      kind: 'primary-table'
      id: string | null
      creatureIds: ReadonlySet<string>
    }>
  | Readonly<{
      kind: 'stock'
      creatureId: string
      maximum: number | null
    }>

function signature(state: Omit<WorldFactionDraftState, 'baseline'>): string {
  return JSON.stringify({
    ...state,
    inventory: Object.entries(state.inventory).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  })
}

export function createWorldFactionDraftState(
  faction: WorldFaction | null
): WorldFactionDraftState {
  const state = {
    displayName: faction?.displayName ?? '',
    notes: faction?.notes ?? '',
    disposition: faction?.disposition ?? 0,
    primaryEncounterTableId: faction?.primaryEncounterTableId ?? null,
    inventory: Object.fromEntries(
      faction?.inventory.map((entry) => [entry.creatureId, entry.maximum]) ?? []
    )
  }
  return { ...state, baseline: signature(state) }
}

export function worldFactionDraftReducer(
  state: WorldFactionDraftState,
  action: WorldFactionDraftAction
): WorldFactionDraftState {
  if (action.kind === 'name') return { ...state, displayName: action.value }
  if (action.kind === 'notes') return { ...state, notes: action.value }
  if (action.kind === 'disposition')
    return {
      ...state,
      disposition: Math.max(-50, Math.min(50, Math.round(action.value)))
    }
  if (action.kind === 'primary-table')
    return {
      ...state,
      primaryEncounterTableId: action.id,
      inventory: Object.fromEntries(
        Object.entries(state.inventory).filter(([creatureId]) =>
          action.creatureIds.has(creatureId)
        )
      )
    }
  const inventory = { ...state.inventory }
  if (action.maximum === null) delete inventory[action.creatureId]
  else inventory[action.creatureId] = Math.max(0, Math.floor(action.maximum))
  return { ...state, inventory }
}

export function worldFactionDraftDirty(state: WorldFactionDraftState) {
  const { baseline, ...draft } = state
  return signature(draft) !== baseline
}

export function worldFactionDraftValue(
  state: WorldFactionDraftState
): WorldFactionDraft {
  return {
    displayName: state.displayName,
    notes: state.notes,
    disposition: state.disposition,
    primaryEncounterTableId: state.primaryEncounterTableId,
    inventory: Object.entries(state.inventory)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([creatureId, maximum]) => ({
        creatureId,
        maximum
      }))
  }
}
