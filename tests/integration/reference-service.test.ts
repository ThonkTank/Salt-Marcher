import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import {
  CreatureCatalogService,
  creatures as creatureCatalog
} from '../../src/core/creatures/catalog.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ReferenceCatalogAdapter } from '../../src/core/reference/reference-catalog-adapter.js'
import { ReferenceService } from '../../src/core/reference/reference-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'

const roots: string[] = []
const catalogs: ReferenceCatalogAdapter[] = []

afterEach(() => {
  for (const catalog of catalogs.splice(0)) catalog.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-references-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('References')
  const database = () => campaigns.activeCampaignDatabase()
  const locations = new WorldLocationService(database)
  const sources = new EncounterSourceService(database)
  const creatures = new CreatureCatalogService(() =>
    campaigns.installationDatabase()
  )
  const catalog = new ReferenceCatalogAdapter(
    resolve('resources/reference/srd-5.1.sqlite')
  )
  catalogs.push(catalog)
  return {
    campaigns,
    locations,
    references: new ReferenceService(
      catalog,
      { all: () => creatureCatalog, detail: (id) => creatures.detail(id) },
      locations,
      { read: () => sources.readFactions() },
      { read: () => sources.readNpcs() },
      () => campaigns.activeCampaignId()
    )
  }
}

describe('reference service', () => {
  it('publishes pinned offline SRD concepts and stable creature-part targets', () => {
    const { campaigns, references } = harness()
    const index = references.staticIndex()
    const terms = new Set(index.terms.map((term) => term.term))
    expect(index.scope).toBe('static')
    expect(terms.has('Prone')).toBe(true)
    expect(terms.has('Magic Missile')).toBe(true)
    expect(terms.has('Dash')).toBe(true)
    expect(terms.has('Longsword')).toBe(true)

    const prone = references.detail({
      scope: 'srd',
      catalogId: 'srd-5.1',
      definitionKind: 'condition',
      definitionId: 'conditions:prone'
    })
    expect(prone.documentKind).toBe('article')
    expect(JSON.stringify(prone)).toContain('movement')

    const goblin = references.detail({
      scope: 'creature',
      creatureId: 'goblin'
    })
    expect(goblin.documentKind).toBe('creature')
    if (goblin.documentKind === 'creature')
      expect(goblin.creature.name).toBe('Goblin')
    expect(
      references.detail({
        scope: 'creature-part',
        creatureId: 'goblin',
        partKind: 'trait',
        partId: 'nimble-escape'
      }).title
    ).toBe('Nimble Escape')
    campaigns.close()
  })

  it('isolates exact campaign terms by explicit campaign id', () => {
    const { campaigns, locations, references } = harness()
    const world = locations.create(
      {
        displayName: 'Slow',
        tags: ['Ort'],
        notes: 'Magic Missile is forbidden here.'
      },
      locations.read().revision
    ).snapshot
    const campaignId = campaigns.activeCampaignId()
    const location = world.locations[0]!
    const before = references.campaignIndex(campaignId)
    expect(before.scope).toBe('campaign')
    expect(before.terms.find((term) => term.term === 'Slow')?.matchMode).toBe(
      'exact'
    )

    locations.update(
      location.id,
      {
        displayName: 'The Quiet Keep',
        tags: location.tags,
        notes: location.notes
      },
      world.revision
    )
    const renamed = references.campaignIndex(campaignId)
    expect(renamed.revision).not.toBe(before.revision)
    expect(renamed.terms.some((term) => term.term === 'The Quiet Keep')).toBe(
      true
    )
    expect(() => references.campaignIndex('another-campaign')).toThrow(
      'not_found'
    )
    campaigns.close()
  })
})
