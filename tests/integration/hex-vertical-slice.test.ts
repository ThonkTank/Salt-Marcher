import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { chunkKeyFor, HexMapService } from '../../src/core/hex/hex-map-store.js'
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
  const database = () => campaigns.activeCampaignDatabase()
  let now = 1_000
  return {
    campaigns,
    play: new LivePlayService(database),
    locations: new WorldLocationService(database),
    maps: new HexMapService(database),
    travel: new HexTravelService(database, () => now),
    advance(milliseconds: number) {
      now += milliseconds
    },
    database
  }
}

describe('chunked hex editor to session travel vertical slice', () => {
  it('persists sparse terrain and placements with independent revisions', () => {
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
    const map = maps.create('Küste', maps.catalog().revision)
    const painted = maps.paint({
      mapId: map.id,
      coordinate: { q: 1, r: 0 },
      terrainId: 'forest',
      expectedChunkRevision: 0
    })
    expect(painted).toMatchObject({
      key: { q: 0, r: 0 },
      revision: 1,
      terrainOverrides: [{ q: 1, r: 0, terrainId: 'forest' }]
    })

    const afterPaint = maps.catalog().maps.find((entry) => entry.id === map.id)!
    maps.placeLocation({
      mapId: map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: afterPaint.contentRevision
    })
    const reopened = maps.readChunks(map.id, [{ q: 0, r: 0 }])
    expect(reopened.chunks[0]).toMatchObject({
      revision: 2,
      locations: [{ displayName: 'Salzhafen', q: 0, r: 0 }]
    })
    expect(reopened.map.metadataRevision).toBe(0)
    expect(reopened.map.contentRevision).toBe(2)
  })

  it('uses mathematical floor chunking for far positive and negative coordinates', () => {
    const h = harness()
    const map = h.maps.create('Unendliche Wildnis', h.maps.catalog().revision)
    expect(chunkKeyFor({ q: -1, r: -32 })).toEqual({ q: -1, r: -1 })
    expect(chunkKeyFor({ q: -33, r: 31 })).toEqual({ q: -2, r: 0 })

    const far = { q: 100_000, r: -100_000 }
    const key = chunkKeyFor(far)
    h.maps.paint({
      mapId: map.id,
      coordinate: far,
      terrainId: 'mountain',
      expectedChunkRevision: 0
    })
    expect(h.maps.readChunks(map.id, [key]).chunks[0]).toMatchObject({
      key,
      terrainOverrides: [{ ...far, terrainId: 'mountain' }]
    })
    expect(
      h.maps.readChunks(map.id, [{ q: 0, r: 0 }]).chunks[0]?.terrainOverrides
    ).toEqual([])
  })

  it('reconciles elapsed travel without mutating a read', () => {
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
    const map = h.maps.create('Marschland', h.maps.catalog().revision)
    h.maps.placeLocation({
      mapId: map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: map.contentRevision
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
    const travelling = h.travel.start({
      sceneId,
      mapId: map.id,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 1,
      expectedRevision: ready.revision
    })
    h.advance(1_001)
    expect(h.travel.read(sceneId)).toEqual(travelling)
    expect(h.travel.tick().changed.at(-1)).toMatchObject({
      status: 'completed',
      current: { q: 1, r: 0 },
      gameTimeSeconds: 32_400
    })
  })

  it('loads 8,192 visible rows from a 100,000-coordinate authored map', () => {
    const h = harness()
    const map = h.maps.create('Lastprofil', h.maps.catalog().revision)
    const db = h.database()
    const insert = db.prepare(
      `INSERT INTO hex_terrain
       (map_id, chunk_q, chunk_r, q, r, terrain_id)
       VALUES (?, ?, ?, ?, ?, 'forest')`
    )
    db.transaction(() => {
      for (let q = 0; q < 400; q += 1)
        for (let r = 0; r < 250; r += 1)
          insert.run(map.id, Math.floor(q / 32), Math.floor(r / 32), q, r)
      db.prepare(
        `INSERT INTO hex_chunk_revision (map_id, chunk_q, chunk_r, revision)
         SELECT map_id, chunk_q, chunk_r, 1 FROM hex_terrain
         WHERE map_id = ? GROUP BY map_id, chunk_q, chunk_r`
      ).run(map.id)
      db.prepare('UPDATE hex_map SET content_revision = 1 WHERE id = ?').run(
        map.id
      )
    })()
    const keys = Array.from({ length: 8 }, (_, q) => ({ q, r: 0 }))
    const coldStarted = performance.now()
    const cold = h.maps.readChunks(map.id, keys)
    const coldMs = performance.now() - coldStarted
    const warmStarted = performance.now()
    const warm = h.maps.readChunks(map.id, keys)
    const warmMs = performance.now() - warmStarted

    expect(
      cold.chunks.reduce(
        (count, chunk) => count + chunk.terrainOverrides.length,
        0
      )
    ).toBe(8_192)
    expect(warm).toEqual(cold)
    expect(coldMs).toBeLessThan(1_000)
    expect(warmMs).toBeLessThan(1_000)
  })
})
