import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import {
  activateCampaignInputSchema,
  campaignIdInputSchema,
  campaignSnapshotSchema,
  capabilityFailureSchema,
  createCampaignInputSchema,
  freezeCampaignSnapshot,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema
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
  combatCommandResultSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
  liveSessionSnapshotSchema,
  moveCombatPhaseInputSchema,
  prepareCombatInputSchema,
  sceneGroupCommandResultSchema,
  setConcentrationInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema,
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
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import {
  coreOperations,
  mainOperationForChannel,
  operationForChannel,
  type CoreOperationInput,
  type CoreOperationKind,
  type CoreOperationOutput
} from '../../shared/contracts/operations.js'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  encounterSelectionEvaluationSchema,
  evaluateEncounterSelectionInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  setSceneGroupArchivedInputSchema,
  setSceneLocationInputSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationRequestSchema,
  sceneGroupDraftGenerationSchema
} from '../../shared/contracts/scene.js'
import {
  coreProcessStatusSchema,
  type CoreProcessStatus
} from '../../shared/contracts/runtime.js'
import { sessionChangeNoticeSchema } from '../../shared/contracts/session-change.js'
import {
  installationPreferencesSchema,
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from '../../shared/contracts/settings.js'
import {
  deleteWorldLocationInputSchema,
  saveWorldLocationInputSchema,
  worldLocationPlacementCommandSchema,
  worldLocationPlacementCommitResultSchema,
  updateWorldLocationMapPresentationInputSchema,
  worldLocationChangeNoticeSchema,
  worldLocationDeleteReceiptSchema,
  worldLocationMapPresentationSchema,
  worldLocationSaveReceiptInputSchema,
  worldLocationSaveReceiptSchema,
  worldLocationSnapshotSchema,
  worldLocationTagSearchInputSchema,
  worldLocationTagSuggestionsSchema
} from '../../shared/contracts/world-location.js'
import {
  createLocationSymbolInputSchema,
  deleteLocationSymbolInputSchema,
  importLocationSymbolInputSchema,
  importLocationSymbolResultSchema,
  locationSymbolMutationReceiptSchema,
  locationSymbolChangeNoticeSchema,
  locationSymbolDeleteImpactSchema,
  locationSymbolDeleteResultSchema,
  locationSymbolDetailInputSchema,
  locationSymbolPageSchema,
  locationSymbolSchema,
  locationSymbolSearchInputSchema,
  locationSymbolSnapshotSchema,
  updateLocationSymbolInputSchema
} from '../../shared/contracts/location-symbol.js'
import {
  biomeCatalogMutationResultSchema,
  biomeChangeNoticeSchema,
  biomeDeleteImpactSchema,
  biomeDefinitionSchema,
  biomePageSchema,
  biomeSearchInputSchema,
  createBiomeInputSchema,
  deleteBiomeInputSchema,
  updateBiomeInputSchema
} from '../../shared/contracts/biome.js'
import {
  createEncounterTableInputSchema,
  createWorldFactionInputSchema,
  deleteEncounterTableInputSchema,
  deleteWorldFactionInputSchema,
  encounterTableCommandReceiptInputSchema,
  encounterTableCommandReceiptSchema,
  encounterTableDeleteReceiptSchema,
  encounterTableChangeNoticeSchema,
  encounterTableMutationReceiptSchema,
  encounterTableSnapshotSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema,
  worldFactionCommandReceiptInputSchema,
  worldFactionCommandReceiptSchema,
  worldFactionDeleteReceiptSchema,
  worldFactionMutationReceiptSchema,
  worldFactionSnapshotSchema
} from '../../shared/contracts/encounter-source.js'
import { hexChangeNoticeSchema } from '../../shared/contracts/hex.js'
import {
  referenceCampaignIndexInputSchema,
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceIndexChangeNoticeSchema,
  referenceTargetSchema
} from '../../shared/contracts/reference.js'
import { sessionGenerationEncounterInputSchema } from '../../shared/contracts/session-generation.js'

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
      throw new CapabilityError(result.error.code, result.error.retryable)
    const value = schema.safeParse(result.payload)
    if (!value.success) throw new CapabilityError('protocol_violation', false)
    return value.data!
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

async function invokeCore<K extends CoreOperationKind>(
  kind: K,
  input: CoreOperationInput<K>
): Promise<CoreOperationOutput<K>> {
  const operation = coreOperations[kind]
  if (operation.channel === null)
    throw new CapabilityError('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) throw new CapabilityError('validation_failed', false)
  try {
    const raw: unknown = await ipcRenderer.invoke(
      operation.channel,
      request.data
    )
    const result = z
      .discriminatedUnion('ok', [
        z.object({ ok: z.literal(true), payload: z.unknown() }).passthrough(),
        z
          .object({ ok: z.literal(false), error: capabilityFailureSchema })
          .passthrough()
      ])
      .parse(raw)
    if (!result.ok)
      throw new CapabilityError(result.error.code, result.error.retryable)
    const value = operation.output.safeParse(result.payload)
    if (!value.success) throw new CapabilityError('protocol_violation', false)
    return value.data as CoreOperationOutput<K>
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

async function invokeMain<T>(channel: string, input: unknown): Promise<T> {
  const operation = mainOperationForChannel(channel)
  if (operation === null) throw new CapabilityError('protocol_violation', false)
  const request = operation[1].input.safeParse(input)
  if (!request.success) throw new CapabilityError('validation_failed', false)
  try {
    return operation[1].output.parse(
      await ipcRenderer.invoke(operation[1].channel!, request.data)
    ) as T
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

const live = async (channel: string, input: unknown) =>
  freezeDeep(await invoke(channel, input, liveSessionSnapshotSchema))
const combatCommand = async (channel: string, input: unknown) =>
  freezeDeep(await invoke(channel, input, combatCommandResultSchema))
const sceneGroupCommand = async (channel: string, input: unknown) =>
  freezeDeep(await invoke(channel, input, sceneGroupCommandResultSchema))

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
    },
    async rename(id, name) {
      const input = renameCampaignInputSchema.parse({ id, name })
      return freezeCampaignSnapshot(
        await invoke('campaign:rename', input, campaignSnapshotSchema)
      )
    },
    async trash(id) {
      const input = campaignIdInputSchema.parse({ id })
      return freezeCampaignSnapshot(
        await invoke('campaign:trash', input, campaignSnapshotSchema)
      )
    },
    async restore(id) {
      const input = campaignIdInputSchema.parse({ id })
      return freezeCampaignSnapshot(
        await invoke('campaign:restore', input, campaignSnapshotSchema)
      )
    },
    async deleteForever(id, confirmationName) {
      const input = permanentlyDeleteCampaignInputSchema.parse({
        id,
        confirmationName
      })
      return freezeCampaignSnapshot(
        await invoke('campaign:deleteForever', input, campaignSnapshotSchema)
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
  references: {
    staticIndex: async () =>
      freezeDeep(
        await invoke('references:static-index', undefined, referenceIndexSchema)
      ),
    campaignIndex: async (campaignId) =>
      freezeDeep(
        await invoke(
          'references:campaign-index',
          referenceCampaignIndexInputSchema.parse({ campaignId }),
          referenceIndexSchema
        )
      ),
    detail: async (target) =>
      freezeDeep(
        await invoke(
          'references:detail',
          referenceTargetSchema.parse(target),
          referenceDocumentSchema
        )
      ),
    onCampaignIndexChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(referenceIndexChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('references:index-changed', handler)
      return () =>
        ipcRenderer.removeListener('references:index-changed', handler)
    }
  },
  locations: {
    read: async () =>
      freezeDeep(
        await invoke('locations:read', undefined, worldLocationSnapshotSchema)
      ),
    suggestTags: async (query, limit = 6) =>
      freezeDeep(
        await invoke(
          'locations:suggest-tags',
          worldLocationTagSearchInputSchema.parse({ query, limit }),
          worldLocationTagSuggestionsSchema
        )
      ),
    save: async (input) =>
      freezeDeep(
        await invoke(
          'locations:save',
          saveWorldLocationInputSchema.parse(input),
          worldLocationSaveReceiptSchema
        )
      ),
    saveReceipt: async (commandId) =>
      freezeDeep(
        await invoke(
          'locations:save-receipt',
          worldLocationSaveReceiptInputSchema.parse({ commandId }),
          worldLocationSaveReceiptSchema.nullable()
        )
      ),
    commitPlacement: async (input) =>
      freezeDeep(
        await invoke(
          'locations:commit-placement',
          worldLocationPlacementCommandSchema.parse(input),
          worldLocationPlacementCommitResultSchema
        )
      ),
    updateMapPresentation: async (id, patch, expectedRevision) =>
      freezeDeep(
        await invoke(
          'locations:update-map-presentation',
          updateWorldLocationMapPresentationInputSchema.parse({
            id,
            patch,
            expectedRevision
          }),
          worldLocationMapPresentationSchema
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'locations:delete',
          deleteWorldLocationInputSchema.parse({ id, expectedRevision }),
          worldLocationDeleteReceiptSchema
        )
      ),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(worldLocationChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('locations:changed', handler)
      return () => ipcRenderer.removeListener('locations:changed', handler)
    }
  },
  locationSymbols: {
    create: async (symbol, expectedRevision) =>
      freezeDeep(
        await invoke(
          'location-symbols:create',
          createLocationSymbolInputSchema.parse({ symbol, expectedRevision }),
          locationSymbolMutationReceiptSchema
        )
      ),
    search: async (query = '', offset = 0, limit = 24) =>
      freezeDeep(
        await invoke(
          'location-symbols:search',
          locationSymbolSearchInputSchema.parse({ query, offset, limit }),
          locationSymbolPageSchema
        )
      ),
    detail: async (id) =>
      freezeDeep(
        await invoke(
          'location-symbols:detail',
          locationSymbolDetailInputSchema.parse({ id }),
          locationSymbolSchema
        )
      ),
    update: async (id, displayName, expectedRevision) =>
      freezeDeep(
        await invoke(
          'location-symbols:update',
          updateLocationSymbolInputSchema.parse({
            id,
            displayName,
            expectedRevision
          }),
          locationSymbolSnapshotSchema
        )
      ),
    deleteImpact: async (id) =>
      freezeDeep(
        await invoke(
          'location-symbols:delete-impact',
          { id },
          locationSymbolDeleteImpactSchema
        )
      ),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'location-symbols:delete',
          deleteLocationSymbolInputSchema.parse({
            commandId,
            id,
            expectedRevision
          }),
          locationSymbolDeleteResultSchema
        )
      ),
    importAndAssign: async (input) =>
      freezeDeep(
        await invoke(
          'location-symbols:import-and-assign',
          importLocationSymbolInputSchema.parse(input),
          importLocationSymbolResultSchema
        )
      ),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(locationSymbolChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('location-symbols:changed', handler)
      return () =>
        ipcRenderer.removeListener('location-symbols:changed', handler)
    }
  },
  biomes: {
    search: async (query = '', offset = 0, limit = 60) =>
      freezeDeep(
        await invoke(
          'biomes:search',
          biomeSearchInputSchema.parse({ query, offset, limit }),
          biomePageSchema
        )
      ),
    detail: async (id) =>
      freezeDeep(await invoke('biomes:detail', { id }, biomeDefinitionSchema)),
    create: async (commandId, biome, expectedRevision) =>
      freezeDeep(
        await invoke(
          'biomes:create',
          createBiomeInputSchema.parse({ commandId, biome, expectedRevision }),
          biomeCatalogMutationResultSchema
        )
      ),
    update: async (commandId, id, biome, expectedRevision) =>
      freezeDeep(
        await invoke(
          'biomes:update',
          updateBiomeInputSchema.parse({
            commandId,
            id,
            biome,
            expectedRevision
          }),
          biomeCatalogMutationResultSchema
        )
      ),
    deleteImpact: async (id) =>
      freezeDeep(
        await invoke('biomes:delete-impact', { id }, biomeDeleteImpactSchema)
      ),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'biomes:delete',
          deleteBiomeInputSchema.parse({ commandId, id, expectedRevision }),
          biomeCatalogMutationResultSchema
        )
      ),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(biomeChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('biomes:changed', handler)
      return () => ipcRenderer.removeListener('biomes:changed', handler)
    }
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
    commandReceipt: async (commandId) =>
      freezeDeep(
        await invoke(
          'encounter-tables:command-receipt',
          encounterTableCommandReceiptInputSchema.parse({ commandId }),
          encounterTableCommandReceiptSchema.nullable()
        )
      ),
    create: async (commandId, table, expectedRevision, scope = 'campaign') =>
      freezeDeep(
        await invoke(
          'encounter-tables:create',
          createEncounterTableInputSchema.parse({
            commandId,
            table,
            expectedRevision,
            scope
          }),
          encounterTableMutationReceiptSchema
        )
      ),
    update: async (
      commandId,
      id,
      table,
      expectedRevision,
      scope = 'campaign'
    ) =>
      freezeDeep(
        await invoke(
          'encounter-tables:update',
          updateEncounterTableInputSchema.parse({
            commandId,
            id,
            table,
            expectedRevision,
            scope
          }),
          encounterTableMutationReceiptSchema
        )
      ),
    delete: async (commandId, id, expectedRevision, scope = 'campaign') =>
      freezeDeep(
        await invoke(
          'encounter-tables:delete',
          deleteEncounterTableInputSchema.parse({
            commandId,
            id,
            expectedRevision,
            scope
          }),
          encounterTableDeleteReceiptSchema
        )
      ),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(encounterTableChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('encounter-tables:changed', handler)
      return () =>
        ipcRenderer.removeListener('encounter-tables:changed', handler)
    }
  },
  factions: {
    read: async () =>
      freezeDeep(
        await invoke('factions:read', undefined, worldFactionSnapshotSchema)
      ),
    commandReceipt: async (commandId) =>
      freezeDeep(
        await invoke(
          'factions:command-receipt',
          worldFactionCommandReceiptInputSchema.parse({ commandId }),
          worldFactionCommandReceiptSchema.nullable()
        )
      ),
    create: async (commandId, faction, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:create',
          createWorldFactionInputSchema.parse({
            commandId,
            faction,
            expectedRevision
          }),
          worldFactionMutationReceiptSchema
        )
      ),
    update: async (commandId, id, faction, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:update',
          updateWorldFactionInputSchema.parse({
            commandId,
            id,
            faction,
            expectedRevision
          }),
          worldFactionMutationReceiptSchema
        )
      ),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invoke(
          'factions:delete',
          deleteWorldFactionInputSchema.parse({
            commandId,
            id,
            expectedRevision
          }),
          worldFactionDeleteReceiptSchema
        )
      )
  },
  hex: {
    editorBootstrap: () => invokeCore('hex.editorBootstrap', undefined),
    biomeCatalog: async () =>
      freezeDeep(await invokeCore('hex.biomeCatalog', undefined)),
    catalog: async () => freezeDeep(await invokeCore('hex.catalog', undefined)),
    locateLocation: (locationId) =>
      invokeCore('hex.locateLocation', { locationId }),
    readChunks: async (mapId, keys) =>
      freezeDeep(
        await invokeCore('hex.readChunks', { mapId, keys: [...keys] })
      ),
    replaceBiomePlaceholder: async (input) =>
      freezeDeep(await invokeCore('hex.replaceBiomePlaceholder', input)),
    create: async (input) => freezeDeep(await invokeCore('hex.create', input)),
    updateMetadata: async (input) =>
      freezeDeep(await invokeCore('hex.update', input)),
    applyBrushStroke: async (input) =>
      freezeDeep(await invokeCore('hex.applyBrushStroke', input)),
    history: (mapId) => invokeCore('hex.history', { mapId }),
    undo: (input) => invokeCore('hex.undo', input),
    redo: (input) => invokeCore('hex.redo', input),
    commandReceipt: (commandId) =>
      invokeCore('hex.commandReceipt', { commandId }),
    runtimeOverlays: (mapId) => invokeCore('hex.runtimeOverlays', { mapId }),
    onChanged(listener) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(freezeDeep(hexChangeNoticeSchema.parse(raw)))
      ipcRenderer.on('hex:changed', handler)
      return () => ipcRenderer.removeListener('hex:changed', handler)
    }
  },
  hexTravel: {
    read: async (sceneId) =>
      freezeDeep(await invokeCore('hexTravel.read', { sceneId })),
    evaluate: (sceneId, mapId, waypoints) =>
      invokeCore('hexTravel.evaluate', {
        sceneId,
        mapId,
        waypoints: [...waypoints]
      }),
    position: async (sceneId, mapId, coordinate, expectedSceneRevision) =>
      freezeDeep(
        await invokeCore('hexTravel.position', {
          sceneId,
          mapId,
          coordinate,
          expectedSceneRevision
        })
      ),
    start: async (sceneId, mapId, waypoints, multiplier, expectedRevision) =>
      freezeDeep(
        await invokeCore('hexTravel.start', {
          sceneId,
          mapId,
          waypoints: [...waypoints],
          multiplier,
          expectedRevision
        })
      ),
    pause: (sceneId, expectedRevision) =>
      invokeCore('hexTravel.pause', { sceneId, expectedRevision }),
    resume: (sceneId, expectedRevision) =>
      invokeCore('hexTravel.resume', { sceneId, expectedRevision }),
    abort: (sceneId, expectedRevision) =>
      invokeCore('hexTravel.abort', { sceneId, expectedRevision }),
    setMultiplier: (sceneId, multiplier, expectedRevision) =>
      invokeCore('hexTravel.setMultiplier', {
        sceneId,
        multiplier,
        expectedRevision
      })
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
  sessionGeneration: {
    generateEncounterIntents: async (input) =>
      freezeDeep(
        await invokeCore(
          'sessionGeneration.generateEncounterIntents',
          sessionGenerationEncounterInputSchema.parse(input)
        )
      )
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
    saveGroup: (
      sceneId,
      groupId,
      name,
      note,
      disposition,
      entries,
      expectedRevision,
      expectedGroupRevision
    ) =>
      sceneGroupCommand(
        'scene:saveGroup',
        saveSceneGroupInputSchema.parse({
          sceneId,
          groupId,
          name,
          note,
          disposition,
          entries,
          expectedRevision,
          expectedGroupRevision
        })
      ),
    setGroupArchived: (sceneId, groupId, archived, expectedGroupRevision) =>
      sceneGroupCommand(
        'scene:setGroupArchived',
        setSceneGroupArchivedInputSchema.parse({
          sceneId,
          groupId,
          archived,
          expectedGroupRevision
        })
      ),
    deleteGroup: (sceneId, groupId, expectedGroupRevision) =>
      sceneGroupCommand(
        'scene:deleteGroup',
        deleteSceneGroupInputSchema.parse({
          sceneId,
          groupId,
          expectedGroupRevision
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
      combatCommand(
        'combat:prepare',
        prepareCombatInputSchema.parse({
          sceneId,
          groupIds,
          expectedSceneRevision
        })
      ),
    joinGroup: (
      sceneId,
      groupId,
      expectedGroupRevision,
      expectedCombatRevision
    ) =>
      combatCommand(
        'combat:joinGroup',
        joinCombatGroupInputSchema.parse({
          sceneId,
          groupId,
          expectedGroupRevision,
          expectedCombatRevision
        })
      ),
    rollInitiative: (expectedRevision) =>
      combatCommand(
        'combat:rollInitiative',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    confirmInitiative: (values, expectedRevision) =>
      combatCommand(
        'combat:confirmInitiative',
        confirmInitiativeInputSchema.parse({ values, expectedRevision })
      ),
    advanceTurn: (expectedRevision) =>
      combatCommand(
        'combat:advanceTurn',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    retreatTurn: (expectedRevision) =>
      combatCommand(
        'combat:retreatTurn',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    adjustInitiative: (id, initiative, expectedRevision) =>
      combatCommand(
        'combat:adjustInitiative',
        adjustInitiativeInputSchema.parse({ id, initiative, expectedRevision })
      ),
    changeHp: (cardId, amount, healing, expectedRevision) =>
      combatCommand(
        'combat:changeHp',
        changeHpInputSchema.parse({ cardId, amount, healing, expectedRevision })
      ),
    toggleCondition: (cardId, condition, active, expectedRevision) =>
      combatCommand(
        'combat:toggleCondition',
        toggleConditionInputSchema.parse({
          cardId,
          condition,
          active,
          expectedRevision
        })
      ),
    setConcentration: (cardId, concentrating, expectedRevision) =>
      combatCommand(
        'combat:setConcentration',
        setConcentrationInputSchema.parse({
          cardId,
          concentrating,
          expectedRevision
        })
      ),
    setExhaustion: (cardId, exhaustionLevel, expectedRevision) =>
      combatCommand(
        'combat:setExhaustion',
        setExhaustionInputSchema.parse({
          cardId,
          exhaustionLevel,
          expectedRevision
        })
      ),
    undo: (expectedRevision) =>
      combatCommand(
        'combat:undo',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    end: (expectedRevision) =>
      combatCommand(
        'combat:end',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    moveToPhase: (target, expectedRevision) =>
      combatCommand(
        'combat:moveToPhase',
        moveCombatPhaseInputSchema.parse({ target, expectedRevision })
      ),
    updateResolution: (selectedEnemyIds, mode, xpFraction, expectedRevision) =>
      combatCommand(
        'combat:updateResolution',
        updateResolutionInputSchema.parse({
          selectedEnemyIds,
          mode,
          xpFraction,
          expectedRevision
        })
      ),
    awardXp: (expectedRevision) =>
      combatCommand(
        'combat:awardXp',
        combatRevisionInputSchema.parse({ expectedRevision })
      ),
    complete: (expectedRevision) =>
      combatCommand(
        'combat:complete',
        combatRevisionInputSchema.parse({ expectedRevision })
      )
  },
  runtime: Object.freeze({
    readOnly: process.argv.includes('--salt-marcher-read-only'),
    e2e: process.argv.includes('--salt-marcher-e2e'),
    processMemoryBytes: () => invokeMain<number>('runtime:memory', undefined),
    gpuObservation: () => invokeMain('runtime:gpu-observation', undefined),
    coreStatus: () => invokeMain('runtime:core-status', undefined),
    retryCore: () => invokeMain('runtime:retry-core', undefined),
    reportRendererIncident: (incident) =>
      invokeMain('runtime:report-renderer-incident', incident),
    reloadRenderer: () => invokeMain('runtime:reload-renderer', undefined),
    pickLocationSymbolFile: () =>
      invokeMain('runtime:pick-location-symbol-file', undefined),
    onCoreStatus(listener: (status: CoreProcessStatus) => void) {
      const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
        listener(coreProcessStatusSchema.parse(raw))
      ipcRenderer.on('runtime:core-status-changed', handler)
      return () =>
        ipcRenderer.removeListener('runtime:core-status-changed', handler)
    }
  } satisfies SaltMarcherApi['runtime'])
}

contextBridge.exposeInMainWorld('saltMarcher', Object.freeze(api))

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
