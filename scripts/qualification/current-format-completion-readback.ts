import assert from 'node:assert/strict'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import {
  WorldLocationService,
  WorldLocationStore
} from '../../src/core/worldplanner/location-store.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationSaveJournal } from '../../src/core/worldplanner/world-location-save-journal.js'
import type {
  WorldLocation,
  WorldLocationSaveReceipt,
  WorldLocationSnapshot
} from '../../src/shared/contracts/world-location.js'
import type {
  CurrentFormatCompletionCampaign,
  CurrentFormatCompletionFixture
} from './current-format-completion-fixture.js'
import type { CurrentFormatCompletionReconciledReceipt } from './current-format-completion-materializer.js'
import type { CurrentFormatEconomyFixture } from './current-format-economy-fixture.js'
import {
  assertCurrentFormatEconomyReadback,
  readCurrentFormatEconomyFixture,
  type CurrentFormatEconomyReadback
} from './current-format-economy-readback.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'
import {
  assertNoRawUuid,
  collectUuids,
  replaceSemanticIdentities,
  semanticHash
} from './qualification-semantic-oracle.js'

type Placement = NonNullable<ReturnType<HexMapStore['locateLocation']>>

export type CurrentFormatCompletionCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  receipt: WorldLocationSaveReceipt
  location: WorldLocation
  placement: Placement
  semanticProjection: unknown
  semanticSha256: string
}>

export type CurrentFormatCompletionReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  economy: CurrentFormatEconomyReadback
  campaigns: readonly CurrentFormatCompletionCampaignReadback[]
}>

export function readCurrentFormatCompletionFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture,
  completionFixture: CurrentFormatCompletionFixture
): CurrentFormatCompletionReadback {
  const downstreamLocationNames = new Map(
    completionFixture.campaigns.map((campaign) => [
      campaign.role,
      new Set([campaign.materialization.locationName])
    ])
  )
  const economy = readCurrentFormatEconomyFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture,
    preparationFixture,
    economyFixture,
    { downstreamLocationNames }
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const readbacks = completionFixture.campaigns.map((configured) => {
      const economyCampaign = economy.campaigns.find(
        ({ role }) => role === configured.role
      )
      const spatial = spatialFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!economyCampaign || !spatial)
        throw new Error(
          `Current-format completion Campaign ${configured.role} has no economy/spatial readback.`
        )
      const value = campaigns.visitCampaignDatabase(
        economyCampaign.campaignId,
        (database) => {
          const symbols = new LocationSymbolService(
            campaigns.installationPersistenceAccess()
          )
          const locations = new WorldLocationService(
            fixedSqliteDatabaseAccess(database),
            (id) =>
              symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
            campaigns.installationPersistenceAccess()
          ).read()
          const matching = locations.locations.filter(
            ({ displayName }) =>
              displayName === configured.materialization.locationName
          )
          assert.equal(
            matching.length,
            1,
            `Current-format completion Campaign ${configured.role} saved Location is not singular.`
          )
          const location = matching[0]!
          const receipt = new WorldLocationSaveJournal(database).receipt(
            configured.materialization.commandId
          )
          assert.ok(receipt)
          const maps = new HexMapStore(
            database,
            new WorldLocationStore(database)
          )
          const placement = maps.locateLocation(location.id)
          assert.ok(placement)
          const map = maps.summary(placement.mapId)
          assert.equal(map.displayName, spatial.materialization.mapName)
          const projection = semanticCompletionProjection(
            configured,
            economyCampaign.semanticSha256,
            receipt,
            location,
            placement
          )
          return Object.freeze({
            role: configured.role,
            campaignId: economyCampaign.campaignId,
            receipt,
            location,
            placement,
            semanticProjection: projection,
            semanticSha256: semanticHash(projection)
          })
        }
      )
      assert.ok(value)
      return value
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Independent completion readback changed Campaign switch authority.'
    )
    return Object.freeze({
      fixtureIdentity: completionFixture.identity,
      qualificationClaim: completionFixture.qualificationClaim,
      economy,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatCompletionReadback(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture,
  completionFixture: CurrentFormatCompletionFixture,
  readback: CurrentFormatCompletionReadback
): void {
  assertCurrentFormatEconomyReadback(
    rootFixture,
    spatialFixture,
    preparationFixture,
    economyFixture,
    sanitizeEconomyReadback(
      spatialFixture,
      economyFixture,
      completionFixture,
      readback
    )
  )
  assert.equal(readback.fixtureIdentity, completionFixture.identity)
  assert.equal(
    readback.qualificationClaim,
    completionFixture.qualificationClaim
  )
  const campaignUuids: Set<string>[] = []
  for (const expected of completionFixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual)
    assert.equal(actual.receipt.status, 'saved')
    if (actual.receipt.status !== 'saved')
      throw new Error(
        `Campaign ${expected.role} completion receipt is partial.`
      )
    assert.equal(actual.receipt.commandId, expected.materialization.commandId)
    assert.equal(actual.receipt.saved.id, actual.location.id)
    assert.deepStrictEqual(actual.receipt.saved, actual.location)
    assert.equal(
      actual.receipt.snapshot.revision,
      expected.expected.locationRevision
    )
    assert.deepStrictEqual(actual.receipt.snapshot, {
      revision: expected.expected.locationRevision,
      locations: readback.economy.campaigns.find(
        ({ role }) => role === expected.role
      )!.locations.locations
    })
    assert.equal(actual.receipt.placement, 'applied')
    assert.deepStrictEqual(
      actual.placement.coordinate,
      expected.materialization.placementCoordinate
    )
    assert.equal(
      actual.placement.contentRevision,
      expected.expected.mapContentRevision
    )
    assert.equal(
      actual.semanticSha256,
      expected.expected.semanticSha256,
      `Campaign ${expected.role} complete Current-Format hash drifted; actual ${actual.semanticSha256}.`
    )
    campaignUuids.push(
      collectUuids({
        campaignId: actual.campaignId,
        commandId: actual.receipt.commandId,
        locationId: actual.location.id,
        mapId: actual.placement.mapId
      })
    )
  }
  for (const id of campaignUuids[0] ?? [])
    assert.ok(
      !(campaignUuids[1]?.has(id) ?? false),
      `Completion identity ${id} leaked across Campaign A/B.`
    )
}

export function assertCurrentFormatCompletionReceipt(
  receipt: CurrentFormatCompletionReconciledReceipt,
  readback: CurrentFormatCompletionReadback
): void {
  assert.equal(receipt.fixtureIdentity, readback.fixtureIdentity)
  assert.equal(receipt.qualificationClaim, readback.qualificationClaim)
  for (const expected of receipt.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual)
    assert.equal(actual.campaignId, expected.campaignId)
    assert.equal(actual.receipt.commandId, expected.commandId)
    assert.equal(actual.location.id, expected.locationId)
    assert.equal(actual.placement.mapId, expected.mapId)
    assert.equal(actual.receipt.snapshot.revision, expected.locationRevision)
    assert.equal(actual.placement.contentRevision, expected.mapContentRevision)
  }
}

function sanitizeEconomyReadback(
  spatialFixture: CurrentFormatSpatialFixture,
  economyFixture: CurrentFormatEconomyFixture,
  completionFixture: CurrentFormatCompletionFixture,
  readback: CurrentFormatCompletionReadback
): CurrentFormatEconomyReadback {
  const completionLocationIds = new Map(
    readback.campaigns.map((campaign) => [campaign.role, campaign.location.id])
  )
  const sanitize = (
    role: 'A' | 'B',
    snapshot: WorldLocationSnapshot
  ): WorldLocationSnapshot => {
    const economy = economyFixture.campaigns.find(
      (campaign) => campaign.role === role
    )
    const completion = completionFixture.campaigns.find(
      (campaign) => campaign.role === role
    )
    assert.ok(economy)
    assert.ok(completion)
    assert.equal(snapshot.revision, completion.expected.locationRevision)
    const id = completionLocationIds.get(role)
    assert.ok(id)
    assert.equal(
      snapshot.locations.filter((location) => location.id === id).length,
      1
    )
    return {
      revision: economy.expected.locationRevision,
      locations: snapshot.locations.filter((location) => location.id !== id)
    }
  }
  return {
    ...readback.economy,
    preparation: {
      ...readback.economy.preparation,
      spatial: {
        ...readback.economy.preparation.spatial,
        root: {
          ...readback.economy.preparation.spatial.root,
          campaigns: readback.economy.preparation.spatial.root.campaigns.map(
            (campaign) => ({
              ...campaign,
              locations: sanitize(campaign.role, campaign.locations)
            })
          )
        },
        campaigns: readback.economy.preparation.spatial.campaigns.map(
          (campaign) => {
            const configured = spatialFixtureCampaign(
              campaign.role,
              spatialFixture,
              completionFixture,
              completionLocationIds
            )
            return {
              ...campaign,
              catalog: {
                ...campaign.catalog,
                maps: campaign.catalog.maps.map((map) =>
                  map.id === campaign.mapId
                    ? {
                        ...map,
                        contentRevision: configured.spatialContentRevision
                      }
                    : map
                )
              },
              chunks: {
                ...campaign.chunks,
                map: {
                  ...campaign.chunks.map,
                  contentRevision: configured.spatialContentRevision
                },
                chunks: campaign.chunks.chunks.map((chunk) => {
                  const locations = chunk.locations.filter(
                    ({ locationId }) =>
                      locationId !== configured.completionLocationId
                  )
                  const removedCount = chunk.locations.length - locations.length
                  return locations.length === chunk.locations.length
                    ? chunk
                    : {
                        ...chunk,
                        revision: chunk.revision - removedCount,
                        locations
                      }
                })
              }
            }
          }
        )
      },
      campaigns: readback.economy.preparation.campaigns.map((campaign) => ({
        ...campaign,
        locations: sanitize(campaign.role, campaign.locations)
      }))
    },
    campaigns: readback.economy.campaigns.map((campaign) => ({
      ...campaign,
      locations: sanitize(campaign.role, campaign.locations)
    }))
  }
}

function spatialFixtureCampaign(
  role: 'A' | 'B',
  spatialFixture: CurrentFormatSpatialFixture,
  completionFixture: CurrentFormatCompletionFixture,
  completionLocationIds: ReadonlyMap<'A' | 'B', string>
) {
  const completion = completionFixture.campaigns.find(
    (campaign) => campaign.role === role
  )
  const completionLocationId = completionLocationIds.get(role)
  const spatial = spatialFixture.campaigns.find(
    (campaign) => campaign.role === role
  )
  assert.ok(completion)
  assert.ok(completionLocationId)
  assert.ok(spatial)
  return {
    completionLocationId,
    spatialContentRevision: spatial.expected.mapContentRevision
  }
}

function semanticCompletionProjection(
  configured: CurrentFormatCompletionCampaign,
  economySemanticSha256: string,
  receipt: WorldLocationSaveReceipt,
  location: WorldLocation,
  placement: Placement
): unknown {
  assert.equal(receipt.status, 'saved')
  const identities = new Map<string, string>([
    [configured.materialization.commandId, 'command:interrupted-location-save'],
    [location.id, configured.materialization.locationSemanticKey],
    [placement.mapId, 'hex-map:current']
  ])
  const projection = replaceSemanticIdentities(
    {
      upstream: { economySemanticSha256 },
      receipt: {
        status: receipt.status,
        commandId: receipt.commandId,
        snapshotRevision: receipt.snapshot.revision,
        saved: receipt.saved,
        placement: receipt.status === 'saved' ? receipt.placement : null
      },
      placement
    },
    identities
  )
  assertNoRawUuid(projection, `Campaign ${configured.role} completion`)
  return projection
}
