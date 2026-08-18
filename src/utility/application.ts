import {
  capabilityFailureSchema,
  type CapabilityErrorCode
} from '../shared/contracts/campaign.js'
import {
  coreControlRequestSchema,
  coreDiagnosticsSchema,
  coreEventSchema,
  coreReadySchema,
  coreRequestSchema,
  coreStartupConfigurationSchema,
  type CoreHandlers,
  type CoreRequest
} from '../shared/contracts/core-protocol.js'
import { coreOperations } from '../shared/contracts/operations.js'
import { openCampaignStore } from '../core/persistence/sqlite/campaign-store.js'
import {
  CreatureCatalogService,
  creatures as creatureCatalogRows
} from '../core/creatures/catalog.js'
import { LivePlayService } from '../core/encounter/live-combat.js'
import { z } from 'zod'
import { WorldLocationService } from '../core/worldplanner/location-store.js'
import { LocationSymbolLifecycleService } from '../core/application/location-symbol-lifecycle.js'
import { EncounterSourceService } from '../core/application/encounter-source-service.js'
import {
  chunkKeyFor,
  HexMapService,
  HexMapStore
} from '../core/hex/hex-map-store.js'
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
import {
  BiomeCatalogService,
  type BiomeMapChange
} from '../core/application/biome-catalog-service.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import { placeholderBiomeId } from '../shared/contracts/biome.js'
import { hexBrushStrokeResultSchema } from '../shared/contracts/hex.js'
import { hexTravelContextResultSchema } from '../shared/contracts/live-session.js'
import { ReferenceService } from '../core/reference/reference-service.js'
import { ReferenceCatalogAdapter } from '../core/reference/reference-catalog-adapter.js'
import { randomUUID } from 'node:crypto'
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
import {
  ReferenceChangeCoordinator,
  type ReferenceChangeDescriptor
} from '../core/reference/reference-change-coordinator.js'
import {
  bootstrapMetrics,
  bootstrapPhase,
  bootstrapReady
} from './bootstrap-observability.js'

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
let pendingPreparationWakeups = 0
const campaigns = bootstrapPhase('campaign-store', () =>
  openCampaignStore(root, incompatibleDataPolicy)
)
const generatorPresets = bootstrapPhase(
  'installation-services',
  () => new GeneratorPresetStore(campaigns.installationDatabase())
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
  () => campaigns.activeCampaignDatabase()
)
const activeDatabase = () => campaigns.activeCampaignDatabase()
const activePartyProgression = () =>
  generatorPresets
    .configFor(campaigns.list().activeCampaignId)
    .config.loot.progression.map((row) => row.xpAtLevel)
const campaignRules = new CampaignRulesService(activeDatabase)
const encounterPlans = new GeneratedEncounterPlanService(activeDatabase)
const sessionPlanner = new SessionPlannerService(
  activeDatabase,
  sessionGenerationService,
  encounterPlans,
  publishPreparationChange,
  schedulePreparationWork,
  undefined,
  (db) =>
    new ItemDefinitionResolver(db, (reference) =>
      createLootCatalogIndex(
        sessionGenerationCatalog.loadFullByReference(reference)
      )
    ),
  activePartyProgression
)
const symbolLifecycle = new LocationSymbolLifecycleService(campaigns)
const locationSymbols = symbolLifecycle.symbols
const customSymbol = (id: string) => symbolLifecycle.customSymbol(id)
const locationStore = (db: ReturnType<typeof activeDatabase>) =>
  symbolLifecycle.locationStore(db)
