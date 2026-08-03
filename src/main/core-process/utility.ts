import {
  capabilityFailureSchema,
  coreReadySchema,
  type CapabilityErrorCode
} from '../../shared/contracts/campaign.js'
import { coreRequestSchema } from '../../shared/contracts/core-protocol.js'
import { CampaignStore } from '../../core/persistence/sqlite/campaign-store.js'
import { CreatureCatalogService } from '../../core/creatures/catalog.js'
import { LivePlayService } from '../../core/encounter/live-combat.js'
import { z } from 'zod'
import { join } from 'node:path'
import { WorldLocationService } from '../../core/worldplanner/location-store.js'
import { EncounterSourceService } from '../../core/worldplanner/encounter-source-store.js'
const root = process.argv[2]
if (!root || !process.parentPort)
  throw new Error('Utility process requires a data root and parent port')
const campaigns = new CampaignStore(root)
const play = new LivePlayService(() => campaigns.activeCampaignPath())
const locations = new WorldLocationService(() => campaigns.activeCampaignPath())
const sources = new EncounterSourceService(() => campaigns.activeCampaignPath())
const creatures = new CreatureCatalogService(
  join(root, 'installation.sqlite'),
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
process.parentPort.postMessage(coreReadySchema.parse({ kind: 'core.ready' }))
process.parentPort.on('message', (event) => {
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
    if (r.kind === 'core.shutdown') {
      respond(r.requestId, campaigns.list())
      campaigns.close()
      process.exit(0)
    } else if (r.kind === 'campaign.list')
      respond(r.requestId, campaigns.list())
    else if (r.kind === 'campaign.create')
      respond(r.requestId, campaigns.create(r.input.name))
    else if (r.kind === 'campaign.activate')
      respond(r.requestId, campaigns.activate(r.input.id))
    else if (r.kind === 'party.read') respond(r.requestId, play.readParty())
    else if (r.kind === 'party.setMembership')
      respond(
        r.requestId,
        play.setMembership(r.input.id, r.input.active, r.input.expectedRevision)
      )
    else if (r.kind === 'party.create')
      respond(
        r.requestId,
        play.createPartyCharacter(r.input.character, r.input.expectedRevision)
      )
    else if (r.kind === 'party.update')
      respond(
        r.requestId,
        play.updatePartyCharacter(
          r.input.id,
          r.input.character,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'party.delete')
      respond(
        r.requestId,
        play.deletePartyCharacter(r.input.id, r.input.expectedRevision)
      )
    else if (r.kind === 'party.adjustXp')
      respond(
        r.requestId,
        play.adjustPartyXp(r.input.id, r.input.delta, r.input.expectedRevision)
      )
    else if (r.kind === 'party.rest')
      respond(
        r.requestId,
        play.restParty(r.input.type, r.input.expectedRevision)
      )
    else if (r.kind === 'party.calculateAdventuringDay')
      respond(
        r.requestId,
        play.calculateAdventuringDay(r.input.rows, r.input.totalXp)
      )
    else if (r.kind === 'creatures.search')
      respond(r.requestId, creatures.search(r.input))
    else if (r.kind === 'creatures.filterOptions')
      respond(r.requestId, creatures.filterOptions())
    else if (r.kind === 'creatures.detail') {
      respond(r.requestId, creatures.detail(r.input.id))
    } else if (r.kind === 'locations.read')
      respond(r.requestId, locations.read())
    else if (r.kind === 'locations.create')
      respond(
        r.requestId,
        locations.create(r.input.location, r.input.expectedRevision)
      )
    else if (r.kind === 'locations.update')
      respond(
        r.requestId,
        locations.update(r.input.id, r.input.location, r.input.expectedRevision)
      )
    else if (r.kind === 'locations.delete')
      respond(
        r.requestId,
        locations.delete(r.input.id, r.input.expectedRevision)
      )
    else if (r.kind === 'encounterTables.read')
      respond(r.requestId, sources.readTables())
    else if (r.kind === 'encounterTables.create')
      respond(
        r.requestId,
        sources.createTable(r.input.table, r.input.expectedRevision)
      )
    else if (r.kind === 'encounterTables.update')
      respond(
        r.requestId,
        sources.updateTable(r.input.id, r.input.table, r.input.expectedRevision)
      )
    else if (r.kind === 'encounterTables.delete')
      respond(
        r.requestId,
        sources.deleteTable(r.input.id, r.input.expectedRevision)
      )
    else if (r.kind === 'factions.read')
      respond(r.requestId, sources.readFactions())
    else if (r.kind === 'factions.create')
      respond(
        r.requestId,
        sources.createFaction(r.input.faction, r.input.expectedRevision)
      )
    else if (r.kind === 'factions.update')
      respond(
        r.requestId,
        sources.updateFaction(
          r.input.id,
          r.input.faction,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'factions.delete')
      respond(
        r.requestId,
        sources.deleteFaction(r.input.id, r.input.expectedRevision)
      )
    else if (r.kind === 'session.read') respond(r.requestId, play.readSession())
    else if (r.kind === 'scene.focus')
      respond(
        r.requestId,
        play.focusScene(r.input.sceneId, r.input.expectedRevision)
      )
    else if (r.kind === 'scene.setLocation')
      respond(
        r.requestId,
        play.setSceneLocation(
          r.input.sceneId,
          r.input.locationId,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'scene.saveGroup')
      respond(
        r.requestId,
        play.saveSceneGroup(
          r.input.sceneId,
          r.input.groupId,
          r.input.name,
          r.input.entries,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'scene.deleteGroup')
      respond(
        r.requestId,
        play.deleteSceneGroup(
          r.input.sceneId,
          r.input.groupId,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'scene.assignPartyMember')
      respond(
        r.requestId,
        play.assignScenePartyMember(
          r.input.sceneId,
          r.input.partyMemberId,
          r.input.assigned,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'scene.evaluateGroupDraft')
      respond(
        r.requestId,
        play.evaluateGroupDraft(
          r.input.sceneId,
          r.input.entries,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'scene.generateGroupDraft')
      respond(
        r.requestId,
        play.generateGroupDraft(
          r.input.sceneId,
          r.input.entries,
          r.input.mode,
          r.input.filters,
          r.input.tuning,
          r.input.seed,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'encounter.evaluate')
      respond(
        r.requestId,
        play.evaluateEncounter(
          r.input.sceneId,
          r.input.groupIds,
          r.input.expectedRevision
        )
      )
    else if (r.kind === 'combat.prepare')
      respond(
        r.requestId,
        play.prepareCombat(
          r.input.sceneId,
          r.input.expectedSceneRevision,
          r.input.groupIds
        )
      )
    else if (r.kind === 'combat.rollInitiative')
      respond(r.requestId, play.rollInitiative(r.input.expectedRevision))
    else if (r.kind === 'combat.confirmInitiative')
      respond(
        r.requestId,
        play.confirmInitiative(r.input.expectedRevision, r.input.values)
      )
    else if (r.kind === 'combat.advanceTurn')
      respond(r.requestId, play.advanceTurn(r.input.expectedRevision))
    else if (r.kind === 'combat.adjustInitiative')
      respond(
        r.requestId,
        play.adjustInitiative(
          r.input.expectedRevision,
          r.input.id,
          r.input.initiative
        )
      )
    else if (r.kind === 'combat.changeHp')
      respond(
        r.requestId,
        play.changeHp(
          r.input.expectedRevision,
          r.input.cardId,
          r.input.amount,
          r.input.healing
        )
      )
    else if (r.kind === 'combat.end')
      respond(r.requestId, play.endCombat(r.input.expectedRevision))
    else if (r.kind === 'combat.updateResolution')
      respond(
        r.requestId,
        play.updateResolution(
          r.input.expectedRevision,
          r.input.selectedEnemyIds,
          r.input.thresholdFraction,
          r.input.xpFraction
        )
      )
    else if (r.kind === 'combat.awardXp')
      respond(r.requestId, play.awardXp(r.input.expectedRevision))
    else if (r.kind === 'combat.complete')
      respond(r.requestId, play.completeCombat(r.input.expectedRevision))
  } catch (e) {
    failure(
      r.requestId,
      e instanceof Error && e.message === 'not found'
        ? 'not_found'
        : e instanceof Error && e.message === 'stale'
          ? 'stale'
          : e instanceof Error && e.message === 'validation'
            ? 'validation_failed'
            : 'internal'
    )
  }
})
function respond(requestId: string, payload: unknown) {
  process.parentPort?.postMessage({ requestId, ok: true, payload })
}
function failure(requestId: string, code: CapabilityErrorCode) {
  process.parentPort?.postMessage({
    requestId,
    ok: false,
    error: capabilityFailureSchema.parse({ code, retryable: false })
  })
}
