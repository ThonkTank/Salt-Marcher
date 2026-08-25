import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { WorldLocationSaveCommandHandler } from '../../src/core/application/world-location-save.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import {
  WorldLocationService,
  WorldLocationStore
} from '../../src/core/worldplanner/location-store.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationSaveJournal } from '../../src/core/worldplanner/world-location-save-journal.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import {
  assertExactPrimaryCoverage,
  loadCurrentFormatCompletionFixture,
  type CurrentFormatCompletionFixture,
  validateCurrentFormatCompletionFixture
} from '../../scripts/qualification/current-format-completion-fixture.js'
import {
  currentFormatCompletionCommand,
  interruptCurrentFormatCompletionFixture,
  reconcileCurrentFormatCompletionFixture
} from '../../scripts/qualification/current-format-completion-materializer.js'
import {
  assertCurrentFormatCompletionReadback,
  assertCurrentFormatCompletionReceipt,
  readCurrentFormatCompletionFixture
} from '../../scripts/qualification/current-format-completion-readback.js'
import { loadCurrentFormatEconomyFixture } from '../../scripts/qualification/current-format-economy-fixture.js'
import { readCurrentFormatEconomyFixture } from '../../scripts/qualification/current-format-economy-readback.js'
import { loadCurrentFormatLiveFixture } from '../../scripts/qualification/current-format-live-fixture.js'
import { loadCurrentFormatPreparationFixture } from '../../scripts/qualification/current-format-preparation-fixture.js'
import { loadCurrentFormatRootFixture } from '../../scripts/qualification/current-format-root-fixture.js'
import { loadCurrentFormatSpatialFixture } from '../../scripts/qualification/current-format-spatial-fixture.js'
import { createCurrentFormatSpatialEditingOwner } from '../../scripts/qualification/current-format-spatial-owner.js'

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
const spatialFixture = loadCurrentFormatSpatialFixture(
  'docs/project/evidence/frontend-robustness-current-format-spatial-fixture.v1.json',
  manifest,
  rootFixture,
  liveFixture
)
const preparationFixture = loadCurrentFormatPreparationFixture(
  'docs/project/evidence/frontend-robustness-current-format-preparation-fixture.v1.json',
  manifest,
  spatialFixture
)
const economyFixture = loadCurrentFormatEconomyFixture(
  'docs/project/evidence/frontend-robustness-current-format-economy-fixture.v1.json',
  manifest,
  preparationFixture,
  spatialFixture
)
const fixturePath =
  'docs/project/evidence/frontend-robustness-current-format-completion-fixture.v1.json'
const completionFixture = loadCurrentFormatCompletionFixture(
  fixturePath,
  manifest,
  rootFixture,
  liveFixture,
  spatialFixture,
  preparationFixture,
  economyFixture
)

