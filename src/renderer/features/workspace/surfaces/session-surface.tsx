import { lazy, Suspense } from 'react'
import { message } from '../../../i18n/session-runtime.de.js'

const SceneDesktop = lazy(() =>
  import('./desktop-session-surface.js').then((module) => ({
    default: module.DesktopSessionSurface
  }))
)
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

export default function SessionSurface(props: WorkspaceSurfaceProps) {
  return (
    <Suspense fallback={<p role="status">{message('desktop.loading')}</p>}>
      <div className="session-surface">
        <SceneDesktop {...props} />
      </div>
    </Suspense>
  )
}
