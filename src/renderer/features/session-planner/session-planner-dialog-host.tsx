import { lazy, Suspense } from 'react'
import type { Treasure } from '../../../shared/contracts/loot.js'
import type {
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import type { PlannerDraftProjection } from './planner-draft.js'

const LazyTreasureEditorDialog = lazy(async () => {
  const module = await import('../loot/treasure-editor-dialog.js')
  return { default: module.TreasureEditorDialog }
})

const LazyRewardDistributionDialog = lazy(async () => {
  const module = await import('../loot/reward-distribution-dialog.js')
  return { default: module.RewardDistributionDialog }
})

export function SessionPlannerDialogHost(props: {
  snapshot: WorkspaceSurfaceProps['snapshot']
  onError: WorkspaceSurfaceProps['onError']
  workspace: SessionPlannerWorkspace
  selectedScene: SessionPlannerScene | null
  selectedProjection: PlannerDraftProjection['scenes'][number] | undefined
  seed: number
  stageMessage: string
  confirmation: {
    operationId: string
    target: SessionPlannerWorkspace
  } | null
  nameDialog: 'create' | 'rename' | null
  name: string
  deleteConfirm: boolean
  treasureEditor: Treasure | null | false
  distribution: Treasure | null
  setConfirmation: (value: null) => void
  setNameDialog: (value: 'create' | 'rename' | null) => void
  setName: (name: string) => void
  setDeleteConfirm: (value: boolean) => void
  setTreasureEditor: (value: Treasure | null | false) => void
  setDistribution: (value: Treasure | null) => void
  cancelPreparation: () => Promise<void>
  requestPreparation: (
    target: SessionPlannerWorkspace,
    operationId: string,
    confirmedReplacement: boolean,
    seed: number
  ) => Promise<void>
  submitName: () => Promise<void>
  deleteSession: () => Promise<void>
  refreshWorkspace: () => void
}) {
  return (
    <>
      {props.confirmation && (
        <ModalDialog
          role="alertdialog"
          className="planner-confirm-dialog"
          ariaLabel={message('planner.replaceTitle')}
          onClose={() => void props.cancelPreparation()}
        >
          <h2>{message('planner.replaceTitle')}</h2>
          <p>{props.stageMessage}</p>
          <footer>
            <button
              type="button"
              onClick={() => void props.cancelPreparation()}
            >
              {message('action.cancel')}
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                const current = props.confirmation!
                props.setConfirmation(null)
                void props.requestPreparation(
                  current.target,
                  current.operationId,
                  true,
                  props.seed
                )
              }}
            >
              {message('planner.replaceAction')}
            </button>
          </footer>
        </ModalDialog>
      )}

      {props.nameDialog && (
        <ModalDialog
          className="planner-name-dialog"
          ariaLabel={
            props.nameDialog === 'create'
              ? message('planner.sessionCreate')
              : message('planner.rename')
          }
          onClose={() => props.setNameDialog(null)}
        >
          <h2>
            {props.nameDialog === 'create'
              ? message('planner.sessionCreate')
              : message('planner.rename')}
          </h2>
          <label>
            {message('loot.label')}
            <input
              autoFocus
              value={props.name}
              onChange={(event) => props.setName(event.target.value)}
            />
          </label>
          <footer>
            <button type="button" onClick={() => props.setNameDialog(null)}>
              {message('action.cancel')}
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!props.name.trim()}
              onClick={() => void props.submitName()}
            >
              {message('action.save')}
            </button>
          </footer>
        </ModalDialog>
      )}

      {props.deleteConfirm && (
        <ModalDialog
          role="alertdialog"
          className="planner-confirm-dialog"
          ariaLabel={message('planner.deleteAction')}
          onClose={() => props.setDeleteConfirm(false)}
        >
          <h2>
            {formatMessage('planner.deleteTitle', {
              name: props.workspace.session.name
            })}
          </h2>
          <p>{message('planner.deleteHint')}</p>
          <footer>
            <button type="button" onClick={() => props.setDeleteConfirm(false)}>
              {message('action.cancel')}
            </button>
            <button type="button" onClick={() => void props.deleteSession()}>
              {message('planner.deleteAction')}
            </button>
          </footer>
        </ModalDialog>
      )}

      <Suspense fallback={null}>
        {props.treasureEditor !== false && (
          <LazyTreasureEditorDialog
            snapshot={props.snapshot}
            initialAnchor={{ kind: 'unplaced' }}
            treasure={props.treasureEditor}
            close={() => props.setTreasureEditor(false)}
            saved={() => {
              props.setTreasureEditor(false)
              props.refreshWorkspace()
            }}
            onError={props.onError}
          />
        )}

        {props.distribution && (
          <LazyRewardDistributionDialog
            treasure={props.distribution}
            snapshot={props.snapshot}
            context={{
              kind: props.selectedScene?.encounterPlanId
                ? 'encounter'
                : 'quest',
              label: props.selectedScene?.title ?? props.workspace.session.name,
              xp:
                props.selectedProjection?.encounter?.status === 'ready'
                  ? props.selectedProjection.encounter.summary.adjustedXp
                  : null
            }}
            close={() => props.setDistribution(null)}
            completed={() => {
              props.setDistribution(null)
              props.refreshWorkspace()
            }}
            onError={props.onError}
          />
        )}
      </Suspense>
    </>
  )
}
