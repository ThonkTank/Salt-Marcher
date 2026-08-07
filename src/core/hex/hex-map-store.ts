import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { z } from 'zod'
import {
  axialCoordinateSchema,
  createHexMapStoreInputSchema,
  hexChunkKeySchema,
  hexChunkSnapshotSchema,
  hexMapCatalogSnapshotSchema,
  hexMapSummarySchema,
  hexBiomeIdSchema,
  placeHexLocationInputSchema,
  readHexChunksInputSchema,
  removeHexLocationInputSchema,
  updateHexMapStoreInputSchema,
  type AxialCoordinate,
  type HexChunkKey,
  type HexChunkSnapshot,
  type HexMapCatalogSnapshot,
  type HexMarkerPresentation
} from '../../shared/contracts/hex.js'
import {
  HEX_CHUNK_SIZE,
  hexChunkKeyFor
} from '../../shared/hex/axial-geometry.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'

export { HEX_CHUNK_SIZE }

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
    CREATE TABLE IF NOT EXISTS hex_tile (
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      biome_id TEXT NOT NULL,
      chunk_q INTEGER GENERATED ALWAYS AS
        ((q - CASE WHEN q < 0 THEN 31 ELSE 0 END) / 32) STORED,
      chunk_r INTEGER GENERATED ALWAYS AS
        ((r - CASE WHEN r < 0 THEN 31 ELSE 0 END) / 32) STORED,
      PRIMARY KEY(map_id, q, r)
    );
    CREATE INDEX IF NOT EXISTS idx_hex_tile_chunk
      ON hex_tile(map_id, chunk_q, chunk_r);
    CREATE INDEX IF NOT EXISTS idx_hex_tile_biome
      ON hex_tile(biome_id, map_id);
    CREATE TABLE IF NOT EXISTS hex_location_placement (
      location_id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      UNIQUE(map_id, q, r),
      FOREIGN KEY(map_id, q, r) REFERENCES hex_tile(map_id, q, r)
        ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS hex_journey (
      scene_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('travelling', 'paused', 'blocked', 'completed', 'aborted')),
      current_index INTEGER NOT NULL CHECK(current_index >= 0),
      party_member_ids_json TEXT NOT NULL,
      multiplier INTEGER NOT NULL CHECK(multiplier IN (1, 2, 5, 10)),
      segment_started_at INTEGER,
      abort_reason TEXT CHECK(abort_reason IS NULL OR abort_reason IN ('user', 'map-edit')),
      hint_code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hex_journey_path (
      scene_id TEXT NOT NULL REFERENCES hex_journey(scene_id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK(position >= 0),
      map_id TEXT NOT NULL,
      q INTEGER NOT NULL,
      r INTEGER NOT NULL,
      PRIMARY KEY(scene_id, position)
    );
    CREATE INDEX IF NOT EXISTS idx_hex_journey_path_tile
      ON hex_journey_path(map_id, q, r);
    CREATE TABLE IF NOT EXISTS hex_edit_history (
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      command_id TEXT NOT NULL UNIQUE,
      label_code TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      PRIMARY KEY(map_id, sequence)
    );
    CREATE TABLE IF NOT EXISTS hex_edit_history_cursor (
      map_id TEXT PRIMARY KEY NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      cursor_sequence INTEGER NOT NULL DEFAULT 0 CHECK(cursor_sequence >= 0)
    );
    CREATE TABLE IF NOT EXISTS hex_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL REFERENCES hex_map(id) ON DELETE CASCADE,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
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
  return hexChunkKeySchema.parse(hexChunkKeyFor(coordinate))
}

function uniqueChunkKeys(
  coordinates: readonly AxialCoordinate[]
): HexChunkKey[] {
  const keys = new Map<string, HexChunkKey>()
  for (const coordinate of coordinates) {
    const key = chunkKeyFor(coordinate)
    keys.set(`${key.q}:${key.r}`, key)
  }
  return [...keys.values()]
}

export class HexMapService {
  constructor(
    private readonly campaignDatabase: () => Database.Database,
    private readonly locationLookup?: (
      db: Database.Database
    ) => HexLocationLookup
  ) {}

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
    const input = createHexMapStoreInputSchema.parse({
      displayName,
      expectedCatalogRevision
    })
    return this.withStore((store) => store.create(input))
  }

  update(input: unknown) {
    return this.withStore((store) =>
      store.updateMetadata(updateHexMapStoreInputSchema.parse(input))
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

  private withStore<T>(work: (store: HexMapStore) => T): T {
    const db = this.campaignDatabase()
    const locations = this.locationLookup?.(db) ?? new WorldLocationStore(db)
    return work(new HexMapStore(db, locations))
  }
}

export interface HexLocationLookup {
  exists(id: string): boolean
  displayName(id: string): string | null
  displayNames?(ids: readonly string[]): ReadonlyMap<string, string>
  markerPresentation?(id: string): HexMarkerPresentation
}

export type HexMapTruthCell = Readonly<{
  mapId: string
  q: number
  r: number
  biomeId: z.infer<typeof hexBiomeIdSchema> | null
  locationId: string | null
}>

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

  readChunks(mapId: string, keys: readonly HexChunkKey[]) {
    const map = this.summary(mapId)
    const unique = new Map(
      keys.map((raw) => {
        const key = hexChunkKeySchema.parse(raw)
        return [`${key.q}:${key.r}`, key]
      })
    )
    if (unique.size > 64) throw new CapabilityError('validation_failed', false)
    return {
      map,
      chunks: [...unique.values()].map((key) => this.readChunk(mapId, key))
    } as const
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
    const authoredTiles = this.db
      .prepare(
        `SELECT t.q, t.r, t.biome_id AS biomeId
         FROM hex_tile t
         WHERE t.map_id = ? AND t.chunk_q = ? AND t.chunk_r = ?
         ORDER BY t.q, t.r`
      )
      .all(mapId, key.q, key.r)
    const locations = (
      this.db
        .prepare(
          `SELECT placement.location_id AS locationId,
                  placement.q, placement.r
           FROM hex_location_placement placement
           JOIN hex_tile tile
             ON tile.map_id = placement.map_id
            AND tile.q = placement.q AND tile.r = placement.r
           WHERE tile.map_id = ? AND tile.chunk_q = ? AND tile.chunk_r = ?
           ORDER BY placement.q, placement.r`
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
        'Nicht verfügbarer Ort',
      marker: this.locations.markerPresentation?.(placement.locationId) ?? {
        revision: 0,
        title:
          this.locations.displayName(placement.locationId) ??
          'Nicht verfügbarer Ort',
        symbol: { kind: 'builtin', id: 'location' },
        symbolSize: 44,
        labelCurve: 0,
        labelPosition: 'below'
      }
    }))
    return hexChunkSnapshotSchema.parse({
      key,
      revision: revision ?? 0,
      authoredTiles,
      locations
    })
  }

  create(input: z.infer<typeof createHexMapStoreInputSchema>) {
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

  updateMetadata(input: z.infer<typeof updateHexMapStoreInputSchema>) {
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

  applyBrushTargets(input: {
    mapId: string
    mode: 'paint' | 'erase'
    biomeId: z.infer<typeof hexBiomeIdSchema> | null
    coordinates: readonly AxialCoordinate[]
    expectedContentRevision: number
  }) {
    return this.db.transaction(() => {
      const map = this.summary(input.mapId)
      if (map.contentRevision !== input.expectedContentRevision)
        throw new CapabilityError('stale', true)
      const coordinates = input.coordinates
      if (coordinates.length === 0)
        return {
          catalogRevision: this.catalog().revision,
          map,
          chunks: [] as HexChunkSnapshot[]
        }
      const keys = uniqueChunkKeys(coordinates)
      if (keys.length > 64)
        throw new CapabilityError('validation_failed', false)
      const insertTile = this.db.prepare(
        `INSERT INTO hex_tile (map_id, q, r, biome_id)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(map_id, q, r) DO UPDATE SET
           biome_id = excluded.biome_id`
      )
      const deleteTile = this.db.prepare(
        'DELETE FROM hex_tile WHERE map_id = ? AND q = ? AND r = ?'
      )
      for (const coordinate of coordinates) {
        if (input.mode === 'erase') {
          deleteTile.run(input.mapId, coordinate.q, coordinate.r)
          continue
        }
        insertTile.run(input.mapId, coordinate.q, coordinate.r, input.biomeId)
      }
      for (const key of keys) this.bumpChunk(input.mapId, key)
      this.bumpContent(input.mapId)
      return {
        catalogRevision: this.catalog().revision,
        map: this.summary(input.mapId),
        chunks: keys.map((key) => this.readChunk(input.mapId, key))
      }
    })()
  }

  changedBrushTargets(input: {
    mapId: string
    mode: 'paint' | 'erase'
    biomeId: z.infer<typeof hexBiomeIdSchema> | null
    coordinates: readonly AxialCoordinate[]
  }): AxialCoordinate[] {
    this.summary(input.mapId)
    const rows = this.db
      .prepare(
        `WITH targets(q, r) AS (
           SELECT CAST(json_extract(value, '$.q') AS INTEGER),
                  CAST(json_extract(value, '$.r') AS INTEGER)
           FROM json_each(?)
         )
         SELECT targets.q, targets.r
         FROM targets
         LEFT JOIN hex_tile tile
           ON tile.map_id = ? AND tile.q = targets.q AND tile.r = targets.r
         WHERE (? = 'erase' AND tile.map_id IS NOT NULL)
            OR (? = 'paint' AND (
              tile.map_id IS NULL OR tile.biome_id <> ?
            ))`
      )
      .all(
        JSON.stringify(input.coordinates),
        input.mapId,
        input.mode,
        input.mode,
        input.biomeId
      )
    return axialCoordinateSchema.array().parse(rows)
  }

  placeLocation(input: z.infer<typeof placeHexLocationInputSchema>) {
    return this.db.transaction(() => {
      const map = this.summary(input.mapId)
      if (map.contentRevision !== input.expectedContentRevision)
        throw new CapabilityError('stale', true)
      if (!this.locations.exists(input.locationId))
        throw new CapabilityError('not_found', false)
      if (!this.tileExists(input.mapId, input.coordinate))
        throw new CapabilityError('validation_failed', false)
      const occupied = this.locationAt(input.mapId, input.coordinate)
      if (occupied && occupied.locationId !== input.locationId)
        throw new CapabilityError('validation_failed', false)
      const previous = this.placement(input.locationId)
      const changed = new Map<string, Map<string, HexChunkKey>>()
      const addChange = (changedMapId: string, key: HexChunkKey) => {
        const keys = changed.get(changedMapId) ?? new Map<string, HexChunkKey>()
        keys.set(`${key.q}:${key.r}`, key)
        changed.set(changedMapId, keys)
      }
      if (previous !== null) {
        this.db
          .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
          .run(input.locationId)
        const previousKey = chunkKeyFor(previous)
        addChange(previous.mapId, previousKey)
      }
      const key = chunkKeyFor(input.coordinate)
      this.db
        .prepare(
          `INSERT INTO hex_location_placement
           (location_id, map_id, q, r) VALUES (?, ?, ?, ?)`
        )
        .run(
          input.locationId,
          input.mapId,
          input.coordinate.q,
          input.coordinate.r
        )
      addChange(input.mapId, key)
      for (const [changedMapId, keys] of changed) {
        for (const changedKey of keys.values())
          this.bumpChunk(changedMapId, changedKey)
        this.bumpContent(changedMapId)
      }
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

  unlinkDeletedLocation(locationId: string) {
    const previous = this.placement(locationId)
    if (previous === null) return null
    const key = chunkKeyFor(previous)
    this.db
      .prepare('DELETE FROM hex_location_placement WHERE location_id = ?')
      .run(locationId)
    this.bumpChunk(previous.mapId, key)
    this.bumpContent(previous.mapId)
    return {
      map: this.summary(previous.mapId),
      chunk: this.readChunk(previous.mapId, key)
    }
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

  tileExists(mapId: string, coordinate: AxialCoordinate): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM hex_tile WHERE map_id = ? AND q = ? AND r = ?')
        .get(mapId, coordinate.q, coordinate.r) !== undefined
    )
  }

  locationImpacts(
    mapId: string,
    coordinateIds: ReadonlySet<string>
  ): Array<{
    locationId: string
    displayName: string
    q: number
    r: number
  }> {
    const targets = [...coordinateIds]
      .map(parseTileId)
      .filter(
        (coordinate): coordinate is AxialCoordinate => coordinate !== null
      )
    const rows = this.db
      .prepare(
        `WITH targets(q, r) AS (
           SELECT CAST(json_extract(value, '$.q') AS INTEGER),
                  CAST(json_extract(value, '$.r') AS INTEGER)
           FROM json_each(?)
         )
         SELECT placement.location_id AS locationId,
                placement.q, placement.r
         FROM targets
         JOIN hex_location_placement placement
           ON placement.map_id = ?
          AND placement.q = targets.q AND placement.r = targets.r
         ORDER BY placement.q, placement.r`
      )
      .all(JSON.stringify(targets), mapId) as Array<{
      locationId: string
      q: number
      r: number
    }>
    const names = this.locations.displayNames
      ? this.locations.displayNames(rows.map((row) => row.locationId))
      : new Map(
          rows.map((row) => [
            row.locationId,
            this.locations.displayName(row.locationId) ?? row.locationId
          ])
        )
    return rows.map((row) => ({
      ...row,
      displayName: names.get(row.locationId) ?? row.locationId
    }))
  }

  biomeAt(mapId: string, coordinate: AxialCoordinate) {
    this.summary(mapId)
    const row = this.db
      .prepare(
        `SELECT t.biome_id AS biomeId
         FROM hex_tile t
         WHERE t.map_id = ? AND t.q = ? AND t.r = ?`
      )
      .get(mapId, coordinate.q, coordinate.r) as { biomeId: string } | undefined
    return row ? hexBiomeIdSchema.parse(row.biomeId) : null
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

  captureTruth(
    mapId: string,
    coordinates: readonly AxialCoordinate[]
  ): HexMapTruthCell[] {
    this.summary(mapId)
    const rows = this.db
      .prepare(
        `WITH targets(q, r) AS (
           SELECT CAST(json_extract(value, '$.q') AS INTEGER),
                  CAST(json_extract(value, '$.r') AS INTEGER)
           FROM json_each(?)
         )
         SELECT targets.q, targets.r,
                CASE WHEN tile.map_id IS NULL THEN NULL
                     ELSE tile.biome_id END AS biomeId,
                placement.location_id AS locationId
         FROM targets
         LEFT JOIN hex_tile tile
           ON tile.map_id = ? AND tile.q = targets.q AND tile.r = targets.r
         LEFT JOIN hex_location_placement placement
           ON placement.map_id = tile.map_id
          AND placement.q = tile.q AND placement.r = tile.r`
      )
      .all(JSON.stringify(coordinates), mapId) as Array<{
      q: number
      r: number
      biomeId: string | null
      locationId: string | null
    }>
    return rows.map((row) => ({
      mapId,
      q: row.q,
      r: row.r,
      biomeId:
        row.biomeId === null ? null : hexBiomeIdSchema.parse(row.biomeId),
      locationId: row.locationId
    }))
  }

  restoreTruth(
    mapId: string,
    cells: readonly HexMapTruthCell[],
    expectedContentRevision: number
  ) {
    return this.db.transaction(() => {
      const map = this.summary(mapId)
      if (map.contentRevision !== expectedContentRevision)
        throw new CapabilityError('stale', true)
      const groups = new Map<string, HexMapTruthCell[]>()
      for (const cell of cells) {
        const group = groups.get(cell.mapId) ?? []
        group.push(cell)
        groups.set(cell.mapId, group)
      }
      const ownerCells = groups.get(mapId) ?? []
      if (ownerCells.length === 0 && cells.length > 0)
        throw new CapabilityError('validation_failed', false)
      const changes = [...groups].map(([changedMapId, changedCells]) => ({
        mapId: changedMapId,
        keys: uniqueChunkKeys(changedCells)
      }))
      const skippedLocationIds: string[] = []
      for (const cell of cells)
        this.db
          .prepare(
            'DELETE FROM hex_location_placement WHERE map_id = ? AND q = ? AND r = ?'
          )
          .run(cell.mapId, cell.q, cell.r)
      for (const cell of cells) {
        this.db
          .prepare('DELETE FROM hex_tile WHERE map_id = ? AND q = ? AND r = ?')
          .run(cell.mapId, cell.q, cell.r)
        if (cell.biomeId === null) continue
        this.db
          .prepare(
            `INSERT INTO hex_tile (map_id, q, r, biome_id)
             VALUES (?, ?, ?, ?)`
          )
          .run(cell.mapId, cell.q, cell.r, cell.biomeId)
        if (cell.locationId && !this.locations.exists(cell.locationId))
          skippedLocationIds.push(cell.locationId)
        if (cell.locationId && this.locations.exists(cell.locationId)) {
          const current = this.placement(cell.locationId)
          if (
            current &&
            (current.mapId !== cell.mapId ||
              current.q !== cell.q ||
              current.r !== cell.r)
          )
            throw new CapabilityError('stale', false)
          this.db
            .prepare(
              `INSERT INTO hex_location_placement
               (location_id, map_id, q, r) VALUES (?, ?, ?, ?)`
            )
            .run(cell.locationId, cell.mapId, cell.q, cell.r)
        }
      }
      for (const change of changes) {
        for (const key of change.keys) this.bumpChunk(change.mapId, key)
        if (change.keys.length > 0) this.bumpContent(change.mapId)
      }
      const ownerKeys =
        changes.find((change) => change.mapId === mapId)?.keys ?? []
      return {
        patch: {
          catalogRevision: this.catalog().revision,
          map: this.summary(mapId),
          chunks: ownerKeys.map((key) => this.readChunk(mapId, key))
        },
        changedChunks: changes.flatMap((change) =>
          change.keys.map((key) => ({ mapId: change.mapId, key }))
        ),
        skippedLocationIds: [...new Set(skippedLocationIds)]
      }
    })()
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
  }

  private bumpCatalog(): void {
    this.db
      .prepare(
        'UPDATE hex_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}
