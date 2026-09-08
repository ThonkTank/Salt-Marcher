import { recoverWithDialog } from './startup-recovery.js'
import {
  recoverLocalMaintenance,
  completeLocalMaintenance,
  rollbackLocalMaintenance
} from '../local-profile/maintenance.js'
import { relaunchRelease } from '../release/relaunch.js'
import {
  configureReleaseQualification,
  qualifyRelease,
  releaseQualificationEnabled
} from '../release/qualification.js'
import { existsSync } from 'node:fs'
import { ReleaseController } from '../release/controller.js'
import { releaseRoot } from '../release/paths.js'
import {
  recoverRelease,
  completeRelease,
  rollbackRelease
} from '../release/recovery.js'
import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
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
import { loadBuildInfo, windowTitleForBuild } from './build-info.js'
import { runtimeEvidenceSchema } from '../../shared/contracts/runtime-evidence.js'
import { type ProfileLock } from '../local-profile/local-profile-lock.js'

import { openApplicationProfile } from '../local-profile/application-profile.js'

let core: CoreProcessSupervisor | undefined
let localProfileLock: ProfileLock | undefined

export async function startApplication(): Promise<void> {
  const buildInfo = loadBuildInfo()
  const windowTitle = windowTitleForBuild(buildInfo)
  const release =
    buildInfo?.channel === 'release' &&
    process.platform === 'linux' &&
    process.arch === 'x64'
  let profile = release
    ? join(releaseRoot(), 'profile')
    : app.getPath('userData')
  if (process.platform === 'linux') {
    const access = openApplicationProfile(
      profile,
      app,
      buildInfo?.channel === 'local' || release ? dirname(profile) : undefined
    )
    localProfileLock = access
    profile = access.profile
  }
  try {
    await app.whenReady()
    configureSecurity()
    configureReleaseQualification()
    const installationRoot = dirname(profile)
    const local = buildInfo?.channel === 'local'
    const recovery = await recoverWithDialog(
      () =>
        release
          ? recoverRelease()
          : local
            ? recoverLocalMaintenance(installationRoot, buildInfo.commit)
            : 'normal',
      installationRoot,
      !process.argv.includes('--smoke-test')
    )
    if (recovery === null) {
      app.quit()
      return
    }
    if (recovery === 'relaunch') {
      relaunchRelease(
        join(installationRoot, 'current', 'SaltMarcher.AppImage'),
        local ? [`--user-data-dir=${profile}`] : []
      )
      app.quit()
      return
    }
    await startApplicationWithProfileLock(
      buildInfo,
      windowTitle,
      profile,
      recovery === 'verify'
    )
  } catch (error) {
    if (core === undefined || core.status() === 'closed') {
      localProfileLock?.release()
      localProfileLock = undefined
    }
    throw error
  }
}

