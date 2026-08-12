import { SessionPlannerWorkspace } from '../../session-planner/session-planner-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

export default function PlannerSurface(props: WorkspaceSurfaceProps) {
  return <SessionPlannerWorkspace {...props} />
}
