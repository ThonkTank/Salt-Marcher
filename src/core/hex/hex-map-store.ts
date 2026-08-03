import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { z } from 'zod'
import {
  axialCoordinateSchema,
  createHexMapInputSchema,
  hexChunkKeySchema,
  hexChunkReadResultSchema,
  hexChunkSnapshotSchema,
  hexMapCatalogSnapshotSchema,
  hexMapSummarySchema,
  hexTerrainIdSchema,
  paintHexTerrainInputSchema,
  placeHexLocationInputSchema,
  readHexChunksInputSchema,
  removeHexLocationInputSchema,
  updateHexMapInputSchema,
  type AxialCoordinate,
  type HexChunkKey,
  type HexChunkReadResult,
  type HexChunkSnapshot,
  type HexMapCatalogSnapshot
} from '../../shared/contracts/hex.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'

export const HEX_CHUNK_SIZE = 32

export function initializeHexSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hex_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS hex_map (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      metadata_revision INTEGER NOT NULL CHECK(metadata_revision >= 0),
      content_revision INTEGER NOT NULL CHECK(content_revision >= 0),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS hex_chunk_revision (
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      chunk_q INTEGER NOT NULL,
      chunk_r INTEGER NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      PRIMARY KEY(map_id, chunk_q, chunk_r)
    );
    CREATE TABLE IF NOT EXISTS hex_terrain (
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      chunk_q INTEGER NOT NULL,
      chunk_r INTEGER NOT NULL,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      terrain_id TEXT NOT NULL,
      PRIMARY KEY(map_id, q, r)
    );
    CREATE INDEX IF NOT EXISTS idx_hex_terrain_chunk
      ON hex_terrain(map_id, chunk_q, chunk_r);
    CREATE TABLE IF NOT EXISTS hex_location_placement (
      location_id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      chunk_q INTEGER NOT NULL,
      chunk_r INTEGER NOT NULL,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      UNIQUE(map_id, q, r)
    );
    CREATE INDEX IF NOT EXISTS idx_hex_location_chunk
      ON hex_location_placement(map_id, chunk_q, chunk_r);
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
  const parsed = axialCoordinateSchema.safeParse({
    q: Number(match[1]),
    r: Number(match[2])
  })
  return parsed.success ? parsed.data : null
}

export function tileLabel(coordinate: AxialCoordinate): string {
  return `Hex q=${coordinate.q}, r=${coordinate.r}`
}

export function chunkKeyFor(coordinate: AxialCoordinate): HexChunkKey {
  return hexChunkKeySchema.parse({
    q: Math.floor(coordinate.q / HEX_CHUNK_SIZE),
    r: Math.floor(coordinate.r / HEX_CHUNK_SIZE)
  })
}

export class HexMapService {
  constructor(private readonly campaignDatabase: () => Database.Database) {}

  catalog(): HexMapCatalogSnapshot {
    return this.withStore((store) => store.catalog())
  }

  locateLocation(locationId: string) {
    return this.withStore((store) => store.locateLocation(locationId))
  }

  readChunks(mapId: string, keys: readonly HexChunkKey[]) {
    const input = readHexChunksInputSchema.parse({ mapId, keys })
    return this.withStore((store) => store.readChunks(input.mapId, input.keys))
  }

  create(displayName: string, expectedCatalogRevision: number) {
    const input = createHexMapInputSchema.parse({
      displayName,
      expectedCatalogRevision
    })
    return this.withStore((store) => store.create(input))
  }

  update(input: unknown) {
    return this.withStore((store) =>
      store.updateMetadata(updateHexMapInputSchema.parse(input))
    )
  }

  paint(input: unknown) {
    return this.withStore((store) =>
      store.paint(paintHexTerrainInputSchema.parse(input))
    )
  }

  placeLocation(input: unknown) {
    return this.withStore((store) =>
      store.placeLocation(placeHexLocationInputSchema.parse(input))
    )
  }

  removeLocation(input: unknown) {
    return this.withStore((store) =>
      store.removeLocation(removeHexLocationInputSchema.parse(input))
    )
  }

  unlinkDeletedLocation(locationId: string): void {
    this.withStore((store) => store.unlinkDeletedLocation(locationId))
  }

  private withStore<T>(work: (store: HexMapStore) => T): T {
    const db = this.campaignDatabase()
    const locations = new WorldLocationStore(db)
    return work(new HexMapStore(db, locations))
  }
}

export interface HexLocationLookup {
  exists(id: string): boolean
  displayName(id: string): string | null
}

export class HexMapStore {
  constructor(
    private readonly db: Database.Database,
    private readonly locations: HexLocationLookup
  ) {}

  catalog(): HexMapCatalogSnapshot {
    const revision = (
      this.db
        .prepare('SELECT revision FROM hex_metadata WHERE singleton = 1')
        .get() as { revision: number }
    ).revision
    const maps = this.db
      .prepare(
        `SELECT id, display_name AS displayName,
                metadata_revision AS metadataRevision,
                content_revision AS contentRevision, position
         FROM hex_map ORDER BY position, id`
      )
      .all()
    return hexMapCatalogSnapshotSchema.parse({ revision, maps })
  }

