import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import {
  activateCampaignInputSchema,
  campaignIdInputSchema,
  capabilityFailureSchema,
  createCampaignInputSchema,
  freezeCampaignSnapshot,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema
} from '../../shared/contracts/campaign.js'
import { creatureCatalogQuerySchema } from '../../shared/contracts/encounter.js'
import {
  adjustInitiativeInputSchema,
  changeHpInputSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
  moveCombatPhaseInputSchema,
  prepareCombatInputSchema,
  setConcentrationInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema,
  updateResolutionInputSchema
} from '../../shared/contracts/live-session.js'
import {
  adjustPartyXpInputSchema,
  adventuringDayInputSchema,
  createPartyCharacterInputSchema,
  deletePartyCharacterInputSchema,
  restPartyInputSchema,
  setMembershipInputSchema,
  updatePartyCharacterInputSchema
} from '../../shared/contracts/party.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import {
  coreOperations,
  mainOperations,
  type CoreOperationInput,
  type CoreOperationKind,
  type CoreOperationOutput,
  type MainOperationInput,
  type MainOperationKind,
  type MainOperationOutput
} from '../../shared/contracts/operations.js'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  evaluateEncounterSelectionInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  setSceneGroupArchivedInputSchema,
  setSceneLocationInputSchema,
  sceneGroupDraftGenerationRequestSchema
} from '../../shared/contracts/scene.js'
import {
  coreProcessStatusSchema,
  type CoreProcessStatus
} from '../../shared/contracts/runtime.js'
import { sessionChangeNoticeSchema } from '../../shared/contracts/session-change.js'
import {
  installationPreferencesSchema,
  updateInstallationSettingsInputSchema
} from '../../shared/contracts/settings.js'
import {
  deleteWorldLocationInputSchema,
  saveWorldLocationInputSchema,
  worldLocationPlacementCommandSchema,
  updateWorldLocationMapPresentationInputSchema,
  worldLocationChangeNoticeSchema,
  worldLocationSaveReceiptInputSchema,
  worldLocationTagSearchInputSchema
} from '../../shared/contracts/world-location.js'
import {
  createLocationSymbolInputSchema,
  deleteLocationSymbolInputSchema,
  importLocationSymbolInputSchema,
  locationSymbolChangeNoticeSchema,
  locationSymbolDetailInputSchema,
  locationSymbolSearchInputSchema,
  updateLocationSymbolInputSchema
} from '../../shared/contracts/location-symbol.js'
import {
  biomeChangeNoticeSchema,
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
  encounterTableChangeNoticeSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema,
  worldFactionCommandReceiptInputSchema
} from '../../shared/contracts/encounter-source.js'
import { hexChangeNoticeSchema } from '../../shared/contracts/hex.js'
import {
  referenceCampaignIndexInputSchema,
  referenceIndexChangeNoticeSchema,
  referenceTargetSchema
} from '../../shared/contracts/reference.js'
import { sessionGenerationEncounterInputSchema } from '../../shared/contracts/session-generation.js'

const invokeIpc = (channel: string, input: unknown): Promise<unknown> =>
  ipcRenderer.invoke(channel, input)

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
    const raw = await invokeIpc(operation.channel, request.data)
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

