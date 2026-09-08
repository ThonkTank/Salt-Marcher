import { lazy, Suspense } from 'react'
import { message } from '../../../i18n/session-runtime.de.js'

const SceneDesktop = lazy(() =>
  import('./desktop-session-surface.js').then((module) => ({
    default: module.DesktopSessionSurface
  }))
)
import SessionWorkspace from '../../session/session-workspace.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'
import { useSessionTravelIntegration } from '../integrations/session-travel.js'

export default function SessionSurface(props: WorkspaceSurfaceProps) {
  if (props.desktopPreview)
    return (
      <Suspense fallback={<p role="status">{message('desktop.loading')}</p>}>
        <div className="session-surface">
          <SceneDesktop {...props} />
        </div>
      </Suspense>
    )
  return <LegacySessionSurface {...props} />
}

function LegacySessionSurface(props: WorkspaceSurfaceProps) {
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
