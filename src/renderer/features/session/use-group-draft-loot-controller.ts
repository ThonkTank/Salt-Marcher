import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CommitGroupRewardResult,
  GenerateGroupDraftLootInput
} from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useGroupLootPort } from '../loot/use-loot-ports.js'
import {
  addLootCatalogEntry,
  createGroupLootDraftHistory,
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
import type { LootCatalogEntry } from '../../../shared/contracts/loot.js'
import type {
  EditableTreasureContainer,
  EditableTreasureItem
} from '../loot/treasure-draft.js'
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
}>

const emptyPreview = (): PreviewState => ({
  run: null,
  history: null,
  seed: null,
  phase: 'idle',
  error: ''
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
  const previews = useRef(new Map<string, PreviewState>())
  const activeKey = useRef(input.draftKey)
  const requestSequence = useRef(0)
  const [activePreview, setActivePreview] = useState<{
    draftKey: string
    state: PreviewState
  }>(() => ({ draftKey: input.draftKey, state: emptyPreview() }))
  const preview =
    activePreview.draftKey === input.draftKey
      ? activePreview.state
      : emptyPreview()

  useEffect(() => {
    activeKey.current = input.draftKey
    requestSequence.current += 1
    setActivePreview({
      draftKey: input.draftKey,
      state: previews.current.get(input.draftKey) ?? emptyPreview()
    })
  }, [input.draftKey])

  const store = useCallback((key: string, next: PreviewState) => {
    previews.current.set(key, next)
    if (activeKey.current === key)
      setActivePreview({ draftKey: key, state: next })
  }, [])

  const invalidate = useCallback(() => {
    requestSequence.current += 1
    previews.current.delete(input.draftKey)
    if (activeKey.current === input.draftKey)
      setActivePreview({ draftKey: input.draftKey, state: emptyPreview() })
  }, [input.draftKey])

  const generate = useCallback(
    async (
      entriesOverride: readonly GroupRewardEntry[] = input.entries,
      seedOverride: number = generationSeed(loot.e2e)
    ): Promise<boolean> => {
      if (entriesOverride.length === 0) {
        invalidate()
        return false
      }
      const key = input.draftKey
      const request = ++requestSequence.current
      const previous = previews.current.get(key) ?? emptyPreview()
      store(key, {
        ...previous,
        phase: 'generating',
        error: '',
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
        if (requestSequence.current !== request) return false
        store(key, {
          run: result.run,
          history: createGroupLootDraftHistory(
            groupLootDraftFromRun(result.run)
          ),
          phase: 'ready',
          error: '',
          seed: seedOverride
        })
        return true
      } catch (cause) {
        if (requestSequence.current !== request) return false
        store(key, {
          ...previous,
          phase: 'error',
          error: capabilityErrorText(cause),
          seed: seedOverride
        })
        return false
      }
    },
    [input, invalidate, loot, store]
  )

  const retry = useCallback(
    () => generate(input.entries, preview.seed ?? generationSeed(loot.e2e)),
    [generate, input.entries, loot.e2e, preview.seed]
  )

  const reroll = useCallback(
    () => generate(input.entries, generationSeed(loot.e2e)),
    [generate, input.entries, loot.e2e]
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
      const request = ++requestSequence.current
      store(key, { ...preview, phase: 'committing', error: '' })
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
        if (requestSequence.current === request)
          store(key, { ...preview, phase: 'ready', error: '' })
        return result
      } catch (cause) {
        if (requestSequence.current === request)
          store(key, {
            ...preview,
            phase: 'error',
            error: capabilityErrorText(cause)
          })
        return null
      }
    },
    [input, loot, preview, store]
  )

  const updateDraft = useCallback(
    (update: (draft: GroupLootDraft) => GroupLootDraft) => {
      const current = previews.current.get(input.draftKey)
      if (!current?.history) return
      store(input.draftKey, {
        ...current,
        history: mutateGroupLootDraft(current.history, update)
      })
    },
    [input.draftKey, store]
  )

  const patchItem = useCallback(
    (id: string, patch: Partial<EditableTreasureItem>) =>
      updateDraft((draft) => patchGroupLootItem(draft, id, patch)),
    [updateDraft]
  )
  const patchContainer = useCallback(
    (id: string, patch: Partial<EditableTreasureContainer>) =>
      updateDraft((draft) => patchGroupLootContainer(draft, id, patch)),
    [updateDraft]
  )
  const removeItem = useCallback(
    (id: string) => updateDraft((draft) => removeGroupLootItem(draft, id)),
    [updateDraft]
  )
  const removeContainer = useCallback(
    (id: string) => updateDraft((draft) => removeGroupLootContainer(draft, id)),
    [updateDraft]
  )
  const addCatalogEntry = useCallback(
    (entry: LootCatalogEntry) =>
      updateDraft((draft) => addLootCatalogEntry(draft, entry)),
    [updateDraft]
  )
  const undo = useCallback(() => {
    const current = previews.current.get(input.draftKey)
    if (!current?.history) return
    store(input.draftKey, {
      ...current,
      history: undoGroupLootDraft(current.history)
    })
  }, [input.draftKey, store])
  const redo = useCallback(() => {
    const current = previews.current.get(input.draftKey)
    if (!current?.history) return
    store(input.draftKey, {
      ...current,
      history: redoGroupLootDraft(current.history)
    })
  }, [input.draftKey, store])

  const hasDirtyDrafts = useCallback(
    () =>
      [...previews.current.values()].some(
        (state) => state.history && groupLootDraftDirty(state.history)
      ),
    []
  )

  return {
    ...preview,
    draft: preview.history?.draft ?? null,
    dirty: preview.history ? groupLootDraftDirty(preview.history) : false,
    canUndo: (preview.history?.past.length ?? 0) > 0,
    canRedo: (preview.history?.future.length ?? 0) > 0,
    generate,
    retry,
    reroll,
    commit,
    invalidate,
    patchLabel: (label: string) =>
      updateDraft((draft) => ({ ...draft, label })),
    patchItem,
    patchContainer,
    removeItem,
    removeContainer,
    addCatalogEntry,
    undo,
    redo,
    hasDirtyDrafts
  }
}
