import { randomUUID } from 'node:crypto'
import type { CampaignStore } from '../core/persistence/sqlite/campaign-store.js'
import type { HexTravelService } from '../core/hex/hex-travel.js'
import { chunkKeyFor, type HexMapService } from '../core/hex/hex-map-store.js'
import type { LivePlayService } from '../core/encounter/live-combat.js'
import type { WorldLocationService } from '../core/worldplanner/location-store.js'
import type { LocationSymbolLifecycleService } from '../core/application/location-symbol-lifecycle.js'
import type {
  BiomeCatalogService,
  BiomeMapChange
} from '../core/application/biome-catalog-service.js'
import type { EncounterSourceService } from '../core/application/encounter-source-service.js'
import type { WorldNpcApplicationService } from '../core/application/world-npc-application-service.js'
import type {
  ReferenceChangeCoordinator,
  ReferenceChangeDescriptor
} from '../core/reference/reference-change-coordinator.js'
import type { createLootComposition } from './composition/loot.js'
import { coreEventSchema } from '../shared/contracts/core-protocol.js'
import { hexBrushStrokeResultSchema } from '../shared/contracts/hex.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import type { UtilityRuntimeCounters } from './runtime-dispatcher.js'

interface CoreEventPort {
  postMessage(message: unknown): void
}

export class CoreEventSink {
  constructor(
    private readonly port: CoreEventPort,
    private readonly counters: UtilityRuntimeCounters
  ) {}

  post(event: unknown): void {
    const parsed = coreEventSchema.parse(event)
    this.counters.eventsPublished += 1
    this.port.postMessage(parsed)
  }
}

interface DomainEventDependencies {
  sink: CoreEventSink
  campaigns: CampaignStore
  referenceChanges: ReferenceChangeCoordinator
  hex: HexMapService
  hexTravel: HexTravelService
  play: LivePlayService
  loot: Pick<ReturnType<typeof createLootComposition>, 'projectionRevision'>
  locations: WorldLocationService
  locationSymbols: LocationSymbolLifecycleService['symbols']
  biomes: BiomeCatalogService
  encounterSources: EncounterSourceService
  worldNpcs: WorldNpcApplicationService
}