async function startApplicationWithProfileLock(
  buildInfo: ReturnType<typeof loadBuildInfo>,
  windowTitle: string,
  profile: string,
  verifyMaintenance = false
): Promise<void> {
  if (buildInfo !== undefined)
    console.info(
      JSON.stringify({
        component: 'build-identity',
        event: 'loaded',
        ...buildInfo
      })
    )
  const packaged = app.isPackaged
  core = new CoreProcessSupervisor(
    {
      dataRoot: join(profile, packaged ? 'campaign-data' : 'development-data'),
      referenceDatabasePath: resourcePath('reference', 'srd-5.1.sqlite'),
      sessionGenerationCatalogRoot: resourcePath('sessiongeneration'),
      incompatibleDataPolicy: 'preserve'
    },
    outputPath('main', 'utility.js')
  )
  if (isE2eRuntime()) {
    ipcMain.handle('salt-marcher-e2e:terminate-utility', () =>
      core?.terminateUtilityForE2e()
    )
    ipcMain.handle('salt-marcher-e2e:interrupt-generator-preset-create', () =>
      core?.interruptNextResultForE2e('generatorPresets.create')
    )
    ipcMain.handle('salt-marcher-e2e:interrupt-campaign-create', () =>
      core?.interruptNextResultForE2e('campaign.create')
    )
    ipcMain.handle('salt-marcher-e2e:runtime-evidence', async () => {
      if (core === undefined) throw new Error('Core is unavailable')
      return runtimeEvidenceSchema.parse({
        capturedAt: new Date().toISOString(),
        supervisor: await core.runtimeMetrics(),
        processes: app.getAppMetrics().map((metric) => ({
          pid: metric.pid,
          type: metric.type,
          cpuPercent: Math.max(0, metric.cpu.percentCPUUsage),
          idleWakeupsPerSecond: Math.max(0, metric.cpu.idleWakeupsPerSecond),
          workingSetSizeKiB: Math.max(0, metric.memory.workingSetSize)
        }))
      })
    })
  }
  connectCoreNotifications(core)
  void core.waitUntilReady().catch(() => {
    // The shell stays visible and exposes explicit recovery through core status.
  })

  const supervisor = core
  const releases = new ReleaseController(
    buildInfo?.channel === 'release' &&
      process.platform === 'linux' &&
      process.arch === 'x64',
    async () => {
      await supervisor.closeGracefully()
    },
    () => supervisor.resumeAfterMaintenance()
  )
  if (verifyMaintenance) {
    try {
      await supervisor.waitUntilReady()
      if (buildInfo?.channel === 'local')
        completeLocalMaintenance(dirname(profile), buildInfo.commit)
      else completeRelease()
    } catch (error) {
      await supervisor.closeGracefully()
      const installationRoot = dirname(profile)
      if (buildInfo?.channel === 'local')
        rollbackLocalMaintenance(installationRoot)
      else rollbackRelease()
      if (existsSync(join(installationRoot, 'current')))
        relaunchRelease(
          join(installationRoot, 'current', 'SaltMarcher.AppImage'),
          buildInfo?.channel === 'local' ? [`--user-data-dir=${profile}`] : []
        )
      app.quit()
      throw error
    }
  }
  registerCapabilities(core, releases)
  createMainWindow(windowTitle)
  if (releaseQualificationEnabled()) {
    await supervisor.waitUntilReady()
    void qualifyRelease(releases, verifyMaintenance, async () => {
      await supervisor.requestOperation('campaign.create', {
        commandId: crypto.randomUUID(),
        expectedRegistryRevision: 0,
        name: 'Update-Abnahme'
      })
    })
    return
  }
  void releases.automaticCheck()
  const updateTimer = setInterval(() => {
    void releases.automaticCheck()
  }, 86_400_000)
  updateTimer.unref()
  if (process.argv.includes('--passive-e2e')) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createMainWindow(windowTitle)
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
  supervisor.onNpcsChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['npcs.onChanged'].channel,
          capabilityEvents['npcs.onChanged'].payload.parse(notice)
        )
  })
  supervisor.onFactionsChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!isReadOnlyWindow(window.webContents))
        window.webContents.send(
          capabilityEvents['factions.onChanged'].channel,
          capabilityEvents['factions.onChanged'].payload.parse(notice)
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
  localProfileLock?.release()
  localProfileLock = undefined
  if (isE2eRuntime())
    ipcMain.removeHandler('salt-marcher-e2e:terminate-utility')
  if (isE2eRuntime())
    ipcMain.removeHandler('salt-marcher-e2e:interrupt-generator-preset-create')
  if (isE2eRuntime()) ipcMain.removeHandler('salt-marcher-e2e:runtime-evidence')
}

/** Observe an already requested shutdown without releasing the live profile lease. */
export function waitForCoreTermination(): Promise<void> {
  const supervisor = core
  if (supervisor === undefined || supervisor.status() === 'closed')
    return Promise.resolve()
  return new Promise((resolve) => {
    let unsubscribe = () => {}
    unsubscribe = supervisor.onStatus((status) => {
      if (status !== 'closed') return
      unsubscribe()
      resolve()
    })
  })
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

export async function reportInstalledRuntimeVerification(): Promise<void> {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  await core.waitUntilReady()
  const build = loadBuildInfo()
  const runtime = await core.runtimeMetrics()
  console.info(
    JSON.stringify({
      component: 'installed-runtime-verification',
      event: 'ready',
      windowTitle: windowTitleForBuild(build),
      build,
      runtime
    })
  )
}
