import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { CoreProcessClient } from '../core-process/core-process-client.js'
import { createMainWindow } from '../windows/main-window.js'
import { isReadOnlyWindow } from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
import {
  activateCampaignInputSchema,
  campaignCapabilityResponseSchema,
  createCampaignInputSchema,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  runtimeGpuObservationSchema,
  type RuntimeGpuObservation
} from '../../shared/qualification/runtime-observation.js'
import {
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema
} from '../../shared/contracts/encounter.js'
import {
  adjustInitiativeInputSchema,
  changeHpInputSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  liveSessionSnapshotSchema,
  prepareCombatInputSchema,
  updateResolutionInputSchema
} from '../../shared/contracts/live-session.js'
import {
  adjustPartyXpInputSchema,
  adventuringDayCalculationSchema,
  adventuringDayInputSchema,
  createPartyCharacterInputSchema,
  deletePartyCharacterInputSchema,
  partySnapshotSchema,
  restPartyInputSchema,
  setMembershipInputSchema,
  updatePartyCharacterInputSchema
} from '../../shared/contracts/party.js'
import { z } from 'zod'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  encounterSelectionEvaluationSchema,
  evaluateEncounterSelectionInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  setSceneLocationInputSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationRequestSchema,
  sceneGroupDraftGenerationSchema
} from '../../shared/contracts/scene.js'
import {
  defaultSessionLayoutPreference,
  sessionLayoutPreferenceSchema
} from '../../shared/contracts/session-layout.js'
import {
  createWorldLocationInputSchema,
  deleteWorldLocationInputSchema,
  updateWorldLocationInputSchema,
  worldLocationSnapshotSchema
} from '../../shared/contracts/world-location.js'
import {
  createEncounterTableInputSchema,
  createWorldFactionInputSchema,
  deleteEncounterTableInputSchema,
  deleteWorldFactionInputSchema,
  encounterTableSnapshotSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema,
  worldFactionSnapshotSchema
} from '../../shared/contracts/encounter-source.js'

let core: CoreProcessClient | undefined

