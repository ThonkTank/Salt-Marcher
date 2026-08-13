import { app, BrowserWindow, ipcMain } from 'electron'
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
import {
  emptyPassiveProjection,
  passiveProjectionSchema
} from '../../shared/contracts/passive-display.js'
import { registerCapabilities } from './capability-registration.js'
import { capabilityEvents } from '../../shared/contracts/events.js'
import { isE2eRuntime } from './e2e-runtime.js'

let core: CoreProcessSupervisor | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessSupervisor(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js'),
    resourcePath('reference', 'srd-5.1.sqlite'),
    resourcePath('sessiongeneration')
  )
  if (isE2eRuntime())
    ipcMain.handle('salt-marcher-e2e:terminate-utility', () =>
      core?.terminateUtilityForE2e()
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
        capabilityEvents['runtime.onCoreStatus'].channel,
        capabilityEvents['runtime.onCoreStatus'].payload.parse(status)
      )
  })
  supervisor.onSessionChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(
        capabilityEvents['session.onChanged'].channel,
        capabilityEvents['session.onChanged'].payload.parse(notice)
      )
      if (isReadOnlyWindow(window.webContents))
        window.webContents.send(
          'projection:changed',
          passiveProjectionSchema.parse(emptyPassiveProjection)
        )
    }
  })
  supervisor.onLootChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['loot.onChanged'].channel,
          capabilityEvents['loot.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onPreparationChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['sessionPlanner.onPreparationChanged'].channel,
          capabilityEvents['sessionPlanner.onPreparationChanged'].payload.parse(
            notice
          )
        )
  })
  supervisor.onReferenceChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(
        capabilityEvents['references.onCampaignIndexChanged'].channel,
        capabilityEvents['references.onCampaignIndexChanged'].payload.parse(
          notice
        )
      )
  })
  supervisor.onHexChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['hex.onChanged'].channel,
          capabilityEvents['hex.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onLocationsChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['locations.onChanged'].channel,
          capabilityEvents['locations.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onLocationSymbolsChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['locationSymbols.onChanged'].channel,
          capabilityEvents['locationSymbols.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onBiomesChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['biomes.onChanged'].channel,
          capabilityEvents['biomes.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onEncounterTablesChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['encounterTables.onChanged'].channel,
          capabilityEvents['encounterTables.onChanged'].payload.parse(notice)
        )
  })
}

export async function stopApplication(): Promise<void> {
  await core?.closeGracefully()
  core = undefined
  if (isE2eRuntime())
    ipcMain.removeHandler('salt-marcher-e2e:terminate-utility')
}

export function waitForCoreReady(): Promise<void> {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core.waitUntilReady()
}

export async function runSessionGenerationSmoke(): Promise<void> {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  await core.waitUntilReady()
  const identity = await core.requestOperation(
    'core.sessionGenerationCatalog',
    undefined
  )
  if (!identity.catalogVersion || !identity.catalogContentHash)
    throw new Error('Packaged session-generation catalog smoke failed')
}
