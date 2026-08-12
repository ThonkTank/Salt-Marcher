import {
  capabilityFailureSchema,
  coreReadySchema,
  type CapabilityErrorCode
} from '../shared/contracts/campaign.js'
import {
  coreEventSchema,
  coreRequestSchema,
  type CoreHandlers,
  type CoreRequest
} from '../shared/contracts/core-protocol.js'
import { coreOperations } from '../shared/contracts/operations.js'
import { openDevelopmentCampaignStore } from '../core/persistence/sqlite/campaign-store.js'
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
import { WorldLocationPlacementService } from '../core/application/world-location-placement.js'
import {
  BiomeCatalogService,
  type BiomeMapChange
} from '../core/application/biome-catalog-service.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import { placeholderBiomeId } from '../shared/contracts/biome.js'
import { hexBrushStrokeResultSchema } from '../shared/contracts/hex.js'
import { hexTravelContextResultSchema } from '../shared/contracts/live-session.js'
import { emptyPassiveProjection } from '../shared/contracts/passive-display.js'
import { ReferenceService } from '../core/reference/reference-service.js'
import { ReferenceCatalogAdapter } from '../core/reference/reference-catalog-adapter.js'
import { referenceTargetKey } from '../shared/reference/reference-target-key.js'
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
const root = process.argv[2]
const referenceDatabasePath = process.argv[3]
const sessionGenerationCatalogRoot = process.argv[4]
if (
  !root ||
  !referenceDatabasePath ||
  !sessionGenerationCatalogRoot ||
  !process.parentPort
)
  throw new Error(
    'Utility process requires a data root, reference database, catalog root, and parent port'
  )
const campaigns = openDevelopmentCampaignStore(root)
const generatorPresets = new GeneratorPresetStore(
  campaigns.installationDatabase()
)
const sessionGenerationCatalog = new BundledSessionGenerationCatalogRegistry(
  sessionGenerationCatalogRoot
)
const sessionGenerationService = new SessionGenerationService(
  sessionGenerationCatalog,
  sha256EncounterEntropy,
  () => generatorPresets.configFor(campaigns.list().activeCampaignId),
  () => campaigns.activeCampaignDatabase()
)
const activeDatabase = () => campaigns.activeCampaignDatabase()
const campaignRules = new CampaignRulesService(activeDatabase)
const encounterPlans = new GeneratedEncounterPlanService(activeDatabase)
const sessionPlanner = new SessionPlannerService(
  activeDatabase,
  sessionGenerationService,
  encounterPlans,
  publishPreparationChange,
  schedulePreparationWork
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
    locations: locationsForMap
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
const hexBiomeCatalog = () => {
  return biomeService.hexCatalog()
}
const referenceCatalog = new ReferenceCatalogAdapter(referenceDatabasePath)
const references = new ReferenceService(
  referenceCatalog,
  { all: () => creatureCatalogRows, detail: (id) => creatures.detail(id) },
  locations,
  { read: () => sources.readFactions() },
  () => campaigns.activeCampaignId()
)
let travelTimer: NodeJS.Timeout | undefined

type ReferenceSnapshot = Readonly<{
  index: ReturnType<ReferenceService['campaignIndex']>
  documents: ReadonlyMap<string, string>
}>

function referenceSnapshot(): ReferenceSnapshot {
  const campaignId = campaigns.activeCampaignId()
  const index = references.campaignIndex(campaignId)
  const targets = new Map(
    index.terms.flatMap((term) =>
      term.candidates.map(
        (candidate) =>
          [referenceTargetKey(candidate.target), candidate.target] as const
      )
    )
  )
  return {
    index,
    documents: new Map(
      [...targets].map(([key, target]) => [
        key,
        JSON.stringify(references.detail(target))
      ])
    )
  }
}

function publishReferenceChange(before: ReferenceSnapshot | null): void {
  const campaignId = campaigns.activeCampaignId()
  const after = referenceSnapshot()
  const targets = (snapshot: ReferenceSnapshot | null) =>
    new Map(
      (snapshot?.index.terms ?? []).flatMap((term) =>
        term.candidates.map(
          (candidate) =>
            [referenceTargetKey(candidate.target), candidate.target] as const
        )
      )
    )
  const oldTargets = targets(before)
  const newTargets = targets(after)
  const changedTargets = [...oldTargets, ...newTargets]
    .filter(
      ([key], index, all) => all.findIndex(([other]) => other === key) === index
    )
    .filter(([key]) => before?.documents.get(key) !== after.documents.get(key))
    .map(([, target]) => target)
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'reference.changed',
      notice: {
        campaignId,
        revision: after.index.revision,
        changedTargets
      }
    })
  )
}

