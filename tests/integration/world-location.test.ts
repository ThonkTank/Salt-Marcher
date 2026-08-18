import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import {
  WorldLocationService,
  WorldLocationStore
} from '../../src/core/worldplanner/location-store.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-locations-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Locations')
  return {
    campaigns,
    play: new LivePlayService(campaigns.activeCampaignPersistence()),
    locations: new WorldLocationService(campaigns.activeCampaignPersistence())
  }
}

describe('world locations', () => {
  it('returns the exact created entity with the next aggregate snapshot', () => {
    const { campaigns, locations } = harness()
    const result = locations.create(
      {
        displayName: 'Exakter Ort',
        tags: ['Ruine', 'Küste'],
        readAloud: 'Salz liegt in der Luft.',
        notes: 'Nur für die Spielleitung.',
        factionIds: [],
        encounterTableIds: []
      },
      0
    )
    expect(result.saved.displayName).toBe('Exakter Ort')
    expect(result.saved.tags).toEqual(['Ruine', 'Küste'])
    expect(result.saved.readAloud).toBe('Salz liegt in der Luft.')
    expect(result.saved.notes).toBe('Nur für die Spielleitung.')
    expect(result.snapshot.revision).toBe(1)
    expect(result.snapshot.locations).toContainEqual(result.saved)
    campaigns.close()
  })

  it('creates, updates, deletes and revision-checks independent namesakes', () => {
    const { campaigns, locations } = harness()
    let snapshot = locations.read()
    snapshot = locations.create(
      { displayName: 'Saltmarsh', tags: ['Hafen'], notes: 'Harbour town' },
      snapshot.revision
    ).snapshot
    const first = snapshot.locations[0]
    snapshot = locations.create(
      {
        displayName: 'Saltmarsh',
        tags: ['Namensvetter'],
        notes: 'Independent namesake'
      },
      snapshot.revision
    ).snapshot
    expect(snapshot.locations).toHaveLength(2)
    expect(
      new Set(snapshot.locations.map((location) => location.id)).size
    ).toBe(2)
    expect(() =>
      locations.update(
        first?.id ?? '',
        { displayName: 'Stale', tags: ['Ort'], notes: '' },
        0
      )
    ).toThrow('stale')
    snapshot = locations.update(
      first?.id ?? '',
      {
        displayName: 'New Saltmarsh',
        tags: ['Küste', 'Hafen', 'Markt'],
        notes: 'Updated'
      },
      snapshot.revision
    ).snapshot
    expect(snapshot.locations[0]).toMatchObject({
      displayName: 'New Saltmarsh',
      tags: ['Küste', 'Hafen', 'Markt'],
      notes: 'Updated'
    })
    const database = activeCampaignDatabase(campaigns)
    expect(
      database
        .prepare(
          'SELECT canonical_value AS canonical, display_value AS display, position FROM worldplanner_location_tag WHERE location_id = ? ORDER BY position'
        )
        .all(first?.id ?? '')
    ).toEqual([
      { canonical: 'küste', display: 'Küste', position: 0 },
      { canonical: 'hafen', display: 'Hafen', position: 1 },
      { canonical: 'markt', display: 'Markt', position: 2 }
    ])
    snapshot = locations.delete(first?.id ?? '', snapshot.revision).snapshot
    expect(snapshot.locations).toHaveLength(1)
    expect(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM worldplanner_location_tag WHERE location_id = ?'
        )
        .get(first?.id ?? '')
    ).toEqual({ count: 0 })
    campaigns.close()
  })

  it('suggests a bounded, canonicalized tag vocabulary from relational rows', () => {
    const { campaigns, locations } = harness()
    const snapshot = locations.create(
      {
        displayName: 'Erster Ort',
        tags: ['Küste', 'Ruine', '100% sicher'],
        notes: ''
      },
      0
    ).snapshot
    locations.create(
      {
        displayName: 'Zweiter Ort',
        tags: ['KÜSTE', 'Hafen'],
        notes: ''
      },
      snapshot.revision
    )

    expect(locations.suggestTags('üs')).toEqual(['Küste'])
    expect(locations.suggestTags('%')).toEqual(['100% sicher'])
    expect(locations.suggestTags('', 2)).toEqual(['Küste', 'Ruine'])
    campaigns.close()
  })

  it('persists choices and preserves a deleted scene reference as unresolved', () => {
    const { campaigns, locations, play } = harness()
    let world = locations.read()
    world = locations.create(
      {
        displayName: 'The Docks',
        tags: ['Hafen'],
        notes: 'Fog and warehouses'
      },
      world.revision
    ).snapshot
    const locationId = world.locations[0]?.id ?? ''
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.setSceneLocation(sceneId, locationId, session.scene.revision)
    expect(session.scene.scenes[0]).toMatchObject({
      locationId,
      locationName: 'The Docks'
    })
    expect(session.scene.locationChoices).toEqual([
      { id: locationId, displayName: 'The Docks' }
    ])

    locations.delete(locationId, world.revision)
    session = play.readSession()
    expect(session.scene.scenes[0]).toMatchObject({
      locationId,
      locationName: 'Nicht verfügbarer Ort'
    })
    expect(session.scene.locationChoices).toEqual([])
    session = play.setSceneLocation(sceneId, null, session.scene.revision)
    expect(session.scene.scenes[0]).toMatchObject({
      locationId: null,
      locationName: ''
    })
    campaigns.close()
  })

  it('resumes the exact location state after reopening the campaign', () => {
    const { campaigns, locations } = harness()
    const expected = locations.create(
      {
        displayName: 'Abbey Isle',
        tags: ['Ruine'],
        readAloud: 'Eine verfallene Abtei erhebt sich aus dem Nebel.',
        notes: 'Ruined cloister'
      },
      locations.read().revision
    ).snapshot
    const root = roots[0] ?? ''
    campaigns.close()

    const reopened = new CampaignStore(root)
    const resumed = new WorldLocationService(
      reopened.activeCampaignPersistence()
    ).read()
    reopened.close()
    expect(resumed).toEqual(expected)
  })

  it('bulk-reads catalog data and presentation with a constant query count', () => {
    const { campaigns, locations } = harness()
    let snapshot = locations.read()
    for (let index = 0; index < 30; index += 1)
      snapshot = locations.create(
        { displayName: `Ort ${index}`, tags: ['Ort'], notes: '' },
        snapshot.revision
      ).snapshot
    const database = activeCampaignDatabase(campaigns)
    let prepares = 0
    const counted = new Proxy(database, {
      get(target, property) {
        if (property === 'prepare')
          return (source: string) => {
            prepares += 1
            return target.prepare(source)
          }
        // The read path only uses prepare; preserve all other native members.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Reflect.get(target, property, target)
      }
    })

    const bulk = new WorldLocationStore(counted).read()
    expect(bulk.locations).toHaveLength(30)
    expect(prepares).toBe(5)
    expect(bulk.locations.every((entry) => entry.mapPresentation)).toBe(true)
    campaigns.close()
  })
})
