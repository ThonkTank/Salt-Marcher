import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import type { SavedEncounterPlanSummary } from '../../../shared/contracts/encounter-plans.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import type {
  SaveSessionPlanInput,
  SessionPreparationReceipt,
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { plannerDraftReducer, projectPlannerDraft } from './planner-draft.js'
import type { EncounterSearchState } from './scene-inspector.js'
import {
  isPreparationTerminal,
  preparationStatusMessage,
  type PreparationStage
} from './preparation-status-model.js'
import { useSessionPlannerPorts } from './use-session-planner-ports.js'

export function useSessionPlannerController(
  onError: (message: string) => void
) {
  const { planner, encounters, loot } = useSessionPlannerPorts()
  const [workspace, setWorkspace] = useState<SessionPlannerWorkspace | null>(
    null
  )
  const [draft, dispatchDraft] = useReducer(plannerDraftReducer, null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [seed, setSeed] = useState(179_974)
  const [stage, setStage] = useState<PreparationStage>('idle')
  const [stageMessage, setStageMessage] = useState('')
  const [confirmation, setConfirmation] = useState<{
    operationId: string
    target: SessionPlannerWorkspace
  } | null>(null)
  const [nameDialog, setNameDialog] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [encounterQuery, setEncounterQuery] = useState('')
  const [encounterSearch, setEncounterSearch] = useState<EncounterSearchState>({
    status: 'idle'
  })
  const [encounterSummaryCache, setEncounterSummaryCache] = useState(
    () => new Map<string, SavedEncounterPlanSummary>()
  )
  const [treasureEditor, setTreasureEditor] = useState<Treasure | null | false>(
    false
  )
  const [distribution, setDistribution] = useState<Treasure | null>(null)
  const preparationRef = useRef<string | null>(null)
  const rewardCommands = useRef(new Map<string, string>())
  const searchEpoch = useRef(0)

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
  const selectedProjection = draftProjection?.scenes.find(
    (scene) => scene.id === selectedScene?.id
  )
  const selectedSceneId = selectedScene?.id ?? null

  useEffect(() => {
    const epoch = ++searchEpoch.current
    const query = encounterQuery.trim()
    const timer = window.setTimeout(
      () => {
        if (query.length < 2 || !selectedSceneId) {
          if (searchEpoch.current === epoch)
            setEncounterSearch({ status: 'idle' })
          return
        }
        setEncounterSearch({ status: 'searching' })
        void encounters
          .search(query)
          .then(async (result) => {
            const summaries =
              result.hits.length > 0
                ? await encounters.summaries(
                    result.hits.map((hit) => hit.planId)
                  )
                : { entries: [] }
            if (searchEpoch.current !== epoch) return
            const byId = new Map(
              summaries.entries.map((entry) => [entry.planId, entry])
            )
            setEncounterSummaryCache((current) => {
              const next = new Map(current)
              for (const entry of summaries.entries)
                if (entry.status === 'READY')
                  next.set(entry.planId, entry.summary)
              return next
            })
            setEncounterSearch({
              status: 'ready',
              hits: result.hits.map((hit) => {
                const entry = byId.get(hit.planId)
                return {
                  ...hit,
                  summary: entry?.status === 'READY' ? entry.summary : null
                }
              }),
              hasMore: result.hasMore
            })
          })
          .catch(() => {
            if (searchEpoch.current === epoch)
              setEncounterSearch({ status: 'failed' })
          })
      },
      query.length < 2 || !selectedSceneId ? 0 : 180
    )
    return () => window.clearTimeout(timer)
  }, [encounterQuery, encounters, selectedSceneId])

  const applyWorkspace = useCallback((next: SessionPlannerWorkspace): void => {
    setWorkspace(next)
    dispatchDraft({ type: 'replace', draft: draftFromWorkspace(next) })
    setEncounterSummaryCache(
      new Map(
        next.session.scenes.flatMap((scene) =>
          scene.encounter?.status === 'ready'
            ? [[scene.encounter.summary.id, scene.encounter.summary] as const]
            : []
        )
      )
    )
    setDirty(false)
  }, [])

  function mutate(
    update: (current: SaveSessionPlanInput) => SaveSessionPlanInput
  ): void {
    dispatchDraft({ type: 'update', update })
    setDirty(true)
    searchEpoch.current += 1
  }

  function patchScene(
    sceneId: string,
    patch: Partial<SessionPlannerScene>
  ): void {
    dispatchDraft({ type: 'patch-scene', sceneId, patch })
    setDirty(true)
  }

  async function saveDraft(): Promise<SessionPlannerWorkspace | null> {
    if (!draft) return workspace
    try {
      const saved = await planner.save(draft)
      applyWorkspace(saved)
      return saved
    } catch (cause) {
      onError(capabilityErrorText(cause))
      return null
    }
  }

  async function openSession(sessionId: string): Promise<void> {
    if (sessionId === workspace?.session.id) return
    try {
      applyWorkspace(
        dirty && draft
          ? await planner.switch(sessionId, draft)
          : await planner.open(sessionId)
      )
      setEncounterQuery('')
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function submitName(): Promise<void> {
    if (!name.trim() || !workspace) return
    try {
      const current = dirty ? await saveDraft() : workspace
      if (!current) return
      const next =
        nameDialog === 'create'
          ? await planner.create(name)
          : await planner.rename(
              current.session.id,
              current.session.revision,
              name
            )
      setNameDialog(null)
      applyWorkspace(next)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  async function deleteSession(): Promise<void> {
    if (!workspace) return
    try {
      applyWorkspace(
        await planner.delete(workspace.session.id, workspace.session.revision)
      )
      setDeleteConfirm(false)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  const applyPreparationReceipt = useCallback(
    async (receipt: SessionPreparationReceipt): Promise<void> => {
      setSeed(receipt.seed)
      preparationRef.current = isPreparationTerminal(receipt.status)
        ? null
        : receipt.operationId
      const stageByStatus = {
        queued: 'queued',
        generating: 'generating',
        resolving_encounters: 'resolving-encounters',
        saving: 'saving',
        succeeded: 'ready',
        invalid: 'invalid',
        stale: 'stale',
        failed: 'failed',
        canceled: 'canceled'
      } as const
      setStage(stageByStatus[receipt.status])
      setStageMessage(preparationStatusMessage(receipt))
      if (receipt.status === 'succeeded') applyWorkspace(await planner.read())
    },
    [applyWorkspace, planner]
  )

  const reconcilePreparation = useCallback(
    async (operationId: string): Promise<void> => {
      const result = await planner.preparationReceipt({ operationId })
      if (result.receipt) await applyPreparationReceipt(result.receipt)
    },
    [applyPreparationReceipt, planner]
  )

  const requestPreparation = useCallback(
    async (
      target: SessionPlannerWorkspace,
      operationId: string,
      confirmedReplacement: boolean,
      requestedSeed: number
    ): Promise<void> => {
      try {
        preparationRef.current = operationId
        setStage('queued')
        setStageMessage(message('planner.progressQueued'))
        const started = await planner.startPreparation({
          operationId,
          sessionId: target.session.id,
          expectedRevision: target.session.revision,
          seed: requestedSeed,
          confirmedReplacement
        })
        if (started.status === 'confirmation_required') {
          setConfirmation({ operationId, target })
          setStage('confirming-replacement')
          setStageMessage(
            formatMessage('planner.replaceHint', {
              count: started.parameters.sceneCount
            })
          )
          return
        }
        setConfirmation(null)
        await applyPreparationReceipt(started.receipt)
      } catch (cause) {
        preparationRef.current = null
        setConfirmation(null)
        setStage('failed')
        setStageMessage(capabilityErrorText(cause))
        onError(capabilityErrorText(cause))
      }
    },
    [applyPreparationReceipt, onError, planner]
  )

  useEffect(() => {
    let current = true
    void planner
      .read()
      .then((loaded) => {
        if (!current) return
        applyWorkspace(loaded)
        if (loaded.preparation) {
          preparationRef.current = loaded.preparation.operationId
          void applyPreparationReceipt(loaded.preparation)
        }
      })
      .catch((cause) => onError(capabilityErrorText(cause)))
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [applyPreparationReceipt, applyWorkspace, onError, planner])

  useEffect(
    () =>
      planner.onPreparationChanged((notice) => {
        if (
          preparationRef.current === notice.operationId ||
          notice.status === 'succeeded'
        )
          void reconcilePreparation(notice.operationId).catch((cause) =>
            onError(capabilityErrorText(cause))
          )
      }),
    [onError, planner, reconcilePreparation]
  )

  async function generate(): Promise<void> {
    let target = workspace
    if (dirty) target = await saveDraft()
    if (!target) return
    await requestPreparation(target, crypto.randomUUID(), false, seed)
  }

  async function cancelPreparation(): Promise<void> {
    const operationId = preparationRef.current
    preparationRef.current = null
    if (operationId) {
      const result = await planner
        .cancelPreparation({ operationId })
        .catch(() => null)
      if (result) await applyPreparationReceipt(result.receipt)
    }
    setConfirmation(null)
  }

  async function materializeReward(
    runId: string,
    generatedTreasureId: string,
    label: string,
    edit: boolean,
    placed: Treasure | null
  ): Promise<void> {
    if (dirty && !(await saveDraft())) return
    try {
      let treasure = placed
      if (!treasure) {
        const key = `${runId}:${generatedTreasureId}`
        let commandId = rewardCommands.current.get(key)
        if (!commandId) {
          commandId = crypto.randomUUID()
          rewardCommands.current.set(key, commandId)
        }
        treasure = await loot.acceptGenerated({
          commandId,
          runId,
          generatedTreasureId,
          label,
          anchor: { kind: 'unplaced' }
        })
      }
      applyWorkspace(await planner.read())
      if (edit) setTreasureEditor(treasure)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }

  const preparationRunning = [
    'queued',
    'generating',
    'resolving-encounters',
    'saving'
  ].includes(stage)

  return {
    workspace,
    draft,
    draftProjection,
    selectedScene,
    selectedProjection,
    dirty,
    loading,
    participantsOpen,
    seed,
    stage,
    stageMessage,
    confirmation,
    nameDialog,
    name,
    deleteConfirm,
    encounterQuery,
    encounterSearch,
    treasureEditor,
    distribution,
    preparationRunning,
    setParticipantsOpen,
    setSeed,
    setConfirmation,
    setNameDialog,
    setName,
    setDeleteConfirm,
    setEncounterQuery,
    setTreasureEditor,
    setDistribution,
    mutate,
    patchScene,
    saveDraft,
    openSession,
    submitName,
    deleteSession,
    requestPreparation,
    generate,
    cancelPreparation,
    materializeReward,
    applyWorkspace,
    planner
  }
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
