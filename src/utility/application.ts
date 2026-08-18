import type Database from 'better-sqlite3'
import {
  coreReadySchema,
  coreStartupConfigurationSchema,
  type CoreHandlers
} from '../shared/contracts/core-protocol.js'
import { coreOperations } from '../shared/contracts/operations.js'
import { assertExactOperationKeys } from '../shared/contracts/operations/registry.js'
import { openCampaignStore } from '../core/persistence/sqlite/campaign-store.js'
import {
  CreatureCatalogService,
  creatures as creatureCatalogRows
} from '../core/creatures/catalog.js'
import { LivePlayService } from '../core/encounter/live-combat.js'
import { WorldLocationService } from '../core/worldplanner/location-store.js'
import { LocationSymbolLifecycleService } from '../core/application/location-symbol-lifecycle.js'
import { EncounterSourceService } from '../core/application/encounter-source-service.js'
import { HexMapService, HexMapStore } from '../core/hex/hex-map-store.js'
import { HexMapEditingCommandHandler } from '../core/application/hex-map-editing.js'
import { HexTravelService, HexTravelStore } from '../core/hex/hex-travel.js'
import { HexEditJournalStore } from '../core/hex/hex-edit-journal-store.js'
import { PartyStore } from '../core/party/party-store.js'
import { SceneStore } from '../core/scene/scene-store.js'
import { CampaignUnitOfWork } from '../core/application/campaign-unit-of-work.js'
import { GeneratorPresetStore } from '../core/persistence/sqlite/generator-preset-store.js'
import { defaultGeneratorConfig } from '../shared/generator/system-generator-preset.js'
import { WorldLocationDeletionCommandHandler } from '../core/application/world-location-deletion.js'
import { WorldLocationSaveCommandHandler } from '../core/application/world-location-save.js'
import { WorldLocationSaveJournal } from '../core/worldplanner/world-location-save-journal.js'
import { WorldNpcStore } from '../core/worldplanner/npc-store.js'
import { WorldNpcApplicationService } from '../core/application/world-npc-application-service.js'
import { WorldFactionStore } from '../core/worldplanner/faction-store.js'
import { EncounterTableStore } from '../core/encounter/encounter-table-store.js'
import { WorldLocationPlacementService } from '../core/application/world-location-placement.js'
import { BiomeCatalogService } from '../core/application/biome-catalog-service.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import { placeholderBiomeId } from '../shared/contracts/biome.js'
import { hexTravelContextResultSchema } from '../shared/contracts/live-session.js'
import { ReferenceService } from '../core/reference/reference-service.js'
import { ReferenceCatalogAdapter } from '../core/reference/reference-catalog-adapter.js'
import {
  BundledSessionGenerationCatalogRegistry,
  CatalogProviderError
} from './session-generation/catalog-provider.js'
import { sha256EncounterEntropy } from './session-generation/sha256-entropy.js'
import { SessionGenerationService } from './session-generation/session-generation-service.js'
import { GeneratedEncounterPlanService } from '../core/encounter/generated-plan-service.js'
import { SessionPlannerService } from './session-planner/session-planner-service.js'
import { CampaignRulesService } from '../core/application/campaign-rules-service.js'
import { createLootComposition } from './composition/loot.js'
import { ItemDefinitionResolver } from '../core/loot/item-definition-resolver.js'
import { createLootCatalogIndex } from '../core/loot/loot-catalog-index.js'
import { createCampaignHandlers } from './composition/campaign.js'
import { CampaignImportService } from '../core/campaign-import/campaign-import-service.js'
import {
  createEncounterHandlers,
  createPartyHandlers,
  createSessionHandlers
} from './composition/live-play.js'
import { createReferenceHandlers } from './composition/reference.js'
import { createSessionPlannerHandlers } from './composition/session-planner.js'
import { createBiomeHandlers } from './composition/biome.js'
import { createWorldPlannerHandlers } from './composition/world-planner.js'
import { createHexHandlers } from './composition/hex.js'
import { createTravelHandlers } from './composition/travel.js'
import { ReferenceChangeCoordinator } from '../core/reference/reference-change-coordinator.js'
import { bootstrapPhase, bootstrapReady } from './bootstrap-observability.js'
import { startUtilityDispatcher } from './runtime-dispatcher.js'
import {
  PreparationWorkScheduler,
  TravelBoundaryScheduler
} from './domain-scheduling.js'
import { CoreEventSink, createDomainEventPublishers } from './domain-events.js'

