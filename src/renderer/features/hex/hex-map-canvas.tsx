import type { ReactElement } from 'react'
import type { HexMapCanvasProps } from './hex-map-canvas-pixi.js'
import { ModuleHost } from '../../shell/module-host.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { message } from '../../i18n/messages.de.js'

const loadPixiCanvas = async () => {
  const module = await import('./hex-map-canvas-pixi.js')
  return { default: module.HexMapCanvasPixi }
}

/** Keeps Pixi and its WebGL runtime outside workspace chunks until a map is visible. */
export function HexMapCanvas(props: HexMapCanvasProps): ReactElement {
  const api = useCapabilityApi()
  return (
    <ModuleHost
      workspace="hex"
      load={loadPixiCanvas}
      componentProps={props}
      loadingMessage={message('hex.loading')}
      failureMessage={message(
        'ui.die.kartenansicht.konnte.nicht.initialisiert.werden.navigation.und'
      )}
      recoveryMessage={message('workspace.reloadHint')}
      retryLabel={message('ui.kartenansicht.erneut.laden')}
      reloadLabel={message('action.reloadApplication')}
      reportIncident={api.runtime.reportRendererIncident}
      reloadRenderer={api.runtime.reloadRenderer}
    />
  )
}
