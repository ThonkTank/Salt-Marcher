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
import { EncounterSourceService } from '../core/application/encounter-source-service.js'
import { HexMapService } from '../core/hex/hex-map-store.js'
import { HexTravelService } from '../core/hex/hex-travel.js'
import { hexTerrainCatalog } from '../core/hex/terrain-catalog.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import { hexTravelSnapshotSchema } from '../shared/contracts/hex.js'
import { emptyPassiveProjection } from '../shared/contracts/passive-display.js'
import { ReferenceService } from '../core/reference/reference-service.js'
import { ReferenceCatalogAdapter } from '../core/reference/reference-catalog-adapter.js'
import { referenceTargetKey } from '../shared/reference/reference-target-key.js'
const root = process.argv[2]
const referenceDatabasePath = process.argv[3]
if (!root || !referenceDatabasePath || !process.parentPort)
  throw new Error(
    'Utility process requires a data root, reference database, and parent port'
  )
const campaigns = openDevelopmentCampaignStore(root)
const activeDatabase = () => campaigns.activeCampaignDatabase()
const play = new LivePlayService(activeDatabase)
const locations = new WorldLocationService(activeDatabase)
const sources = new EncounterSourceService(activeDatabase)
const hex = new HexMapService(activeDatabase)
const hexTravel = new HexTravelService(activeDatabase)
const creatures = new CreatureCatalogService(
  () => campaigns.installationDatabase(),
  (query) => sources.resolve(query),
  () => ({
    encounterTables: sources
      .readTables()
      .tables.map((table) => ({ id: table.id, label: table.displayName })),
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
  reason: 'travel-boundary' | 'travel-command' | 'campaign-reconcile'
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
  'campaign.create': (input) =>
    mutateReferences(() => campaigns.create(input.name)),
  'campaign.activate': (input) =>
    mutateReferences(() => campaigns.activate(input.id)),
  'campaign.rename': (input) => campaigns.rename(input.id, input.name),
  'campaign.trash': (input) => campaigns.trash(input.id),
  'campaign.restore': (input) => campaigns.restore(input.id),
  'campaign.deleteForever': (input) =>
    campaigns.deleteForever(input.id, input.confirmationName),
  'settings.read': () => campaigns.readSettings(),
  'settings.update': (input) =>
    campaigns.updateSettings(input.patch, input.expectedRevision),
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

const worldPlannerHandlers = {
  'locations.read': () => locations.read(),
  'locations.create': (input) =>
    mutateReferences(() =>
      locations.create(input.location, input.expectedRevision)
    ),
  'locations.update': (input) =>
    mutateReferences(() =>
      locations.update(input.id, input.location, input.expectedRevision)
    ),
  'locations.delete': (input) =>
    mutateReferences(() =>
      activeDatabase().transaction(() => {
        hex.unlinkDeletedLocation(input.id)
        return locations.delete(input.id, input.expectedRevision)
      })()
    ),
  'encounterTables.read': () => sources.readTables(),
  'encounterTables.create': (input) =>
    sources.createTable(input.table, input.expectedRevision),
  'encounterTables.update': (input) =>
    sources.updateTable(input.id, input.table, input.expectedRevision),
  'encounterTables.delete': (input) =>
    sources.deleteTable(input.id, input.expectedRevision),
  'factions.read': () => sources.readFactions(),
  'factions.create': (input) =>
    mutateReferences(() =>
      sources.createFaction(input.faction, input.expectedRevision)
    ),
  'factions.update': (input) =>
    mutateReferences(() =>
      sources.updateFaction(input.id, input.faction, input.expectedRevision)
    ),
  'factions.delete': (input) =>
    mutateReferences(() =>
      sources.deleteFaction(input.id, input.expectedRevision)
    )
} satisfies Pick<
  CoreHandlers,
  | 'locations.read'
  | 'locations.create'
  | 'locations.update'
  | 'locations.delete'
  | 'encounterTables.read'
  | 'encounterTables.create'
  | 'encounterTables.update'
  | 'encounterTables.delete'
  | 'factions.read'
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
  'combat.awardXp': (input) => play.awardXp(input.expectedRevision),
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
  'hex.terrainCatalog': () => hexTerrainCatalog,
  'hex.catalog': () => hex.catalog(),
  'hex.locateLocation': (input) => hex.locateLocation(input.locationId),
  'hex.readChunks': (input) => hex.readChunks(input.mapId, input.keys),
  'hex.create': (input) =>
    hex.create(input.displayName, input.expectedCatalogRevision),
  'hex.update': (input) => hex.update(input),
  'hex.paint': (input) => hex.paint(input),
  'hex.placeLocation': (input) => hex.placeLocation(input),
  'hex.removeLocation': (input) => hex.removeLocation(input)
} satisfies Pick<
  CoreHandlers,
  | 'hex.terrainCatalog'
  | 'hex.catalog'
  | 'hex.locateLocation'
  | 'hex.readChunks'
  | 'hex.create'
  | 'hex.update'
  | 'hex.paint'
  | 'hex.placeLocation'
  | 'hex.removeLocation'
>

const travelHandlers = {
  'hexTravel.read': (input) => hexTravel.read(input.sceneId),
  'hexTravel.evaluate': (input) => hexTravel.evaluate(input),
  'hexTravel.position': (input) => hexTravel.position(input),
  'hexTravel.start': (input) => hexTravel.start(input),
  'hexTravel.pause': (input) => hexTravel.pause(input),
  'hexTravel.resume': (input) => hexTravel.resume(input),
  'hexTravel.abort': (input) => hexTravel.abort(input),
  'hexTravel.setMultiplier': (input) => hexTravel.setMultiplier(input)
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
  ...worldPlannerHandlers,
  ...sessionHandlers,
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
    failure(r.requestId, mapped.code, mapped.retryable)
  }
}

function dispatch(request: CoreRequest): Promise<unknown> {
  const handler = handlers[request.kind] as (input: unknown) => unknown
  const result = handler(request.input)
  return Promise.resolve(result).then((payload) => {
    const parsed = coreOperations[request.kind].output.parse(payload)
    if (
      request.kind.startsWith('hexTravel.') &&
      request.kind !== 'hexTravel.read'
    ) {
      const snapshot = hexTravelSnapshotSchema.safeParse(parsed)
      if (snapshot.success)
        publishSessionChange(snapshot.data, 'travel-command')
    }
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
  retryable = false
) {
  process.parentPort?.postMessage({
    requestId,
    ok: false,
    error: capabilityFailureSchema.parse({
      code,
      retryable
    })
  })
}

function capabilityFailure(error: unknown): {
  code: CapabilityErrorCode
  retryable: boolean
} {
  if (error instanceof CapabilityError)
    return {
      code: error.code,
      retryable: error.retryable
    }
  return { code: 'internal', retryable: false }
}
