import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { useEncounterPlanSearch } from './use-encounter-plan-search.js'
import { useSessionPlannerPorts } from './use-session-planner-ports.js'
import { useSessionPlannerSessionCommands } from './use-session-planner-session-commands.js'
import { useSessionPlannerWorkspace } from './use-session-planner-workspace.js'
import { useSessionPreparation } from './use-session-preparation.js'
import { useSessionRewardMaterialization } from './use-session-reward-materialization.js'

/** Thin composition boundary for the Session Planner view. */
export function useSessionPlannerController(
  onError: (message: string) => void
) {
  const { planner, encounters, loot } = useSessionPlannerPorts()
  const coordinator = useAsyncCommandCoordinator()
  const workspace = useSessionPlannerWorkspace({
    coordinator,
    planner,
    onError
  })
  const search = useEncounterPlanSearch({
    coordinator,
    encounters,
    sessionId: workspace.workspace?.session.id ?? null,
    sessionRevision: workspace.workspace?.session.revision ?? null,
    selectedSceneId: workspace.selectedScene?.id ?? null,
    intentRevision: workspace.intentRevision,
    cacheSummaries: workspace.cacheEncounterSummaries
  })
  const sessions = useSessionPlannerSessionCommands({
    coordinator,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    mergeCatalog: workspace.mergeCatalog,
    resetEncounterQuery: () => search.setQuery(''),
    onError
  })
  const preparation = useSessionPreparation({
    coordinator,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    saveDraft: sessions.saveDraft,
    onError
  })
  const rewards = useSessionRewardMaterialization({
    coordinator,
    loot,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    saveDraft: sessions.saveDraft,
    onError
  })

  return {
    workspace: workspace.workspace,
    draft: workspace.draft,
    draftProjection: workspace.draftProjection,
    selectedScene: workspace.selectedScene,
    selectedProjection: workspace.selectedProjection,
    dirty: workspace.dirty,
    loading: workspace.loading,
    participantsOpen: workspace.participantsOpen,
    seed: preparation.seed,
    stage: preparation.stage,
    stageMessage: preparation.stageMessage,
    confirmation: preparation.confirmation,
    nameDialog: sessions.nameDialog,
    name: sessions.name,
    deleteConfirm: sessions.deleteConfirm,
    encounterQuery: search.query,
    encounterSearch: search.state,
    treasureEditor: rewards.treasureEditor,
    distribution: rewards.distribution,
    preparationRunning: preparation.preparationRunning,
    setParticipantsOpen: workspace.setParticipantsOpen,
    setSeed: preparation.setSeed,
    setConfirmation: preparation.setConfirmation,
    setNameDialog: sessions.setNameDialog,
    setName: sessions.setName,
    setDeleteConfirm: sessions.setDeleteConfirm,
    setEncounterQuery: search.setQuery,
    setTreasureEditor: rewards.setTreasureEditor,
    setDistribution: rewards.setDistribution,
    mutate: workspace.mutate,
    patchScene: workspace.patchScene,
    saveDraft: sessions.saveDraft,
    openSession: sessions.openSession,
    submitName: sessions.submitName,
    deleteSession: sessions.deleteSession,
    requestPreparation: preparation.requestPreparation,
    generate: preparation.generate,
    cancelPreparation: preparation.cancelPreparation,
    materializeReward: rewards.materializeReward,
    applyWorkspace: workspace.applyWorkspace,
    planner
  }
}
