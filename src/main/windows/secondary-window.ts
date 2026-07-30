import { app, BrowserWindow, type WebContents } from 'electron'
import { hardenWebContents } from '../security/security.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'

const readOnlyContents = new WeakSet<WebContents>()

export function createSecondaryWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: 'SaltMarcher (read-only)',
    width: 500,
    height: 360,
    show: false,
    webPreferences: {
      preload: outputPath('preload', 'index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      additionalArguments: ['--salt-marcher-read-only']
    }
  })
  readOnlyContents.add(window.webContents)
  hardenWebContents(window.webContents)
  window.once('ready-to-show', () => window.show())
  const rendererUrl = developmentRendererUrl()
  if (rendererUrl !== undefined) {
    void window.loadURL(`${rendererUrl}?readonly=1`)
  } else {
    void window.loadFile(outputPath('renderer', 'index.html'), {
      query: { readonly: '1' }
    })
  }
  return window
}

export function isReadOnlyWindow(contents: WebContents): boolean {
  return readOnlyContents.has(contents)
}

function developmentRendererUrl(): string | undefined {
  const value = process.env['ELECTRON_RENDERER_URL']
  if (app.isPackaged || value === undefined) return undefined
  const url = new URL(value)
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)
    ? value
    : undefined
}