const locations = new WorldLocationService(activeDatabase, customSymbol, () =>
  campaigns.installationDatabase()
)
const sources = new EncounterSourceService(
  activeDatabase,
  () => campaigns.installationDatabase(),
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
const worldNpcs = new WorldNpcApplicationService(
  activeDatabase,
  creatureReferenceResolver,
  (database) => {
    const campaignTables = new EncounterTableStore(database)
    const installationTables = new EncounterTableStore(
      campaigns.installationDatabase(),
      'installation'
    )
    return new WorldFactionStore(database, {
      containsTable: (id) =>
        campaignTables.contains(id) || installationTables.contains(id),
      containsCreature: (tableId, creatureId) =>
        campaignTables.containsCreature(tableId, creatureId) ||
        installationTables.containsCreature(tableId, creatureId)
    })
  }
)
const biomeService = new BiomeCatalogService(campaigns)
const biomeProjection = (
  id: Parameters<typeof biomeService.hexDefinition>[0]
) => biomeService.hexDefinition(id)
const play = new LivePlayService(activeDatabase, biomeProjection, () => {
  try {
    return generatorPresets.configFor(campaigns.list().activeCampaignId)
  } catch {
    return defaultGeneratorConfig
  }
})
const lootComposition = createLootComposition({
  activeDatabase,
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
const hex = new HexMapService(activeDatabase, locationStore)
const hexEditing = new HexMapEditingCommandHandler(() => {
  const db = activeDatabase()
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
const worldLocationDeletion = new WorldLocationDeletionCommandHandler(() => {
  const db = activeDatabase()
  const locationsForMap = locationStore(db)
  return {
    unitOfWork: new CampaignUnitOfWork(db),
    maps: new HexMapStore(db, locationsForMap),
    journal: new HexEditJournalStore(db),
    locations: locationsForMap,
    npcs: new WorldNpcStore(db, creatureReferenceResolver)
  }
})
const worldLocationPlacement = new WorldLocationPlacementService(() => {
  const db = activeDatabase()
  return {
    maps: new HexMapStore(db, locationStore(db)),
    hexEditing
  }
})
const worldLocationSave = new WorldLocationSaveCommandHandler(() => {
  const database = activeDatabase()
  return {
    locations,
    journal: new WorldLocationSaveJournal(database),
    placement: worldLocationPlacement
  }
})
const hexTravel = new HexTravelService(
  activeDatabase,
  Date.now,
  biomeProjection
)
const creatures = new CreatureCatalogService(
  () => campaigns.installationDatabase(),
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
const referenceChanges = new ReferenceChangeCoordinator(
  () => campaigns.activeCampaignId(),
  (campaignId) => references.campaignIndex(campaignId),
  {
    all: () => worldNpcs.referenceDependencies(),
    one: (id) => worldNpcs.referenceDependency(id)
  },
  (notice) =>
    postCoreEvent({
      kind: 'reference.changed',
      notice
    })
)
let travelTimer: NodeJS.Timeout | undefined

function postCoreEvent(event: unknown): void {
  runtimeCounters.eventsPublished += 1
  process.parentPort?.postMessage(coreEventSchema.parse(event))
}

function mutateReferences<T>(
  work: () => T,
  changes: (result: T) => readonly ReferenceChangeDescriptor[]
): T {
  const result = work()
  referenceChanges.record(changes(result))
  return result
}

function publishSessionChange(
  snapshot: ReturnType<HexTravelService['read']>,
  reason:
    'travel-boundary' | 'travel-command' | 'campaign-reconcile' | 'map-edit'
): void {
  postCoreEvent({
    kind: 'session.changed',
    notice: {
      campaignId: campaigns.activeCampaignId(),
      sceneId: snapshot.sceneId,
      revision: snapshot.revision,
      reason
    }
  })
}

function publishLootChange(
  reason: 'created' | 'updated' | 'moved' | 'accepted' | 'distributed'
): void {
  postCoreEvent({
    kind: 'loot.changed',
    notice: {
      campaignId: campaigns.activeCampaignId(),
      revision: lootComposition.projectionRevision(),
      reason
    }
  })
}

function publishPreparationChange(notice: {
  operationId: string
  status:
    | 'queued'
    | 'generating'
    | 'resolving_encounters'
    | 'saving'
    | 'succeeded'
    | 'invalid'
    | 'stale'
    | 'failed'
    | 'canceled'
}): void {
  postCoreEvent({
    kind: 'session-planner.preparation-changed',
    notice: {
      campaignId: campaigns.activeCampaignId(),
      ...notice
    }
  })
}

function schedulePreparationWork(work: () => void): void {
  const configured = Number(
    process.env['SALT_MARCHER_E2E_PREPARATION_STAGE_DELAY_MS'] ?? 0
  )
  const delay =
    process.env['SALT_MARCHER_E2E'] === 'true' &&
    Number.isInteger(configured) &&
    configured >= 0 &&
    configured <= 5_000
      ? configured
      : 0
  pendingPreparationWakeups += 1
  const execute = () => {
    pendingPreparationWakeups -= 1
    runtimeCounters.scheduledWakeups += 1
    work()
  }
  if (delay > 0) {
    setTimeout(execute, delay)
    return
  }
  setImmediate(execute)
}

function publishHexChange(payload: unknown): void {
  const result = hexBrushStrokeResultSchema.safeParse(payload)
  if (!result.success || result.data.status !== 'applied') return
  const applied = result.data
  if (!applied.changed) return
  publishHexNotice(
    applied.commandId,
    applied.maps.map((map) => map.id),
    applied.changedChunks
  )
  const changedScenes = new Set(
    applied.impact.journeys.map((journey) => journey.sceneId)
  )
  const changedMembers = new Set(
    applied.impact.partyMembers.map((member) => member.memberId)
  )
  if (changedMembers.size > 0)
    for (const scene of play.readSession().scene.scenes)
      if (scene.partyMemberIds.some((memberId) => changedMembers.has(memberId)))
        changedScenes.add(scene.id)
  for (const sceneId of changedScenes)
    publishSessionChange(hexTravel.read(sceneId), 'map-edit')
}

function publishHexNotice(
  commandId: string,
  mapIds: readonly string[],
  changedChunks: readonly unknown[]
): void {
  postCoreEvent({
    kind: 'hex.changed',
    notice: {
      campaignId: campaigns.activeCampaignId(),
      commandId,
      mapIds,
      changedChunks
    }
  })
}

function biomeChangedChunks(mapId: string, changes: readonly BiomeMapChange[]) {
  const keys = new Map(
    changes
      .filter((change) => change.mapId === mapId)
      .map((change) => {
        const key = change.key
        return [`${key.q}:${key.r}`, key] as const
      })
  )
  if (keys.size === 0) return []
  const changed = []
  const values = [...keys.values()]
  for (let index = 0; index < values.length; index += 64)
    changed.push(
      ...hex
        .readChunks(mapId, values.slice(index, index + 64))
        .chunks.map((chunk) => ({
          mapId,
          key: chunk.key,
          revision: chunk.revision
        }))
    )
  return changed
}

function publishBiomeMapChanges(
  commandId: string,
  changes: readonly BiomeMapChange[]
): void {
  let campaignId: string
  try {
    campaignId = campaigns.activeCampaignId()
  } catch {
    return
  }
  const active = changes.filter((change) => change.campaignId === campaignId)
  for (const mapId of new Set(active.map((change) => change.mapId)))
    publishHexNotice(commandId, [mapId], biomeChangedChunks(mapId, active))
}

function publishLocationChange(
  changedLocationIds: readonly string[],
  reason: 'catalog' | 'presentation' | 'symbol-replacement'
): void {
  postCoreEvent({
    kind: 'locations.changed',
    notice: {
      campaignId: campaigns.activeCampaignId(),
      revision: locations.read().revision,
      changedLocationIds,
      reason
    }
  })
}

function publishLocationMarkerHexChanges(
  locationIds: readonly string[],
  commandId: string = randomUUID()
): void {
  const placements = locationIds
    .map((locationId) => hex.locateLocation(locationId))
    .filter((placement) => placement !== null)
  if (placements.length === 0) return
  const changedChunks = new Map(
    placements.map((placement) => {
      const key = chunkKeyFor(placement.coordinate)
      const chunk = hex.readChunks(placement.mapId, [key]).chunks[0]
      if (!chunk) throw new CapabilityError('internal', false)
      return [
        `${placement.mapId}:${key.q}:${key.r}`,
        { mapId: placement.mapId, key, revision: chunk.revision }
      ] as const
    })
  )
  publishHexNotice(
    commandId,
    [...new Set(placements.map((placement) => placement.mapId))],
    [...changedChunks.values()]
  )
}

function publishSymbolChange(
  changedSymbolIds: readonly string[],
  reason: 'created' | 'renamed' | 'deleted'
): void {
  postCoreEvent({
    kind: 'location-symbols.changed',
    notice: {
      revision: locationSymbols.read().revision,
      changedSymbolIds,
      reason
    }
  })
}

function publishBiomeChange(
  changedBiomeIds: readonly string[],
  reason: 'created' | 'updated' | 'deleted'
): void {
  postCoreEvent({
    kind: 'biomes.changed',
    notice: {
      revision: biomeService.catalog.revision(),
      changedBiomeIds,
      reason
    }
  })
}

function publishEncounterTableChange(
  snapshot: ReturnType<EncounterSourceService['readTables']>,
  changedTableIds: readonly string[],
  scope: 'installation' | 'campaign',
  reason: 'created' | 'updated' | 'deleted'
): void {
  postCoreEvent({
    kind: 'encounter-tables.changed',
    notice: {
      installationRevision: snapshot.installation.revision,
      campaignRevision: snapshot.campaign.revision,
      changedTableIds,
      scope,
      reason
    }
  })
}

function publishNpcChange(
  changedNpcIds: readonly string[],
  reason: 'created' | 'updated' | 'deleted' | 'reference-unlinked'
): void {
  postCoreEvent({
    kind: 'npcs.changed',
    notice: {
      revision: worldNpcs.search({ limit: 1 }).revision,
      changedNpcIds,
      reason
    }
  })
}

function publishFactionChange(
  changedFactionIds: readonly string[],
  reason: 'created' | 'updated' | 'deleted'
): void {
  postCoreEvent({
    kind: 'factions.changed',
    notice: {
      revision: sources.readFactions().revision,
      changedFactionIds,
      reason
    }
  })
}

bootstrapPhase('recovery', () => {
  symbolLifecycle.recoverPendingImports()
  symbolLifecycle.recoverPendingDeletions()
  biomeService.recoverPendingDeletions()
  sources.recoverPendingInstallationTableLifecycles()
  if (campaigns.list().activeCampaignId !== null)
    sessionPlanner.recoverPendingPreparations()
})

function scheduleNextBoundary(): void {
  if (travelTimer !== undefined) clearTimeout(travelTimer)
  travelTimer = undefined
  try {
    const delay = hexTravel.nextBoundaryDelay()
    if (delay === null) return
    travelTimer = setTimeout(() => {
      travelTimer = undefined
      runtimeCounters.scheduledWakeups += 1
      reconcileAndSchedule('travel-boundary')
    }, delay)
    travelTimer.unref()
  } catch {
    // No active campaign is a normal idle state for the installation.
  }
}

function reconcileAndSchedule(
  reason: 'travel-boundary' | 'travel-command' | 'campaign-reconcile'
): void {
  try {
    const tick = hexTravel.tick()
    for (const snapshot of tick.changed) publishSessionChange(snapshot, reason)
  } catch {
    // No active campaign is a normal idle state for the installation.
  }
  scheduleNextBoundary()
}

reconcileAndSchedule('campaign-reconcile')
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
    if (travelTimer !== undefined) clearTimeout(travelTimer)
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

process.parentPort.on('message', (event) => {
  void handleMessage(event)
})

async function handleMessage(event: { data: unknown }): Promise<void> {
  runtimeCounters.messagesReceived += 1
  const control = coreControlRequestSchema.safeParse(event.data)
  if (control.success) {
    process.parentPort?.postMessage(
      coreDiagnosticsSchema.parse({
        kind: 'core.diagnostics',
        requestId: control.data.requestId,
        metrics: {
          ...runtimeCounters,
          activeDomainTimers:
            (travelTimer === undefined ? 0 : 1) + pendingPreparationWakeups,
          uptimeMs: process.uptime() * 1_000,
          bootstrap: bootstrapMetrics()
        }
      })
    )
    return
  }
  const parsed = coreRequestSchema.safeParse(event.data)
  if (!parsed.success) {
    const envelope = z
      .object({
        kind: z.literal('core.request'),
        requestId: z.uuid(),
        operation: z.string()
      })
      .safeParse(event.data)
    if (envelope.success) failure(envelope.data.requestId, 'validation_failed')
    return
  }
  const r = parsed.data
  try {
    const payload = await dispatch(r)
    respond(r.requestId, payload)
    if (r.operation === 'core.shutdown') setImmediate(() => process.exit(0))
  } catch (e) {
    const mapped = capabilityFailure(e)
    failure(r.requestId, mapped.code, mapped.retryable, mapped.issues)
  } finally {
    runtimeCounters.requestsCompleted += 1
  }
}

function dispatch(request: CoreRequest): Promise<unknown> {
  const handler = handlers[request.operation] as (input: unknown) => unknown
  const result = handler(request.input)
  return Promise.resolve(result).then((payload) => {
    const parsed = coreOperations[request.operation].output.parse(payload)
    if (
      request.operation === 'hex.create' ||
      request.operation === 'hex.update' ||
      request.operation === 'hex.applyBrushStroke' ||
      request.operation === 'hex.undo' ||
      request.operation === 'hex.redo'
    )
      publishHexChange(parsed)
    if (
      request.operation.startsWith('hexTravel.') &&
      request.operation !== 'hexTravel.read'
    ) {
      const result = hexTravelContextResultSchema.safeParse(parsed)
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
      reconcileAndSchedule(
        request.operation.startsWith('campaign.')
          ? 'campaign-reconcile'
          : 'travel-command'
      )
    return parsed
  })
}
function respond(requestId: string, payload: unknown) {
  process.parentPort?.postMessage({
    kind: 'core.result',
    requestId,
    ok: true,
    payload
  })
}
function failure(
  requestId: string,
  code: CapabilityErrorCode,
  retryable = false,
  issues: CapabilityError['issues'] = []
) {
  process.parentPort?.postMessage({
    kind: 'core.result',
    requestId,
    ok: false,
    error: capabilityFailureSchema.parse({
      code,
      retryable,
      ...(issues.length > 0 ? { issues } : {})
    })
  })
}

function capabilityFailure(error: unknown): {
  code: CapabilityErrorCode
  retryable: boolean
  issues: CapabilityError['issues']
} {
  if (error instanceof CapabilityError)
    return {
      code: error.code,
      retryable: error.retryable,
      issues: error.issues
    }
  return { code: 'internal', retryable: false, issues: [] }
}