const startup = bootstrapPhase('configuration', () =>
  coreStartupConfigurationSchema.parse(JSON.parse(process.argv[2] ?? ''))
)
if (!process.parentPort)
  throw new Error('Utility process requires an Electron parent port')
const {
  dataRoot: root,
  referenceDatabasePath,
  sessionGenerationCatalogRoot,
  incompatibleDataPolicy
} = startup
const runtimeCounters = {
  messagesReceived: 0,
  requestsCompleted: 0,
  eventsPublished: 0,
  scheduledWakeups: 0
}
const preparationScheduler = new PreparationWorkScheduler(() => {
  runtimeCounters.scheduledWakeups += 1
})
const campaigns = bootstrapPhase('campaign-store', () =>
  openCampaignStore(root, incompatibleDataPolicy)
)
const generatorPresets = bootstrapPhase('installation-services', () =>
  campaigns
    .installationPersistenceAccess()
    .use((database) => new GeneratorPresetStore(database))
)
const sessionGenerationCatalog = bootstrapPhase(
  'session-generation-catalog',
  () =>
    new BundledSessionGenerationCatalogRegistry(sessionGenerationCatalogRoot)
)
const sessionGenerationService = new SessionGenerationService(
  sessionGenerationCatalog,
  sha256EncounterEntropy,
  () => generatorPresets.configFor(campaigns.list().activeCampaignId),
  campaigns.activeCampaignPersistence()
)
const activePersistence = campaigns.activeCampaignPersistence()
const campaignRules = new CampaignRulesService(activePersistence)
const encounterPlans = new GeneratedEncounterPlanService(activePersistence)
const symbolLifecycle = new LocationSymbolLifecycleService(campaigns)
const locationSymbols = symbolLifecycle.symbols
const customSymbol = (id: string) => symbolLifecycle.customSymbol(id)
const locationStore = (db: Database.Database) =>
  symbolLifecycle.locationStore(db)
const locations = new WorldLocationService(
  activePersistence,
  customSymbol,
  campaigns.installationPersistenceAccess()
)
const sources = new EncounterSourceService(
  activePersistence,
  campaigns.installationPersistenceAccess(),
  (visitor) =>
    void campaigns.visitCampaignDatabases(({ id, database }) =>
      visitor({ id, database })
    )
)
const creatureReferences = new Map(
  creatureCatalogRows.map((creature) => [
    creature.id,
    { id: creature.id, displayName: creature.name }
  ])
)
const creatureReferenceResolver = {
  resolve: (id: string) => creatureReferences.get(id) ?? null
}
const campaignImport = new CampaignImportService(
  campaigns,
  creatureReferenceResolver
)
const installationEncounterTables = campaigns
  .installationPersistenceAccess()
  .use((database) => new EncounterTableStore(database, 'installation'))
