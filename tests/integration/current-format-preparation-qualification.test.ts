import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { GeneratorPresetStore } from '../../src/core/persistence/sqlite/generator-preset-store.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatLiveFixture } from '../../scripts/qualification/current-format-live-fixture.js'
import {
  loadCurrentFormatPreparationFixture,
  type CurrentFormatPreparationFixture,
  validateCurrentFormatPreparationFixture
} from '../../scripts/qualification/current-format-preparation-fixture.js'
import { materializeCurrentFormatPreparationFixture } from '../../scripts/qualification/current-format-preparation-materializer.js'
import {
  assertCurrentFormatPreparationReadback,
  assertCurrentFormatPreparationReceipt,
  readCurrentFormatPreparationFixture
} from '../../scripts/qualification/current-format-preparation-readback.js'
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
const fixturePath =
  'docs/project/evidence/frontend-robustness-current-format-preparation-fixture.v1.json'
const preparationFixture = loadCurrentFormatPreparationFixture(
  fixturePath,
  manifest,
  spatialFixture
)

describe('FR2F2C1 current-format preparation qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2c1-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('materializes A/B through preparation owners and reopens complete semantic projections', () => {
    const receipt = materialize()
    const readback = read()

    expect(() =>
      assertCurrentFormatPreparationReadback(
        rootFixture,
        spatialFixture,
        preparationFixture,
        readback
      )
    ).not.toThrow()
    expect(() =>
      assertCurrentFormatPreparationReceipt(receipt, readback)
    ).not.toThrow()
  })

  it('rejects invalid Campaign B and coverage before publishing Campaign A', () => {
    const raw = structuredClone(
      preparationFixture
    ) as DeepMutable<CurrentFormatPreparationFixture>
    raw.campaigns[1]!.materialization.presetName =
      raw.campaigns[0]!.materialization.presetName
    expect(() =>
      validateCurrentFormatPreparationFixture(raw, manifest, spatialFixture)
    ).toThrow('identities must be unique')

    const coverage = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(() =>
      validateCurrentFormatPreparationFixture(
        {
          ...coverage,
          coveredCampaignRegistrations: [
            'session-planner',
            'encounter-plans',
            'encounter-tables',
            'session-generation',
            'campaign-rules'
          ]
        },
        manifest,
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

  it('detects a public Campaign Rules mutation', () => {
    materialize()
    visitCampaign('A', (database) => {
      const rules = new CampaignRulesService(
        fixedSqliteDatabaseAccess(database)
      )
      rules.update({
        commandId: '01910000-0000-7000-8000-00000000000c',
        expectedRevision: rules.read().revision,
        rewardXpBasis: 'base'
      })
    })
    expect(() =>
      assertCurrentFormatPreparationReadback(
        rootFixture,
        spatialFixture,
        preparationFixture,
        read()
      )
    ).toThrow()
  })

  it('detects a public installation Preset reassignment', () => {
    materialize()
    const campaigns = new CampaignStore(root)
    try {
      const campaignB = campaigns
        .campaignImportRepository()
        .previous(rootFixture.campaigns[1]!.bundle.source.id)!
      const presets = campaigns
        .installationPersistenceAccess()
        .use((database) => new GeneratorPresetStore(database))
      presets.assign({
        commandId: '01910000-0000-7000-8000-00000000000d',
        campaignId: campaignB.campaignId,
        presetId: systemGeneratorPresetId,
        expectedRegistryRevision: presets.registry().revision
      })
    } finally {
      campaigns.close()
    }
    expect(() =>
      assertCurrentFormatPreparationReadback(
        rootFixture,
        spatialFixture,
        preparationFixture,
        read()
      )
    ).toThrow()
  })

  it('detects a public installation Encounter Table mutation', () => {
    materialize()
    const campaigns = new CampaignStore(root)
    try {
      campaigns.installationPersistenceAccess().use((database) => {
        const tables = new EncounterTableStore(database, 'installation')
        const saved = tables.commandReceipt(
          preparationFixture.installation.sharedEncounterTableCommandId
        )
        if (!saved || !('saved' in saved)) throw new Error('missing table')
        tables.update(
          '01910000-0000-7000-8000-00000000000e',
          saved.saved.id,
          {
            displayName: saved.saved.displayName,
            description: 'Mutated after materialization.',
            entries: saved.saved.entries.map(({ creatureId, weight }) => ({
              creatureId,
              weight
            }))
          },
          tables.read().revision
        )
      })
    } finally {
      campaigns.close()
    }
    expect(() =>
      assertCurrentFormatPreparationReadback(
        rootFixture,
        spatialFixture,
        preparationFixture,
        read()
      )
    ).toThrow()
  })

  it('detects removal of the shared table from Campaign Location data', () => {
    materialize()
    const campaigns = new CampaignStore(root)
    try {
      const rootCampaign = rootFixture.campaigns[0]!
      const registered = campaigns
        .campaignImportRepository()
        .previous(rootCampaign.bundle.source.id)!
      campaigns.visitCampaignDatabase(registered.campaignId, (database) => {
        const locationId = campaigns
          .campaignImportRepository()
          .entityMappings(database, rootCampaign.bundle.source.id)
          .find(
            ({ kind, externalKey }) =>
              kind === 'locations' &&
              externalKey ===
                preparationFixture.campaigns[0]!.materialization
                  .referencedLocationExternalKey
          )!.internalId
        const locations = new WorldLocationService(
          fixedSqliteDatabaseAccess(database),
          () => null,
          campaigns.installationPersistenceAccess()
        )
        const snapshot = locations.read()
        const location = snapshot.locations.find(({ id }) => id === locationId)!
        locations.update(
          location.id,
          {
            displayName: location.displayName,
            tags: location.tags,
            readAloud: location.readAloud,
            notes: location.notes,
            factionIds: location.factionIds,
            encounterTableIds: []
          },
          snapshot.revision
        )
      })
    } finally {
      campaigns.close()
    }
    expect(() =>
      assertCurrentFormatPreparationReadback(
        rootFixture,
        spatialFixture,
        preparationFixture,
        read()
      )
    ).toThrow()
  })

  function materialize() {
    return materializeCurrentFormatPreparationFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture
    )
  }

  function read() {
    return readCurrentFormatPreparationFixture(
      root,
      rootFixture,
      liveFixture,
      spatialFixture,
      preparationFixture
    )
  }

  function visitCampaign(
    role: 'A' | 'B',
    work: Parameters<CampaignStore['visitCampaignDatabase']>[1]
  ): void {
    const campaigns = new CampaignStore(root)
    try {
      const sourceId = rootFixture.campaigns.find(
        (campaign) => campaign.role === role
      )!.bundle.source.id
      const campaign = campaigns.campaignImportRepository().previous(sourceId)!
      campaigns.visitCampaignDatabase(campaign.campaignId, work)
    } finally {
      campaigns.close()
    }
  }
})

type DeepMutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T[Key] extends object
      ? DeepMutable<T[Key]>
      : T[Key]
}
