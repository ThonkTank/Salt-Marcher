import assert from 'node:assert/strict'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { biomeDefinition } from '../../src/core/hex/biome-catalog.js'
import { HexMapService } from '../../src/core/hex/hex-map-store.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import type {
  HexBrushStrokeResult,
  HexChunkReadResult,
  HexHistoryState,
  HexMapCatalogSnapshot,
  HexRuntimeOverlayProjection,
  HexTravelSnapshot
} from '../../src/shared/contracts/hex.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type {
  CurrentFormatLiveCampaign,
  CurrentFormatLiveFixture
} from './current-format-live-fixture.js'
import { currentFormatLiveSemanticIdentities } from './current-format-live-readback.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import {
  assertCurrentFormatRootReadback,
  readCurrentFormatRootFixture,
  type CurrentFormatRootCampaignReadback,
  type CurrentFormatRootReadback
} from './current-format-root-readback.js'
import type {
  CurrentFormatSpatialCampaign,
  CurrentFormatSpatialFixture
} from './current-format-spatial-fixture.js'
import { spatialChunkKeys } from './current-format-spatial-fixture.js'
import type { CurrentFormatSpatialMaterializationReceipt } from './current-format-spatial-materializer.js'
import { createCurrentFormatSpatialEditingOwner } from './current-format-spatial-owner.js'
import {
  assertNoRawUuid,
  collectUuids,
  replaceSemanticIdentities,
  semanticHash
} from './qualification-semantic-oracle.js'

type SpatialCommandReceipts = Readonly<{
  createMap: HexBrushStrokeResult
  paintRoute: HexBrushStrokeResult
  paintSparseSentinel: HexBrushStrokeResult
  placeLocation: HexBrushStrokeResult
}>

export type CurrentFormatSpatialCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  sceneId: string
  mapId: string
  session: LiveSessionSnapshot
  catalog: HexMapCatalogSnapshot
  chunks: HexChunkReadResult
  history: HexHistoryState
  commandReceipts: SpatialCommandReceipts
  travel: HexTravelSnapshot
  overlays: HexRuntimeOverlayProjection
  nextBoundaryDelay: number | null
  semanticProjection: unknown
  semanticSha256: string
}>

export type CurrentFormatSpatialReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  root: CurrentFormatRootReadback
  campaigns: readonly CurrentFormatSpatialCampaignReadback[]
}>

export function readCurrentFormatSpatialFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture
): CurrentFormatSpatialReadback {
  const root = readCurrentFormatRootFixture(dataRoot, rootFixture)
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const readbacks = spatialFixture.campaigns.map((configured) => {
      const rootCampaign = root.campaigns.find(
        ({ role }) => role === configured.role
      )
      const liveCampaign = liveFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!rootCampaign || !liveCampaign)
        throw new Error(
          `Current-format spatial Campaign ${configured.role} has no root/Live readback.`
        )
      const readback = campaigns.visitCampaignDatabase(
        rootCampaign.campaignId,
        (database) => {
          const now = () => configured.materialization.travel.advanceTo
          const access = fixedSqliteDatabaseAccess(database)
          const session = new LivePlayService(access).readSession()
          const maps = new HexMapService(access)
          const catalog = maps.catalog()
          const matchingMaps = catalog.maps.filter(
            ({ displayName }) =>
              displayName === configured.materialization.mapName
          )
          assert.equal(
            matchingMaps.length,
            1,
            `Campaign ${configured.role} spatial map is not singular.`
          )
          assert.equal(
            catalog.maps.length,
            1,
            `Campaign ${configured.role} contains an unaccounted Hex map.`
          )
          const map = matchingMaps[0]!
          const storedChunks = maps.readChunks(
            map.id,
            spatialChunkKeys(configured)
          )
          const chunks: HexChunkReadResult = {
            ...storedChunks,
            biomes: [
              ...new Set(
                storedChunks.chunks.flatMap((chunk) =>
                  chunk.authoredTiles.map(({ biomeId }) => biomeId)
                )
              )
            ].map(biomeDefinition)
          }
          const editing = createCurrentFormatSpatialEditingOwner(database, now)
          const commandReceipts = readCommandReceipts(configured, editing)
          const travelOwner = new HexTravelService(access, now)
          const travel = travelOwner.read(session.scene.focusedSceneId)
          const overlays = travelOwner.runtimeOverlays(map.id)
          const nextBoundaryDelay = travelOwner.nextBoundaryDelay()
          const semanticProjection = semanticSpatialProjection(
            configured,
            liveCampaign,
            rootCampaign,
            session,
            map.id,
            {
              catalog,
              chunks,
              history: editing.history(map.id),
              commandReceipts,
              travel,
              overlays,
              nextBoundaryDelay
            }
          )
          return {
            role: configured.role,
            campaignId: rootCampaign.campaignId,
            sceneId: session.scene.focusedSceneId,
            mapId: map.id,
            session,
            catalog,
            chunks,
            history: editing.history(map.id),
            commandReceipts,
            travel,
            overlays,
            nextBoundaryDelay,
            semanticProjection,
            semanticSha256: semanticHash(semanticProjection)
          }
        }
      )
      if (!readback)
        throw new Error(
          `Current-format spatial Campaign ${configured.role} database is unavailable.`
        )
      return Object.freeze(readback)
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Independent spatial readback must not mutate Campaign registry state.'
    )
    return Object.freeze({
      fixtureIdentity: spatialFixture.identity,
      qualificationClaim: spatialFixture.qualificationClaim,
      root,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatSpatialReadback(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  readback: CurrentFormatSpatialReadback
): void {
  assertSpatialRootPreservation(rootFixture, readback.root)
  assert.equal(readback.fixtureIdentity, spatialFixture.identity)
  assert.equal(readback.qualificationClaim, spatialFixture.qualificationClaim)
  assert.equal(readback.root.fixtureIdentity, rootFixture.identity)
  assert.equal(readback.campaigns.length, spatialFixture.campaigns.length)
  const campaignA = readback.campaigns.find(({ role }) => role === 'A')
  assert.ok(campaignA)
  assert.equal(
    readback.root.activeCampaignId,
    campaignA.campaignId,
    'Campaign A must remain active after independent spatial readback.'
  )

  const campaignUuidSets: Set<string>[] = []
  for (const expected of spatialFixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual, `Missing spatial readback for Campaign ${expected.role}.`)
    assertCampaign(expected, actual)
    campaignUuidSets.push(
      collectUuids({
        session: actual.session,
        catalog: actual.catalog,
        chunks: actual.chunks,
        commandReceipts: actual.commandReceipts,
        travel: actual.travel,
        overlays: actual.overlays
      })
    )
  }
  for (const id of campaignUuidSets[0] ?? [])
    assert.ok(
      !(campaignUuidSets[1]?.has(id) ?? false),
      `Spatial identity ${id} leaked across Campaign A/B.`
    )
}

function assertSpatialRootPreservation(
  fixture: CurrentFormatRootFixture,
  root: CurrentFormatRootReadback
): void {
  assertCurrentFormatRootReadback(fixture, {
    ...root,
    campaigns: root.campaigns.map((campaign) => ({
      ...campaign,
      party: {
        ...campaign.party,
        members: campaign.party.members.map((member) => ({
          ...member,
          travelPosition: null
        }))
      }
    }))
  })
}

export function assertCurrentFormatSpatialReceipt(
  receipt: CurrentFormatSpatialMaterializationReceipt,
  readback: CurrentFormatSpatialReadback
): void {
  assert.equal(receipt.fixtureIdentity, readback.fixtureIdentity)
  assert.equal(receipt.qualificationClaim, readback.qualificationClaim)
  for (const expected of receipt.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual, `Missing spatial receipt for Campaign ${expected.role}.`)
    assert.equal(actual.campaignId, expected.campaignId)
    assert.equal(actual.sceneId, expected.sceneId)
    assert.equal(actual.mapId, expected.mapId)
    assert.equal(actual.travel.revision, expected.finalTravelRevision)
    assert.deepStrictEqual(
      Object.fromEntries(
        Object.entries(actual.commandReceipts).map(([key, value]) => [
          key,
          value.commandId
        ])
      ),
      expected.commandIds
    )
  }
}

function assertCampaign(
  expected: CurrentFormatSpatialCampaign,
  actual: CurrentFormatSpatialCampaignReadback
): void {
  const sentinels = expected.expected
  const map = actual.catalog.maps[0]!
  assert.equal(actual.catalog.revision, sentinels.catalogRevision)
  assert.equal(map.id, actual.mapId)
  assert.equal(map.metadataRevision, sentinels.mapMetadataRevision)
  assert.equal(map.contentRevision, sentinels.mapContentRevision)
  assert.equal(actual.chunks.map.id, actual.mapId)
  assert.equal(actual.chunks.chunks.length, sentinels.chunkCount)
  assert.equal(
    actual.chunks.chunks.reduce(
      (count, chunk) => count + chunk.authoredTiles.length,
      0
    ),
    sentinels.authoredTileCount
  )
  assert.equal(
    actual.chunks.chunks.reduce(
      (count, chunk) => count + chunk.locations.length,
      0
    ),
    1
  )
  assert.deepStrictEqual(actual.history, {
    canUndo: true,
    canRedo: false,
    undoLabel: sentinels.historyUndoLabel,
    redoLabel: null
  })
  for (const command of Object.values(actual.commandReceipts))
    assert.equal(command.status, 'applied')

  assert.equal(actual.session.party.revision, sentinels.partyRevision)
  assert.equal(actual.session.scene.revision, sentinels.sceneRevision)
  assert.equal(actual.session.revision, sentinels.sceneRevision)
  assert.equal(actual.session.combat?.revision, sentinels.combatRevision)
  assert.equal(actual.travel.sceneId, actual.sceneId)
  assert.equal(actual.travel.mapId, actual.mapId)
  assert.equal(actual.travel.revision, sentinels.travelRevision)
  assert.equal(actual.travel.status, sentinels.travelStatus)
  assert.equal(actual.travel.currentIndex, sentinels.currentIndex)
  assert.equal(actual.travel.gameTimeSeconds, sentinels.gameTimeSeconds)
  assert.deepStrictEqual(actual.travel.current, sentinels.currentCoordinate)
  assert.equal(actual.travel.path.length, sentinels.routeLength)
  assert.equal(actual.travel.locationName, sentinels.locationName)
  assert.equal(actual.travel.segmentStartedAt, sentinels.segmentStartedAt)
  assert.equal(actual.travel.segmentEndsAt, sentinels.segmentEndsAt)
  assert.equal(actual.nextBoundaryDelay, sentinels.nextBoundaryDelay)
  assert.deepStrictEqual(actual.overlays, {
    mapId: actual.mapId,
    overlays: [
      {
        sceneId: actual.sceneId,
        label: 'Standardszene',
        token: sentinels.currentCoordinate,
        route: actual.travel.path,
        focused: true
      }
    ]
  })
  assert.equal(
    actual.semanticSha256,
    sentinels.semanticSha256,
    `Campaign ${expected.role} complete semantic spatial hash drifted; actual ${actual.semanticSha256}.`
  )
}

function readCommandReceipts(
  configured: CurrentFormatSpatialCampaign,
  editing: ReturnType<typeof createCurrentFormatSpatialEditingOwner>
): SpatialCommandReceipts {
  const read = (key: keyof SpatialCommandReceipts): HexBrushStrokeResult => {
    const receipt = editing.commandReceipt(
      configured.materialization.commandIds[key]
    )
    if (!receipt)
      throw new Error(
        `Current-format spatial Campaign ${configured.role} is missing command receipt ${key}.`
      )
    return receipt
  }
  return Object.freeze({
    createMap: read('createMap'),
    paintRoute: read('paintRoute'),
    paintSparseSentinel: read('paintSparseSentinel'),
    placeLocation: read('placeLocation')
  })
}

function semanticSpatialProjection(
  configured: CurrentFormatSpatialCampaign,
  live: CurrentFormatLiveCampaign,
  root: CurrentFormatRootCampaignReadback,
  session: LiveSessionSnapshot,
  mapId: string,
  spatial: Readonly<{
    catalog: HexMapCatalogSnapshot
    chunks: HexChunkReadResult
    history: HexHistoryState
    commandReceipts: SpatialCommandReceipts
    travel: HexTravelSnapshot
    overlays: HexRuntimeOverlayProjection
    nextBoundaryDelay: number | null
  }>
): unknown {
  const additions = new Map<string, string>([
    [mapId, configured.materialization.mapSemanticKey],
    [configured.materialization.commandIds.createMap, 'command:hex-create-map'],
    [
      configured.materialization.commandIds.paintRoute,
      'command:hex-paint-route'
    ],
    [
      configured.materialization.commandIds.paintSparseSentinel,
      'command:hex-paint-sparse'
    ],
    [
      configured.materialization.commandIds.placeLocation,
      'command:hex-place-location'
    ]
  ])
  const identities = currentFormatLiveSemanticIdentities(
    live,
    root,
    session,
    additions
  )
  const projection = replaceSemanticIdentities(
    {
      liveSession: session,
      hex: spatial
    },
    identities
  )
  assertNoRawUuid(projection, `Campaign ${configured.role} spatial`)
  return projection
}
