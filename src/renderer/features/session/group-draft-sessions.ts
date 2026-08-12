import type { SceneGroup } from '../../../shared/contracts/scene.js'
import {
  emptyGroupDraftHistory,
  groupDraftReducer,
  groupDraftSignature,
  type GroupDraftMutation,
  type GroupDraftState
} from './group-draft.js'

export type GroupDraftSessionsState = Readonly<{
  activeKey: string | null
  draft: GroupDraftState
  cached: Readonly<Record<string, GroupDraftState>>
}>

export type GroupDraftSessionsAction =
  | { kind: 'mutate'; mutation: GroupDraftMutation }
  | {
      kind: 'activate'
      key: string | null
      fallback: GroupDraftState
    }

export function createGroupDraftSessions(
  activeKey: string | null,
  draft: GroupDraftState
): GroupDraftSessionsState {
  return { activeKey, draft, cached: {} }
}

export function groupDraftSessionsReducer(
  state: GroupDraftSessionsState,
  action: GroupDraftSessionsAction
): GroupDraftSessionsState {
  if (action.kind === 'mutate')
    return {
      ...state,
      draft: groupDraftReducer(state.draft, action.mutation)
    }
  if (action.key === state.activeKey) return state

  const cached = { ...state.cached }
  if (state.activeKey) cached[state.activeKey] = state.draft
  const draft = action.key ? cached[action.key] : undefined
  if (action.key) delete cached[action.key]
  return {
    activeKey: action.key,
    draft: draft ?? action.fallback,
    cached
  }
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

export function groupDraftSessionsDirty(
  sessions: GroupDraftSessionsState
): boolean {
  return (
    (sessions.activeKey !== null && groupDraftStateDirty(sessions.draft)) ||
    Object.values(sessions.cached).some(groupDraftStateDirty)
  )
}
