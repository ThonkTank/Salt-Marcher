import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CoreProcessClient } from '../core-process/core-process-client.js'
import { createMainWindow } from '../windows/main-window.js'
import {
  createSecondaryWindow,
  isReadOnlyWindow
} from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
import { isE2eRuntime } from './e2e-runtime.js'
import {
  activateCampaignInputSchema,
  createCampaignInputSchema
} from '../../shared/contracts/campaign.js'

let core: CoreProcessClient | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessClient(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js')
  )
  await core.waitUntilReady()
  ipcMain.handle('campaign:list', (event) => {
    authorize(event, false)
    return requireCore().list()
  })
  ipcMain.handle('campaign:create', (event, raw) => {
    authorize(event, true)
    return requireCore().create(createCampaignInputSchema.parse(raw).name)
  })
  ipcMain.handle('campaign:activate', (event, raw) => {
    authorize(event, true)
    return requireCore().activate(activateCampaignInputSchema.parse(raw).id)
  })
  createMainWindow()
  if (!isE2eRuntime()) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

export function stopApplication(): void {
  core?.close()
  core = undefined
}

function requireCore(): CoreProcessClient {
  if (core === undefined) throw new Error('Core process is not started')
  return core
}

function authorize(event: IpcMainInvokeEvent, requiresWrite: boolean): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new Error('Unauthorized IPC sender')
  if (requiresWrite && isReadOnlyWindow(event.sender)) {
    throw new Error('This window cannot write campaign data')
  }
}
