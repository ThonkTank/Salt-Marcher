import { useCallback, useEffect, useReducer } from 'react'
import type {
  CommitGroupRewardResult,
  GenerateGroupDraftLootInput,
  LootCatalogEntry
} from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { capabilityErrorIssues } from '../../../shared/errors/capability-error.js'
import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import {
  addLootCatalogEntry,
  beginGroupLootDraftTransaction,
  createGroupLootDraftHistory,
  endGroupLootDraftTransaction,
  groupLootCommitDraft,
  groupLootDraftDirty,
  groupLootDraftFromRun,
  mutateGroupLootDraft,
  patchGroupLootContainer,
  patchGroupLootItem,
  redoGroupLootDraft,
  removeGroupLootContainer,
  removeGroupLootItem,
  undoGroupLootDraft,
  type GroupLootDraft,
  type GroupLootDraftHistory
} from '../loot/group-loot-draft.js'
import type {
  EditableTreasureContainer,
  EditableTreasureItem
} from '../loot/treasure-draft.js'
import { useGroupLootPort } from '../loot/use-loot-ports.js'
import { generationSeed } from './generation-seed.js'

type GroupRewardEntry = GenerateGroupDraftLootInput['entries'][number]
export type GroupDraftLootPhase =
  'idle' | 'generating' | 'ready' | 'committing' | 'error'

type PreviewState = Readonly<{
  run: GroupRewardGeneratedRun | null
  history: GroupLootDraftHistory | null
  seed: number | null
  phase: GroupDraftLootPhase
  error: string
  issues: readonly CapabilityIssue[]
  requestToken: string | null
}>

type ControllerState = Readonly<{
  activeKey: string
  sessions: Readonly<Record<string, PreviewState>>
}>

type ControllerAction =
  | { kind: 'activate'; key: string }
  | { kind: 'invalidate'; key: string }
  | {
      kind: 'begin'
      key: string
      requestToken: string
      phase: 'generating' | 'committing'
      seed?: number
    }
  | {
      kind: 'generated'
      key: string
      requestToken: string
      run: GroupRewardGeneratedRun
      seed: number
    }
  | {
      kind: 'completed'
      key: string
      requestToken: string
    }
  | {
      kind: 'failed'
      key: string
      requestToken: string
      error: string
      issues: readonly CapabilityIssue[]
    }
  | {
      kind: 'mutate'
      key: string
      update: (draft: GroupLootDraft) => GroupLootDraft
    }
  | { kind: 'undo'; key: string }
  | { kind: 'redo'; key: string }
  | { kind: 'begin-edit'; key: string; editKey: string }
  | { kind: 'end-edit'; key: string }

const emptyPreview = (): PreviewState => ({
  run: null,
  history: null,
  seed: null,
  phase: 'idle',
  error: '',
  issues: [],
  requestToken: null
})

