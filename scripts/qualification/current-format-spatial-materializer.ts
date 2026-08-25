import assert from 'node:assert/strict'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import type { HexBrushStrokeResult } from '../../src/shared/contracts/hex.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import { materializeCurrentFormatLiveFixture } from './current-format-live-materializer.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type {
  CurrentFormatSpatialCampaign,
  CurrentFormatSpatialFixture
} from './current-format-spatial-fixture.js'
import { createCurrentFormatSpatialEditingOwner } from './current-format-spatial-owner.js'

const spatialCampaignReceiptSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    sceneId: z.uuid(),
    mapId: z.uuid(),
    commandIds: z
      .object({
        createMap: z.uuid(),
        paintRoute: z.uuid(),
        paintSparseSentinel: z.uuid(),
        placeLocation: z.uuid()
      })
      .strict(),
    advancedAt: z.number().int().nonnegative(),
    finalTravelRevision: z.number().int().nonnegative()
  })
  .strict()

const spatialMaterializationReceiptSchema = z
  .object({
    fixtureIdentity: z.literal('frontend-robustness-current-format-spatial-v1'),
    qualificationClaim: z.literal(
      'partial-fr2f2b2-spatial-cohort-not-complete-current-format'
    ),
    campaigns: z.array(spatialCampaignReceiptSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatSpatialMaterializationReceipt = Readonly<
  z.infer<typeof spatialMaterializationReceiptSchema>
>

export function materializeCurrentFormatSpatialFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatSpatialMaterializationReceipt {
  const liveReceipt = materializeCurrentFormatLiveFixture(
    dataRoot,
    rootFixture,
    liveFixture
  )
  const liveCampaigns = new Map(
    liveReceipt.campaigns.map((campaign) => [campaign.role, campaign])
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const before = campaigns.list()
    const receipts = spatialFixture.campaigns.map((configured) => {
      const liveCampaign = liveCampaigns.get(configured.role)
      const rootCampaign = rootFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!liveCampaign || !rootCampaign)
        throw new Error(
          `Current-format spatial Campaign ${configured.role} is missing its root/Live receipt.`
        )
      const receipt = campaigns.visitCampaignDatabase(
        liveCampaign.campaignId,
        (database) =>
          materializeCampaign(
            campaigns,
            database,
            liveCampaign.campaignId,
            liveCampaign.sceneId,
            rootCampaign.bundle.source.id,
            configured
          )
      )
      if (!receipt)
        throw new Error(
          `Current-format spatial Campaign ${configured.role} database is unavailable.`
        )
      return receipt
    })
    assert.deepStrictEqual(
      campaigns.list(),
      before,
      'Current-format spatial materialization changed Campaign switch authority.'
    )
    return spatialMaterializationReceiptSchema.parse({
      fixtureIdentity: spatialFixture.identity,
      qualificationClaim: spatialFixture.qualificationClaim,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function materializeCampaign(
  campaigns: CampaignStore,
  database: Database.Database,
  campaignId: string,
  sceneId: string,
  sourceId: string,
  configured: CurrentFormatSpatialCampaign
) {
  const access = fixedSqliteDatabaseAccess(database)
  const clock = { now: configured.materialization.travel.startedAt }
  const now = () => clock.now
  const editing = createCurrentFormatSpatialEditingOwner(database, now)
  const travel = new HexTravelService(access, now)
  const play = new LivePlayService(access)
  const commands = configured.materialization.commandIds

  const created = applied(
    editing.createMap({
      commandId: commands.createMap,
      displayName: configured.materialization.mapName,
      expectedCatalogRevision: 0
    }),
    configured.role,
    'create map'
  )
  const map = created.maps[0]!
  let contentRevision = map.contentRevision

  const routePaint = applied(
    editing.applyBrushStroke({
      commandId: commands.paintRoute,
      mapId: map.id,
      mode: 'paint',
      biomeId: configured.materialization.routeBiomeId,
      path: configured.materialization.routeCoordinates,
      radius: 0,
      expectedContentRevision: contentRevision,
      confirmationToken: null
    }),
    configured.role,
    'paint route'
  )
  contentRevision = routePaint.maps[0]!.contentRevision

  const sparsePaint = applied(
    editing.applyBrushStroke({
      commandId: commands.paintSparseSentinel,
      mapId: map.id,
      mode: 'paint',
      biomeId: configured.materialization.sparseSentinel.biomeId,
      path: [configured.materialization.sparseSentinel.coordinate],
      radius: 0,
      expectedContentRevision: contentRevision,
      confirmationToken: null
    }),
    configured.role,
    'paint sparse sentinel'
  )
  contentRevision = sparsePaint.maps[0]!.contentRevision

  const mappings = campaigns
    .campaignImportRepository()
    .entityMappings(database, sourceId)
  const locationId = mappings.find(
    ({ kind, externalKey }) =>
      kind === 'locations' &&
      externalKey === configured.materialization.placedLocationExternalKey
  )?.internalId
  if (!locationId)
    throw new Error(
      `Current-format spatial Campaign ${configured.role} has no mapped placement Location.`
    )
  const placed = applied(
    editing.placeLocation({
      commandId: commands.placeLocation,
      mapId: map.id,
      locationId,
      coordinate: configured.materialization.placedLocationCoordinate,
      expectedContentRevision: contentRevision
    }),
    configured.role,
    'place Location'
  )
  assert.equal(
    placed.maps[0]!.contentRevision,
    configured.expected.mapContentRevision
  )

  const session = play.readSession()
  assert.equal(session.scene.focusedSceneId, sceneId)
  const positioned = travel.position({
    sceneId,
    mapId: map.id,
    coordinate: configured.materialization.travel.startCoordinate,
    expectedSceneRevision: session.scene.revision
  })
  assert.equal(positioned.status, 'ready')
  const evaluation = travel.evaluate({
    sceneId,
    mapId: map.id,
    waypoints: configured.materialization.travel.waypoints
  })
  if (evaluation.status !== 'ready')
    throw new Error(
      `Current-format spatial Campaign ${configured.role} route was rejected.`
    )
  assert.deepStrictEqual(
    evaluation.path,
    configured.materialization.routeCoordinates
  )
  assert.equal(
    evaluation.totalGameSeconds,
    configured.expected.segmentGameSeconds * 2
  )

  const started = travel.start({
    sceneId,
    mapId: map.id,
    waypoints: configured.materialization.travel.waypoints,
    multiplier: configured.materialization.travel.multiplier,
    expectedRevision: positioned.revision
  })
  assert.equal(started.status, 'travelling')
  assert.equal(
    started.segmentEndsAt,
    configured.materialization.travel.advanceTo
  )

  clock.now = configured.materialization.travel.advanceTo
  const ticked = travel.tick()
  assert.equal(ticked.changed.length, 1)
  assert.equal(ticked.changed[0]!.currentIndex, 1)
  let final = ticked.changed[0]!
  if (configured.materialization.travel.finalStatus === 'paused')
    final = travel.pause({ sceneId, expectedRevision: final.revision })
  assert.equal(final.status, configured.expected.travelStatus)
  assert.equal(final.revision, configured.expected.travelRevision)
  assert.equal(final.gameTimeSeconds, configured.expected.gameTimeSeconds)
  assert.deepStrictEqual(final.current, configured.expected.currentCoordinate)

  return spatialCampaignReceiptSchema.parse({
    role: configured.role,
    campaignId,
    sceneId,
    mapId: map.id,
    commandIds: commands,
    advancedAt: clock.now,
    finalTravelRevision: final.revision
  })
}

function applied(
  result: HexBrushStrokeResult,
  role: 'A' | 'B',
  operation: string
): Extract<HexBrushStrokeResult, { status: 'applied' }> {
  if (result.status !== 'applied')
    throw new Error(
      `Current-format spatial Campaign ${role} could not ${operation}: ${result.status}.`
    )
  return result
}