const legacySessionLayoutPreferenceSchema = z
  .object({
    mode: z.enum(['rows', 'columns']),
    rows: z.unknown(),
    columns: z
      .object({
        leftFraction: z.number(),
        leftTopFraction: z.number(),
        rightTopFraction: z.number()
      })
      .strict(),
    upperRightTab: z.enum(['details', 'map'])
  })
  .strict()

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessClient(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js')
  )
  await core.waitUntilReady()
  ipcMain.handle('campaign:list', (event) =>
    invokeCapability(() => {
      authorize(event, false)
      return requireCore().list()
    })
  )
  const sessionLayoutPath = join(app.getPath('userData'), 'session-layout.json')
  ipcMain.handle('session-layout:read', (event) =>
    invokeGeneric(async () => {
      authorize(event, false)
      try {
        const raw: unknown = JSON.parse(
          await readFile(sessionLayoutPath, 'utf8')
        )
        const current = sessionLayoutPreferenceSchema.safeParse(raw)
        if (current.success) return current.data
        const legacy = legacySessionLayoutPreferenceSchema.parse(raw)
        return sessionLayoutPreferenceSchema.parse({
          leftFraction: legacy.columns.leftFraction,
          rightTopFraction: legacy.columns.rightTopFraction,
          upperRightTab: legacy.upperRightTab
        })
      } catch {
        return defaultSessionLayoutPreference
      }
    }, sessionLayoutPreferenceSchema)
  )
  ipcMain.handle('session-layout:save', (event, raw) =>
    invokeGeneric(async () => {
      authorize(event, true)
      const preference = sessionLayoutPreferenceSchema.safeParse(raw)
      if (!preference.success)
        throw new CapabilityError('validation_failed', false)
      const temporary = `${sessionLayoutPath}.tmp`
      await writeFile(temporary, JSON.stringify(preference.data), 'utf8')
      await rename(temporary, sessionLayoutPath)
      return preference.data
    }, sessionLayoutPreferenceSchema)
  )
  ipcMain.handle('campaign:create', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = createCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().create(input.data.name)
    })
  )
  ipcMain.handle('campaign:activate', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = activateCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().activate(input.data.id)
    })
  )
  const capability = <T>(
    channel: string,
    schema: z.ZodType<T>,
    write: boolean,
    parse: z.ZodType<unknown>,
    operation: (input: unknown) => Promise<T>
  ) =>
    ipcMain.handle(channel, (event, raw) =>
      invokeGeneric(() => {
        authorize(event, write)
        const value = parse.safeParse(raw)
        if (!value.success)
          throw new CapabilityError('validation_failed', false)
        return operation(value.data)
      }, schema)
    )
  capability('party:read', partySnapshotSchema, false, z.undefined(), () =>
    requireCore().partyRead()
  )
  capability(
    'party:setMembership',
    partySnapshotSchema,
    true,
    setMembershipInputSchema,
    (v) => {
      const i = v as z.infer<typeof setMembershipInputSchema>
      return requireCore().partySetMembership(
        i.id,
        i.active,
        i.expectedRevision
      )
    }
  )
  capability(
    'party:create',
    partySnapshotSchema,
    true,
    createPartyCharacterInputSchema,
    (v) => {
      const i = v as z.infer<typeof createPartyCharacterInputSchema>
      return requireCore().partyCreate(i.character, i.expectedRevision)
    }
  )
  capability(
    'party:update',
    partySnapshotSchema,
    true,
    updatePartyCharacterInputSchema,
    (v) => {
      const i = v as z.infer<typeof updatePartyCharacterInputSchema>
      return requireCore().partyUpdate(i.id, i.character, i.expectedRevision)
    }
  )
  capability(
    'party:delete',
    partySnapshotSchema,
    true,
    deletePartyCharacterInputSchema,
    (v) => {
      const i = v as z.infer<typeof deletePartyCharacterInputSchema>
      return requireCore().partyDelete(i.id, i.expectedRevision)
    }
  )
  capability(
    'party:adjustXp',
    partySnapshotSchema,
    true,
    adjustPartyXpInputSchema,
    (v) => {
      const i = v as z.infer<typeof adjustPartyXpInputSchema>
      return requireCore().partyAdjustXp(i.id, i.delta, i.expectedRevision)
    }
  )
  capability(
    'party:rest',
    partySnapshotSchema,
    true,
    restPartyInputSchema,
    (v) => {
      const i = v as z.infer<typeof restPartyInputSchema>
      return requireCore().partyRest(i.type, i.expectedRevision)
    }
  )
  capability(
    'party:calculateAdventuringDay',
    adventuringDayCalculationSchema,
    false,
    adventuringDayInputSchema,
    (v) => {
      const i = v as z.infer<typeof adventuringDayInputSchema>
      return requireCore().partyCalculateAdventuringDay(i.rows, i.totalXp)
    }
  )
  capability(
    'creatures:search',
    creatureCatalogPageSchema,
    false,
    creatureCatalogQuerySchema,
    (v) =>
      requireCore().creaturesSearch(
        v as z.infer<typeof creatureCatalogQuerySchema>
      )
  )
  capability(
    'creatures:filterOptions',
    creatureFilterOptionsSchema,
    false,
    z.undefined(),
    () => requireCore().creaturesFilterOptions()
  )
  capability(
    'creatures:detail',
    creatureSchema,
    false,
    z.object({ id: z.string() }).strict(),
    (v) => requireCore().creaturesDetail((v as { id: string }).id)
  )
  capability(
    'locations:read',
    worldLocationSnapshotSchema,
    false,
    z.undefined(),
    () => requireCore().locationsRead()
  )
  capability(
    'locations:create',
    worldLocationSnapshotSchema,
    true,
    createWorldLocationInputSchema,
    (v) => {
      const i = v as z.infer<typeof createWorldLocationInputSchema>
      return requireCore().locationsCreate(i.location, i.expectedRevision)
    }
  )
  capability(
    'locations:update',
    worldLocationSnapshotSchema,
    true,
    updateWorldLocationInputSchema,
    (v) => {
      const i = v as z.infer<typeof updateWorldLocationInputSchema>
      return requireCore().locationsUpdate(i.id, i.location, i.expectedRevision)
    }
  )
  capability(
    'locations:delete',
    worldLocationSnapshotSchema,
    true,
    deleteWorldLocationInputSchema,
    (v) => {
      const i = v as z.infer<typeof deleteWorldLocationInputSchema>
      return requireCore().locationsDelete(i.id, i.expectedRevision)
    }
  )
  capability(
    'encounter-tables:read',
    encounterTableSnapshotSchema,
    false,
    z.undefined(),
    () => requireCore().encounterTablesRead()
  )
  capability(
    'encounter-tables:create',
    encounterTableSnapshotSchema,
    true,
    createEncounterTableInputSchema,
    (v) => {
      const i = v as z.infer<typeof createEncounterTableInputSchema>
      return requireCore().encounterTablesCreate(i.table, i.expectedRevision)
    }
  )
  capability(
    'encounter-tables:update',
    encounterTableSnapshotSchema,
    true,
    updateEncounterTableInputSchema,
    (v) => {
      const i = v as z.infer<typeof updateEncounterTableInputSchema>
      return requireCore().encounterTablesUpdate(
        i.id,
        i.table,
        i.expectedRevision
      )
    }
  )
  capability(
    'encounter-tables:delete',
    encounterTableSnapshotSchema,
    true,
    deleteEncounterTableInputSchema,
    (v) => {
      const i = v as z.infer<typeof deleteEncounterTableInputSchema>
      return requireCore().encounterTablesDelete(i.id, i.expectedRevision)
    }
  )
  capability(
    'factions:read',
    worldFactionSnapshotSchema,
    false,
    z.undefined(),
    () => requireCore().factionsRead()
  )
  capability(
    'factions:create',
    worldFactionSnapshotSchema,
    true,
    createWorldFactionInputSchema,
    (v) => {
      const i = v as z.infer<typeof createWorldFactionInputSchema>
      return requireCore().factionsCreate(i.faction, i.expectedRevision)
    }
  )
  capability(
    'factions:update',
    worldFactionSnapshotSchema,
    true,
    updateWorldFactionInputSchema,
    (v) => {
      const i = v as z.infer<typeof updateWorldFactionInputSchema>
      return requireCore().factionsUpdate(i.id, i.faction, i.expectedRevision)
    }
  )
  capability(
    'factions:delete',
    worldFactionSnapshotSchema,
    true,
    deleteWorldFactionInputSchema,
    (v) => {
      const i = v as z.infer<typeof deleteWorldFactionInputSchema>
      return requireCore().factionsDelete(i.id, i.expectedRevision)
    }
  )
  capability(
    'session:read',
    liveSessionSnapshotSchema,
    false,
    z.undefined(),
    () => requireCore().sessionRead()
  )
  capability(
    'scene:focus',
    liveSessionSnapshotSchema,
    true,
    focusSceneInputSchema,
    (v) => {
      const i = v as z.infer<typeof focusSceneInputSchema>
      return requireCore().sceneFocus(i.sceneId, i.expectedRevision)
    }
  )
  capability(
    'scene:setLocation',
    liveSessionSnapshotSchema,
    true,
    setSceneLocationInputSchema,
    (v) => {
      const i = v as z.infer<typeof setSceneLocationInputSchema>
      return requireCore().sceneSetLocation(
        i.sceneId,
        i.locationId,
        i.expectedRevision
      )
    }
  )
  capability(
    'scene:saveGroup',
    liveSessionSnapshotSchema,
    true,
    saveSceneGroupInputSchema,
    (v) =>
      requireCore().sceneSaveGroup(
        v as z.infer<typeof saveSceneGroupInputSchema>
      )
  )
  capability(
    'scene:deleteGroup',
    liveSessionSnapshotSchema,
    true,
    deleteSceneGroupInputSchema,
    (v) =>
      requireCore().sceneDeleteGroup(
        v as z.infer<typeof deleteSceneGroupInputSchema>
      )
  )
  capability(
    'scene:assignPartyMember',
    liveSessionSnapshotSchema,
    true,
    assignScenePartyInputSchema,
    (v) =>
      requireCore().sceneAssignPartyMember(
        v as z.infer<typeof assignScenePartyInputSchema>
      )
  )
  capability(
    'scene:evaluateGroupDraft',
    sceneGroupDraftEvaluationSchema,
    false,
    evaluateSceneGroupDraftInputSchema,
    (v) => {
      const i = v as z.infer<typeof evaluateSceneGroupDraftInputSchema>
      return requireCore().sceneEvaluateGroupDraft(
        i.sceneId,
        i.entries,
        i.expectedRevision
      )
    }
  )
  capability(
    'scene:generateGroupDraft',
    sceneGroupDraftGenerationSchema,
    false,
    sceneGroupDraftGenerationRequestSchema,
    (v) => {
      const i = v as z.infer<typeof sceneGroupDraftGenerationRequestSchema>
      return requireCore().sceneGenerateGroupDraft(
        i.sceneId,
        i.entries,
        i.mode,
        i.filters,
        i.tuning,
        i.seed,
        i.expectedRevision
      )
    }
  )
  capability(
    'encounter:evaluate',
    encounterSelectionEvaluationSchema,
    false,
    evaluateEncounterSelectionInputSchema,
    (v) => {
      const i = v as z.infer<typeof evaluateEncounterSelectionInputSchema>
      return requireCore().encounterEvaluate(
        i.sceneId,
        i.groupIds,
        i.expectedRevision
      )
    }
  )
  capability(
    'combat:prepare',
    liveSessionSnapshotSchema,
    true,
    prepareCombatInputSchema,
    (v) => {
      const i = v as z.infer<typeof prepareCombatInputSchema>
      return requireCore().combatPrepare(
        i.sceneId,
        i.groupIds,
        i.expectedSceneRevision
      )
    }
  )
  capability(
    'combat:rollInitiative',
    liveSessionSnapshotSchema,
    true,
    combatRevisionInputSchema,
    (v) =>
      requireCore().combatRollInitiative(
        (v as z.infer<typeof combatRevisionInputSchema>).expectedRevision
      )
  )
  capability(
    'combat:confirmInitiative',
    liveSessionSnapshotSchema,
    true,
    confirmInitiativeInputSchema,
    (v) => {
      const i = v as z.infer<typeof confirmInitiativeInputSchema>
      return requireCore().combatConfirmInitiative(i.values, i.expectedRevision)
    }
  )
  capability(
    'combat:advanceTurn',
    liveSessionSnapshotSchema,
    true,
    combatRevisionInputSchema,
    (v) =>
      requireCore().combatAdvanceTurn(
        (v as z.infer<typeof combatRevisionInputSchema>).expectedRevision
      )
  )
  capability(
    'combat:adjustInitiative',
    liveSessionSnapshotSchema,
    true,
    adjustInitiativeInputSchema,
    (v) => {
      const i = v as z.infer<typeof adjustInitiativeInputSchema>
      return requireCore().combatAdjustInitiative(
        i.id,
        i.initiative,
        i.expectedRevision
      )
    }
  )
  capability(
    'combat:changeHp',
    liveSessionSnapshotSchema,
    true,
    changeHpInputSchema,
    (v) => {
      const i = v as z.infer<typeof changeHpInputSchema>
      return requireCore().combatChangeHp(
        i.cardId,
        i.amount,
        i.healing,
        i.expectedRevision
      )
    }
  )
  capability(
    'combat:end',
    liveSessionSnapshotSchema,
    true,
    combatRevisionInputSchema,
    (v) =>
      requireCore().combatEnd(
        (v as z.infer<typeof combatRevisionInputSchema>).expectedRevision
      )
  )
  capability(
    'combat:updateResolution',
    liveSessionSnapshotSchema,
    true,
    updateResolutionInputSchema,
    (v) => {
      const i = v as z.infer<typeof updateResolutionInputSchema>
      return requireCore().combatUpdateResolution(
        i.selectedEnemyIds,
        i.thresholdFraction,
        i.xpFraction,
        i.expectedRevision
      )
    }
  )
  capability(
    'combat:awardXp',
    liveSessionSnapshotSchema,
    true,
    combatRevisionInputSchema,
    (v) =>
      requireCore().combatAwardXp(
        (v as z.infer<typeof combatRevisionInputSchema>).expectedRevision
      )
  )
  capability(
    'combat:complete',
    liveSessionSnapshotSchema,
    true,
    combatRevisionInputSchema,
    (v) =>
      requireCore().combatComplete(
        (v as z.infer<typeof combatRevisionInputSchema>).expectedRevision
      )
  )
  ipcMain.handle('runtime:memory', (event) => {
    authorize(event, false)
    return app
      .getAppMetrics()
      .reduce((total, metric) => total + metric.memory.workingSetSize * 1024, 0)
  })
  ipcMain.handle('runtime:gpu-observation', async (event) => {
    authorize(event, false)
    await app.getGPUInfo('complete')
    return runtimeGpuObservationSchema.parse(await gpuObservation())
  })
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