function mutateReferences<T>(work: () => T): T {
  let before: ReferenceSnapshot | null = null
  try {
    before = referenceSnapshot()
  } catch {
    // Creating the first campaign has no previous campaign reference index.
  }
  const result = work()
  publishReferenceChange(before)
  return result
}

function publishSessionChange(
  snapshot: ReturnType<HexTravelService['read']>,
  reason:
    'travel-boundary' | 'travel-command' | 'campaign-reconcile' | 'map-edit'
): void {
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'session.changed',
      notice: {
        campaignId: campaigns.activeCampaignId(),
        sceneId: snapshot.sceneId,
        revision: snapshot.revision,
        reason
      }
    })
  )
}

function publishLootChange(
  reason: 'created' | 'updated' | 'moved' | 'accepted' | 'distributed'
): void {
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'loot.changed',
      notice: {
        campaignId: campaigns.activeCampaignId(),
        revision: lootComposition.projectionRevision(),
        reason
      }
    })
  )
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
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'session-planner.preparation-changed',
      notice: {
        campaignId: campaigns.activeCampaignId(),
        ...notice
      }
    })
  )
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
  if (delay > 0) {
    setTimeout(work, delay)
    return
  }
  setImmediate(work)
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
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'hex.changed',
      notice: {
        campaignId: campaigns.activeCampaignId(),
        commandId,
        mapIds,
        changedChunks
      }
    })
  )
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
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'locations.changed',
      notice: {
        campaignId: campaigns.activeCampaignId(),
        revision: locations.read().revision,
        changedLocationIds,
        reason
      }
    })
  )
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
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'location-symbols.changed',
      notice: {
        revision: locationSymbols.read().revision,
        changedSymbolIds,
        reason
      }
    })
  )
}

function publishBiomeChange(
  changedBiomeIds: readonly string[],
  reason: 'created' | 'updated' | 'deleted'
): void {
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'biomes.changed',
      notice: {
        revision: biomeService.catalog.revision(),
        changedBiomeIds,
        reason
      }
    })
  )
}

function publishEncounterTableChange(
  snapshot: ReturnType<EncounterSourceService['readTables']>,
  changedTableIds: readonly string[],
  scope: 'installation' | 'campaign',
  reason: 'created' | 'updated' | 'deleted'
): void {
  process.parentPort?.postMessage(
    coreEventSchema.parse({
      kind: 'encounter-tables.changed',
      notice: {
        installationRevision: snapshot.installation.revision,
        campaignRevision: snapshot.campaign.revision,
        changedTableIds,
        scope,
        reason
      }
    })
  )
}

symbolLifecycle.recoverPendingImports()
symbolLifecycle.recoverPendingDeletions()
biomeService.recoverPendingDeletions()
sources.recoverPendingInstallationTableLifecycles()
if (campaigns.list().activeCampaignId !== null)
  sessionPlanner.recoverPendingPreparations()