const worldNpcs = new WorldNpcApplicationService(
  activePersistence,
  creatureReferenceResolver,
  (database) => {
    const campaignTables = new EncounterTableStore(database)
    return new WorldFactionStore(database, {
      containsTable: (id) =>
        campaignTables.contains(id) || installationEncounterTables.contains(id),
      containsCreature: (tableId, creatureId) =>
        campaignTables.containsCreature(tableId, creatureId) ||
        installationEncounterTables.containsCreature(tableId, creatureId)
    })
  }
)
const biomeService = new BiomeCatalogService(campaigns)
const biomeProjection = (
  id: Parameters<typeof biomeService.hexDefinition>[0]
) => biomeService.hexDefinition(id)
const play = new LivePlayService(activePersistence, biomeProjection, () => {
  try {
    return generatorPresets.configFor(campaigns.list().activeCampaignId)
  } catch {
    return defaultGeneratorConfig
  }
})
const lootComposition = createLootComposition({
  activeDatabase: activePersistence,
  rules: campaignRules,
  generation: sessionGenerationService,
  currentCatalogReference: () => sessionGenerationCatalog.currentReference(),
  loadCatalog: (reference) => {
    try {
      return sessionGenerationCatalog.loadFullByReference(reference)
    } catch (error) {
      if (error instanceof CatalogProviderError)
        throw new CapabilityError('catalog_unavailable', false)
      throw error
    }
  },
  groupCommands: {
    save: (input) =>
      play.saveSceneGroup(
        input.sceneId,
        input.groupId,
        input.name,
        input.note,
        input.disposition,
        input.entries,
        input.expectedSceneRevision,
        input.expectedGroupRevision,
        input.prospectiveGroupId
      ),
    result: (sceneId, groupIds) => play.sceneGroupResult(sceneId, groupIds)
  }
})
const hex = new HexMapService(activePersistence, locationStore)
const hexEditing = new HexMapEditingCommandHandler(() =>
  activePersistence.use((db) => {
    const locationsForMap = locationStore(db)
    const maps = new HexMapStore(db, locationsForMap)
    const party = new PartyStore(db)
    const scenes = new SceneStore(db, () => locationsForMap.read().locations)
    return {
      unitOfWork: new CampaignUnitOfWork(db),
      maps,
      party,
      travel: new HexTravelStore(db, maps, party, scenes),
      journal: new HexEditJournalStore(db)
    }
  })
)
const worldLocationDeletion = new WorldLocationDeletionCommandHandler(() =>
  activePersistence.use((db) => {
    const locationsForMap = locationStore(db)
    return {
      unitOfWork: new CampaignUnitOfWork(db),
      maps: new HexMapStore(db, locationsForMap),
      journal: new HexEditJournalStore(db),
      locations: locationsForMap,
      npcs: new WorldNpcStore(db, creatureReferenceResolver)
    }
  })
)
const worldLocationPlacement = new WorldLocationPlacementService(() =>
  activePersistence.use((db) => ({
    maps: new HexMapStore(db, locationStore(db)),
    hexEditing
  }))
)
const worldLocationSave = new WorldLocationSaveCommandHandler(() =>
  activePersistence.use((database) => ({
    locations,
    journal: new WorldLocationSaveJournal(database),
    placement: worldLocationPlacement
  }))
)
const hexTravel = new HexTravelService(
  activePersistence,
  Date.now,
  biomeProjection
)
const creatures = new CreatureCatalogService(
  campaigns.installationPersistenceAccess(),
  (query) => sources.resolve(query),
  () => ({
    biomes: biomeService
      .hexCatalog()
      .biomes.map((biome) => ({
        id: biome.id,
        label: biome.label
      }))
      .filter((biome) => biome.id !== placeholderBiomeId),
    encounterTables: [
      ...sources.readTables().installation.tables,
      ...sources.readTables().campaign.tables
    ].map((table) => ({ id: table.id, label: table.displayName })),
    factions: sources.readFactions().factions.map((faction) => ({
      id: faction.id,
      label: faction.displayName
    })),
    locations: locations.read().locations.map((location) => ({
      id: location.id,
      label: location.displayName
    }))
  })
)
const referenceCatalog = new ReferenceCatalogAdapter(referenceDatabasePath)
const references = new ReferenceService(
  referenceCatalog,
  { all: () => creatureCatalogRows, detail: (id) => creatures.detail(id) },
  locations,
  { read: () => sources.readFactions() },
  { read: () => worldNpcs.readAllForReferences() },
  () => campaigns.activeCampaignId()
)
const eventSink = new CoreEventSink(process.parentPort, runtimeCounters)
const referenceChanges = new ReferenceChangeCoordinator(
  () => campaigns.activeCampaignId(),
  (campaignId) => references.campaignIndex(campaignId),
  {
    all: () => worldNpcs.referenceDependencies(),
    one: (id) => worldNpcs.referenceDependency(id)
  },
  (notice) =>
    eventSink.post({
      kind: 'reference.changed',
      notice
    })
)
const {
  mutateReferences,
  publishSessionChange,
  publishLootChange,
  publishPreparationChange,
  publishHexChange,
  publishHexNotice,
  biomeChangedChunks,
  publishBiomeMapChanges,
  publishLocationChange,
  publishLocationMarkerHexChanges,
  publishSymbolChange,
  publishBiomeChange,
  publishEncounterTableChange,
  publishNpcChange,
  publishFactionChange
} = createDomainEventPublishers({
  sink: eventSink,
  campaigns,
  referenceChanges,
  hex,
  hexTravel,
  play,
  loot: lootComposition,
  locations,
  locationSymbols,
  biomes: biomeService,
  encounterSources: sources,
  worldNpcs
})

const sessionPlanner = new SessionPlannerService(
  activePersistence,
  sessionGenerationService,
  encounterPlans,
  publishPreparationChange,
  preparationScheduler.schedule,
  undefined,
  (db) =>
    new ItemDefinitionResolver(db, (reference) =>
      createLootCatalogIndex(
        sessionGenerationCatalog.loadFullByReference(reference)
      )
    )
)

bootstrapPhase('recovery', () => {
  symbolLifecycle.recoverPendingImports()
  symbolLifecycle.recoverPendingDeletions()
  biomeService.recoverPendingDeletions()
  sources.recoverPendingInstallationTableLifecycles()
  if (campaigns.list().activeCampaignId !== null)
    sessionPlanner.recoverPendingPreparations()
})

