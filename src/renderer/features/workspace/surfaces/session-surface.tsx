import SessionWorkspace from '../../session/session-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

export default function SessionSurface(props: WorkspaceSurfaceProps) {
  return (
    <SessionWorkspace
      snapshot={props.snapshot}
      setSnapshot={props.setSnapshot}
      groupDialogOpen={props.groupDialogOpen}
      setGroupDialogOpen={props.setGroupDialogOpen}
      scenario={props.scenario}
      setScenario={props.setScenario}
      layout={props.layout}
      setLayout={props.setLayout}
      onError={props.onError}
    />
  )
}
