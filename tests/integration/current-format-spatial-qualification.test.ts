import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HexMapService } from '../../src/core/hex/hex-map-store.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatLiveFixture } from '../../scripts/qualification/current-format-live-fixture.js'
import { loadCurrentFormatRootFixture } from '../../scripts/qualification/current-format-root-fixture.js'
import {
  loadCurrentFormatSpatialFixture,
  type CurrentFormatSpatialFixture,
  validateCurrentFormatSpatialFixture
} from '../../scripts/qualification/current-format-spatial-fixture.js'
import { materializeCurrentFormatSpatialFixture } from '../../scripts/qualification/current-format-spatial-materializer.js'
import {
  assertCurrentFormatSpatialReadback,
  assertCurrentFormatSpatialReceipt,
  readCurrentFormatSpatialFixture
} from '../../scripts/qualification/current-format-spatial-readback.js'

const manifest = validateCurrentFormatCampaignManifest(
  JSON.parse(
    readFileSync(
      'docs/project/evidence/frontend-robustness-current-format-manifest.v1.json',
      'utf8'
    )
  ),
  {
    campaignDatabaseSchemaVersion: databaseSchemaVersions.campaign,
    campaignSchemaRegistrations:
      createDefaultCampaignSchemaBootstrapper().names()
  }
)
const rootFixture = loadCurrentFormatRootFixture(
  'docs/project/evidence/frontend-robustness-current-format-root-fixture.v1.json',
  manifest
)
const liveFixture = loadCurrentFormatLiveFixture(
  'docs/project/evidence/frontend-robustness-current-format-live-fixture.v1.json',
  manifest,
  rootFixture
)
const spatialFixturePath =
  'docs/project/evidence/frontend-robustness-current-format-spatial-fixture.v1.json'
const spatialFixture = loadCurrentFormatSpatialFixture(
  spatialFixturePath,
  manifest,
  rootFixture,
  liveFixture
)

describe('FR2F2B2 current-format spatial qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2b2-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('materializes A/B through spatial owners and reopens complete semantic projections', () => {
    const receipt = materializeCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    const readback = readCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )

    expect(() =>
      assertCurrentFormatSpatialReadback(rootFixture, spatialFixture, readback)
    ).not.toThrow()
    expect(() =>
      assertCurrentFormatSpatialReceipt(receipt, readback)
    ).not.toThrow()
    expect(
      readback.campaigns.map(({ role, travel, chunks, commandReceipts }) => ({
        role,
        status: travel.status,
        current: travel.current,
        authoredTiles: chunks.chunks.reduce(
          (count, chunk) => count + chunk.authoredTiles.length,
          0
        ),
        commands: Object.values(commandReceipts).map(({ status }) => status)
      }))
    ).toEqual([
      {
        role: 'A',
        status: 'paused',
        current: { q: 1, r: 0 },
        authoredTiles: 4,
        commands: ['applied', 'applied', 'applied', 'applied']
      },
      {
        role: 'B',
        status: 'travelling',
        current: { q: 5, r: -3 },
        authoredTiles: 4,
        commands: ['applied', 'applied', 'applied', 'applied']
      }
    ])
  })

  it('rejects invalid Campaign B spatial truth before publishing Campaign A', () => {
    const raw = structuredClone(
      spatialFixture
    ) as DeepMutable<CurrentFormatSpatialFixture>
    raw.campaigns[1]!.materialization.routeBiomeId = 'water'

    expect(() =>
      validateCurrentFormatSpatialFixture(
        raw,
        manifest,
        rootFixture,
        liveFixture
      )
    ).toThrow('uses an impassable biome')
    const campaigns = new CampaignStore(root)
    try {
      expect(campaigns.list().campaigns).toEqual([])
    } finally {
      campaigns.close()
    }
  })

  it('detects a public Hex map mutation instead of accepting changed spatial bytes', () => {
    materializeCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    visitCampaign(root, 'A', (database) => {
      const maps = new HexMapService(fixedSqliteDatabaseAccess(database))
      const map = maps.catalog().maps[0]!
      maps.update({
        mapId: map.id,
        displayName: 'Changed through HexMapService',
        expectedMetadataRevision: map.metadataRevision
      })
    })

    expect(() =>
      readCurrentFormatSpatialFixture(
        root,
        rootFixture,
        liveFixture,
        spatialFixture
      )
    ).toThrow('spatial map is not singular')
  })

  it('detects a public Travel mutation instead of accepting a changed journey', () => {
    materializeCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    visitCampaign(root, 'B', (database) => {
      const travel = new HexTravelService(
        fixedSqliteDatabaseAccess(database),
        () => 2_002_400
      )
      const current = travel.read()
      travel.pause({
        sceneId: current.sceneId,
        expectedRevision: current.revision
      })
    })

    const changed = readCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    expect(() =>
      assertCurrentFormatSpatialReadback(rootFixture, spatialFixture, changed)
    ).toThrow()
  })

  it('preserves the upstream root oracle except for qualified Travel position', () => {
    materializeCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    visitCampaign(root, 'A', (database) => {
      const locations = new WorldLocationStore(database)
      const snapshot = locations.read()
      const location = snapshot.locations.find(
        ({ displayName }) => displayName === 'Salt Harbor'
      )!
      locations.update(
        location.id,
        {
          displayName: location.displayName,
          tags: location.tags,
          readAloud: location.readAloud,
          notes: 'Changed after spatial materialization.',
          factionIds: location.factionIds,
          encounterTableIds: location.encounterTableIds
        },
        snapshot.revision
      )
    })

    const changed = readCurrentFormatSpatialFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture
    )
    expect(() =>
      assertCurrentFormatSpatialReadback(rootFixture, spatialFixture, changed)
    ).toThrow()
  })

  it('rejects coverage, upstream identity, and semantic-hash drift before mutation', () => {
    const raw = JSON.parse(readFileSync(spatialFixturePath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(() =>
      validateCurrentFormatSpatialFixture(
        { ...raw, coveredCampaignRegistrations: ['scene'] },
        manifest,
        rootFixture,
        liveFixture
      )
    ).toThrow('coverage does not match')
    expect(() =>
      validateCurrentFormatSpatialFixture(
        { ...raw, liveFixtureIdentity: 'stale-live' },
        manifest,
        rootFixture,
        liveFixture
      )
    ).toThrow()

    const campaigns = structuredClone(raw['campaigns']) as Array<{
      expected: { semanticSha256: string }
    }>
    campaigns[0]!.expected.semanticSha256 = 'not-a-hash'
    expect(() =>
      validateCurrentFormatSpatialFixture(
        { ...raw, campaigns },
        manifest,
        rootFixture,
        liveFixture
      )
    ).toThrow()
    const store = new CampaignStore(root)
    try {
      expect(store.list().campaigns).toEqual([])
    } finally {
      store.close()
    }
  })
})

function visitCampaign(
  dataRoot: string,
  role: 'A' | 'B',
  work: Parameters<CampaignStore['visitCampaignDatabase']>[1]
): void {
  const campaigns = new CampaignStore(dataRoot)
  try {
    const sourceId = rootFixture.campaigns.find(
      (campaign) => campaign.role === role
    )!.bundle.source.id
    const campaign = campaigns.campaignImportRepository().previous(sourceId)
    expect(campaign).not.toBeNull()
    campaigns.visitCampaignDatabase(campaign!.campaignId, work)
  } finally {
    campaigns.close()
  }
}

type DeepMutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T[Key] extends object
      ? DeepMutable<T[Key]>
      : T[Key]
}