const travelScheduler = new TravelBoundaryScheduler(
  hexTravel,
  publishSessionChange,
  () => {
    runtimeCounters.scheduledWakeups += 1
  }
)
travelScheduler.reconcile('campaign-reconcile')
bootstrapReady()
process.parentPort.postMessage(coreReadySchema.parse({ kind: 'core.ready' }))
const campaignHandlers = createCampaignHandlers({
  campaigns,
  campaignImport,
  campaignRules,
  generatorPresets,
  mutateReferences,
  recoverPendingPreparations: () => sessionPlanner.recoverPendingPreparations()
})
const partyHandlers = createPartyHandlers(play)
const creatureHandlers = createReferenceHandlers({ creatures, references })

const biomeHandlers = createBiomeHandlers({
  biomes: biomeService,
  publishMapChanges: publishBiomeMapChanges,
  publishChange: publishBiomeChange
})

const worldPlannerHandlers = createWorldPlannerHandlers({
  locations,
  save: worldLocationSave,
  placement: worldLocationPlacement,
  deletion: worldLocationDeletion,
  symbols: symbolLifecycle,
  sources,
  worldNpcs,
  biomes: biomeService,
  mutateReferences,
  publishLocationChange,
  publishLocationMarkerHexChanges,
  publishSymbolChange,
  publishEncounterTableChange,
  publishBiomeChange,
  publishHexChange,
  publishHexNotice,
  publishNpcChange,
  publishFactionChange
})

const sessionHandlers = createSessionHandlers(play)
const sessionPlannerHandlers = createSessionPlannerHandlers({
  encounterPlans,
  sessionPlanner
})
const encounterHandlers = createEncounterHandlers(play)

const hexHandlers = createHexHandlers({
  hex,
  editing: hexEditing,
  travel: hexTravel,
  biomes: biomeService,
  locations,
  changedChunks: biomeChangedChunks,
  publishNotice: publishHexNotice
})
const travelHandlers = createTravelHandlers({ travel: hexTravel, play })

const lifecycleHandlers = {
  'core.sessionGenerationCatalog': () =>
    sessionGenerationCatalog.currentReference(),
  'core.shutdown': () => {
    travelScheduler.close()
    referenceCatalog.close()
    campaigns.close()
    return null
  }
} satisfies Pick<
  CoreHandlers,
  'core.sessionGenerationCatalog' | 'core.shutdown'
>

const handlers = {
  ...campaignHandlers,
  ...partyHandlers,
  ...creatureHandlers,
  ...biomeHandlers,
  ...worldPlannerHandlers,
  ...sessionHandlers,
  ...sessionPlannerHandlers,
  ...lootComposition.handlers,
  ...encounterHandlers,
  ...hexHandlers,
  ...travelHandlers,
  ...lifecycleHandlers
} satisfies CoreHandlers

assertExactOperationKeys(
  'utility_handlers',
  Object.keys(coreOperations),
  Object.keys(handlers)
)

startUtilityDispatcher({
  parentPort: process.parentPort,
  handlers,
  counters: runtimeCounters,
  activeDomainTimers: () =>
    travelScheduler.activeTimers() + preparationScheduler.activeWakeups(),
  afterOperation(request, payload) {
    if (
      request.operation === 'hex.create' ||
      request.operation === 'hex.update' ||
      request.operation === 'hex.applyBrushStroke' ||
      request.operation === 'hex.undo' ||
      request.operation === 'hex.redo'
    )
      publishHexChange(payload)
    if (
      request.operation.startsWith('hexTravel.') &&
      request.operation !== 'hexTravel.read'
    ) {
      const result = hexTravelContextResultSchema.safeParse(payload)
      if (result.success)
        publishSessionChange(result.data.travel, 'travel-command')
    }
    const lootReason =
      request.operation === 'loot.create'
        ? 'created'
        : request.operation === 'loot.update'
          ? 'updated'
          : request.operation === 'loot.move'
            ? 'moved'
            : request.operation === 'loot.acceptGenerated'
              ? 'accepted'
              : request.operation === 'loot.commitGroupReward'
                ? 'accepted'
                : request.operation === 'loot.distribute'
                  ? 'distributed'
                  : null
    if (lootReason) publishLootChange(lootReason)
    if (
      coreOperations[request.operation].mode === 'write' &&
      request.operation !== 'settings.update' &&
      request.operation !== 'core.shutdown'
    )
      travelScheduler.reconcile(
        request.operation.startsWith('campaign.')
          ? 'campaign-reconcile'
          : 'travel-command'
      )
  }
})
