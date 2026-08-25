import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createDefaultCampaignSchemaBootstrapper } from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { validateCurrentFormatCampaignManifest } from '../../scripts/qualification/current-format-campaign-manifest.js'
import { loadCurrentFormatRootFixture } from '../../scripts/qualification/current-format-root-fixture.js'
import {
  loadCurrentFormatLiveFixture,
  validateCurrentFormatLiveFixture
} from '../../scripts/qualification/current-format-live-fixture.js'
import { materializeCurrentFormatLiveFixture } from '../../scripts/qualification/current-format-live-materializer.js'
import {
  assertCurrentFormatLiveReceipt,
  assertCurrentFormatLiveReadback,
  readCurrentFormatLiveFixture
} from '../../scripts/qualification/current-format-live-readback.js'

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
const liveFixturePath =
  'docs/project/evidence/frontend-robustness-current-format-live-fixture.v1.json'
const liveFixture = loadCurrentFormatLiveFixture(
  liveFixturePath,
  manifest,
  rootFixture
)

describe('FR2F2B1 current-format Live Play qualification protocol', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'salt-marcher-fr2f2b1-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('materializes A/B through Live Play and reads complete semantic snapshots after reopen', () => {
    const receipt = materializeCurrentFormatLiveFixture(
      root,
      rootFixture,
      liveFixture
    )

    expect(receipt.qualificationClaim).toBe(
      'partial-fr2f2b1-live-cohort-not-complete-current-format'
    )
    expect(receipt.campaigns.map(({ role }) => role)).toEqual(['A', 'B'])
    expect(
      new Set(receipt.campaigns.map(({ combatId }) => combatId)).size
    ).toBe(2)

    const readback = readCurrentFormatLiveFixture(
      root,
      rootFixture,
      liveFixture
    )
    expect(() =>
      assertCurrentFormatLiveReadback(rootFixture, liveFixture, readback)
    ).not.toThrow()
    expect(() =>
      assertCurrentFormatLiveReceipt(receipt, readback)
    ).not.toThrow()
    expect(
      readback.campaigns.map(({ role, session }) => ({
        role,
        location: session.scene.scenes[0]?.locationName,
        active: session.party.members.filter(({ active }) => active).length,
        inactive: session.party.members.filter(({ active }) => !active).length,
        combat: session.combat?.phase
      }))
    ).toEqual([
      {
        role: 'A',
        location: 'Salt Harbor',
        active: 1,
        inactive: 1,
        combat: 'initiative'
      },
      {
        role: 'B',
        location: 'Moon Marsh',
        active: 1,
        inactive: 1,
        combat: 'initiative'
      }
    ])
  })

  it('rejects invalid Campaign B Live truth before publishing Campaign A', () => {
    const raw = JSON.parse(readFileSync(liveFixturePath, 'utf8')) as {
      campaigns: Array<{
        materialization: {
          groups: Array<{ entries: Array<{ creatureId: string }> }>
        }
      }>
    }
    raw.campaigns[1]!.materialization.groups[0]!.entries[0]!.creatureId =
      'missing-creature'

    expect(() =>
      validateCurrentFormatLiveFixture(raw, manifest, rootFixture)
    ).toThrow('references unknown creature')
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

  it('detects a public Live Play mutation instead of accepting changed bytes', () => {
    materializeCurrentFormatLiveFixture(root, rootFixture, liveFixture)
    const campaigns = new CampaignStore(root)
    try {
      const sourceA = rootFixture.campaigns[0]!.bundle.source.id
      const campaignA = campaigns.campaignImportRepository().previous(sourceA)
      expect(campaignA).not.toBeNull()
      campaigns.visitCampaignDatabase(campaignA!.campaignId, (database) => {
        const play = new LivePlayService(fixedSqliteDatabaseAccess(database))
        const session = play.readSession()
        const scene = session.scene.scenes.find(
          ({ id }) => id === session.scene.focusedSceneId
        )!
        const archived = scene.groups.find(({ archived }) => archived)!
        play.setSceneGroupArchived(
          scene.id,
          archived.id,
          false,
          archived.revision
        )
      })
    } finally {
      campaigns.close()
    }

    const changed = readCurrentFormatLiveFixture(root, rootFixture, liveFixture)
    expect(() =>
      assertCurrentFormatLiveReadback(rootFixture, liveFixture, changed)
    ).toThrow()
  })

  it('rejects coverage, root identity, and malformed semantic hashes before mutation', () => {
    const raw = JSON.parse(readFileSync(liveFixturePath, 'utf8')) as Record<
      string,
      unknown
    >
    expect(() =>
      validateCurrentFormatLiveFixture(
        { ...raw, coveredCampaignRegistrations: ['combat', 'scene'] },
        manifest,
        rootFixture
      )
    ).toThrow('coverage does not match')
    expect(() =>
      validateCurrentFormatLiveFixture(
        { ...raw, rootFixtureIdentity: 'stale-root' },
        manifest,
        rootFixture
      )
    ).toThrow()

    const campaigns = structuredClone(raw['campaigns']) as Array<{
      expected: { semanticSha256: string }
    }>
    campaigns[0]!.expected.semanticSha256 = 'not-a-hash'
    expect(() =>
      validateCurrentFormatLiveFixture(
        { ...raw, campaigns },
        manifest,
        rootFixture
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
