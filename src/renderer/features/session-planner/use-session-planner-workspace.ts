import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { SavedEncounterPlanSummary } from '../../../shared/contracts/encounter-plans.js'
import type {
  SaveSessionPlanInput,
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { plannerDraftReducer, projectPlannerDraft } from './planner-draft.js'
import type { SessionPlannerPort } from './use-session-planner-ports.js'

export type SessionPlannerAuthority = Readonly<{
  workspace: SessionPlannerWorkspace | null
  draft: SaveSessionPlanInput | null
  dirty: boolean
  intentRevision: number
  authoredRevision: number
}>

/** Owns Planner workspace, authored draft and their local authority revision. */
export function useSessionPlannerWorkspace(options: {
  coordinator: AsyncCommandCoordinator
  planner: SessionPlannerPort
  onError: (message: string) => void
}) {
  const { coordinator, onError, planner } = options
  const [authority] = useState(() => new PlannerAuthorityContext())
  const [workspace, setWorkspace] = useState<SessionPlannerWorkspace | null>(
    null
  )
  const [draft, dispatchDraft] = useReducer(plannerDraftReducer, null)
  const [dirty, setDirty] = useState(false)
  const [intentRevision, setIntentRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [encounterSummaryCache, setEncounterSummaryCache] = useState(
    () => new Map<string, SavedEncounterPlanSummary>()
  )

  const applyWorkspace = useCallback(
    (next: SessionPlannerWorkspace): void => {
      const nextDraft = draftFromWorkspace(next)
      const revision = authority.replace(next, nextDraft)
      setWorkspace(next)
      dispatchDraft({ type: 'replace', draft: nextDraft })
      setEncounterSummaryCache(workspaceEncounterSummaries(next))
      setDirty(false)
      setIntentRevision(revision)
    },
    [authority]
  )

  const mutate = useCallback(
    (update: (current: SaveSessionPlanInput) => SaveSessionPlanInput): void => {
      const current = authority.read().draft
      if (!current) return
      const next = update(current)
      const revision = authority.replaceDraft(next)
      dispatchDraft({ type: 'replace', draft: next })
      setDirty(true)
      setIntentRevision(revision)
    },
    [authority]
  )

  const patchScene = useCallback(
    (sceneId: string, patch: Partial<SessionPlannerScene>): void => {
      mutate((current) => ({
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, ...patch } : scene
        )
      }))
    },
    [mutate]
  )

  const mergeCatalog = useCallback(
    (sessions: SessionPlannerWorkspace['sessions']): void => {
      const current = authority.read().workspace
      if (!current) return
      const next = { ...current, sessions }
      authority.mergeCatalog(next)
      setWorkspace(next)
    },
    [authority]
  )

  const cacheEncounterSummaries = useCallback(
    (summaries: readonly SavedEncounterPlanSummary[]): void => {
      if (summaries.length === 0) return
      setEncounterSummaryCache((current) => {
        const next = new Map(current)
        for (const summary of summaries) next.set(summary.id, summary)
        return next
      })
    },
    []
  )

  useEffect(() => {
    void coordinator
      .run({
        scope: 'planner.workspace.load',
        mode: 'latest-only',
        execute: () => planner.read(),
        accept: applyWorkspace
      })
      .then((outcome) => {
        if (outcome.status === 'failure')
          onError(capabilityErrorText(outcome.cause))
        if (outcome.status !== 'stale') setLoading(false)
      })
  }, [applyWorkspace, coordinator, onError, planner])

  const selectedScene = useMemo(
    () =>
      draft?.scenes.find((scene) => scene.id === draft.selectedSceneId) ?? null,
    [draft]
  )
  const draftProjection = useMemo(
    () =>
      workspace && draft
        ? projectPlannerDraft({
            draft,
            workspace,
            encounterSummaries: encounterSummaryCache
          })
        : null,
    [draft, encounterSummaryCache, workspace]
  )

  return {
    workspace,
    draft,
    draftProjection,
    selectedScene,
    selectedProjection: draftProjection?.scenes.find(
      (scene) => scene.id === selectedScene?.id
    ),
    dirty,
    loading,
    participantsOpen,
    intentRevision,
    setParticipantsOpen,
    applyWorkspace,
    mergeCatalog,
    cacheEncounterSummaries,
    mutate,
    patchScene,
    read: authority.read
  }
}

class PlannerAuthorityContext {
  #current: SessionPlannerAuthority = Object.freeze({
    workspace: null,
    draft: null,
    dirty: false,
    intentRevision: 0,
    authoredRevision: 0
  })

  public readonly read = (): SessionPlannerAuthority => this.#current

  public replace(
    workspace: SessionPlannerWorkspace,
    draft: SaveSessionPlanInput
  ): number {
    const intentRevision = this.#current.intentRevision + 1
    this.#current = Object.freeze({
      workspace,
      draft,
      dirty: false,
      intentRevision,
      authoredRevision: this.#current.authoredRevision
    })
    return intentRevision
  }

  public replaceDraft(draft: SaveSessionPlanInput): number {
    const intentRevision = this.#current.intentRevision + 1
    this.#current = Object.freeze({
      ...this.#current,
      draft,
      dirty: true,
      intentRevision,
      authoredRevision: this.#current.authoredRevision + 1
    })
    return intentRevision
  }

  public mergeCatalog(workspace: SessionPlannerWorkspace): void {
    this.#current = Object.freeze({ ...this.#current, workspace })
  }
}

function workspaceEncounterSummaries(
  workspace: SessionPlannerWorkspace
): Map<string, SavedEncounterPlanSummary> {
  return new Map(
    workspace.session.scenes.flatMap((scene) =>
      scene.encounter?.status === 'ready'
        ? [[scene.encounter.summary.id, scene.encounter.summary] as const]
        : []
    )
  )
}

function draftFromWorkspace(
  workspace: SessionPlannerWorkspace
): SaveSessionPlanInput {
  return {
    sessionId: workspace.session.id,
    expectedRevision: workspace.session.revision,
    participantIds: [...workspace.session.participantIds],
    adventureDayFraction: workspace.session.adventureDayFraction,
    encounterCount: workspace.session.encounterCount,
    selectedSceneId: workspace.session.selectedSceneId,
    scenes: workspace.session.scenes.map((scene) => ({
      id: scene.id,
      titleKind: scene.titleKind,
      title: scene.title,
      notes: scene.notes,
      locationId: scene.locationId,
      encounterPlanId: scene.encounterPlanId,
      allocatedXp: scene.allocatedXp,
      position: scene.position,
      restAfter: scene.restAfter,
      manualLootNotes: scene.manualLootNotes.map((note) => ({ ...note })),
      generatedRewards: scene.generatedRewards.map((reward) => ({
        runId: reward.runId,
        generatedTreasureId: reward.generatedTreasureId,
        rewardChannel: reward.rewardChannel,
        anchorEncounterNumber: reward.anchorEncounterNumber,
        treasureOrdinal: reward.treasureOrdinal,
        position: reward.position
      }))
    }))
  }
}
