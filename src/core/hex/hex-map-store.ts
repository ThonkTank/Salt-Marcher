import Database from 'better-sqlite3'
import { z } from 'zod'
import {
  axialCoordinateSchema,
  createHexMapInputSchema,
  hexMapCatalogSnapshotSchema,
  hexMapSnapshotSchema,
  hexMapSummarySchema,
  hexTerrainIdSchema,
  paintHexTerrainInputSchema,
  placeHexLocationInputSchema,
  removeHexLocationInputSchema,
  updateHexMapInputSchema,
  type AxialCoordinate,
  type HexMapCatalogSnapshot,
  type HexMapSnapshot
} from '../../shared/contracts/hex.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { initializeWorldLocationSchema } from '../worldplanner/location-store.js'
import { initializePartySchema } from '../party/party-store.js'

export function initializeHexSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hex_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS hex_map (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      radius INTEGER NOT NULL CHECK(radius BETWEEN 0 AND 99),
      revision INTEGER NOT NULL CHECK(revision >= 0),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS hex_terrain (
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      terrain_id TEXT NOT NULL,
      PRIMARY KEY(map_id, q, r)
    );
    CREATE TABLE IF NOT EXISTS hex_location_placement (
      location_id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      UNIQUE(map_id, q, r)
    );
    CREATE TABLE IF NOT EXISTS hex_journey (
      scene_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      path_json TEXT NOT NULL,
      current_index INTEGER NOT NULL CHECK(current_index >= 0),
      party_member_ids_json TEXT NOT NULL,
      multiplier INTEGER NOT NULL CHECK(multiplier IN (1, 2, 5, 10)),
      segment_started_at INTEGER,
      hint TEXT NOT NULL
    );
  `)
  db.prepare(
    'INSERT OR IGNORE INTO hex_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export function tileId(coordinate: AxialCoordinate): string {
  return `${coordinate.q}:${coordinate.r}`
}

export function parseTileId(value: string): AxialCoordinate | null {
  const match = /^(-?\d+):(-?\d+)$/.exec(value)
  if (!match) return null
  return axialCoordinateSchema.parse({
    q: Number(match[1]),
    r: Number(match[2])
  })
}

export function tileLabel(coordinate: AxialCoordinate): string {
  return `Hex q=${coordinate.q}, r=${coordinate.r}`
}

export function insideRadius(coordinate: AxialCoordinate, radius: number) {
  return (
    Math.max(
      Math.abs(coordinate.q),
      Math.abs(coordinate.r),
      Math.abs(-coordinate.q - coordinate.r)
    ) <= radius
  )
}

export function coordinates(radius: number): readonly AxialCoordinate[] {
  const result: AxialCoordinate[] = []
  for (let q = -radius; q <= radius; q += 1) {
    const minR = Math.max(-radius, -q - radius)
    const maxR = Math.min(radius, -q + radius)
    for (let r = minR; r <= maxR; r += 1)
      result.push({ q: Object.is(q, -0) ? 0 : q, r: Object.is(r, -0) ? 0 : r })
  }
  return result
}

export class HexMapService {
  constructor(private readonly campaignPath: () => string) {}

  catalog(): HexMapCatalogSnapshot {
    return this.withStore((store) => store.catalog())
  }

  read(mapId: string): HexMapSnapshot {
    return this.withStore((store) => store.read(mapId))
  }

  create(displayName: string, expectedCatalogRevision: number) {
    const input = createHexMapInputSchema.parse({
      displayName,
      expectedCatalogRevision
    })
    return this.withStore((store) => store.create(input))
  }

  update(input: unknown) {
    const parsed = updateHexMapInputSchema.parse(input)
    return this.withStore((store) => store.update(parsed))
  }

  paint(input: unknown) {
    const parsed = paintHexTerrainInputSchema.parse(input)
    return this.withStore((store) => store.paint(parsed))
  }

  placeLocation(input: unknown) {
    const parsed = placeHexLocationInputSchema.parse(input)
    return this.withStore((store) => store.placeLocation(parsed))
  }

  removeLocation(input: unknown) {
    const parsed = removeHexLocationInputSchema.parse(input)
    return this.withStore((store) => store.removeLocation(parsed))
  }

  private withStore<T>(work: (store: HexMapStore) => T): T {
    const db = new Database(this.campaignPath())
    db.pragma('foreign_keys = ON')
    try {
      initializeHexSchema(db)
      initializeWorldLocationSchema(db)
      initializePartySchema(db)
      return work(new HexMapStore(db))
    } finally {
      db.close()
    }
  }
}

export class HexMapStore {
  constructor(private readonly db: Database.Database) {}

  catalog(): HexMapCatalogSnapshot {
    const revision = (
      this.db
        .prepare('SELECT revision FROM hex_metadata WHERE singleton = 1')
        .get() as { revision: number }
    ).revision
    const maps = this.db
      .prepare(
        'SELECT id, display_name AS displayName, radius, revision, position FROM hex_map ORDER BY position, id'
      )
      .all()
    return hexMapCatalogSnapshotSchema.parse({ revision, maps })
  }

  read(mapId: string): HexMapSnapshot {
    const map = this.map(mapId)
    const terrainRows = this.db
      .prepare(
        'SELECT q, r, terrain_id AS terrainId FROM hex_terrain WHERE map_id = ?'
      )
      .all(mapId) as Array<{ q: number; r: number; terrainId: string }>
    const terrain = new Map(
      terrainRows.map((row) => [
        tileId(row),
        hexTerrainIdSchema.parse(row.terrainId)
      ])
    )
    const placementRows = this.db
      .prepare(
        `SELECT p.location_id AS locationId, p.q, p.r,
                l.display_name AS displayName
         FROM hex_location_placement p
         LEFT JOIN worldplanner_location l ON l.id = p.location_id
         WHERE p.map_id = ?`
      )
      .all(mapId) as Array<{
      locationId: string
      q: number
      r: number
      displayName: string | null
    }>
    const placements = new Map(placementRows.map((row) => [tileId(row), row]))
    return hexMapSnapshotSchema.parse({
      map,
      tiles: coordinates(map.radius).map((coordinate) => {
        const placement = placements.get(tileId(coordinate))
        return {
          ...coordinate,
          id: tileId(coordinate),
          label: tileLabel(coordinate),
          terrainId: terrain.get(tileId(coordinate)) ?? 'grassland',
          location: placement
            ? {
                locationId: placement.locationId,
                displayName: placement.displayName ?? 'Nicht verfügbarer Ort',
                q: placement.q,
                r: placement.r
              }
            : null
        }
      })
    })
  }

  create(input: z.infer<typeof createHexMapInputSchema>) {
    return this.db.transaction(() => {
      this.assertCatalogRevision(input.expectedCatalogRevision)
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM hex_map'
          )
          .get() as { value: number }
      ).value
      const id = uuidv7()
      this.db
        .prepare(
          'INSERT INTO hex_map (id, display_name, radius, revision, position) VALUES (?, ?, 2, 0, ?)'
        )
        .run(id, input.displayName, position)
      this.bumpCatalog()
      return this.read(id)
    })()
  }

  update(input: z.infer<typeof updateHexMapInputSchema>) {
    return this.db.transaction(() => {
      const current = this.map(input.mapId)
      if (current.revision !== input.expectedRevision) throw new Error('stale')
      if (input.radius < current.radius) {
        const authored = this.db
          .prepare(
            `SELECT 1 FROM (
              SELECT q, r FROM hex_terrain WHERE map_id = ?
              UNION ALL
              SELECT q, r FROM hex_location_placement WHERE map_id = ?
            ) WHERE max(abs(q), abs(r), abs(-q-r)) > ? LIMIT 1`
          )
          .get(input.mapId, input.mapId, input.radius)
        if (authored && !input.confirmDataLoss)
          throw new Error('confirmation required')
        const occupied = this.db
          .prepare(
            `SELECT 1 FROM player_characters
             WHERE travel_map_id = ? AND attached_to_party_token = 1
               AND max(abs(CAST(substr(travel_tile_id, 1, instr(travel_tile_id, ':') - 1) AS INTEGER)),
                       abs(CAST(substr(travel_tile_id, instr(travel_tile_id, ':') + 1) AS INTEGER)),
                       abs(-CAST(substr(travel_tile_id, 1, instr(travel_tile_id, ':') - 1) AS INTEGER)
                           -CAST(substr(travel_tile_id, instr(travel_tile_id, ':') + 1) AS INTEGER))) > ?
             LIMIT 1`
          )
          .get(input.mapId, input.radius)
        if (occupied) throw new Error('party outside radius')
        this.db
          .prepare(
            'DELETE FROM hex_terrain WHERE map_id = ? AND max(abs(q), abs(r), abs(-q-r)) > ?'
          )
          .run(input.mapId, input.radius)
        this.db
          .prepare(
            'DELETE FROM hex_location_placement WHERE map_id = ? AND max(abs(q), abs(r), abs(-q-r)) > ?'
          )
          .run(input.mapId, input.radius)
      }
      this.db
        .prepare(
          'UPDATE hex_map SET display_name = ?, radius = ?, revision = revision + 1 WHERE id = ?'
        )
        .run(input.displayName, input.radius, input.mapId)
      this.bumpCatalog()
      return this.read(input.mapId)
    })()
  }

  paint(input: z.infer<typeof paintHexTerrainInputSchema>) {
    return this.db.transaction(() => {
      this.assertMapCoordinate(
        input.mapId,
        input.coordinate,
        input.expectedRevision
      )
      if (input.terrainId === 'grassland')
        this.db
          .prepare(
            'DELETE FROM hex_terrain WHERE map_id = ? AND q = ? AND r = ?'
          )
          .run(input.mapId, input.coordinate.q, input.coordinate.r)
      else
        this.db
          .prepare(
            `INSERT INTO hex_terrain (map_id, q, r, terrain_id) VALUES (?, ?, ?, ?)
             ON CONFLICT(map_id, q, r) DO UPDATE SET terrain_id = excluded.terrain_id`
          )
          .run(
            input.mapId,
            input.coordinate.q,
            input.coordinate.r,
            input.terrainId
          )
      this.bumpMap(input.mapId)
      return this.read(input.mapId)
    })()
  }

  placeLocation(input: z.infer<typeof placeHexLocationInputSchema>) {
    return this.db.transaction(() => {
      this.assertMapCoordinate(
        input.mapId,
        input.coordinate,
        input.expectedRevision
      )
      const exists = this.db
        .prepare('SELECT 1 FROM worldplanner_location WHERE id = ?')
        .get(input.locationId)
      if (!exists) throw new Error('not found')
      this.db
        .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
        .run(input.locationId)
      this.db
        .prepare(
          'INSERT INTO hex_location_placement (location_id, map_id, q, r) VALUES (?, ?, ?, ?)'
        )
        .run(
          input.locationId,
          input.mapId,
          input.coordinate.q,
          input.coordinate.r
        )
      this.bumpMap(input.mapId)
      return this.read(input.mapId)
    })()
  }

  removeLocation(input: z.infer<typeof removeHexLocationInputSchema>) {
    return this.db.transaction(() => {
      const placement = this.db
        .prepare(
          'SELECT map_id AS mapId FROM hex_location_placement WHERE location_id = ?'
        )
        .get(input.locationId) as { mapId: string } | undefined
      if (!placement) throw new Error('not found')
      const map = this.map(placement.mapId)
      if (map.revision !== input.expectedMapRevision) throw new Error('stale')
      this.db
        .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
        .run(input.locationId)
      this.bumpMap(placement.mapId)
      return this.read(placement.mapId)
    })()
  }

  private map(id: string): z.infer<typeof hexMapSummarySchema> {
    const row = this.db
      .prepare(
        'SELECT id, display_name AS displayName, radius, revision, position FROM hex_map WHERE id = ?'
      )
      .get(id)
    if (!row) throw new Error('not found')
    return hexMapSummarySchema.parse(row)
  }

  private assertMapCoordinate(
    mapId: string,
    coordinate: AxialCoordinate,
    expectedRevision: number
  ) {
    const map = this.map(mapId)
    if (map.revision !== expectedRevision) throw new Error('stale')
    if (!insideRadius(coordinate, map.radius))
      throw new Error('validation failed')
  }

  private assertCatalogRevision(expected: number) {
    if (this.catalog().revision !== expected) throw new Error('stale')
  }

  private bumpMap(mapId: string) {
    this.db
      .prepare('UPDATE hex_map SET revision = revision + 1 WHERE id = ?')
      .run(mapId)
    this.bumpCatalog()
  }

  private bumpCatalog() {
    this.db
      .prepare(
        'UPDATE hex_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}
