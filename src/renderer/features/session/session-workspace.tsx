import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { Dispatch, SetStateAction } from 'react'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { SessionCenterPanel } from './session-center-panel.js'
import { SessionControlPanel } from './session-control-panel.js'
import { SessionDialogHost } from './session-dialog-host.js'
import { SessionGroupsPanel } from './session-groups-panel.js'
import { SessionPanelLayout } from './session-panel-layout.js'
import type { SessionScenario } from './session-scenario.js'
import { SessionScenarioPanel } from './session-scenario-panel.js'
import type { SessionTravelSlots } from './session-travel-slots.js'
import { useSessionWorkspaceController } from './use-session-workspace-controller.js'
import './session-workspace.css'

export default function SessionWorkspace(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: Dispatch<SetStateAction<LiveSessionSnapshot>>
  scenario: SessionScenario
  setScenario: (scenario: SessionScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
  travel: SessionTravelSlots
}) {
  const reference = useReferenceContext()
  const { model, actions } = useSessionWorkspaceController({
    snapshot: props.snapshot,
    setSnapshot: props.setSnapshot,
    onError: props.onError
  })
  const control = (
    <SessionControlPanel model={model.control} actions={actions} />
  )
  const groups = <SessionGroupsPanel model={model.groups} actions={actions} />
  const details = (
    <SessionCenterPanel
      focused={model.focused}
      layout={props.layout}
      setLayout={props.setLayout}
      travel={props.travel}
      onError={props.onError}
      inspectCreature={actions.inspectCreature}
    />
  )
  const scenario = (
    <SessionScenarioPanel
      snapshot={model.snapshot}
      loot={model.loot}
      setSnapshot={props.setSnapshot}
      scenario={props.scenario}
      setScenario={props.setScenario}
      layout={props.layout}
      setLayout={props.setLayout}
      onError={props.onError}
      travel={props.travel}
      openReference={reference.openReference}
      manageGroups={actions.manageGroups}
      reinforce={actions.reinforce}
      distribute={actions.distribute}
    />
  )

  return (
    <section
      className="session-mockup"
      aria-label={message('ui.session.workspace')}
    >
      <div className="session-layout">
        <SessionPanelLayout
          preference={props.layout}
          changed={props.setLayout}
          control={control}
          groups={groups}
          details={details}
          scenario={scenario}
        />
      </div>
      <SessionDialogHost
        model={model}
        actions={actions}
        onError={props.onError}
      />
    </section>
  )
}