async function gpuObservation(): Promise<RuntimeGpuObservation> {
  const [featureStatus, info] = await Promise.all([
    Promise.resolve(app.getGPUFeatureStatus()),
    app.getGPUInfo('complete')
  ])
  const devices = gpuDevices(info)
  return {
    operatingSystem: process.platform,
    architecture: process.arch,
    electronVersion: process.versions.electron,
    featureStatus: Object.fromEntries(
      Object.entries(featureStatus).map(([key, value]) => [key, String(value)])
    ),
    activeGpuDevices: devices.filter((device) => device.active),
    softwareRendering: usesSoftwareRendering(featureStatus, devices)
  }
}

function gpuDevices(info: unknown): RuntimeGpuObservation['activeGpuDevices'] {
  const records = objectValue(info)['gpuDevice']
  if (!Array.isArray(records)) return []
  return records.flatMap((record) => {
    const device = objectValue(record)
    return [
      {
        active: device['active'] === true,
        deviceId: stringValue(device['deviceId']),
        vendorId: stringValue(device['vendorId']),
        deviceName: stringValue(device['deviceString']),
        vendorName: stringValue(device['vendorString']),
        driverVendor: stringValue(device['driverVendor']),
        driverVersion: stringValue(device['driverVersion'])
      }
    ]
  })
}

