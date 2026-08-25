import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { campaignImportExportHash } from '../../src/core/campaign-import/campaign-import-service.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import {
  loadCurrentFormatRootFixture,
  type CurrentFormatRootFixture,
  validateCurrentFormatRootFixture
} from '../../scripts/qualification/current-format-root-fixture.js'
import { materializeCurrentFormatRootFixture } from '../../scripts/qualification/current-format-root-materializer.js'
import {
  assertCurrentFormatRootReadback,
  readCurrentFormatRootFixture
} from '../../scripts/qualification/current-format-root-readback.js'

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
const fixturePath =
  'docs/project/evidence/frontend-robustness-current-format-root-fixture.v1.json'
const fixture = loadCurrentFormatRootFixture(fixturePath, manifest)

describe('FR2F2A current-format root qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2a-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('materializes A/B through import owners and independently reads exact root truth after reopen', () => {
    const receipt = materializeCurrentFormatRootFixture(root, fixture)

    expect(receipt.qualificationClaim).toBe(
      'partial-fr2f2a-root-cohort-not-complete-current-format'
    )
    expect(receipt.campaigns.map(({ role }) => role)).toEqual(['A', 'B'])
    expect(
      new Set(receipt.campaigns.map(({ campaignId }) => campaignId)).size
    ).toBe(2)

    const readback = readCurrentFormatRootFixture(root, fixture)
    expect(() =>
      assertCurrentFormatRootReadback(fixture, readback)
    ).not.toThrow()
    expect(
      readback.campaigns
        .find(({ role }) => role === 'A')
        ?.npcs.npcs.map(({ displayName, lifecycle }) => ({
          displayName,
          lifecycle
        }))
    ).toEqual([
      { displayName: 'Warden Vey', lifecycle: 'active' },
      { displayName: 'Oren', lifecycle: 'defeated' }
    ])
    expect(
      readback.campaigns.find(({ role }) => role === 'B')?.factions.factions[0]
        ?.disposition
    ).toBe(25)
  })

  it('fails closed instead of rewriting a populated installation', () => {
    materializeCurrentFormatRootFixture(root, fixture)

    expect(() => materializeCurrentFormatRootFixture(root, fixture)).toThrow(
      'requires an empty installation'
    )
  })

  it('validates both bundles before publishing Campaign A', () => {
    const raw = structuredClone(
      fixture
    ) as DeepMutable<CurrentFormatRootFixture>
    const campaignB = raw.campaigns[1]!
    campaignB.bundle.npcs[0]!.creature.resolvedId = 'missing-creature'
    campaignB.bundle.resolutions.find(
      ({ path }) => path === 'npcs.0.creature'
    )!.resolvedValue = 'missing-creature'
    campaignB.bundle.source.exportHash = campaignImportExportHash(
      campaignB.bundle
    )
    const invalid = validateCurrentFormatRootFixture(raw, manifest)

    expect(() => materializeCurrentFormatRootFixture(root, invalid)).toThrow(
      'Campaign B failed preflight: unknown_statblock'
    )
    const campaigns = new CampaignStore(root)
    try {
      expect(campaigns.list()).toEqual({
        revision: 0,
        activeCampaignId: null,
        campaigns: [],
        trashedCampaigns: []
      })
    } finally {
      campaigns.close()
    }
  })

  it('detects a public-owner mutation instead of blessing current bytes as expected truth', () => {
    materializeCurrentFormatRootFixture(root, fixture)
    const campaigns = new CampaignStore(root)
    try {
      const sourceA = fixture.campaigns[0]!.bundle.source.id
      const campaignA = campaigns.campaignImportRepository().previous(sourceA)
      expect(campaignA).not.toBeNull()
      campaigns.visitCampaignDatabase(campaignA!.campaignId, (database) => {
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
            notes: 'Changed through the owning WorldLocationStore.',
            factionIds: location.factionIds,
            encounterTableIds: location.encounterTableIds
          },
          snapshot.revision
        )
      })
    } finally {
      campaigns.close()
    }

    const changed = readCurrentFormatRootFixture(root, fixture)
    expect(() => assertCurrentFormatRootReadback(fixture, changed)).toThrow()
  })

  it('rejects coverage and export-hash drift before Campaign mutation', () => {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(() =>
      validateCurrentFormatRootFixture(
        {
          ...raw,
          coveredCampaignRegistrations: [
            'party',
            ...(raw['coveredCampaignRegistrations'] as string[]).slice(1)
          ]
        },
        manifest
      )
    ).toThrow('coverage does not match')

    const campaigns = structuredClone(raw['campaigns']) as Array<{
      bundle: { source: { exportHash: string } }
    }>
    campaigns[0]!.bundle.source.exportHash = 'f'.repeat(64)
    expect(() =>
      validateCurrentFormatRootFixture({ ...raw, campaigns }, manifest)
    ).toThrow('export hash is invalid')
  })
})

type DeepMutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T[Key] extends object
      ? DeepMutable<T[Key]>
      : T[Key]
}
