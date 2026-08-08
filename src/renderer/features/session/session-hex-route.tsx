import type { ComponentType } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { ModuleHost } from '../../shell/module-host.js'

type MapProps = Readonly<{
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}>

type TravelProps = MapProps & Readonly<{ openMap: () => void }>

const loadMap = () =>
  import('../hex/session-map-surface.js') as Promise<{
    default: ComponentType<MapProps>
  }>
const loadTravel = () =>
  import('../hex/travel-surface.js') as Promise<{
    default: ComponentType<TravelProps>
  }>

export function SessionHexRoute(
  props:
    | Readonly<{ kind: 'map'; surfaceProps: MapProps }>
    | Readonly<{ kind: 'travel'; surfaceProps: TravelProps }>
) {
  const api = useCapabilityApi()
  const common = {
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
  }
  return props.kind === 'map' ? (
    <ModuleHost
      {...common}
      load={loadMap}
      componentProps={props.surfaceProps}
    />
  ) : (
    <ModuleHost
      {...common}
      load={loadTravel}
      componentProps={props.surfaceProps}
    />
  )
}
