import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { CoreProcessSupervisor } from '../core-process/core-process-supervisor.js'
import { createMainWindow } from '../windows/main-window.js'
import {
  createSecondaryWindow,
  isReadOnlyWindow
} from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath, resourcePath } from './runtime-paths.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { coreProcessStatusSchema } from '../../shared/contracts/runtime.js'
import {
  emptyPassiveProjection,
  passiveProjectionSchema
} from '../../shared/contracts/passive-display.js'
import { registerCapabilities } from './capability-registration.js'

let core: CoreProcessSupervisor | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessSupervisor(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js'),
    resourcePath('reference', 'srd-5.1.sqlite')
  )
  connectCoreNotifications(core)
  void core.waitUntilReady().catch(() => {
    // The shell stays visible and exposes explicit recovery through core status.
  })

  registerCapabilities(core)
  createMainWindow()
  if (process.argv.includes('--passive-e2e')) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

function connectCoreNotifications(supervisor: CoreProcessSupervisor): void {
  supervisor.onStatus((status) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(
        'runtime:core-status-changed',
        coreProcessStatusSchema.parse(status)
      )
  })
  supervisor.onSessionChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('session:changed', notice)
      if (isReadOnlyWindow(window.webContents))
        window.webContents.send(
          'projection:changed',
          passiveProjectionSchema.parse(emptyPassiveProjection)
        )
    }
  })
  supervisor.onReferenceChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('references:index-changed', notice)
  })
  supervisor.onHexChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send('hex:changed', notice)
  })
}

export async function stopApplication(): Promise<void> {
  await core?.closeGracefully()
  core = undefined
}

export function waitForCoreReady(): Promise<void> {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core.waitUntilReady()
}