export function useGroupDraftLootController(input: {
  draftKey: string
  sceneId: string
  groupId: string
  expectedSceneRevision: number
  expectedGroupRevision: number | null
  expectedPartyRevision: number
  entries: readonly GroupRewardEntry[]
}) {
  const loot = useGroupLootPort()
  const [state, dispatch] = useReducer(controllerReducer, {
    activeKey: input.draftKey,
    sessions: {}
  })
  useEffect(() => {
    dispatch({ kind: 'activate', key: input.draftKey })
  }, [input.draftKey])
  const preview = state.sessions[input.draftKey] ?? emptyPreview()

  const invalidate = useCallback(
    () => dispatch({ kind: 'invalidate', key: input.draftKey }),
    [input.draftKey]
  )

  const generate = useCallback(
    async (
      entriesOverride: readonly GroupRewardEntry[] = input.entries,
      seedOverride: number = generationSeed(loot.e2e)
    ): Promise<boolean> => {
      if (entriesOverride.length === 0) {
        dispatch({ kind: 'invalidate', key: input.draftKey })
        return false
      }
      const key = input.draftKey
      const requestToken = crypto.randomUUID()
      dispatch({
        kind: 'begin',
        key,
        requestToken,
        phase: 'generating',
        seed: seedOverride
      })
      try {
        const rules = await loot.readRules()
        const result = await loot.generate({
          sceneId: input.sceneId,
          groupId: input.groupId,
          expectedSceneRevision: input.expectedSceneRevision,
          expectedGroupRevision: input.expectedGroupRevision,
          expectedPartyRevision: input.expectedPartyRevision,
          expectedCampaignRulesRevision: rules.revision,
          entries: [...entriesOverride],
          seed: seedOverride
        })
        dispatch({
          kind: 'generated',
          key,
          requestToken,
          run: result.run,
          seed: seedOverride
        })
        return true
      } catch (cause) {
        dispatch({
          kind: 'failed',
          key,
          requestToken,
          error: capabilityErrorText(cause),
          issues: capabilityErrorIssues(cause)
        })
        return false
      }
    },
    [input, loot]
  )

  const commit = useCallback(
    async (draft: {
      name: string
      note: string
      disposition: SceneGroupDisposition
      entries: readonly GroupRewardEntry[]
    }): Promise<CommitGroupRewardResult | null> => {
      const run = preview.run
      const treasure = run?.treasures[0]
      const history = preview.history
      if (!run || !treasure || !history) return null
      const key = input.draftKey
      const requestToken = crypto.randomUUID()
      dispatch({ kind: 'begin', key, requestToken, phase: 'committing' })
      try {
        const result = await loot.commit({
          commandId: crypto.randomUUID(),
          runId: run.id,
          generatedTreasureId: treasure.id,
          treasureDraft: groupLootCommitDraft(history.draft),
          sceneId: input.sceneId,
          groupId: input.groupId,
          expectedSceneRevision: input.expectedSceneRevision,
          expectedGroupRevision: input.expectedGroupRevision,
          name: draft.name,
          note: draft.note,
          disposition: draft.disposition,
          entries: [...draft.entries]
        })
        dispatch({ kind: 'completed', key, requestToken })
        return result
      } catch (cause) {
        dispatch({
          kind: 'failed',
          key,
          requestToken,
          error: capabilityErrorText(cause),
          issues: capabilityErrorIssues(cause)
        })
        return null
      }
    },
    [input, loot, preview.history, preview.run]
  )

  const updateDraft = useCallback(
    (update: (draft: GroupLootDraft) => GroupLootDraft) =>
      dispatch({ kind: 'mutate', key: input.draftKey, update }),
    [input.draftKey]
  )

  return {
    ...preview,
    draft: preview.history?.draft ?? null,
    dirty: preview.history ? groupLootDraftDirty(preview.history) : false,
    canUndo: (preview.history?.past.length ?? 0) > 0,
    canRedo: (preview.history?.future.length ?? 0) > 0,
    generate,
    retry: () =>
      generate(input.entries, preview.seed ?? generationSeed(loot.e2e)),
    reroll: () => generate(input.entries, generationSeed(loot.e2e)),
    commit,
    invalidate,
    patchLabel: (label: string) =>
      updateDraft((draft) => ({ ...draft, label })),
    patchItem: (id: string, patch: Partial<EditableTreasureItem>) =>
      updateDraft((draft) => patchGroupLootItem(draft, id, patch)),
    patchContainer: (id: string, patch: Partial<EditableTreasureContainer>) =>
      updateDraft((draft) => patchGroupLootContainer(draft, id, patch)),
    removeItem: (id: string) =>
      updateDraft((draft) => removeGroupLootItem(draft, id)),
    removeContainer: (id: string) =>
      updateDraft((draft) => removeGroupLootContainer(draft, id)),
    addCatalogEntry: (entry: LootCatalogEntry) =>
      updateDraft((draft) => addLootCatalogEntry(draft, entry)),
    undo: () => dispatch({ kind: 'undo', key: input.draftKey }),
    redo: () => dispatch({ kind: 'redo', key: input.draftKey }),
    beginEdit: (editKey: string) =>
      dispatch({ kind: 'begin-edit', key: input.draftKey, editKey }),
    endEdit: () => dispatch({ kind: 'end-edit', key: input.draftKey }),
    hasDirtyDrafts: () =>
      Object.values(state.sessions).some(
        (session) => session.history && groupLootDraftDirty(session.history)
      )
  }
}

export type GroupDraftLootController = ReturnType<
  typeof useGroupDraftLootController
>

function controllerReducer(
  state: ControllerState,
  action: ControllerAction
): ControllerState {
  if (action.kind === 'activate')
    return action.key === state.activeKey
      ? state
      : { ...state, activeKey: action.key }
  if (action.kind === 'invalidate') {
    if (!state.sessions[action.key]) return state
    const { [action.key]: _removed, ...sessions } = state.sessions
    void _removed
    return { ...state, sessions }
  }
  const current = state.sessions[action.key] ?? emptyPreview()
  let next: PreviewState
  if (action.kind === 'begin')
    next = {
      ...current,
      phase: action.phase,
      error: '',
      issues: [],
      requestToken: action.requestToken,
      ...(action.seed === undefined ? {} : { seed: action.seed })
    }
  else if (action.kind === 'generated') {
    if (current.requestToken !== action.requestToken) return state
    next = {
      run: action.run,
      history: createGroupLootDraftHistory(groupLootDraftFromRun(action.run)),
      phase: 'ready',
      error: '',
      issues: [],
      seed: action.seed,
      requestToken: null
    }
  } else if (action.kind === 'completed') {
    if (current.requestToken !== action.requestToken) return state
    next = {
      ...current,
      phase: 'ready',
      error: '',
      issues: [],
      requestToken: null
    }
  } else if (action.kind === 'failed') {
    if (current.requestToken !== action.requestToken) return state
    next = {
      ...current,
      phase: 'error',
      error: action.error,
      issues: action.issues,
      requestToken: null
    }
  } else if (action.kind === 'mutate') {
    if (!current.history) return state
    next = {
      ...current,
      history: mutateGroupLootDraft(current.history, action.update)
    }
  } else if (action.kind === 'undo') {
    if (!current.history) return state
    next = { ...current, history: undoGroupLootDraft(current.history) }
  } else if (action.kind === 'redo') {
    if (!current.history) return state
    next = { ...current, history: redoGroupLootDraft(current.history) }
  } else if (action.kind === 'begin-edit') {
    if (!current.history) return state
    next = {
      ...current,
      history: beginGroupLootDraftTransaction(current.history, action.editKey)
    }
  } else {
    if (!current.history) return state
    next = {
      ...current,
      history: endGroupLootDraftTransaction(current.history)
    }
  }
  return {
    ...state,
    sessions: { ...state.sessions, [action.key]: next }
  }
}
