import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import {
  activateCampaignInputSchema,
  campaignSnapshotSchema,
  capabilityFailureSchema,
  createCampaignInputSchema,
  freezeCampaignSnapshot
} from '../../shared/contracts/campaign.js'
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
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { runtimeGpuObservationSchema } from '../../shared/qualification/runtime-observation.js'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import { operationForChannel } from '../../shared/contracts/operations.js'
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
import { coreProcessStatusSchema } from '../../shared/contracts/runtime.js'
import { sessionChangeNoticeSchema } from '../../shared/contracts/session-change.js'
import {
  installationPreferencesSchema,
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from '../../shared/contracts/settings.js'
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
import {
  createHexMapInputSchema,
  evaluateHexRouteInputSchema,
  hexChunkReadResultSchema,
  hexChunkSnapshotSchema,
  hexMapCatalogSnapshotSchema,
  hexLocationPlacementReferenceSchema,
  hexMapSummarySchema,
  hexRouteEvaluationSchema,
  hexTerrainCatalogSchema,
  hexTravelSnapshotSchema,
  mutateHexTravelInputSchema,
  paintHexTerrainInputSchema,
  placeHexLocationInputSchema,
  positionHexPartyInputSchema,
  readHexChunksInputSchema,
  removeHexLocationInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema,
  updateHexMapInputSchema
} from '../../shared/contracts/hex.js'

async function invoke<T>(
  channel: string,
  input: unknown,
  schema: { safeParse(value: unknown): { success: boolean; data?: T } }
): Promise<T> {
  try {
    const operation = operationForChannel(channel)
    if (operation === null)
      throw new CapabilityError('protocol_violation', false)
    const raw: unknown = await ipcRenderer.invoke(operation[1].channel!, input)
    const result = z
      .discriminatedUnion('ok', [
        z.object({ ok: z.literal(true), payload: z.unknown() }).passthrough(),
        z
          .object({
            ok: z.literal(false),
            error: capabilityFailureSchema
          })
          .passthrough()
      ])
      .parse(raw)
    if (!result.ok)
      throw new CapabilityError(
        result.error.code,
        result.error.retryable,
        result.error.data
      )
    const value = schema.safeParse(result.payload)
    if (!value.success) throw new CapabilityError('protocol_violation', false)
    return value.data!
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

const live = async (channel: string, input: unknown) =>
  freezeDeep(await invoke(channel, input, liveSessionSnapshotSchema))

const api: SaltMarcherApi = {
  campaigns: {
    async list() {
      return freezeCampaignSnapshot(
        await invoke('campaign:list', undefined, campaignSnapshotSchema)
      )
    },
    async create(name) {
      const input = createCampaignInputSchema.parse({ name })
      return freezeCampaignSnapshot(
        await invoke('campaign:create', input, campaignSnapshotSchema)
      )
    },
    async activate(id) {
      const input = activateCampaignInputSchema.parse({ id })
      return freezeCampaignSnapshot(
        await invoke('campaign:activate', input, campaignSnapshotSchema)
      )
    }
  },
  settings: {
    read: async () =>
      freezeDeep(
        await invoke('settings:read', undefined, installationSettingsSchema)
      ),
    update: async (patch, expectedRevision) =>
      freezeDeep(
        await invoke(
          'settings:update',
          updateInstallationSettingsInputSchema.parse({
            patch: installationPreferencesSchema.partial().parse(patch),
            expectedRevision
          }),
          installationSettingsSchema
        )
      )
  },
  party: {
    read: async () =>
      freezeDeep(await invoke('party:read', undefined, partySnapshotSchema)),
    setMembership: async (id, active, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:setMembership',
          setMembershipInputSchema.parse({ id, active, expectedRevision }),
          partySnapshotSchema
        )
      ),
    create: async (character, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:create',
          createPartyCharacterInputSchema.parse({
            character,
            expectedRevision
          }),
          partySnapshotSchema
        )
      ),
    update: async (id, character, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:update',
          updatePartyCharacterInputSchema.parse({
            id,
            character,
            expectedRevision
          }),
          partySnapshotSchema
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:delete',
          deletePartyCharacterInputSchema.parse({ id, expectedRevision }),
          partySnapshotSchema
        )
      ),
    adjustXp: async (id, delta, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:adjustXp',
          adjustPartyXpInputSchema.parse({ id, delta, expectedRevision }),
          partySnapshotSchema
        )
      ),
    rest: async (type, expectedRevision) =>
      freezeDeep(
        await invoke(
          'party:rest',
          restPartyInputSchema.parse({ type, expectedRevision }),
          partySnapshotSchema
        )
      ),
    calculateAdventuringDay: (rows, totalXp) =>
      invoke(
        'party:calculateAdventuringDay',
        adventuringDayInputSchema.parse({
          rows,
          ...(totalXp === undefined ? {} : { totalXp })
        }),
        adventuringDayCalculationSchema
      )
  },
  creatures: {
    search: (query) =>
      invoke(
        'creatures:search',
        creatureCatalogQuerySchema.parse(query),
        creatureCatalogPageSchema
      ),
    filterOptions: () =>
      invoke('creatures:filterOptions', undefined, creatureFilterOptionsSchema),
    detail: (id) => invoke('creatures:detail', { id }, creatureSchema)
  },
  locations: {
    read: async () =>
      freezeDeep(
        await invoke('locations:read', undefined, worldLocationSnapshotSchema)
      ),
    create: async (location, expectedRevision) =>
      freezeDeep(
        await invoke(
          'locations:create',
          createWorldLocationInputSchema.parse({ location, expectedRevision }),
          worldLocationSnapshotSchema
        )
      ),
    update: async (id, location, expectedRevision) =>
      freezeDeep(
        await invoke(
          'locations:update',
          updateWorldLocationInputSchema.parse({
            id,
            location,
            expectedRevision
          }),
          worldLocationSnapshotSchema
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'locations:delete',
          deleteWorldLocationInputSchema.parse({ id, expectedRevision }),
          worldLocationSnapshotSchema
        )
      )
  },
  encounterTables: {
    read: async () =>
      freezeDeep(
        await invoke(
          'encounter-tables:read',
          undefined,
          encounterTableSnapshotSchema
        )
      ),
    create: async (table, expectedRevision) =>
      freezeDeep(
        await invoke(
          'encounter-tables:create',
          createEncounterTableInputSchema.parse({ table, expectedRevision }),
          encounterTableSnapshotSchema
        )
      ),
    update: async (id, table, expectedRevision) =>
      freezeDeep(
        await invoke(
          'encounter-tables:update',
          updateEncounterTableInputSchema.parse({
            id,
            table,
            expectedRevision
          }),
          encounterTableSnapshotSchema
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'encounter-tables:delete',
          deleteEncounterTableInputSchema.parse({ id, expectedRevision }),
          encounterTableSnapshotSchema
        )
      )
  },
  factions: {
    read: async () =>
      freezeDeep(
        await invoke('factions:read', undefined, worldFactionSnapshotSchema)
      ),
    create: async (faction, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:create',
          createWorldFactionInputSchema.parse({ faction, expectedRevision }),
          worldFactionSnapshotSchema
        )
      ),
    update: async (id, faction, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:update',
          updateWorldFactionInputSchema.parse({
            id,
            faction,
            expectedRevision
          }),
          worldFactionSnapshotSchema
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:delete',
          deleteWorldFactionInputSchema.parse({ id, expectedRevision }),
          worldFactionSnapshotSchema
        )
      )
  },
  hex: {
    terrainCatalog: async () =>
      freezeDeep(
        await invoke('hex:terrainCatalog', undefined, hexTerrainCatalogSchema)
      ),
    catalog: async () =>
      freezeDeep(
        await invoke('hex:catalog', undefined, hexMapCatalogSnapshotSchema)
      ),
    locateLocation: (locationId) =>
      invoke(
        'hex:locateLocation',
        { locationId },
        hexLocationPlacementReferenceSchema
      ),
    readChunks: async (mapId, keys) =>
      freezeDeep(
        await invoke(
          'hex:readChunks',
          readHexChunksInputSchema.parse({ mapId, keys }),
          hexChunkReadResultSchema
        )
      ),
    create: async (displayName, expectedCatalogRevision) =>
      freezeDeep(
        await invoke(
          'hex:create',
          createHexMapInputSchema.parse({
            displayName,
            expectedCatalogRevision
          }),
          hexMapSummarySchema
        )
      ),
    updateMetadata: async (mapId, displayName, expectedMetadataRevision) =>
      freezeDeep(
        await invoke(
          'hex:update',
          updateHexMapInputSchema.parse({
            mapId,
            displayName,
            expectedMetadataRevision
          }),
          hexMapSummarySchema
        )
      ),
    paint: async (mapId, coordinate, terrainId, expectedChunkRevision) =>
      freezeDeep(
        await invoke(
          'hex:paint',
          paintHexTerrainInputSchema.parse({
            mapId,
            coordinate,
            terrainId,
            expectedChunkRevision
          }),
          hexChunkSnapshotSchema
        )
      ),
    placeLocation: async (mapId, locationId, coordinate, expectedRevision) =>
      freezeDeep(
        await invoke(
          'hex:placeLocation',
          placeHexLocationInputSchema.parse({
            mapId,
            locationId,
            coordinate,
            expectedContentRevision: expectedRevision
          }),
          hexChunkReadResultSchema
        )
      ),
    removeLocation: async (mapId, locationId, expectedContentRevision) =>
      freezeDeep(
        await invoke(
          'hex:removeLocation',
          removeHexLocationInputSchema.parse({
            mapId,
            locationId,
            expectedContentRevision
          }),
          hexChunkReadResultSchema
        )
      )
  },
  hexTravel: {
    read: async (sceneId) =>
      freezeDeep(
        await invoke('hex-travel:read', { sceneId }, hexTravelSnapshotSchema)
      ),
    evaluate: (sceneId, mapId, waypoints) =>
      invoke(
        'hex-travel:evaluate',
        evaluateHexRouteInputSchema.parse({ sceneId, mapId, waypoints }),
        hexRouteEvaluationSchema
      ),
    position: async (sceneId, mapId, coordinate, expectedSceneRevision) =>
      freezeDeep(
        await invoke(
          'hex-travel:position',
          positionHexPartyInputSchema.parse({
            sceneId,
            mapId,
            coordinate,
            expectedSceneRevision
          }),
          hexTravelSnapshotSchema
        )
      ),
    start: async (sceneId, mapId, waypoints, multiplier, expectedRevision) =>
      freezeDeep(
        await invoke(
          'hex-travel:start',
          startHexTravelInputSchema.parse({
            sceneId,
            mapId,
            waypoints,
            multiplier,
            expectedRevision
          }),
          hexTravelSnapshotSchema
        )
      ),
    pause: (sceneId, expectedRevision) =>
      invoke(
        'hex-travel:pause',
        mutateHexTravelInputSchema.parse({ sceneId, expectedRevision }),
        hexTravelSnapshotSchema
      ),
    resume: (sceneId, expectedRevision) =>
      invoke(
        'hex-travel:resume',
        mutateHexTravelInputSchema.parse({ sceneId, expectedRevision }),
        hexTravelSnapshotSchema
      ),
    abort: (sceneId, expectedRevision) =>
      invoke(
        'hex-travel:abort',
        mutateHexTravelInputSchema.parse({ sceneId, expectedRevision }),
        hexTravelSnapshotSchema
      ),
    setMultiplier: (sceneId, multiplier, expectedRevision) =>
      invoke(
        'hex-travel:setMultiplier',
        setHexTravelMultiplierInputSchema.parse({
          sceneId,
          multiplier,
          expectedRevision
        }),
        hexTravelSnapshotSchema
      )
  },
  session: {
    read: () => live('session:read', undefined),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(sessionChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('session:changed', handler)
      return () => ipcRenderer.removeListener('session:changed', handler)
    }
  },
  scene: {
    focus: (sceneId, expectedRevision) =>
      live(
        'scene:focus',
        focusSceneInputSchema.parse({ sceneId, expectedRevision })
      ),
    setLocation: (sceneId, locationId, expectedRevision) =>
      live(
        'scene:setLocation',
        setSceneLocationInputSchema.parse({
          sceneId,
          locationId,
          expectedRevision
        })
      ),
    saveGroup: (sceneId, groupId, name, entries, expectedRevision) =>
      live(
        'scene:saveGroup',
        saveSceneGroupInputSchema.parse({
          sceneId,
          groupId,
          name,
          entries,
          expectedRevision
        })
      ),
    deleteGroup: (sceneId, groupId, expectedRevision) =>
      live(
        'scene:deleteGroup',
        deleteSceneGroupInputSchema.parse({
          sceneId,
          groupId,
          expectedRevision
        })
      ),
    assignPartyMember: (sceneId, partyMemberId, assigned, expectedRevision) =>
      live(
        'scene:assignPartyMember',
        assignScenePartyInputSchema.parse({
          sceneId,
          partyMemberId,
          assigned,
          expectedRevision
        })
      ),
    evaluateGroupDraft: async (sceneId, entries, expectedRevision) =>
      freezeDeep(
        await invoke(
          'scene:evaluateGroupDraft',
          evaluateSceneGroupDraftInputSchema.parse({
            sceneId,
            entries,
            expectedRevision
          }),
          sceneGroupDraftEvaluationSchema
        )
      ),
    generateGroupDraft: async (
      sceneId,
      entries,
      mode,
      filters,
      tuning,
      seed,
      expectedRevision
    ) =>
      freezeDeep(
        await invoke(
          'scene:generateGroupDraft',
          sceneGroupDraftGenerationRequestSchema.parse({
            sceneId,
            entries,
            mode,
            filters,
            tuning,
            seed,
            expectedRevision
          }),
          sceneGroupDraftGenerationSchema
        )
      )
  },
  encounter: {
    evaluate: (sceneId, groupIds, expectedRevision) =>
      invoke(
        'encounter:evaluate',
        evaluateEncounterSelectionInputSchema.parse({
          sceneId,
          groupIds,
          expectedRevision
        }),
        encounterSelectionEvaluationSchema
      )
  },
  combat: {
    prepare: (sceneId, groupIds, expectedSceneRevision) =>
      live(
        'combat:prepare',
        prepareCombatInputSchema.parse({
          sceneId,
          groupIds,
          expectedSceneRevision
        })
      ),
    rollInitiative: (expectedRevision) =>
      live(
        'combat:rollInitiative',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    confirmInitiative: (values, expectedRevision) =>
      live(
        'combat:confirmInitiative',
        confirmInitiativeInputSchema.parse({ values, expectedRevision })
      ),
    advanceTurn: (expectedRevision) =>
      live(
        'combat:advanceTurn',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    adjustInitiative: (id, initiative, expectedRevision) =>
      live(
        'combat:adjustInitiative',
        adjustInitiativeInputSchema.parse({ id, initiative, expectedRevision })
      ),
    changeHp: (cardId, amount, healing, expectedRevision) =>
      live(
        'combat:changeHp',
        changeHpInputSchema.parse({ cardId, amount, healing, expectedRevision })
      ),
    end: (expectedRevision) =>
      live('combat:end', combatRevisionInputSchema.parse({ expectedRevision })),
    updateResolution: (
      selectedEnemyIds,
      thresholdFraction,
      xpFraction,
      expectedRevision
    ) =>
      live(
        'combat:updateResolution',
        updateResolutionInputSchema.parse({
          selectedEnemyIds,
          thresholdFraction,
          xpFraction,
          expectedRevision
        })
      ),
    awardXp: (expectedRevision) =>
      live(
        'combat:awardXp',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    complete: (expectedRevision) =>
      live(
        'combat:complete',
        combatRevisionInputSchema.parse({ expectedRevision })
      )
  },
  runtime: Object.freeze({
    readOnly: process.argv.includes('--salt-marcher-read-only'),
    e2e: process.argv.includes('--salt-marcher-e2e'),
    async processMemoryBytes() {
      const value: unknown = await ipcRenderer.invoke('runtime:memory')
      return z.number().nonnegative().parse(value)
    },
    async gpuObservation() {
      return runtimeGpuObservationSchema.parse(
        await ipcRenderer.invoke('runtime:gpu-observation')
      )
    },
    async coreStatus() {
      return coreProcessStatusSchema.parse(
        await ipcRenderer.invoke('runtime:core-status')
      )
    },
    async retryCore() {
      return coreProcessStatusSchema.parse(
        await ipcRenderer.invoke('runtime:retry-core')
      )
    },
    onCoreStatus(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(coreProcessStatusSchema.parse(raw))
      ipcRenderer.on('runtime:core-status-changed', handler)
      return () =>
        ipcRenderer.removeListener('runtime:core-status-changed', handler)
    }
  })
}

contextBridge.exposeInMainWorld('saltMarcher', Object.freeze(api))

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
