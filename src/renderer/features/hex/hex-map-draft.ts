export type HexMapNameDraftState = Readonly<{
  baseline: string
  displayName: string
}>

export type HexMapNameDraftAction = Readonly<{
  kind: 'name'
  value: string
}>

export function createHexMapNameDraftState(
  displayName = ''
): HexMapNameDraftState {
  return { baseline: displayName, displayName }
}

export function hexMapNameDraftReducer(
  state: HexMapNameDraftState,
  action: HexMapNameDraftAction
): HexMapNameDraftState {
  return action.kind === 'name'
    ? { ...state, displayName: action.value }
    : state
}

export function hexMapNameDraftValue(state: HexMapNameDraftState): string {
  return state.displayName.trim()
}

export function hexMapNameDraftDirty(state: HexMapNameDraftState): boolean {
  return state.displayName !== state.baseline
}
