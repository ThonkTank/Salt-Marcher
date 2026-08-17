import SessionWorkspace from '../../session/session-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'
import { useSessionTravelIntegration } from '../integrations/session-travel.js'

export default function SessionSurface(props: WorkspaceSurfaceProps) {
  const travel = useSessionTravelIntegration({
    snapshot: props.snapshot,
    setSnapshot: props.setSnapshot,
    onError: props.onError,
    active: props.layout.centerTab === 'map' || props.scenario === 'travel'
  })
  return (
    <SessionWorkspace
      snapshot={props.snapshot}
      setSnapshot={props.setSnapshot}
      scenario={props.scenario}
      setScenario={props.setScenario}
      layout={props.layout}
      setLayout={props.setLayout}
      onError={props.onError}
      travel={travel}
    />
  )
}
