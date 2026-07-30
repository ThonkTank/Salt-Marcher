import { app, BrowserWindow } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'
import { isE2eRuntime } from '../application-lifecycle/e2e-runtime.js'

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: 'SaltMarcher',
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
  const rendererUrl = developmentRendererUrl()
  if (rendererUrl !== undefined) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(outputPath('renderer', 'index.html'))
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