async function invokeMain<K extends MainOperationKind>(
  kind: K,
  input: MainOperationInput<K>
): Promise<MainOperationOutput<K>> {
  const operation = mainOperations[kind]
  if (operation.channel === null)
    throw new CapabilityError('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) throw new CapabilityError('validation_failed', false)
  try {
    return operation.output.parse(
      await invokeIpc(operation.channel, request.data)
    ) as MainOperationOutput<K>
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

const api: SaltMarcherApi = {
  campaigns: {
    async list() {
      return freezeCampaignSnapshot(
        await invokeCore('campaign.list', undefined)
      )
    },
    async create(name) {
      const input = createCampaignInputSchema.parse({ name })
      return freezeCampaignSnapshot(await invokeCore('campaign.create', input))
    },
    async activate(id) {
      const input = activateCampaignInputSchema.parse({ id })
      return freezeCampaignSnapshot(
        await invokeCore('campaign.activate', input)
      )
    },
    async rename(id, name) {
      const input = renameCampaignInputSchema.parse({ id, name })
      return freezeCampaignSnapshot(await invokeCore('campaign.rename', input))
    },
    async trash(id) {
      const input = campaignIdInputSchema.parse({ id })
      return freezeCampaignSnapshot(await invokeCore('campaign.trash', input))
    },
    async restore(id) {
      const input = campaignIdInputSchema.parse({ id })
      return freezeCampaignSnapshot(await invokeCore('campaign.restore', input))
    },
    async deleteForever(id, confirmationName) {
      const input = permanentlyDeleteCampaignInputSchema.parse({
        id,
        confirmationName
      })
      return freezeCampaignSnapshot(
        await invokeCore('campaign.deleteForever', input)
      )
    }
  },
  settings: {
    read: async () => freezeDeep(await invokeCore('settings.read', undefined)),
    update: async (patch, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'settings.update',
          updateInstallationSettingsInputSchema.parse({
            patch: installationPreferencesSchema.partial().parse(patch),
            expectedRevision
          })
        )
      )
  },
  generatorPresets: {
    readEditor: async (input) =>
      freezeDeep(await invokeCore('generatorPresets.readEditor', input)),
    create: async (input) =>
      freezeDeep(await invokeCore('generatorPresets.create', input)),
    update: async (input) =>
      freezeDeep(await invokeCore('generatorPresets.update', input)),
    delete: async (input) =>
      freezeDeep(await invokeCore('generatorPresets.delete', input)),
    assign: async (input) =>
      freezeDeep(await invokeCore('generatorPresets.assign', input)),
    commandReceipt: async (commandId) =>
      freezeDeep(
        await invokeCore('generatorPresets.commandReceipt', { commandId })
      )
  },
  party: {
    read: async () => freezeDeep(await invokeCore('party.read', undefined)),
    setMembership: async (id, active, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.setMembership',
          setMembershipInputSchema.parse({ id, active, expectedRevision })
        )
      ),
    create: async (character, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.create',
          createPartyCharacterInputSchema.parse({
            character,
            expectedRevision
          })
        )
      ),
    update: async (id, character, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.update',
          updatePartyCharacterInputSchema.parse({
            id,
            character,
            expectedRevision
          })
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.delete',
          deletePartyCharacterInputSchema.parse({ id, expectedRevision })
        )
      ),
    adjustXp: async (id, delta, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.adjustXp',
          adjustPartyXpInputSchema.parse({ id, delta, expectedRevision })
        )
      ),
    rest: async (type, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'party.rest',
          restPartyInputSchema.parse({ type, expectedRevision })
        )
      ),
    calculateAdventuringDay: (rows, totalXp) =>
      invokeCore(
        'party.calculateAdventuringDay',
        adventuringDayInputSchema.parse({
          rows,
          ...(totalXp === undefined ? {} : { totalXp })
        })
      )
  },
  creatures: {
    search: (query) =>
      invokeCore('creatures.search', creatureCatalogQuerySchema.parse(query)),
    filterOptions: () => invokeCore('creatures.filterOptions', undefined),
    detail: (id) => invokeCore('creatures.detail', { id })
  },
  references: {
    staticIndex: async () =>
      freezeDeep(await invokeCore('references.staticIndex', undefined)),
    campaignIndex: async (campaignId) =>
      freezeDeep(
        await invokeCore(
          'references.campaignIndex',
          referenceCampaignIndexInputSchema.parse({ campaignId })
        )
      ),
    detail: async (target) =>
      freezeDeep(
        await invokeCore(
          'references.detail',
          referenceTargetSchema.parse(target)
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
    read: async () => freezeDeep(await invokeCore('locations.read', undefined)),
    suggestTags: async (query, limit = 6) =>
      freezeDeep(
        await invokeCore(
          'locations.suggestTags',
          worldLocationTagSearchInputSchema.parse({ query, limit })
        )
      ),
    save: async (input) =>
      freezeDeep(
        await invokeCore(
          'locations.save',
          saveWorldLocationInputSchema.parse(input)
        )
      ),
    saveReceipt: async (commandId) =>
      freezeDeep(
        await invokeCore(
          'locations.saveReceipt',
          worldLocationSaveReceiptInputSchema.parse({ commandId })
        )
      ),
    commitPlacement: async (input) =>
      freezeDeep(
        await invokeCore(
          'locations.commitPlacement',
          worldLocationPlacementCommandSchema.parse(input)
        )
      ),
    updateMapPresentation: async (id, patch, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'locations.updateMapPresentation',
          updateWorldLocationMapPresentationInputSchema.parse({
            id,
            patch,
            expectedRevision
          })
        )
      ),
    delete: async (id, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'locations.delete',
          deleteWorldLocationInputSchema.parse({ id, expectedRevision })
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
        await invokeCore(
          'locationSymbols.create',
          createLocationSymbolInputSchema.parse({ symbol, expectedRevision })
        )
      ),
    search: async (query = '', offset = 0, limit = 24) =>
      freezeDeep(
        await invokeCore(
          'locationSymbols.search',
          locationSymbolSearchInputSchema.parse({ query, offset, limit })
        )
      ),
    detail: async (id) =>
      freezeDeep(
        await invokeCore(
          'locationSymbols.detail',
          locationSymbolDetailInputSchema.parse({ id })
        )
      ),
    update: async (id, displayName, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'locationSymbols.update',
          updateLocationSymbolInputSchema.parse({
            id,
            displayName,
            expectedRevision
          })
        )
      ),
    deleteImpact: async (id) =>
      freezeDeep(await invokeCore('locationSymbols.deleteImpact', { id })),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'locationSymbols.delete',
          deleteLocationSymbolInputSchema.parse({
            commandId,
            id,
            expectedRevision
          })
        )
      ),
    importAndAssign: async (input) =>
      freezeDeep(
        await invokeCore(
          'locationSymbols.importAndAssign',
          importLocationSymbolInputSchema.parse(input)
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
        await invokeCore(
          'biomes.search',
          biomeSearchInputSchema.parse({ query, offset, limit })
        )
      ),
    detail: async (id) => freezeDeep(await invokeCore('biomes.detail', { id })),
    create: async (commandId, biome, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'biomes.create',
          createBiomeInputSchema.parse({ commandId, biome, expectedRevision })
        )
      ),
    update: async (commandId, id, biome, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'biomes.update',
          updateBiomeInputSchema.parse({
            commandId,
            id,
            biome,
            expectedRevision
          })
        )
      ),
    deleteImpact: async (id) =>
      freezeDeep(await invokeCore('biomes.deleteImpact', { id })),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'biomes.delete',
          deleteBiomeInputSchema.parse({ commandId, id, expectedRevision })
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
      freezeDeep(await invokeCore('encounterTables.read', undefined)),
    commandReceipt: async (commandId) =>
      freezeDeep(
        await invokeCore(
          'encounterTables.commandReceipt',
          encounterTableCommandReceiptInputSchema.parse({ commandId })
        )
      ),
    create: async (commandId, table, expectedRevision, scope = 'campaign') =>
      freezeDeep(
        await invokeCore(
          'encounterTables.create',
          createEncounterTableInputSchema.parse({
            commandId,
            table,
            expectedRevision,
            scope
          })
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
        await invokeCore(
          'encounterTables.update',
          updateEncounterTableInputSchema.parse({
            commandId,
            id,
            table,
            expectedRevision,
            scope
          })
        )
      ),
    delete: async (commandId, id, expectedRevision, scope = 'campaign') =>
      freezeDeep(
        await invokeCore(
          'encounterTables.delete',
          deleteEncounterTableInputSchema.parse({
            commandId,
            id,
            expectedRevision,
            scope
          })
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
    read: async () => freezeDeep(await invokeCore('factions.read', undefined)),
    commandReceipt: async (commandId) =>
      freezeDeep(
        await invokeCore(
          'factions.commandReceipt',
          worldFactionCommandReceiptInputSchema.parse({ commandId })
        )
      ),
    create: async (commandId, faction, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'factions.create',
          createWorldFactionInputSchema.parse({
            commandId,
            faction,
            expectedRevision
          })
        )
      ),
    update: async (commandId, id, faction, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'factions.update',
          updateWorldFactionInputSchema.parse({
            commandId,
            id,
            faction,
            expectedRevision
          })
        )
      ),
    delete: async (commandId, id, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'factions.delete',
          deleteWorldFactionInputSchema.parse({
            commandId,
            id,
            expectedRevision
          })
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
    read: async () => freezeDeep(await invokeCore('session.read', undefined)),
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
      invokeCore(
        'scene.focus',
        focusSceneInputSchema.parse({ sceneId, expectedRevision })
      ).then(freezeDeep),
    setLocation: (sceneId, locationId, expectedRevision) =>
      invokeCore(
        'scene.setLocation',
        setSceneLocationInputSchema.parse({
          sceneId,
          locationId,
          expectedRevision
        })
      ).then(freezeDeep),
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
      invokeCore(
        'scene.saveGroup',
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
      ).then(freezeDeep),
    setGroupArchived: (sceneId, groupId, archived, expectedGroupRevision) =>
      invokeCore(
        'scene.setGroupArchived',
        setSceneGroupArchivedInputSchema.parse({
          sceneId,
          groupId,
          archived,
          expectedGroupRevision
        })
      ).then(freezeDeep),
    deleteGroup: (sceneId, groupId, expectedGroupRevision) =>
      invokeCore(
        'scene.deleteGroup',
        deleteSceneGroupInputSchema.parse({
          sceneId,
          groupId,
          expectedGroupRevision
        })
      ).then(freezeDeep),
    assignPartyMember: (sceneId, partyMemberId, assigned, expectedRevision) =>
      invokeCore(
        'scene.assignPartyMember',
        assignScenePartyInputSchema.parse({
          sceneId,
          partyMemberId,
          assigned,
          expectedRevision
        })
      ).then(freezeDeep),
    evaluateGroupDraft: async (sceneId, entries, expectedRevision) =>
      freezeDeep(
        await invokeCore(
          'scene.evaluateGroupDraft',
          evaluateSceneGroupDraftInputSchema.parse({
            sceneId,
            entries,
            expectedRevision
          })
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
        await invokeCore(
          'scene.generateGroupDraft',
          sceneGroupDraftGenerationRequestSchema.parse({
            sceneId,
            entries,
            mode,
            filters,
            tuning,
            seed,
            expectedRevision
          })
        )
      )
  },
  encounter: {
    evaluate: (sceneId, groupIds, expectedRevision) =>
      invokeCore(
        'encounter.evaluate',
        evaluateEncounterSelectionInputSchema.parse({
          sceneId,
          groupIds,
          expectedRevision
        })
      )
  },
  combat: {
    prepare: (sceneId, groupIds, expectedSceneRevision) =>
      invokeCore(
        'combat.prepare',
        prepareCombatInputSchema.parse({
          sceneId,
          groupIds,
          expectedSceneRevision
        })
      ).then(freezeDeep),
    joinGroup: (
      sceneId,
      groupId,
      expectedGroupRevision,
      expectedCombatRevision
    ) =>
      invokeCore(
        'combat.joinGroup',
        joinCombatGroupInputSchema.parse({
          sceneId,
          groupId,
          expectedGroupRevision,
          expectedCombatRevision
        })
      ).then(freezeDeep),
    rollInitiative: (expectedRevision) =>
      invokeCore(
        'combat.rollInitiative',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    confirmInitiative: (values, expectedRevision) =>
      invokeCore(
        'combat.confirmInitiative',
        confirmInitiativeInputSchema.parse({ values, expectedRevision })
      ).then(freezeDeep),
    advanceTurn: (expectedRevision) =>
      invokeCore(
        'combat.advanceTurn',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    retreatTurn: (expectedRevision) =>
      invokeCore(
        'combat.retreatTurn',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    adjustInitiative: (id, initiative, expectedRevision) =>
      invokeCore(
        'combat.adjustInitiative',
        adjustInitiativeInputSchema.parse({ id, initiative, expectedRevision })
      ).then(freezeDeep),
    changeHp: (cardId, amount, healing, expectedRevision) =>
      invokeCore(
        'combat.changeHp',
        changeHpInputSchema.parse({ cardId, amount, healing, expectedRevision })
      ).then(freezeDeep),
    toggleCondition: (cardId, condition, active, expectedRevision) =>
      invokeCore(
        'combat.toggleCondition',
        toggleConditionInputSchema.parse({
          cardId,
          condition,
          active,
          expectedRevision
        })
      ).then(freezeDeep),
    setConcentration: (cardId, concentrating, expectedRevision) =>
      invokeCore(
        'combat.setConcentration',
        setConcentrationInputSchema.parse({
          cardId,
          concentrating,
          expectedRevision
        })
      ).then(freezeDeep),
    setExhaustion: (cardId, exhaustionLevel, expectedRevision) =>
      invokeCore(
        'combat.setExhaustion',
        setExhaustionInputSchema.parse({
          cardId,
          exhaustionLevel,
          expectedRevision
        })
      ).then(freezeDeep),
    undo: (expectedRevision) =>
      invokeCore(
        'combat.undo',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    end: (expectedRevision) =>
      invokeCore(
        'combat.end',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    moveToPhase: (target, expectedRevision) =>
      invokeCore(
        'combat.moveToPhase',
        moveCombatPhaseInputSchema.parse({ target, expectedRevision })
      ).then(freezeDeep),
    updateResolution: (selectedEnemyIds, mode, xpFraction, expectedRevision) =>
      invokeCore(
        'combat.updateResolution',
        updateResolutionInputSchema.parse({
          selectedEnemyIds,
          mode,
          xpFraction,
          expectedRevision
        })
      ).then(freezeDeep),
    awardXp: (expectedRevision) =>
      invokeCore(
        'combat.awardXp',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep),
    complete: (expectedRevision) =>
      invokeCore(
        'combat.complete',
        combatRevisionInputSchema.parse({ expectedRevision })
      ).then(freezeDeep)
  },
  runtime: Object.freeze({
    readOnly: process.argv.includes('--salt-marcher-read-only'),
    e2e: process.argv.includes('--salt-marcher-e2e'),
    processMemoryBytes: () => invokeMain('runtime.memory', undefined),
    gpuObservation: () => invokeMain('runtime.gpuObservation', undefined),
    coreStatus: () => invokeMain('runtime.coreStatus', undefined),
    retryCore: () => invokeMain('runtime.retryCore', undefined),
    reportRendererIncident: (incident) =>
      invokeMain('runtime.reportRendererIncident', incident),
    reloadRenderer: () => invokeMain('runtime.reloadRenderer', undefined),
    pickLocationSymbolFile: () =>
      invokeMain('runtime.pickLocationSymbolFile', undefined),
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