export function createDomainEventPublishers(deps: DomainEventDependencies) {
  const publishSessionChange = (
    snapshot: ReturnType<HexTravelService['read']>,
    reason:
      'travel-boundary' | 'travel-command' | 'campaign-reconcile' | 'map-edit'
  ): void => {
    deps.sink.post({
      kind: 'session.changed',
      notice: {
        campaignId: deps.campaigns.activeCampaignId(),
        sceneId: snapshot.sceneId,
        revision: snapshot.revision,
        reason
      }
    })
  }

  const publishHexNotice = (
    commandId: string,
    mapIds: readonly string[],
    changedChunks: readonly unknown[]
  ): void => {
    deps.sink.post({
      kind: 'hex.changed',
      notice: {
        campaignId: deps.campaigns.activeCampaignId(),
        commandId,
        mapIds,
        changedChunks
      }
    })
  }

  const biomeChangedChunks = (
    mapId: string,
    changes: readonly BiomeMapChange[]
  ) => {
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
        ...deps.hex
          .readChunks(mapId, values.slice(index, index + 64))
          .chunks.map((chunk) => ({
            mapId,
            key: chunk.key,
            revision: chunk.revision
          }))
      )
    return changed
  }

  const publishHexChange = (payload: unknown): void => {
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
      for (const scene of deps.play.readSession().scene.scenes)
        if (
          scene.partyMemberIds.some((memberId) => changedMembers.has(memberId))
        )
          changedScenes.add(scene.id)
    for (const sceneId of changedScenes)
      publishSessionChange(deps.hexTravel.read(sceneId), 'map-edit')
  }

  return {
    mutateReferences: <T>(
      work: () => T,
      changes: (result: T) => readonly ReferenceChangeDescriptor[]
    ): T => {
      const result = work()
      deps.referenceChanges.record(changes(result))
      return result
    },
    publishSessionChange,
    publishLootChange: (
      reason: 'created' | 'updated' | 'moved' | 'accepted' | 'distributed'
    ): void => {
      deps.sink.post({
        kind: 'loot.changed',
        notice: {
          campaignId: deps.campaigns.activeCampaignId(),
          revision: deps.loot.projectionRevision(),
          reason
        }
      })
    },
    publishPreparationChange: (notice: {
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
    }): void => {
      deps.sink.post({
        kind: 'session-planner.preparation-changed',
        notice: {
          campaignId: deps.campaigns.activeCampaignId(),
          ...notice
        }
      })
    },
    publishHexChange,
    publishHexNotice,
    biomeChangedChunks,
    publishBiomeMapChanges: (
      commandId: string,
      changes: readonly BiomeMapChange[]
    ): void => {
      let campaignId: string
      try {
        campaignId = deps.campaigns.activeCampaignId()
      } catch {
        return
      }
      const active = changes.filter(
        (change) => change.campaignId === campaignId
      )
      for (const mapId of new Set(active.map((change) => change.mapId)))
        publishHexNotice(commandId, [mapId], biomeChangedChunks(mapId, active))
    },
    publishLocationChange: (
      changedLocationIds: readonly string[],
      reason: 'catalog' | 'presentation' | 'symbol-replacement'
    ): void => {
      deps.sink.post({
        kind: 'locations.changed',
        notice: {
          campaignId: deps.campaigns.activeCampaignId(),
          revision: deps.locations.read().revision,
          changedLocationIds,
          reason
        }
      })
    },
    publishLocationMarkerHexChanges: (
      locationIds: readonly string[],
      commandId: string = randomUUID()
    ): void => {
      const placements = locationIds
        .map((locationId) => deps.hex.locateLocation(locationId))
        .filter((placement) => placement !== null)
      if (placements.length === 0) return
      const changedChunks = new Map(
        placements.map((placement) => {
          const key = chunkKeyFor(placement.coordinate)
          const chunk = deps.hex.readChunks(placement.mapId, [key]).chunks[0]
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
    },
    publishSymbolChange: (
      changedSymbolIds: readonly string[],
      reason: 'created' | 'renamed' | 'deleted'
    ): void => {
      deps.sink.post({
        kind: 'location-symbols.changed',
        notice: {
          revision: deps.locationSymbols.read().revision,
          changedSymbolIds,
          reason
        }
      })
    },
    publishBiomeChange: (
      changedBiomeIds: readonly string[],
      reason: 'created' | 'updated' | 'deleted'
    ): void => {
      deps.sink.post({
        kind: 'biomes.changed',
        notice: {
          revision: deps.biomes.catalog.revision(),
          changedBiomeIds,
          reason
        }
      })
    },
    publishEncounterTableChange: (
      snapshot: ReturnType<EncounterSourceService['readTables']>,
      changedTableIds: readonly string[],
      scope: 'installation' | 'campaign',
      reason: 'created' | 'updated' | 'deleted'
    ): void => {
      deps.sink.post({
        kind: 'encounter-tables.changed',
        notice: {
          installationRevision: snapshot.installation.revision,
          campaignRevision: snapshot.campaign.revision,
          changedTableIds,
          scope,
          reason
        }
      })
    },
    publishNpcChange: (
      changedNpcIds: readonly string[],
      reason: 'created' | 'updated' | 'deleted' | 'reference-unlinked'
    ): void => {
      deps.sink.post({
        kind: 'npcs.changed',
        notice: {
          revision: deps.worldNpcs.search({ limit: 1 }).revision,
          changedNpcIds,
          reason
        }
      })
    },
    publishFactionChange: (
      changedFactionIds: readonly string[],
      reason: 'created' | 'updated' | 'deleted'
    ): void => {
      deps.sink.post({
        kind: 'factions.changed',
        notice: {
          revision: deps.encounterSources.readFactions().revision,
          changedFactionIds,
          reason
        }
      })
    }
  }
}
