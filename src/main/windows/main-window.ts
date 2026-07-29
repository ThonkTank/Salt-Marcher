import { BrowserWindow } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'

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
      additionalArguments: process.env['SALT_MARCHER_E2E'] === 'true' ? ['--salt-marcher-e2e'] : []
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
