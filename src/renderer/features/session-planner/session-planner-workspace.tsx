import { message } from '../../i18n/session-runtime.de.js'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import { BudgetPanel } from './budget-panel.js'
import { PreparationStatus } from './preparation-status.js'
import { SceneInspector } from './scene-inspector.js'
import { SceneSequence } from './scene-sequence.js'
import { SessionCatalog } from './session-catalog.js'
import { SessionPlannerDialogHost } from './session-planner-dialog-host.js'
import { useSessionPlannerController } from './use-session-planner-controller.js'
import './session-planner.css'

export function SessionPlannerWorkspace(props: WorkspaceSurfaceProps) {
  const controller = useSessionPlannerController(props.onError)
  const { workspace, draft, draftProjection } = controller

  if (controller.loading || !workspace || !draft || !draftProjection)
    return (
      <section className="session-planner-loading" role="status">
        {message('planner.loading')}
      </section>
    )

  return (
    <section className="session-planner" aria-label={message('planner.title')}>
      <SessionCatalog
        workspace={workspace}
        draft={draft}
        dirty={controller.dirty}
        participantsOpen={controller.participantsOpen}
        seed={controller.seed}
        preparationRunning={controller.preparationRunning}
        openSession={(sessionId) => void controller.openSession(sessionId)}
        createSession={() => {
          controller.setName(message('planner.newSession'))
          controller.setNameDialog('create')
        }}
        renameSession={() => {
          controller.setName(workspace.session.name)
          controller.setNameDialog('rename')
        }}
        deleteSession={() => controller.setDeleteConfirm(true)}
        toggleParticipants={() =>
          controller.setParticipantsOpen(!controller.participantsOpen)
        }
        mutate={controller.mutate}
        setSeed={controller.setSeed}
        save={() => void controller.saveDraft()}
        prepare={() => void controller.generate()}
        cancelPreparation={() => void controller.cancelPreparation()}
      />
      <PreparationStatus
        stage={controller.stage}
        detail={controller.stageMessage}
      />

      <div className="planner-body">
        <SceneSequence
          draft={draft}
          mutate={controller.mutate}
          patchScene={controller.patchScene}
        />
        <SceneInspector
          workspace={workspace}
          draft={draft}
          selectedScene={controller.selectedScene}
          selectedProjection={controller.selectedProjection}
          encounterQuery={controller.encounterQuery}
          encounterSearch={controller.encounterSearch}
          setEncounterQuery={controller.setEncounterQuery}
          mutate={controller.mutate}
          patchScene={controller.patchScene}
          materializeReward={(
            runId,
            generatedTreasureId,
            label,
            edit,
            placed
          ) =>
            void controller.materializeReward(
              runId,
              generatedTreasureId,
              label,
              edit,
              placed
            )
          }
          distribute={controller.setDistribution}
        />
        <BudgetPanel budget={draftProjection.budget} />
      </div>

      <SessionPlannerDialogHost
        snapshot={props.snapshot}
        onError={props.onError}
        workspace={workspace}
        selectedScene={controller.selectedScene}
        selectedProjection={controller.selectedProjection}
        seed={controller.seed}
        stageMessage={controller.stageMessage}
        confirmation={controller.confirmation}
        nameDialog={controller.nameDialog}
        name={controller.name}
        deleteConfirm={controller.deleteConfirm}
        treasureEditor={controller.treasureEditor}
        distribution={controller.distribution}
        setConfirmation={controller.setConfirmation}
        setNameDialog={controller.setNameDialog}
        setName={controller.setName}
        setDeleteConfirm={controller.setDeleteConfirm}
        setTreasureEditor={controller.setTreasureEditor}
        setDistribution={controller.setDistribution}
        cancelPreparation={controller.cancelPreparation}
        requestPreparation={controller.requestPreparation}
        submitName={controller.submitName}
        deleteSession={controller.deleteSession}
        refreshWorkspace={() =>
          void controller.planner.read().then(controller.applyWorkspace)
        }
      />
    </section>
  )
}