function usesSoftwareRendering(
  status: Electron.GPUFeatureStatus,
  devices: RuntimeGpuObservation['activeGpuDevices']
): boolean {
  const webgl = String(status.webgl ?? '').toLowerCase()
  const names = devices
    .flatMap((device) => [
      device.deviceName,
      device.vendorName,
      device.driverVendor
    ])
    .join(' ')
    .toLowerCase()
  return (
    webgl.includes('software') || /swiftshader|llvmpipe|software/.test(names)
  )
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function stopApplication(): void {
  core?.close()
  core = undefined
}

function requireCore(): CoreProcessClient {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core
}

function authorize(event: IpcMainInvokeEvent, requiresWrite: boolean): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  if (requiresWrite && isReadOnlyWindow(event.sender)) {
    throw new CapabilityError('read_only', false)
  }
}

async function invokeCapability(
  operation: () => Promise<CampaignSnapshot>
): Promise<unknown> {
  try {
    return campaignCapabilityResponseSchema.parse({
      ok: true,
      snapshot: await operation()
    })
  } catch (error) {
    const failure =
      error instanceof CapabilityError
        ? { code: error.code, retryable: error.retryable }
        : { code: 'internal' as const, retryable: false }
    return campaignCapabilityResponseSchema.parse({ ok: false, error: failure })
  }
}
async function invokeGeneric<T>(
  operation: () => Promise<T>,
  schema: z.ZodType<T>
): Promise<unknown> {
  try {
    return { ok: true, payload: schema.parse(await operation()) }
  } catch (error) {
    const code = error instanceof CapabilityError ? error.code : 'internal'
    return { ok: false, error: { code, retryable: false } }
  }
}
