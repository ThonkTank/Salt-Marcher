import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { chunkKeyFor, HexMapService } from '../../src/core/hex/hex-map-store.js'
import { HexMapEditingCommandHandler } from '../../src/core/application/hex-map-editing.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'
import { HexTravelStore } from '../../src/core/hex/hex-travel.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { HexEditJournalStore } from '../../src/core/hex/hex-edit-journal-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'

const roots: string[] = []
const campaignStores: CampaignStore[] = []
afterEach(() => {
  for (const campaigns of campaignStores.splice(0)) campaigns.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-hex-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaignStores.push(campaigns)
  campaigns.create('Hex campaign')
  const database = () => campaigns.activeCampaignDatabase()
  let now = 1_000
  const editing = new HexMapEditingCommandHandler(() => {
    const db = database()
    const locationStore = new WorldLocationStore(db)
    const maps = new HexMapStore(db, locationStore)
    const party = new PartyStore(db)
    const scenes = new SceneStore(db, () => locationStore.read().locations)
    return {
      unitOfWork: new CampaignUnitOfWork(db),
      maps,
      party,
      travel: new HexTravelStore(db, maps, party, scenes, () => now),
      journal: new HexEditJournalStore(db)
    }
  })
  return {
    campaigns,
    play: new LivePlayService(database),
    locations: new WorldLocationService(database),
    maps: new HexMapService(database),
    editing,
    travel: new HexTravelService(database, () => now),
    advance(milliseconds: number) {
      now += milliseconds
    },
    database
  }
}

describe('chunked hex editor to session travel vertical slice', () => {
  it('persists sparse biome and placements with independent revisions', () => {
    const { locations, maps, editing } = harness()
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
    const painted = editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'forest',
      path: [{ q: 1, r: 0 }],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    expect(painted).toMatchObject({
      status: 'applied',
      maps: [{ id: map.id, contentRevision: 1 }],
      changedChunks: [{ mapId: map.id, key: { q: 0, r: 0 }, revision: 1 }]
    })
    expect(maps.readChunks(map.id, [{ q: 0, r: 0 }]).chunks[0]).toMatchObject({
      authoredTiles: [{ q: 1, r: 0, biomeId: 'forest' }]
    })

    const afterPaint = maps.catalog().maps.find((entry) => entry.id === map.id)!
    maps.placeLocation({
      mapId: map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 1, r: 0 },
      expectedContentRevision: afterPaint.contentRevision
    })
    const reopened = maps.readChunks(map.id, [{ q: 0, r: 0 }])
    expect(reopened.chunks[0]).toMatchObject({
      revision: 2,
      locations: [{ displayName: 'Salzhafen', q: 1, r: 0 }]
    })
    expect(reopened.map.metadataRevision).toBe(0)
    expect(reopened.map.contentRevision).toBe(2)

    const catalogRevision = locations.read().revision
    locations.updateMapPresentation(
      world.locations[0]!.id,
      {
        titleOverride: 'Das alte Salzhafen',
        symbolId: 'settlement',
        symbolSize: 60,
        labelCurve: 12,
        labelPosition: 'above'
      },
      world.locations[0]!.mapPresentation.revision
    )
    const markerOnly = maps.readChunks(map.id, [{ q: 0, r: 0 }])
    expect(markerOnly.map.contentRevision).toBe(2)
    expect(markerOnly.chunks[0]).toMatchObject({
      revision: 2,
      locations: [
        {
          marker: {
            revision: 1,
            title: 'Das alte Salzhafen',
            symbol: { kind: 'builtin', id: 'settlement' },
            symbolSize: 60,
            labelCurve: 12,
            labelPosition: 'above'
          }
        }
      ]
    })
    expect(locations.read().revision).toBe(catalogRevision)
  })

  it('uses mathematical floor chunking for far positive and negative coordinates', () => {
    const h = harness()
    const map = h.maps.create('Unendliche Wildnis', h.maps.catalog().revision)
    expect(chunkKeyFor({ q: -1, r: -32 })).toEqual({ q: -1, r: -1 })
    expect(chunkKeyFor({ q: -33, r: 31 })).toEqual({ q: -2, r: 0 })

    const far = { q: 100_000, r: -100_000 }
    const key = chunkKeyFor(far)
    h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'mountain',
      path: [far],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    expect(h.maps.readChunks(map.id, [key]).chunks[0]).toMatchObject({
      key,
      authoredTiles: [{ ...far, biomeId: 'mountain' }]
    })
    expect(
      h.maps.readChunks(map.id, [{ q: 0, r: 0 }]).chunks[0]?.authoredTiles
    ).toEqual([])
  })

  it('keeps a persistent per-map brush history and idempotent receipts', () => {
    const h = harness()
    const map = h.maps.create('Verlauf', h.maps.catalog().revision)
    const commandId = randomUUID()
    const painted = h.editing.applyBrushStroke({
      commandId,
      mapId: map.id,
      mode: 'paint',
      biomeId: 'forest',
      path: [{ q: 2, r: -1 }],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    expect(h.editing.commandReceipt(commandId)).toEqual(painted)
    expect(h.editing.history(map.id)).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoLabel: 'paint'
    })

    const afterPaint = h.maps
      .catalog()
      .maps.find((entry) => entry.id === map.id)!
    const unchanged = h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'forest',
      path: [{ q: 2, r: -1 }],
      radius: 0,
      expectedContentRevision: afterPaint.contentRevision,
      confirmationToken: null
    })
    expect(unchanged).toMatchObject({ status: 'applied', affectedTileCount: 0 })
    expect(
      h.maps.catalog().maps.find((entry) => entry.id === map.id)!
        .contentRevision
    ).toBe(afterPaint.contentRevision)

    const undone = h.editing.undo({
      commandId: randomUUID(),
      mapId: map.id,
      expectedContentRevision: afterPaint.contentRevision,
      confirmationToken: null
    })
    expect(undone).toMatchObject({ status: 'applied' })
    expect(
      h.maps.readChunks(map.id, [{ q: 0, r: -1 }]).chunks[0]?.authoredTiles
    ).toEqual([])
    expect(h.editing.history(map.id)).toMatchObject({
      canUndo: false,
      canRedo: true
    })

    const afterUndo = h.maps
      .catalog()
      .maps.find((entry) => entry.id === map.id)!
    h.editing.redo({
      commandId: randomUUID(),
      mapId: map.id,
      expectedContentRevision: afterUndo.contentRevision,
      confirmationToken: null
    })
    expect(
      h.maps.readChunks(map.id, [{ q: 0, r: -1 }]).chunks[0]
    ).toMatchObject({
      authoredTiles: [{ q: 2, r: -1, biomeId: 'forest' }]
    })
  })

  it('undoes and redoes a location move across maps as one command', () => {
    const h = harness()
    const location = h.locations.create(
      {
        displayName: 'Wandernde Feste',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      h.locations.read().revision
    ).locations[0]!
    const first = h.maps.create('Erste Karte', h.maps.catalog().revision)
    const second = h.maps.create('Zweite Karte', h.maps.catalog().revision)
    const revision = (mapId: string) =>
      h.maps.catalog().maps.find((map) => map.id === mapId)!.contentRevision
    for (const map of [first, second])
      h.editing.applyBrushStroke({
        commandId: randomUUID(),
        mapId: map.id,
        mode: 'paint',
        biomeId: 'grassland',
        path: [{ q: 0, r: 0 }],
        radius: 0,
        expectedContentRevision: 0,
        confirmationToken: null
      })
    h.editing.placeLocation({
      commandId: randomUUID(),
      mapId: first.id,
      locationId: location.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: revision(first.id)
    })
    const moveCommandId = randomUUID()
    const moved = h.editing.placeLocation({
      commandId: moveCommandId,
      mapId: second.id,
      locationId: location.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: revision(second.id)
    })
    expect(moved.status).toBe('applied')
    if (moved.status !== 'applied') throw new Error('move failed')
    expect(moved.maps.map((map) => map.id)).toEqual(
      expect.arrayContaining([first.id, second.id])
    )
    expect(h.editing.commandReceipt(moveCommandId)).toEqual(moved)

    h.editing.undo({
      commandId: randomUUID(),
      mapId: second.id,
      expectedContentRevision: revision(second.id),
      confirmationToken: null
    })
    expect(h.maps.locateLocation(location.id)).toMatchObject({
      mapId: first.id,
      coordinate: { q: 0, r: 0 }
    })

    h.editing.redo({
      commandId: randomUUID(),
      mapId: second.id,
      expectedContentRevision: revision(second.id),
      confirmationToken: null
    })
    expect(h.maps.locateLocation(location.id)).toMatchObject({
      mapId: second.id,
      coordinate: { q: 0, r: 0 }
    })
  })

  it('retains only twenty history steps and truncates redo after a new edit', () => {
    const h = harness()
    const map = h.maps.create('Begrenzter Verlauf', h.maps.catalog().revision)
    const revision = () =>
      h.maps.catalog().maps.find((entry) => entry.id === map.id)!
        .contentRevision
    for (let q = 0; q < 21; q += 1)
      h.editing.applyBrushStroke({
        commandId: randomUUID(),
        mapId: map.id,
        mode: 'paint',
        biomeId: 'forest',
        path: [{ q, r: 0 }],
        radius: 0,
        expectedContentRevision: revision(),
        confirmationToken: null
      })
    expect(
      (
        h
          .database()
          .prepare(
            'SELECT COUNT(*) AS count FROM hex_edit_history WHERE map_id = ?'
          )
          .get(map.id) as { count: number }
      ).count
    ).toBe(20)

    h.editing.undo({
      commandId: randomUUID(),
      mapId: map.id,
      expectedContentRevision: revision(),
      confirmationToken: null
    })
    expect(h.editing.history(map.id).canRedo).toBe(true)
    h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'water',
      path: [{ q: 100, r: 0 }],
      radius: 0,
      expectedContentRevision: revision(),
      confirmationToken: null
    })
    expect(h.editing.history(map.id).canRedo).toBe(false)
    expect(
      (
        h
          .database()
          .prepare(
            'SELECT COUNT(*) AS count FROM hex_edit_history WHERE map_id = ?'
          )
          .get(map.id) as { count: number }
      ).count
    ).toBe(20)
  })

  it('confirms and cleans references before erasing occupied tiles', () => {
    const h = harness()
    const world = h.locations.create(
      {
        displayName: 'Wachturm',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      h.locations.read().revision
    )
    const map = h.maps.create('Grenzland', h.maps.catalog().revision)
    h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'grassland',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    let summary = h.maps.catalog().maps.find((entry) => entry.id === map.id)!
    h.maps.placeLocation({
      mapId: map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: summary.contentRevision
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
    const ready = h.travel.read(session.scene.focusedSceneId)
    h.travel.start({
      sceneId: session.scene.focusedSceneId,
      mapId: map.id,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 1,
      expectedRevision: ready.revision
    })

    summary = h.maps.catalog().maps.find((entry) => entry.id === map.id)!
    const preview = h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'erase',
      biomeId: null,
      path: [{ q: 0, r: 0 }],
      radius: 0,
      expectedContentRevision: summary.contentRevision,
      confirmationToken: null
    })
    expect(preview).toMatchObject({
      status: 'confirmation_required',
      impact: {
        locations: [{ displayName: 'Wachturm' }],
        journeys: [{ sceneId: session.scene.focusedSceneId }],
        partyMembers: [{ memberId }]
      }
    })
    if (preview.status !== 'confirmation_required') throw new Error('preview')

    const applied = h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'erase',
      biomeId: null,
      path: [{ q: 0, r: 0 }],
      radius: 0,
      expectedContentRevision: summary.contentRevision,
      confirmationToken: preview.confirmationToken
    })
    expect(applied).toMatchObject({ status: 'applied', affectedTileCount: 1 })
    expect(h.maps.locateLocation(world.locations[0]!.id)).toBeNull()
    expect(h.locations.read().locations).toContainEqual(
      expect.objectContaining({ id: world.locations[0]!.id })
    )
    expect(h.travel.read(session.scene.focusedSceneId)).toMatchObject({
      status: 'aborted',
      current: null,
      path: []
    })
    expect(
      h.maps.readChunks(map.id, [{ q: 0, r: 0 }]).chunks[0]!.authoredTiles
    ).toEqual([{ q: 1, r: 0, biomeId: 'grassland' }])

    const afterErase = h.maps
      .catalog()
      .maps.find((entry) => entry.id === map.id)!
    h.editing.undo({
      commandId: randomUUID(),
      mapId: map.id,
      expectedContentRevision: afterErase.contentRevision,
      confirmationToken: null
    })
    expect(h.maps.locateLocation(world.locations[0]!.id)).toMatchObject({
      mapId: map.id,
      coordinate: { q: 0, r: 0 }
    })
    expect(h.travel.read(session.scene.focusedSceneId)).toMatchObject({
      status: 'aborted',
      current: null,
      path: []
    })
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
    h.editing.applyBrushStroke({
      commandId: randomUUID(),
      mapId: map.id,
      mode: 'paint',
      biomeId: 'grassland',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      radius: 0,
      expectedContentRevision: 0,
      confirmationToken: null
    })
    const authoredMap = h.maps
      .catalog()
      .maps.find((entry) => entry.id === map.id)!
    h.maps.placeLocation({
      mapId: map.id,
      locationId: world.locations[0]!.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: authoredMap.contentRevision
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
    const insertTile = db.prepare(
      `INSERT INTO hex_tile (map_id, q, r, biome_id)
       VALUES (?, ?, ?, 'forest')`
    )
    db.transaction(() => {
      for (let q = 0; q < 400; q += 1)
        for (let r = 0; r < 250; r += 1) {
          insertTile.run(map.id, q, r)
        }
      db.prepare(
        `INSERT INTO hex_chunk_revision (map_id, chunk_q, chunk_r, revision)
         SELECT map_id, chunk_q, chunk_r, 1 FROM hex_tile
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
        (count, chunk) => count + chunk.authoredTiles.length,
        0
      )
    ).toBe(8_192)
    expect(warm).toEqual(cold)
    expect(coldMs).toBeLessThan(1_000)
    expect(warmMs).toBeLessThan(1_000)
  })
})
