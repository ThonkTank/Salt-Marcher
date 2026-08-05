import type { WebContents } from 'electron'

type RendererProcessIncident = Readonly<{
  event: 'renderer-process-incident'
  kind: 'load-failed' | 'process-gone' | 'unresponsive' | 'responsive'
  occurredAt: string
  details?: Readonly<Record<string, string | number>>
}>

/** Records native renderer failures without exposing navigation or user data. */
export function observeRendererProcess(webContents: WebContents): void {
  webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      record({
        event: 'renderer-process-incident',
        kind: 'load-failed',
        occurredAt: new Date().toISOString(),
        details: { errorCode, errorDescription }
      })
    }
  )
  webContents.on('render-process-gone', (_event, details) => {
    record({
      event: 'renderer-process-incident',
      kind: 'process-gone',
      occurredAt: new Date().toISOString(),
      details: { reason: details.reason, exitCode: details.exitCode }
    })
  })
  webContents.on('unresponsive', () =>
    record({
      event: 'renderer-process-incident',
      kind: 'unresponsive',
      occurredAt: new Date().toISOString()
    })
  )
  webContents.on('responsive', () =>
    record({
      event: 'renderer-process-incident',
      kind: 'responsive',
      occurredAt: new Date().toISOString()
    })
  )
}

function record(incident: RendererProcessIncident): void {
  console.error(JSON.stringify(incident))
}