describe('FR2F2C2B current-format completion qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2c2b-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reopens provisional A/B receipts, reconciles only placement, and proves exact-one coverage', () => {
    const interrupted = interrupt()
    const interruptedEconomy = readCurrentFormatEconomyFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture,
      economyFixture,
      {
        downstreamLocationNames: new Map(
          completionFixture.campaigns.map((campaign) => [
            campaign.role,
            new Set([campaign.materialization.locationName])
          ])
        )
      }
    )
    const reopened = new CampaignStore(root)
    try {
      for (const expected of interrupted.campaigns) {
        reopened.visitCampaignDatabase(expected.campaignId, (database) => {
          const receipt = new WorldLocationSaveJournal(database).receipt(
            expected.commandId
          )
          expect(receipt).toMatchObject({
            status: 'partially-saved',
            saved: { id: expected.locationId },
            snapshot: { revision: expected.locationRevision },
            placementFailure: {
              kind: 'unavailable',
              detail: 'placement_pending'
            }
          })
          expect(
            new HexMapStore(database, new WorldLocationStore(database))
              .catalog()
              .maps.find(({ id }) => id === expected.mapId)?.contentRevision
          ).toBe(expected.mapContentRevision)
        })
      }
    } finally {
      reopened.close()
    }

    const reconciled = reconcile()
    const readback = read()
    for (const baseline of interruptedEconomy.preparation.spatial.campaigns)
      expect(
        readback.economy.preparation.spatial.campaigns.find(
          ({ role }) => role === baseline.role
        )?.semanticProjection
      ).toEqual(baseline.semanticProjection)
    assertReadback(readback)
    assertCurrentFormatCompletionReceipt(reconciled, readback)
  })

  it('fails closed on missing, duplicate, unknown, and stale primary coverage before publication', () => {
    expect(() =>
      assertExactPrimaryCoverage(
        ['owner:a'],
        [
          { identity: 'fixture:one', values: ['owner:a'] },
          { identity: 'fixture:two', values: ['owner:a'] }
        ],
        'test owners'
      )
    ).toThrow('has 2 dispositions')
    expect(() =>
      assertExactPrimaryCoverage(['owner:a'], [], 'test owners')
    ).toThrow('has 0 dispositions')
    expect(() =>
      assertExactPrimaryCoverage(
        ['owner:a'],
        [{ identity: 'fixture:one', values: ['owner:unknown'] }],
        'test owners'
      )
    ).toThrow('unknown primary')

    const raw = JSON.parse(
      readFileSync(fixturePath, 'utf8')
    ) as DeepMutable<CurrentFormatCompletionFixture>
    raw.coveredCampaignRegistrations = ['loot']
    expect(() =>
      validateCurrentFormatCompletionFixture(
        raw,
        manifest,
        rootFixture,
        liveFixture,
        spatialFixture,
        preparationFixture,
        economyFixture
      )
    ).toThrow('completion Campaign coverage does not match')
    const campaigns = new CampaignStore(root)
    try {
      expect(campaigns.list().campaigns).toEqual([])
    } finally {
      campaigns.close()
    }
  })

  it('rejects changed request reuse after interruption without attempting placement', () => {
    const interrupted = interrupt()
    const expected = interrupted.campaigns[0]!
    const configured = completionFixture.campaigns[0]!
    const placement = vi.fn()
    const campaigns = new CampaignStore(root)
    try {
      campaigns.visitCampaignDatabase(expected.campaignId, (database) => {
        const symbols = new LocationSymbolService(
          campaigns.installationPersistenceAccess()
        )
        const locations = new WorldLocationService(
          fixedSqliteDatabaseAccess(database),
          (id) =>
            symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
          campaigns.installationPersistenceAccess()
        )
        const handler = new WorldLocationSaveCommandHandler(() => ({
          locations,
          journal: new WorldLocationSaveJournal(database),
          placement: { execute: placement }
        }))
        const input = currentFormatCompletionCommand(configured, expected.mapId)
        expect(() =>
          handler.execute({
            ...input,
            location: { ...input.location, displayName: 'Andere Wacht' }
          })
        ).toThrow('validation_failed')
        expect(placement).not.toHaveBeenCalled()
        expect(
          locations
            .read()
            .locations.filter(({ id }) => id === expected.locationId)
        ).toHaveLength(1)
      })
    } finally {
      campaigns.close()
    }
  })

  it('detects a public removal of the reconciled Hex placement', () => {
    interrupt()
    reconcile()
    const before = read().campaigns[0]!
    const campaigns = new CampaignStore(root)
    try {
      campaigns.visitCampaignDatabase(before.campaignId, (database) => {
        const result = createCurrentFormatSpatialEditingOwner(
          database,
          () => 0
        ).removeLocation({
          commandId: '01920000-0000-7000-8000-000000000201',
          mapId: before.placement.mapId,
          locationId: before.location.id,
          expectedContentRevision: before.placement.contentRevision
        })
        expect(result.status).toBe('applied')
      })
    } finally {
      campaigns.close()
    }
    expect(() => assertReadback(read())).toThrow()
  })

  function interrupt() {
    return interruptCurrentFormatCompletionFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture,
      economyFixture,
      completionFixture
    )
  }

  function reconcile() {
    return reconcileCurrentFormatCompletionFixture(
      root,
      rootFixture,
      spatialFixture,
      completionFixture
    )
  }

  function read() {
    return readCurrentFormatCompletionFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture,
      economyFixture,
      completionFixture
    )
  }

  function assertReadback(readback: ReturnType<typeof read>): void {
    assertCurrentFormatCompletionReadback(
      rootFixture,
      spatialFixture,
      preparationFixture,
      economyFixture,
      completionFixture,
      readback
    )
  }
})

type DeepMutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T[Key] extends object
      ? DeepMutable<T[Key]>
      : T[Key]
}
