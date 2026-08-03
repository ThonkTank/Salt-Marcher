import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { HexMapService } from '../../src/core/hex/hex-map-store.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-hex-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Hex campaign')
  const path = () => campaigns.activeCampaignPath()
  let now = 1_000
  return {
    campaigns,
    play: new LivePlayService(path),
    locations: new WorldLocationService(path),
    maps: new HexMapService(path),
    travel: new HexTravelService(path, () => now),
    advance(milliseconds: number) {
      now += milliseconds
    },
    path
  }
}

describe('hex editor to session travel vertical slice', () => {
  it('persists terrain and a globally unique World Planner placement', () => {
    const { locations, maps } = harness()
    const world = locations.create(
      {
        displayName: 'Salzhafen',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      locations.read().revision
    )
    let map = maps.create('Küste', maps.catalog().revision)
    map = maps.paint({
      mapId: map.map.id,
      coordinate: { q: 1, r: 0 },
      terrainId: 'forest',
      expectedRevision: map.map.revision
    })
    map = maps.placeLocation({
      mapId: map.map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedRevision: map.map.revision
    })
    expect(map.tiles.find((tile) => tile.id === '1:0')?.terrainId).toBe(
      'forest'
    )
    expect(map.tiles.find((tile) => tile.id === '0:0')?.location).toMatchObject(
      {
        displayName: 'Salzhafen'
      }
    )

    const reopened = maps.read(map.map.id)
    expect(reopened).toEqual(map)
    locations.delete(world.locations[0]!.id, world.revision)
    expect(
      maps.read(map.map.id).tiles.some((tile) => tile.location !== null)
    ).toBe(false)
  })

  it('derives the scene start, advances the token and scene clock, and pauses after restart', () => {
    const h = harness()
    const world = h.locations.create(
      {
        displayName: 'Startort',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      h.locations.read().revision
    )
    let map = h.maps.create('Marschland', h.maps.catalog().revision)
    map = h.maps.placeLocation({
      mapId: map.map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedRevision: map.map.revision
    })

    let session = h.play.readSession()
    const memberId = session.party.members[0]!.id
    h.play.setMembership(memberId, true, session.party.revision)
    session = h.play.readSession()
    session = h.play.assignScenePartyMember(
      session.scene.focusedSceneId,
      memberId,
      true,
      session.scene.revision
    )
    session = h.play.setSceneLocation(
      session.scene.focusedSceneId,
      world.locations[0]!.id,
      session.scene.revision
    )
    const sceneId = session.scene.focusedSceneId
    const ready = h.travel.read(sceneId)
    expect(ready).toMatchObject({
      status: 'ready',
      current: { q: 0, r: 0 },
      effectiveSpeedFeet: 30,
      assumedSpeedMemberNames: [session.party.members[0]!.name]
    })
    const evaluation = h.travel.evaluate({
      sceneId,
      mapId: map.map.id,
      waypoints: [{ q: 1, r: 0 }]
    })
    expect(evaluation).toMatchObject({ canStart: true, totalGameSeconds: 3600 })
    let journey = h.travel.start({
      sceneId,
      mapId: map.map.id,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 1,
      expectedRevision: ready.revision
    })
    expect(journey.status).toBe('travelling')
    h.advance(1_001)
    journey = h.travel.read(sceneId)
    expect(journey).toMatchObject({
      status: 'completed',
      current: { q: 1, r: 0 },
      gameTimeSeconds: 32_400
    })

    journey = h.travel.start({
      sceneId,
      mapId: map.map.id,
      waypoints: [{ q: 0, r: 0 }],
      multiplier: 1,
      expectedRevision: journey.revision
    })
    expect(journey.status).toBe('travelling')
    const restarted = new HexTravelService(h.path, () => 99_000).read(sceneId)
    expect(restarted).toMatchObject({
      status: 'paused',
      current: { q: 1, r: 0 }
    })
  })
})
