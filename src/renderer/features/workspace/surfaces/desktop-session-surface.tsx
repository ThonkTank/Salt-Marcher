import { useCallback } from 'react'
import type { DesktopMapView } from '../../../../shared/contracts/scene-desktop.js'
import { SceneDesktop } from '../../scene-desktop/scene-desktop.js'
import { useSceneDesktop } from '../../scene-desktop/use-scene-desktop.js'
import { useSessionTravelIntegration } from '../integrations/session-travel.js'
import type { WorkspaceSurfaceProps } from '../workspace-surface-props.js'

/** Controllers outlive individual windows; Utility owns all domain clocks. */
export function DesktopSessionSurface(props: WorkspaceSurfaceProps) {
  const sceneId = props.snapshot.scene.focusedSceneId
  const { projection, snapshot } = useSceneDesktop(props.campaignId, sceneId)
  const presentationChanged = useCallback(
    (value: Pick<DesktopMapView, 'mapId' | 'selected'>) => {
      const state = projection.snapshot().state
      if (state)
        projection.dispatch({
          type: 'map-view',
          value: { ...state.mapView, ...value }
        })
    },
    [projection]
  )
  const travel = useSessionTravelIntegration({
    campaignId: props.campaignId,
    snapshot: props.snapshot,
    setSnapshot: props.setSnapshot,
    onError: props.onError,
    active: !!snapshot.state,
    ...(snapshot.state ? { presentation: snapshot.state.mapView } : {}),
    presentationChanged
  })
  return <SceneDesktop {...props} travel={travel} />
}