function scheduleNextBoundary(): void {
  if (travelTimer !== undefined) clearTimeout(travelTimer)
  travelTimer = undefined
  try {
    const delay = hexTravel.nextBoundaryDelay()
    if (delay === null) return
    travelTimer = setTimeout(() => {
      travelTimer = undefined
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
process.parentPort.postMessage(coreReadySchema.parse({ kind: 'core.ready' }))
const campaignHandlers = {
  'campaign.list': () => campaigns.list(),
  'campaign.create': (input) => {
    const result = mutateReferences(() => campaigns.create(input.name))
    sessionPlanner.recoverPendingPreparations()
    return result
  },
  'campaign.activate': (input) => {
    const result = mutateReferences(() => campaigns.activate(input.id))
    sessionPlanner.recoverPendingPreparations()
    return result
  },
  'campaign.rename': (input) => campaigns.rename(input.id, input.name),
  'campaign.trash': (input) => campaigns.trash(input.id),
  'campaign.restore': (input) => campaigns.restore(input.id),
  'campaign.deleteForever': (input) =>
    campaigns.deleteForever(input.id, input.confirmationName),
  'settings.read': () => campaigns.readSettings(),
  'settings.update': (input) =>
    campaigns.updateSettings(input.patch, input.expectedRevision),
  'campaignRules.read': () => campaignRules.read(),
  'campaignRules.update': (input) => campaignRules.update(input),
  'campaignRules.commandReceipt': (input) =>
    campaignRules.commandReceipt(input.commandId),
  'generatorPresets.readEditor': (input) =>
    generatorPresets.readEditor(input.campaignId),
  'generatorPresets.create': (input) => generatorPresets.create(input),
  'generatorPresets.update': (input) => generatorPresets.update(input),
  'generatorPresets.delete': (input) => generatorPresets.delete(input),
  'generatorPresets.assign': (input) => generatorPresets.assign(input),
  'generatorPresets.commandReceipt': (input) =>
    generatorPresets.commandReceipt(input.commandId),
  'projection.read': () => emptyPassiveProjection
} satisfies Pick<
  CoreHandlers,
  | 'campaign.list'
  | 'campaign.create'
  | 'campaign.activate'
  | 'campaign.rename'
  | 'campaign.trash'
  | 'campaign.restore'
  | 'campaign.deleteForever'
  | 'settings.read'
  | 'settings.update'
  | 'campaignRules.read'
  | 'campaignRules.update'
  | 'campaignRules.commandReceipt'
  | 'generatorPresets.readEditor'
  | 'generatorPresets.create'
  | 'generatorPresets.update'
  | 'generatorPresets.delete'
  | 'generatorPresets.assign'
  | 'generatorPresets.commandReceipt'
  | 'projection.read'
>

const partyHandlers = {
  'party.read': () => play.readParty(),
  'party.setMembership': (input) =>
    play.setMembership(input.id, input.active, input.expectedRevision),
  'party.create': (input) =>
    play.createPartyCharacter(input.character, input.expectedRevision),
  'party.update': (input) =>
    play.updatePartyCharacter(
      input.id,
      input.character,
      input.expectedRevision
    ),
  'party.delete': (input) =>
    play.deletePartyCharacter(input.id, input.expectedRevision),
  'party.adjustXp': (input) =>
    play.adjustPartyXp(input.id, input.delta, input.expectedRevision),
  'party.rest': (input) => play.restParty(input.type, input.expectedRevision),
  'party.calculateAdventuringDay': (input) =>
    play.calculateAdventuringDay(input.rows, input.totalXp)
} satisfies Pick<
  CoreHandlers,
  | 'party.read'
  | 'party.setMembership'
  | 'party.create'
  | 'party.update'
  | 'party.delete'
  | 'party.adjustXp'
  | 'party.rest'
  | 'party.calculateAdventuringDay'
>

const creatureHandlers = {
  'creatures.search': (input) => creatures.search(input),
  'creatures.filterOptions': () => creatures.filterOptions(),
  'creatures.detail': (input) => creatures.detail(input.id),
  'references.staticIndex': () => references.staticIndex(),
  'references.campaignIndex': (input) =>
    references.campaignIndex(input.campaignId),
  'references.detail': (input) => references.detail(input)
} satisfies Pick<
  CoreHandlers,
  | 'creatures.search'
  | 'creatures.filterOptions'
  | 'creatures.detail'
  | 'references.staticIndex'
  | 'references.campaignIndex'
  | 'references.detail'
>

const biomeHandlers = {
  'biomes.search': (input) => biomeService.search(input),
  'biomes.detail': (input) => biomeService.detail(input.id),
  'biomes.create': (input) => {
    const result = biomeService.create(
      input.commandId,
      input.biome,
      input.expectedRevision
    )
    if (result.biome) publishBiomeChange([result.biome.id], 'created')
    return result
  },
  'biomes.update': (input) => {
    const result = biomeService.update(
      input.commandId,
      input.id,
      input.biome,
      input.expectedRevision
    )
    publishBiomeChange([input.id], 'updated')
    return result
  },
  'biomes.deleteImpact': (input) => biomeService.deleteImpact(input.id),
  'biomes.delete': (input) => {
    const { result, changes } = biomeService.delete(
      input.commandId,
      input.id,
      input.expectedRevision
    )
    publishBiomeMapChanges(input.commandId, changes)
    publishBiomeChange([input.id, 'to-be-replaced'], 'deleted')
    return result
  }
} satisfies Pick<
  CoreHandlers,
  | 'biomes.search'
  | 'biomes.detail'
  | 'biomes.create'
  | 'biomes.update'
  | 'biomes.deleteImpact'
  | 'biomes.delete'
>

const worldPlannerHandlers = {
  'locations.read': () => locations.read(),
  'locations.suggestTags': (input) =>
    locations.suggestTags(input.query, input.limit),
  'locations.save': (input) =>
    mutateReferences(() => {
      const execution = worldLocationSave.execute(input)
      publishLocationChange([execution.receipt.saved.id], 'catalog')
      if (execution.hexResult) publishHexChange(execution.hexResult)
      return execution.receipt
    }),
  'locations.saveReceipt': (input) =>
    worldLocationSave.receipt(input.commandId),
  'locations.commitPlacement': (input) => {
    const execution = worldLocationPlacement.execute(input)
    if (execution.hexResult) publishHexChange(execution.hexResult)
    return execution.result
  },
  'locations.updateMapPresentation': (input) => {
    const result = locations.updateMapPresentation(
      input.id,
      input.patch,
      input.expectedRevision
    )
    publishLocationChange([input.id], 'presentation')
    publishLocationMarkerHexChanges([input.id])
    return result
  },
  'locations.delete': (input) =>
    mutateReferences(() => {
      const result = worldLocationDeletion.execute(input)
      if (result.notice)
        publishHexNotice(
          result.notice.campaignCommandId,
          [result.notice.map.id],
          [result.notice.changedChunk]
        )
      publishLocationChange([input.id], 'catalog')
      return result.receipt
    }),
  'locationSymbols.create': (input) => {
    const result = locationSymbols.create(input.symbol, input.expectedRevision)
    publishSymbolChange([result.saved.id], 'created')
    return result
  },
  'locationSymbols.search': (input) =>
    locationSymbols.search(input.query, input.offset, input.limit),
  'locationSymbols.detail': (input) => locationSymbols.detail(input.id),
  'locationSymbols.update': (input) => {
    const result = locationSymbols.update(
      input.id,
      input.displayName,
      input.expectedRevision
    )
    publishSymbolChange([input.id], 'renamed')
    return result
  },
  'locationSymbols.deleteImpact': (input) =>
    symbolLifecycle.deleteImpact(input.id),
  'locationSymbols.delete': (input) => {
    const result = symbolLifecycle.delete(input)
    if (result.activeChangedLocationIds.length > 0)
      publishLocationChange(
        result.activeChangedLocationIds,
        'symbol-replacement'
      )
    publishLocationMarkerHexChanges(
      result.activeChangedLocationIds,
      input.commandId
    )
    if (result.status === 'applied') publishSymbolChange([input.id], 'deleted')
    return {
      status: result.status,
      commandId: input.commandId,
      symbols: result.symbols
    }
  },
  'locationSymbols.importAndAssign': (input) => {
    const result = symbolLifecycle.importAndAssign(input)
    if (result.status === 'applied') {
      publishSymbolChange([result.createdSymbolId], 'created')
      publishLocationChange([input.locationId], 'presentation')
      publishLocationMarkerHexChanges([input.locationId], input.commandId)
    }
    return {
      status: result.status,
      commandId: input.commandId,
      symbols: result.symbols,
      presentationRevision: result.presentation.revision
    }
  },
  'encounterTables.read': () => sources.readTables(),
  'encounterTables.commandReceipt': (input) =>
    sources.tableReceipt(input.commandId),
  'encounterTables.create': (input) => {
    const result = sources.createTable(
      input.commandId,
      input.table,
      input.expectedRevision,
      input.scope
    )
    publishEncounterTableChange(
      result.snapshot,
      [result.saved.id],
      input.scope,
      'created'
    )
    return result
  },
  'encounterTables.update': (input) => {
    const result = sources.updateTable(
      input.commandId,
      input.id,
      input.table,
      input.expectedRevision,
      input.scope
    )
    publishEncounterTableChange(
      result.snapshot,
      [result.saved.id],
      input.scope,
      'updated'
    )
    return result
  },
  'encounterTables.delete': (input) => {
    const linkedBiomeIds =
      input.scope === 'installation'
        ? biomeService.catalog.biomeIdsUsingEncounterTable(input.id)
        : []
    const result = sources.deleteTable(
      input.commandId,
      input.id,
      input.expectedRevision,
      input.scope
    )
    publishEncounterTableChange(
      result.snapshot,
      [result.deletedId],
      input.scope,
      'deleted'
    )
    if (linkedBiomeIds.length > 0) publishBiomeChange(linkedBiomeIds, 'updated')
    return result
  },
  'factions.read': () => sources.readFactions(),
  'factions.commandReceipt': (input) => sources.factionReceipt(input.commandId),
  'factions.create': (input) =>
    mutateReferences(() =>
      sources.createFaction(
        input.commandId,
        input.faction,
        input.expectedRevision
      )
    ),
  'factions.update': (input) =>
    mutateReferences(() =>
      sources.updateFaction(
        input.commandId,
        input.id,
        input.faction,
        input.expectedRevision
      )
    ),
  'factions.delete': (input) =>
    mutateReferences(() =>
      sources.deleteFaction(input.commandId, input.id, input.expectedRevision)
    )
} satisfies Pick<
  CoreHandlers,
  | 'locations.read'
  | 'locations.suggestTags'
  | 'locations.save'
  | 'locations.saveReceipt'
  | 'locations.commitPlacement'
  | 'locations.updateMapPresentation'
  | 'locations.delete'
  | 'locationSymbols.create'
  | 'locationSymbols.search'
  | 'locationSymbols.detail'
  | 'locationSymbols.update'
  | 'locationSymbols.deleteImpact'
  | 'locationSymbols.delete'
  | 'locationSymbols.importAndAssign'
  | 'encounterTables.read'
  | 'encounterTables.commandReceipt'
  | 'encounterTables.create'
  | 'encounterTables.update'
  | 'encounterTables.delete'
  | 'factions.read'
  | 'factions.commandReceipt'
  | 'factions.create'
  | 'factions.update'
  | 'factions.delete'
>

const sessionHandlers = {
  'session.read': () => play.readSession(),
  'scene.focus': (input) =>
    play.focusScene(input.sceneId, input.expectedRevision),
  'scene.setLocation': (input) =>
    play.setSceneLocation(
      input.sceneId,
      input.locationId,
      input.expectedRevision
    ),
  'scene.saveGroup': (input) =>
    play.saveSceneGroup(
      input.sceneId,
      input.groupId,
      input.name,
      input.note,
      input.disposition,
      input.entries,
      input.expectedRevision,
      input.expectedGroupRevision
    ),
  'scene.deleteGroup': (input) =>
    play.deleteSceneGroup(
      input.sceneId,
      input.groupId,
      input.expectedGroupRevision
    ),
  'scene.setGroupArchived': (input) =>
    play.setSceneGroupArchived(
      input.sceneId,
      input.groupId,
      input.archived,
      input.expectedGroupRevision
    ),
  'scene.assignPartyMember': (input) =>
    play.assignScenePartyMember(
      input.sceneId,
      input.partyMemberId,
      input.assigned,
      input.expectedRevision
    ),
  'scene.evaluateGroupDraft': (input) =>
    play.evaluateGroupDraft(
      input.sceneId,
      input.entries,
      input.expectedRevision
    ),
  'scene.generateGroupDraft': (input) =>
    play.generateGroupDraft(
      input.sceneId,
      input.entries,
      input.mode,
      input.filters,
      input.tuning,
      input.seed,
      input.expectedRevision
    )
} satisfies Pick<
  CoreHandlers,
  | 'session.read'
  | 'scene.focus'
  | 'scene.setLocation'
  | 'scene.saveGroup'
  | 'scene.deleteGroup'
  | 'scene.setGroupArchived'
  | 'scene.assignPartyMember'
  | 'scene.evaluateGroupDraft'
  | 'scene.generateGroupDraft'
>

const encounterPlanHandlers = {
  'encounterPlans.summaries': (input) => encounterPlans.summaries(input),
  'encounterPlans.search': (input) => encounterPlans.search(input)
} satisfies Pick<
  CoreHandlers,
  'encounterPlans.summaries' | 'encounterPlans.search'
>

const sessionPlannerHandlers = {
  'sessionPlanner.read': () => sessionPlanner.read(),
  'sessionPlanner.create': (input) => sessionPlanner.create(input),
  'sessionPlanner.open': (input) => sessionPlanner.open(input),
  'sessionPlanner.switch': (input) => sessionPlanner.switch(input),
  'sessionPlanner.rename': (input) => sessionPlanner.rename(input),
  'sessionPlanner.save': (input) => sessionPlanner.save(input),
  'sessionPlanner.delete': (input) => sessionPlanner.delete(input),
  'sessionPlanner.startPreparation': (input) =>
    sessionPlanner.startPreparation(input),
  'sessionPlanner.preparationReceipt': (input) =>
    sessionPlanner.preparationReceipt(input),
  'sessionPlanner.cancelPreparation': (input) =>
    sessionPlanner.cancelPreparation(input)
} satisfies Pick<
  CoreHandlers,
  | 'sessionPlanner.read'
  | 'sessionPlanner.create'
  | 'sessionPlanner.open'
  | 'sessionPlanner.switch'
  | 'sessionPlanner.rename'
  | 'sessionPlanner.save'
  | 'sessionPlanner.delete'
  | 'sessionPlanner.startPreparation'
  | 'sessionPlanner.preparationReceipt'
  | 'sessionPlanner.cancelPreparation'
>

const encounterHandlers = {
  'encounter.evaluate': (input) =>
    play.evaluateEncounter(
      input.sceneId,
      input.groupIds,
      input.expectedRevision
    ),
  'combat.prepare': (input) =>
    play.prepareCombat(
      input.sceneId,
      input.expectedSceneRevision,
      input.groupIds
    ),
  'combat.joinGroup': (input) =>
    play.joinCombatGroup(
      input.sceneId,
      input.groupId,
      input.expectedGroupRevision,
      input.expectedCombatRevision
    ),
  'combat.rollInitiative': (input) =>
    play.rollInitiative(input.expectedRevision),
  'combat.confirmInitiative': (input) =>
    play.confirmInitiative(input.expectedRevision, input.values),
  'combat.advanceTurn': (input) => play.advanceTurn(input.expectedRevision),
  'combat.retreatTurn': (input) => play.retreatTurn(input.expectedRevision),
  'combat.adjustInitiative': (input) =>
    play.adjustInitiative(input.expectedRevision, input.id, input.initiative),
  'combat.changeHp': (input) =>
    play.changeHp(
      input.expectedRevision,
      input.cardId,
      input.amount,
      input.healing
    ),
  'combat.toggleCondition': (input) =>
    play.toggleCombatCondition(
      input.expectedRevision,
      input.cardId,
      input.condition,
      input.active
    ),
  'combat.setConcentration': (input) =>
    play.setCombatConcentration(
      input.expectedRevision,
      input.cardId,
      input.concentrating
    ),
  'combat.setExhaustion': (input) =>
    play.setCombatExhaustion(
      input.expectedRevision,
      input.cardId,
      input.exhaustionLevel
    ),
  'combat.undo': (input) => play.undoCombat(input.expectedRevision),
  'combat.end': (input) => play.endCombat(input.expectedRevision),
  'combat.moveToPhase': (input) =>
    play.moveCombatToPhase(input.expectedRevision, input.target),
  'combat.updateResolution': (input) =>
    play.updateResolution(
      input.expectedRevision,
      input.selectedEnemyIds,
      input.mode,
      input.xpFraction
    ),
  'combat.awardXp': (input) =>
    play.awardXp(input.expectedRevision, input.expectedCampaignRulesRevision),
  'combat.complete': (input) => play.completeCombat(input.expectedRevision)
} satisfies Pick<
  CoreHandlers,
  | 'encounter.evaluate'
  | 'combat.prepare'
  | 'combat.joinGroup'
  | 'combat.rollInitiative'
  | 'combat.confirmInitiative'
  | 'combat.advanceTurn'
  | 'combat.retreatTurn'
  | 'combat.adjustInitiative'
  | 'combat.changeHp'
  | 'combat.toggleCondition'
  | 'combat.setConcentration'
  | 'combat.setExhaustion'
  | 'combat.undo'
  | 'combat.end'
  | 'combat.moveToPhase'
  | 'combat.updateResolution'
  | 'combat.awardXp'
  | 'combat.complete'
>

const hexHandlers = {
  'hex.editorBootstrap': () => ({
    catalog: hex.catalog(),
    biomes: hexBiomeCatalog(),
    locations: locations.read()
  }),
  'hex.biomeCatalog': () => hexBiomeCatalog(),
  'hex.catalog': () => hex.catalog(),
  'hex.locateLocation': (input) => hex.locateLocation(input.locationId),
  'hex.readChunks': (input) => {
    const result = hex.readChunks(input.mapId, input.keys)
    const biomeIds = result.chunks.flatMap((chunk) =>
      chunk.authoredTiles.map((tile) => tile.biomeId)
    )
    return {
      ...result,
      biomes: biomeService.hexCatalog(biomeIds).biomes
    }
  },
  'hex.replaceBiomePlaceholder': (input) => {
    const changes = biomeService.replaceMapPlaceholder(input)
    const summary = hex.catalog().maps.find((map) => map.id === input.mapId)
    if (!summary) throw new CapabilityError('not_found', false)
    const changedChunks = biomeChangedChunks(input.mapId, changes)
    if (changes.length > 0)
      publishHexNotice(input.commandId, [input.mapId], changedChunks)
    return {
      commandId: input.commandId,
      mapId: input.mapId,
      contentRevision: summary.contentRevision,
      affectedTileCount: changes.reduce(
        (total, change) => total + change.affectedTileCount,
        0
      ),
      changedChunks
    }
  },
  'hex.create': (input) => hexEditing.createMap(input),
  'hex.update': (input) => hexEditing.updateMap(input),
  'hex.applyBrushStroke': (input) => {
    if (input.mode === 'paint') {
      if (input.biomeId === null)
        throw new CapabilityError('validation_failed', false)
      const definition = biomeService.catalog.require(input.biomeId)
      if (definition.kind === 'placeholder')
        throw new CapabilityError('validation_failed', false)
    }
    return hexEditing.applyBrushStroke(input)
  },
  'hex.history': (input) => hexEditing.history(input.mapId),
  'hex.undo': (input) => hexEditing.undo(input),
  'hex.redo': (input) => hexEditing.redo(input),
  'hex.commandReceipt': (input) => hexEditing.commandReceipt(input.commandId),
  'hex.runtimeOverlays': (input) => hexTravel.runtimeOverlays(input.mapId)
} satisfies Pick<
  CoreHandlers,
  | 'hex.biomeCatalog'
  | 'hex.editorBootstrap'
  | 'hex.catalog'
  | 'hex.locateLocation'
  | 'hex.readChunks'
  | 'hex.replaceBiomePlaceholder'
  | 'hex.create'
  | 'hex.update'
  | 'hex.applyBrushStroke'
  | 'hex.history'
  | 'hex.undo'
  | 'hex.redo'
  | 'hex.commandReceipt'
  | 'hex.runtimeOverlays'
>

const travelHandlers = {
  'hexTravel.read': (input) => travelContext(hexTravel.read(input.sceneId)),
  'hexTravel.evaluate': (input) => hexTravel.evaluate(input),
  'hexTravel.position': (input) => travelContext(hexTravel.position(input)),
  'hexTravel.start': (input) => travelContext(hexTravel.start(input)),
  'hexTravel.pause': (input) => travelContext(hexTravel.pause(input)),
  'hexTravel.resume': (input) => travelContext(hexTravel.resume(input)),
  'hexTravel.abort': (input) => travelContext(hexTravel.abort(input)),
  'hexTravel.setMultiplier': (input) =>
    travelContext(hexTravel.setMultiplier(input))
} satisfies Pick<
  CoreHandlers,
  | 'hexTravel.read'
  | 'hexTravel.evaluate'
  | 'hexTravel.position'
  | 'hexTravel.start'
  | 'hexTravel.pause'
  | 'hexTravel.resume'
  | 'hexTravel.abort'
  | 'hexTravel.setMultiplier'
>

function travelContext(travel: ReturnType<HexTravelService['read']>) {
  return { travel, session: play.readSession() }
}

const lifecycleHandlers = {
  'core.shutdown': () => {
    if (travelTimer !== undefined) clearTimeout(travelTimer)
    referenceCatalog.close()
    campaigns.close()
    return null
  }
} satisfies Pick<CoreHandlers, 'core.shutdown'>

const handlers = {
  ...campaignHandlers,
  ...partyHandlers,
  ...creatureHandlers,
  ...biomeHandlers,
  ...worldPlannerHandlers,
  ...sessionHandlers,
  ...encounterPlanHandlers,
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
  const parsed = coreRequestSchema.safeParse(event.data)
  if (!parsed.success) {
    const envelope = z
      .object({ requestId: z.uuid(), kind: z.string() })
      .safeParse(event.data)
    if (envelope.success) failure(envelope.data.requestId, 'validation_failed')
    return
  }
  const r = parsed.data
  try {
    const payload = await dispatch(r)
    respond(r.requestId, payload)
    if (r.kind === 'core.shutdown') setImmediate(() => process.exit(0))
  } catch (e) {
    const mapped = capabilityFailure(e)
    failure(r.requestId, mapped.code, mapped.retryable, mapped.issues)
  }
}

function dispatch(request: CoreRequest): Promise<unknown> {
  const handler = handlers[request.kind] as (input: unknown) => unknown
  const result = handler(request.input)
  return Promise.resolve(result).then((payload) => {
    const parsed = coreOperations[request.kind].output.parse(payload)
    if (
      request.kind === 'hex.create' ||
      request.kind === 'hex.update' ||
      request.kind === 'hex.applyBrushStroke' ||
      request.kind === 'hex.undo' ||
      request.kind === 'hex.redo'
    )
      publishHexChange(parsed)
    if (
      request.kind.startsWith('hexTravel.') &&
      request.kind !== 'hexTravel.read'
    ) {
      const result = hexTravelContextResultSchema.safeParse(parsed)
      if (result.success)
        publishSessionChange(result.data.travel, 'travel-command')
    }
    const lootReason =
      request.kind === 'loot.create'
        ? 'created'
        : request.kind === 'loot.update'
          ? 'updated'
          : request.kind === 'loot.move'
            ? 'moved'
            : request.kind === 'loot.acceptGenerated'
              ? 'accepted'
              : request.kind === 'loot.commitGroupReward'
                ? 'accepted'
                : request.kind === 'loot.distribute'
                  ? 'distributed'
                  : null
    if (lootReason) publishLootChange(lootReason)
    if (
      coreOperations[request.kind].mode === 'write' &&
      request.kind !== 'settings.update' &&
      request.kind !== 'core.shutdown'
    )
      reconcileAndSchedule(
        request.kind.startsWith('campaign.')
          ? 'campaign-reconcile'
          : 'travel-command'
      )
    return parsed
  })
}
function respond(requestId: string, payload: unknown) {
  process.parentPort?.postMessage({ requestId, ok: true, payload })
}
function failure(
  requestId: string,
  code: CapabilityErrorCode,
  retryable = false,
  issues: CapabilityError['issues'] = []
) {
  process.parentPort?.postMessage({
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