  locateLocation(locationId: string) {
    const row = this.db
      .prepare(
        `SELECT p.map_id AS mapId, p.q, p.r,
                m.content_revision AS contentRevision
         FROM hex_location_placement p
         JOIN hex_map m ON m.id = p.map_id
         WHERE p.location_id = ?`
      )
      .get(locationId) as
      | { mapId: string; q: number; r: number; contentRevision: number }
      | undefined
    return row
      ? {
          mapId: row.mapId,
          coordinate: axialCoordinateSchema.parse({ q: row.q, r: row.r }),
          contentRevision: row.contentRevision
        }
      : null
  }

  readChunks(mapId: string, keys: readonly HexChunkKey[]): HexChunkReadResult {
    const map = this.summary(mapId)
    const unique = new Map(
      keys.map((raw) => {
        const key = hexChunkKeySchema.parse(raw)
        return [`${key.q}:${key.r}`, key]
      })
    )
    if (unique.size > 64) throw new CapabilityError('validation_failed', false)
    return hexChunkReadResultSchema.parse({
      map,
      chunks: [...unique.values()].map((key) => this.readChunk(mapId, key))
    })
  }

  readChunk(mapId: string, rawKey: HexChunkKey): HexChunkSnapshot {
    this.summary(mapId)
    const key = hexChunkKeySchema.parse(rawKey)
    const revision = (
      this.db
        .prepare(
          `SELECT revision FROM hex_chunk_revision
           WHERE map_id = ? AND chunk_q = ? AND chunk_r = ?`
        )
        .get(mapId, key.q, key.r) as { revision: number } | undefined
    )?.revision
    const terrainOverrides = this.db
      .prepare(
        `SELECT q, r, terrain_id AS terrainId FROM hex_terrain
         WHERE map_id = ? AND chunk_q = ? AND chunk_r = ? ORDER BY q, r`
      )
      .all(mapId, key.q, key.r)
    const locations = (
      this.db
        .prepare(
          `SELECT location_id AS locationId, q, r
           FROM hex_location_placement
           WHERE map_id = ? AND chunk_q = ? AND chunk_r = ? ORDER BY q, r`
        )
        .all(mapId, key.q, key.r) as Array<{
        locationId: string
        q: number
        r: number
      }>
    ).map((placement) => ({
      ...placement,
      displayName:
        this.locations.displayName(placement.locationId) ??
        'Nicht verfügbarer Ort'
    }))
    return hexChunkSnapshotSchema.parse({
      key,
      revision: revision ?? 0,
      terrainOverrides,
      locations
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
          `INSERT INTO hex_map
           (id, display_name, metadata_revision, content_revision, position)
           VALUES (?, ?, 0, 0, ?)`
        )
        .run(id, input.displayName, position)
      this.bumpCatalog()
      return this.summary(id)
    })()
  }

  updateMetadata(input: z.infer<typeof updateHexMapInputSchema>) {
    return this.db.transaction(() => {
      const map = this.summary(input.mapId)
      if (map.metadataRevision !== input.expectedMetadataRevision)
        throw new CapabilityError('stale', true)
      this.db
        .prepare(
          `UPDATE hex_map SET display_name = ?,
           metadata_revision = metadata_revision + 1 WHERE id = ?`
        )
        .run(input.displayName, input.mapId)
      this.bumpCatalog()
      return this.summary(input.mapId)
    })()
  }

  paint(input: z.infer<typeof paintHexTerrainInputSchema>) {
    return this.db.transaction(() => {
      this.summary(input.mapId)
      const key = chunkKeyFor(input.coordinate)
      this.assertChunkRevision(input.mapId, key, input.expectedChunkRevision)
      if (input.terrainId === 'grassland')
        this.db
          .prepare(
            'DELETE FROM hex_terrain WHERE map_id = ? AND q = ? AND r = ?'
          )
          .run(input.mapId, input.coordinate.q, input.coordinate.r)
      else
        this.db
          .prepare(
            `INSERT INTO hex_terrain
             (map_id, chunk_q, chunk_r, q, r, terrain_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(map_id, q, r) DO UPDATE SET
               chunk_q = excluded.chunk_q,
               chunk_r = excluded.chunk_r,
               terrain_id = excluded.terrain_id`
          )
          .run(
            input.mapId,
            key.q,
            key.r,
            input.coordinate.q,
            input.coordinate.r,
            input.terrainId
          )
      this.bumpChunk(input.mapId, key)
      this.bumpContent(input.mapId)
      return this.readChunk(input.mapId, key)
    })()
  }

  placeLocation(input: z.infer<typeof placeHexLocationInputSchema>) {
    return this.db.transaction(() => {
      const map = this.summary(input.mapId)
      if (map.contentRevision !== input.expectedContentRevision)
        throw new CapabilityError('stale', true)
      if (!this.locations.exists(input.locationId))
        throw new CapabilityError('not_found', false)
      const previous = this.placement(input.locationId)
      if (previous !== null) {
        this.db
          .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
          .run(input.locationId)
        const previousKey = chunkKeyFor(previous)
        this.bumpChunk(previous.mapId, previousKey)
        this.bumpContent(previous.mapId)
      }
      const key = chunkKeyFor(input.coordinate)
      this.db
        .prepare(
          `INSERT INTO hex_location_placement
           (location_id, map_id, chunk_q, chunk_r, q, r)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.locationId,
          input.mapId,
          key.q,
          key.r,
          input.coordinate.q,
          input.coordinate.r
        )
      this.bumpChunk(input.mapId, key)
      this.bumpContent(input.mapId)
      return this.readChunks(input.mapId, [key])
    })()
  }

  removeLocation(input: z.infer<typeof removeHexLocationInputSchema>) {
    return this.db.transaction(() => {
      const map = this.summary(input.mapId)
      if (map.contentRevision !== input.expectedContentRevision)
        throw new CapabilityError('stale', true)
      const previous = this.placement(input.locationId)
      if (previous === null || previous.mapId !== input.mapId)
        throw new CapabilityError('not_found', false)
      const key = chunkKeyFor(previous)
      this.db
        .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
        .run(input.locationId)
      this.bumpChunk(input.mapId, key)
      this.bumpContent(input.mapId)
      return this.readChunks(input.mapId, [key])
    })()
  }

  unlinkDeletedLocation(locationId: string): void {
    const previous = this.placement(locationId)
    if (previous === null) return
    this.db
      .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
      .run(locationId)
    this.bumpChunk(previous.mapId, chunkKeyFor(previous))
    this.bumpContent(previous.mapId)
  }

  summary(id: string): z.infer<typeof hexMapSummarySchema> {
    const row = this.db
      .prepare(
        `SELECT id, display_name AS displayName,
                metadata_revision AS metadataRevision,
                content_revision AS contentRevision, position
         FROM hex_map WHERE id = ?`
      )
      .get(id)
    if (!row) throw new CapabilityError('not_found', false)
    return hexMapSummarySchema.parse(row)
  }

  terrainAt(mapId: string, coordinate: AxialCoordinate) {
    this.summary(mapId)
    const row = this.db
      .prepare(
        'SELECT terrain_id AS terrainId FROM hex_terrain WHERE map_id = ? AND q = ? AND r = ?'
      )
      .get(mapId, coordinate.q, coordinate.r) as
      { terrainId: string } | undefined
    return hexTerrainIdSchema.parse(row?.terrainId ?? 'grassland')
  }

  locationAt(mapId: string, coordinate: AxialCoordinate) {
    const row = this.db
      .prepare(
        `SELECT location_id AS locationId
         FROM hex_location_placement
         WHERE map_id = ? AND q = ? AND r = ?`
      )
      .get(mapId, coordinate.q, coordinate.r) as
      { locationId: string } | undefined
    return row
      ? {
          locationId: row.locationId,
          displayName: this.locations.displayName(row.locationId)
        }
      : null
  }

  private placement(
    locationId: string
  ): (AxialCoordinate & { mapId: string }) | null {
    const row = this.db
      .prepare(
        `SELECT map_id AS mapId, q, r FROM hex_location_placement
         WHERE location_id = ?`
      )
      .get(locationId) as { mapId: string; q: number; r: number } | undefined
    return row ? { mapId: row.mapId, q: row.q, r: row.r } : null
  }

  private assertChunkRevision(
    mapId: string,
    key: HexChunkKey,
    expected: number
  ): void {
    const actual = (
      this.db
        .prepare(
          `SELECT revision FROM hex_chunk_revision
           WHERE map_id = ? AND chunk_q = ? AND chunk_r = ?`
        )
        .get(mapId, key.q, key.r) as { revision: number } | undefined
    )?.revision
    if ((actual ?? 0) !== expected) throw new CapabilityError('stale', true)
  }

  private assertCatalogRevision(expected: number): void {
    if (this.catalog().revision !== expected)
      throw new CapabilityError('stale', true)
  }

  private bumpChunk(mapId: string, key: HexChunkKey): void {
    this.db
      .prepare(
        `INSERT INTO hex_chunk_revision (map_id, chunk_q, chunk_r, revision)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(map_id, chunk_q, chunk_r)
         DO UPDATE SET revision = revision + 1`
      )
      .run(mapId, key.q, key.r)
  }

  private bumpContent(mapId: string): void {
    this.db
      .prepare(
        'UPDATE hex_map SET content_revision = content_revision + 1 WHERE id = ?'
      )
      .run(mapId)
    this.bumpCatalog()
  }

  private bumpCatalog(): void {
    this.db
      .prepare(
        'UPDATE hex_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}
