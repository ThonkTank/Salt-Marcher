import { app, BrowserWindow } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'
import { isE2eRuntime } from '../application-lifecycle/e2e-runtime.js'
import { observeRendererProcess } from './renderer-observability.js'
import { mainWindowGeometry } from '../../shared/contracts/window-geometry.js'

export function createMainWindow(title = 'SaltMarcher'): BrowserWindow {
  const window = new BrowserWindow({
    title,
    width: mainWindowGeometry.defaultWidth,
    height: mainWindowGeometry.defaultHeight,
    minWidth: mainWindowGeometry.minimumWidth,
    minHeight: mainWindowGeometry.minimumHeight,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: outputPath('preload', 'index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      additionalArguments: isE2eRuntime() ? ['--salt-marcher-e2e'] : []
    }
  })
  window.setMenuBarVisibility(false)
  window.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle(title)
  })
  hardenWebContents(window.webContents)
  observeRendererProcess(window.webContents)
  window.once('ready-to-show', () => window.show())
  const rendererUrl = developmentRendererUrl()
  if (rendererUrl !== undefined) {
    void window.loadURL(
      process.argv.includes('--m1-qualification')
        ? `${rendererUrl}/qualification.html`
        : rendererUrl
    )
  } else {
    void window.loadFile(
      outputPath(
        'renderer',
        process.argv.includes('--m1-qualification')
          ? 'qualification.html'
          : 'index.html'
      )
    )
  }
  return window
}

function developmentRendererUrl(): string | undefined {
  const value = process.env['ELECTRON_RENDERER_URL']
  if (app.isPackaged || value === undefined) return undefined
  const url = new URL(value)
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)
    ? value
    : undefined
}
