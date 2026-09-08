import type { DesktopMapView } from '../../../../shared/contracts/scene-desktop.js'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { LiveSessionSnapshot } from '../../../../shared/contracts/live-session.js'
import type {
  HexTravelController,
  HexTravelProviderPort
} from '../../hex/hex-travel-provider-port.js'
import type { SessionTravelSlots } from '../../session/session-travel-slots.js'
import { useTravelController } from '../../travel/use-travel-controller.js'
import { useCapabilityApi } from '../../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../../capabilities/capability-errors.js'
import { message } from '../../../i18n/session-runtime.de.js'
import { ModuleHost } from '../../../shell/module-host.js'

type MapProps = Readonly<{
  controller: HexTravelController
  presentation?: Parameters<SessionTravelSlots['renderMap']>[0]
}>
type ScenarioProps = Readonly<{
  controller: HexTravelController
  openMap: () => void
  mapActive: boolean
}>

const loadMap = () =>
  import('../../hex/hex-workspaces.js').then((module) => ({
    default: module.SessionHexMap as ComponentType<MapProps>
  }))
const loadScenario = () =>
  import('../../hex/hex-workspaces.js').then((module) => ({
    default: module.TravelScenario as ComponentType<ScenarioProps>
  }))

export function useSessionTravelIntegration(options: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  active: boolean
  presentation?: DesktopMapView
  presentationChanged?: (
    view: Pick<DesktopMapView, 'mapId' | 'selected'>
  ) => void
}): SessionTravelSlots {
  const {
    active,
    onError,
    setSnapshot,
    snapshot,
    presentation,
    presentationChanged
  } = options
  const api = useCapabilityApi()
  const [port, setPort] = useState<HexTravelProviderPort | null>(null)

  useEffect(() => {
    if (!active || port) return
    let current = true
    void import('../../hex/hex-travel-provider-port.js').then(
      (module) => {
        if (current) setPort(module.createHexTravelProviderPort(api))
      },
      (cause: unknown) => onError(capabilityErrorText(cause))
    )
    return () => {
      current = false
    }
  }, [active, api, onError, port])

  useEffect(() => () => port?.dispose(), [port])

  const controller = useTravelController({
    port,
    snapshot,
    setSnapshot,
    onError,
    active,
    ...(presentation ? { presentation: presentation } : {})
  })
  useEffect(() => {
    const state = controller.state
    if (
      state.scope?.sceneId !== snapshot.scene.focusedSceneId ||
      (state.lifecycle !== 'ready' && state.lifecycle !== 'unavailable')
    )
      return
    if (
      state.mapId === presentation?.mapId &&
      JSON.stringify(state.selected) === JSON.stringify(presentation?.selected)
    )
      return
    presentationChanged?.({
      mapId: state.mapId,
      selected: state.selected
    })
  }, [
    controller.state,
    presentation,
    presentationChanged,
    snapshot.scene.focusedSceneId
  ])
  const common = useMemo(
    () => ({
      workspace: 'session' as const,
      loadingMessage: message('hex.loading'),
      failureMessage: message(
        'ui.die.kartenansicht.konnte.nicht.initialisiert.werden.navigation.und'
      ),
      recoveryMessage: message('workspace.reloadHint'),
      retryLabel: message('action.retryWorkspace'),
      reloadLabel: message('action.reloadApplication'),
      recoveryPolicy: {
        moduleFailure: 'retry-or-reload' as const,
        renderFailure: 'remount' as const
      },
      reportIncident: (
        incident: Parameters<typeof api.runtime.reportRendererIncident>[0]
      ) => api.runtime.reportRendererIncident(incident),
      reloadRenderer: () => api.runtime.reloadRenderer()
    }),
    [api]
  )

  return useMemo(
    () => ({
      renderMap: (
        presentation?: Parameters<SessionTravelSlots['renderMap']>[0]
      ) => (
        <ModuleHost
          {...common}
          load={loadMap}
          componentProps={{
            controller,
            ...(presentation ? { presentation } : {})
          }}
        />
      ),
      renderScenario: (props: { openMap: () => void; mapActive: boolean }) => (
        <ModuleHost
          {...common}
          load={loadScenario}
          componentProps={{ controller, ...props }}
        />
      )
    }),
    [common, controller]
  )
}
