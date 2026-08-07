import type { ReactElement } from 'react'
import type { HexMapCanvasProps } from './hex-map-canvas-pixi.js'
import { ModuleHost } from '../../shell/module-host.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { message } from '../../i18n/hex-runtime.de.js'

const loadPixiCanvas = async () => {
  const module = await import('./hex-map-canvas-pixi.js')
  return { default: module.HexMapCanvasPixi }
}

/** Keeps Pixi and its WebGL runtime outside workspace chunks until a map is visible. */
export function HexMapCanvas(props: HexMapCanvasProps): ReactElement {
  const api = useCapabilityApi()
  const reportFailure: NonNullable<HexMapCanvasProps['onRendererFailure']> = (
    phase,
    error
  ) => {
    void api.runtime
      .reportRendererIncident({
        scope: 'canvas',
        workspace: 'hex',
        phase,
        code: `canvas.${phase}`,
        errorName: /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error.name)
          ? error.name
          : 'Error',
        message: 'Canvas renderer failed',
        recoveryClass: 'remount-surface'
      })
      .catch(() => undefined)
  }
  return (
    <ModuleHost
      workspace="hex"
      load={loadPixiCanvas}
      componentProps={{ ...props, onRendererFailure: reportFailure }}
      loadingMessage={message('hex.loading')}
      failureMessage={message(
        'ui.die.kartenansicht.konnte.nicht.initialisiert.werden.navigation.und'
      )}
      recoveryMessage={message('workspace.reloadHint')}
      retryLabel={message('ui.kartenansicht.erneut.laden')}
      reloadLabel={message('action.reloadApplication')}
      recoveryPolicy={{
        moduleFailure: 'retry-or-reload',
        renderFailure: 'remount'
      }}
      reportIncident={(incident) =>
        api.runtime.reportRendererIncident(incident)
      }
      reloadRenderer={() => api.runtime.reloadRenderer()}
    />
  )
}
