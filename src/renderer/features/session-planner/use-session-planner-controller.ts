import {
  usePlannerMaintenance,
  usePlannerMaintenanceRuntime
} from './use-planner-maintenance.js'
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
  const runtime = usePlannerMaintenanceRuntime()
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
    failed: runtime.failed,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    mergeCatalog: workspace.mergeCatalog,
    resetEncounterQuery: () => search.setQuery(''),
    onError
  })
  const preparation = useSessionPreparation({
    coordinator,
    failed: runtime.failed,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    saveDraft: sessions.saveDraft,
    onError
  })
  const rewards = useSessionRewardMaterialization({
    coordinator,
    failed: runtime.failed,
    loot,
    planner,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    saveDraft: sessions.saveDraft,
    onError
  })

  const maintenance = usePlannerMaintenance({
    runtime,
    coordinator,
    read: workspace.read,
    applyWorkspace: workspace.applyWorkspace,
    saveDraft: sessions.saveDraft,
    readUnresolved: () => {
      if (preparation.hasActiveOperation())
        return 'Die Sitzungsvorbereitung ist noch offen. Bitte Wartung abbrechen und die Vorbereitung abschließen oder abbrechen.'
      if (sessions.hasOpenDialog() || rewards.hasOpenDialog())
        return 'In der Sitzungsplanung ist noch ein Dialog offen. Bitte Wartung abbrechen und den Dialog zuerst abschließen oder schließen.'
      return null
    }
  })
  return {
    maintenanceBlocked: maintenance.blocked,
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
    setParticipantsOpen: maintenance.edit(workspace.setParticipantsOpen),
    setSeed: maintenance.edit(preparation.setSeed),
    setConfirmation: maintenance.edit(preparation.setConfirmation),
    setNameDialog: maintenance.edit(sessions.setNameDialog),
    setName: maintenance.edit(sessions.setName),
    setDeleteConfirm: maintenance.edit(sessions.setDeleteConfirm),
    setEncounterQuery: maintenance.edit(search.setQuery),
    setTreasureEditor: maintenance.edit(rewards.setTreasureEditor),
    setDistribution: maintenance.edit(rewards.setDistribution),
    mutate: maintenance.edit(workspace.mutate),
    patchScene: maintenance.edit(workspace.patchScene),
    saveDraft: maintenance.command(sessions.saveDraft, null),
    openSession: maintenance.command(sessions.openSession, undefined),
    submitName: maintenance.command(sessions.submitName, undefined),
    deleteSession: maintenance.command(sessions.deleteSession, undefined),
    requestPreparation: maintenance.command(
      preparation.requestPreparation,
      undefined
    ),
    generate: maintenance.command(preparation.generate, undefined),
    cancelPreparation: maintenance.command(
      preparation.cancelPreparation,
      undefined
    ),
    materializeReward: maintenance.command(
      rewards.materializeReward,
      undefined
    ),
    applyWorkspace: workspace.applyWorkspace,
    planner
  }
}
