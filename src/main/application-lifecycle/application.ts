import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { CoreProcessClient } from '../core-process/core-process-client.js'
import { createMainWindow } from '../windows/main-window.js'
import { createSecondaryWindow } from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
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
  ipcMain.handle('campaign:list', () => requireCore().list())
  ipcMain.handle('campaign:create', (_event, raw) =>
    requireCore().create(createCampaignInputSchema.parse(raw).name)
  )
  ipcMain.handle('campaign:activate', (_event, raw) =>
    requireCore().activate(activateCampaignInputSchema.parse(raw).id)
  )
  createMainWindow()
  if (process.env['SALT_MARCHER_E2E'] !== 'true') createSecondaryWindow()
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
