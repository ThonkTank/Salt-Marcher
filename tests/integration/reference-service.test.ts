import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { CreatureCatalogService } from '../../src/core/creatures/catalog.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ReferenceService } from '../../src/core/reference/reference-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'

const roots: string[] = []

afterEach(() => {
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
  return {
    campaigns,
    locations,
    sources,
    references: new ReferenceService(creatures, locations, sources, () =>
      campaigns.activeCampaignId()
    )
  }
}

describe('reference service', () => {
  it('publishes complete offline SRD concepts and rich details', () => {
    const { campaigns, references } = harness()
    const terms = new Set(references.index().terms.map((term) => term.term))
    expect(terms.has('Prone')).toBe(true)
    expect(terms.has('Magic Missile')).toBe(true)
    expect(terms.has('Dash')).toBe(true)
    expect(terms.has('Longsword')).toBe(true)
    expect(
      references.detail({ kind: 'condition', id: 'conditions:prone' }).summary
    ).toContain('movement')
    expect(
      references.detail({ kind: 'spell', id: 'spells:magic-missile' }).facts
    ).toContainEqual({ label: 'Level', value: '1' })
    expect(
      references.detail({ kind: 'creature', id: 'goblin' }).creature?.name
    ).toBe('Goblin')
    expect(
      references.detail({
        kind: 'action',
        id: 'goblin',
        sectionId: 'trait:0'
      }).title
    ).toBe('Nimble Escape')
    campaigns.close()
  })

  it('derives exact campaign terms and reflects rename and deletion revisions', () => {
    const { campaigns, locations, references } = harness()
    let world = locations.create(
      { displayName: 'Slow', notes: 'Magic Missile is forbidden here.' },
      locations.read().revision
    )
    const location = world.locations[0]!
    const before = references.index()
    const slowTargets = before.terms
      .filter((term) => term.term === 'Slow')
      .flatMap((term) =>
        term.candidates.map((candidate) => candidate.target.kind)
      )
    expect(slowTargets).toEqual(expect.arrayContaining(['spell', 'location']))
    expect(
      references.detail({ kind: 'location', id: location.id }).summary
    ).toContain('Magic Missile')

    world = locations.update(
      location.id,
      { displayName: 'The Quiet Keep', notes: location.notes },
      world.revision
    )
    const renamed = references.index()
    expect(renamed.revision).not.toBe(before.revision)
    expect(renamed.terms.some((term) => term.term === 'The Quiet Keep')).toBe(
      true
    )
    world = locations.delete(location.id, world.revision)
    expect(
      references.index().terms.some((term) => term.term === 'The Quiet Keep')
    ).toBe(false)
    expect(() =>
      references.detail({ kind: 'location', id: location.id })
    ).toThrow('not_found')
    expect(world.locations).toHaveLength(0)
    campaigns.close()
  })
})
