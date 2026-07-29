import { BrowserWindow } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'
import { isE2eRuntime } from '../application-lifecycle/e2e-runtime.js'

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 540,
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
  hardenWebContents(window.webContents)
  window.once('ready-to-show', () => window.show())
  if (process.env['ELECTRON_RENDERER_URL'] !== undefined) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(outputPath('renderer', 'index.html'))
  }
  return window
}
