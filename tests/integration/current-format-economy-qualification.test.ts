import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LootService } from '../../src/core/application/loot-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import {
  loadCurrentFormatEconomyFixture,
  type CurrentFormatEconomyFixture,
  validateCurrentFormatEconomyFixture
} from '../../scripts/qualification/current-format-economy-fixture.js'
import { materializeCurrentFormatEconomyFixture } from '../../scripts/qualification/current-format-economy-materializer.js'
import {
  assertCurrentFormatEconomyReadback,
  assertCurrentFormatEconomyReceipt,
  readCurrentFormatEconomyFixture
} from '../../scripts/qualification/current-format-economy-readback.js'
import { loadCurrentFormatLiveFixture } from '../../scripts/qualification/current-format-live-fixture.js'
import { loadCurrentFormatPreparationFixture } from '../../scripts/qualification/current-format-preparation-fixture.js'
import { loadCurrentFormatRootFixture } from '../../scripts/qualification/current-format-root-fixture.js'
import { loadCurrentFormatSpatialFixture } from '../../scripts/qualification/current-format-spatial-fixture.js'

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
const fixturePath =
  'docs/project/evidence/frontend-robustness-current-format-economy-fixture.v1.json'
const economyFixture = loadCurrentFormatEconomyFixture(
  fixturePath,
  manifest,
  preparationFixture,
  spatialFixture
)

describe('FR2F2C2A current-format economy qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2c2a-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('materializes A/B through economy and installation owners and reopens semantic projections', () => {
    const receipt = materialize()
    const readback = read()
    expect(() => assertReadback(readback)).not.toThrow()
    expect(() =>
      assertCurrentFormatEconomyReceipt(receipt, readback)
    ).not.toThrow()
  })

  it('rejects invalid Campaign B and coverage before publishing Campaign A', () => {
    const raw = structuredClone(
      economyFixture
    ) as DeepMutable<CurrentFormatEconomyFixture>
    const firstReference =
      raw.campaigns[0]!.materialization.legacyDefinition.reference
    const secondReference =
      raw.campaigns[1]!.materialization.legacyDefinition.reference
    if (firstReference.kind !== 'legacy' || secondReference.kind !== 'legacy')
      throw new Error('fixture is not legacy')
    secondReference.definitionId = firstReference.definitionId
    expect(() =>
      validateCurrentFormatEconomyFixture(
        raw,
        manifest,
        preparationFixture,
        spatialFixture
      )
    ).toThrow('identities must be present and unique')

    const coverage = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(() =>
      validateCurrentFormatEconomyFixture(
        {
          ...coverage,
          coveredCampaignRegistrations: [
            'character-loot',
            'loot',
            'legacy-items'
          ]
        },
        manifest,
        preparationFixture,
        spatialFixture
      )
    ).toThrow('Campaign coverage does not match')
    const campaigns = new CampaignStore(root)
    try {
      expect(campaigns.list().campaigns).toEqual([])
    } finally {
      campaigns.close()
    }
  })

  it('detects a public Treasure move', () => {
    materialize()
    const before = read().campaigns.find(({ role }) => role === 'A')!
    visitCampaign('A', (database) => {
      const loot = new LootService(fixedSqliteDatabaseAccess(database))
      loot.move({
        commandId: '01920000-0000-7000-8000-000000000009',
        treasureId: before.manualTreasure.id,
        expectedRevision: before.manualTreasure.revision,
        anchor: { kind: 'unplaced' }
      })
    })
    expect(() => assertReadback(read())).toThrow()
  })

  it('detects a public Character Loot correction', () => {
    materialize()
    const before = read().campaigns.find(({ role }) => role === 'A')!
    visitCampaign('A', (database) => {
      const loot = new LootService(fixedSqliteDatabaseAccess(database))
      loot.correctLedger({
        commandId: '01920000-0000-7000-8000-00000000000a',
        characterId: before.ledger.characterId,
        entryId: before.ledger.entries[0]!.id,
        expectedRevision: before.ledger.revision,
        quantity: 1,
        status: 'sold',
        reason: 'Controlled FR2F2C2A mutation.'
      })
    })
    expect(() => assertReadback(read())).toThrow()
  })

  it('detects a public shared Location Symbol rename', () => {
    materialize()
    const campaigns = new CampaignStore(root)
    try {
      const symbols = new LocationSymbolService(
        campaigns.installationPersistenceAccess()
      )
      const snapshot = symbols.read()
      symbols.update(
        snapshot.symbols[0]!.id,
        'Mutiertes Signalfeuer',
        snapshot.revision
      )
    } finally {
      campaigns.close()
    }
    expect(() => assertReadback(read())).toThrow()
  })

  it('detects removal of the shared symbol from Campaign Location data', () => {
    materialize()
    const before = read().campaigns.find(({ role }) => role === 'A')!
    const campaigns = new CampaignStore(root)
    try {
      const registered = registeredCampaign(campaigns, 'A')
      campaigns.visitCampaignDatabase(registered.campaignId, (database) => {
        const symbols = new LocationSymbolService(
          campaigns.installationPersistenceAccess()
        )
        const locations = new WorldLocationService(
          fixedSqliteDatabaseAccess(database),
          (id) =>
            symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
          campaigns.installationPersistenceAccess()
        )
        locations.updateMapPresentation(
          before.symbolLocation.id,
          { symbolId: 'location' },
          before.symbolLocation.mapPresentation.revision
        )
      })
    } finally {
      campaigns.close()
    }
    expect(() => assertReadback(read())).toThrow()
  })

  it('detects a public installation Session layout mutation', () => {
    materialize()
    const campaigns = new CampaignStore(root)
    try {
      const settings = campaigns.readSettings()
      campaigns.updateSettings(
        {
          sessionLayout: {
            ...settings.preferences.sessionLayout,
            centerTab: 'details'
          }
        },
        settings.revision
      )
    } finally {
      campaigns.close()
    }
    expect(() => assertReadback(read())).toThrow()
  })

  function materialize() {
    return materializeCurrentFormatEconomyFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture,
      economyFixture
    )
  }

  function read() {
    return readCurrentFormatEconomyFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture,
      economyFixture
    )
  }

  function assertReadback(readback: ReturnType<typeof read>): void {
    assertCurrentFormatEconomyReadback(
      rootFixture,
      spatialFixture,
      preparationFixture,
      economyFixture,
      readback
    )
  }

  function visitCampaign(
    role: 'A' | 'B',
    work: Parameters<CampaignStore['visitCampaignDatabase']>[1]
  ): void {
    const campaigns = new CampaignStore(root)
    try {
      campaigns.visitCampaignDatabase(
        registeredCampaign(campaigns, role).campaignId,
        work
      )
    } finally {
      campaigns.close()
    }
  }

  function registeredCampaign(campaigns: CampaignStore, role: 'A' | 'B') {
    const sourceId = rootFixture.campaigns.find(
      (campaign) => campaign.role === role
    )!.bundle.source.id
    return campaigns.campaignImportRepository().previous(sourceId)!
  }
})

type DeepMutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T[Key] extends object
      ? DeepMutable<T[Key]>
      : T[Key]
}
