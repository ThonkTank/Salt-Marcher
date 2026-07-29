import { BrowserWindow } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'

export function createSecondaryWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 500,
    height: 360,
    show: false,
    webPreferences: {
      preload: outputPath('preload', 'index.mjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      additionalArguments: ['--salt-marcher-read-only']
    }
  })
  hardenWebContents(window.webContents)
  window.once('ready-to-show', () => window.show())
  if (process.env['ELECTRON_RENDERER_URL'] !== undefined) {
    void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?readonly=1`)
  } else {
    void window.loadFile(outputPath('renderer', 'index.html'), {
      query: { readonly: '1' }
    })
  }
  return window
}
