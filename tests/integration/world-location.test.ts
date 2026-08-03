import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'

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
  const path = () => campaigns.activeCampaignPath()
  return {
    campaigns,
    play: new LivePlayService(path),
    locations: new WorldLocationService(path)
  }
}

describe('world locations', () => {
  it('creates, updates, deletes and revision-checks independent namesakes', () => {
    const { campaigns, locations } = harness()
    let snapshot = locations.read()
    snapshot = locations.create(
      { displayName: 'Saltmarsh', notes: 'Harbour town' },
      snapshot.revision
    )
    const first = snapshot.locations[0]
    snapshot = locations.create(
      { displayName: 'Saltmarsh', notes: 'Independent namesake' },
      snapshot.revision
    )
    expect(snapshot.locations).toHaveLength(2)
    expect(
      new Set(snapshot.locations.map((location) => location.id)).size
    ).toBe(2)
    expect(() =>
      locations.update(first?.id ?? '', { displayName: 'Stale', notes: '' }, 0)
    ).toThrow('stale')
    snapshot = locations.update(
      first?.id ?? '',
      { displayName: 'New Saltmarsh', notes: 'Updated' },
      snapshot.revision
    )
    expect(snapshot.locations[0]).toMatchObject({
      displayName: 'New Saltmarsh',
      notes: 'Updated'
    })
    snapshot = locations.delete(first?.id ?? '', snapshot.revision)
    expect(snapshot.locations).toHaveLength(1)
    campaigns.close()
  })

  it('persists choices and preserves a deleted scene reference as unresolved', () => {
    const { campaigns, locations, play } = harness()
    let world = locations.read()
    world = locations.create(
      { displayName: 'The Docks', notes: 'Fog and warehouses' },
      world.revision
    )
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
      { displayName: 'Abbey Isle', notes: 'Ruined cloister' },
      locations.read().revision
    )
    const root = roots[0] ?? ''
    campaigns.close()

    const reopened = new CampaignStore(root)
    const resumed = new WorldLocationService(() =>
      reopened.activeCampaignPath()
    ).read()
    reopened.close()
    expect(resumed).toEqual(expected)
  })
})
