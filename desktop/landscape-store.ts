import type Database from "better-sqlite3";
import {
  LANDSCAPE_MAX_LEVEL,
  WORLD_LIMIT,
  LANDSCAPE_TILE_BYTES,
  LANDSCAPE_TILE_CELLS,
  landscapeCellAddress,
  landscapeTileBounds,
  landscapeTileKey,
  parseLandscapeTileKey,
  validateLandscapeTile,
  type LandscapePatch,
  type LandscapeTile,
  type LandscapeWeights,
} from "../src/editor/model";
import {
  LANDSCAPE_OVERVIEW_BYTES,
  applyLandscapeOverviewPatch,
  createLandscapeOverviewTile,
  landscapeOverviewPatchKeys,
  parseLandscapeOverviewKey,
  validateLandscapeOverviewTile,
  type LandscapeOverviewTile,
} from "../src/editor/model/landscape";

export const LANDSCAPE_OVERVIEW_ALGORITHM =
  "masked-half-open-centres128-provenance-v1";
const OVERVIEW_CACHE_TILES = 32;
const OVERVIEW_SAMPLES = 128 * 128;

export interface StoredLandscapeTile {
  level: number;
  tile_x: number;
  tile_y: number;
  revision: number;
  mask_blob: Buffer;
  values_blob: Buffer;
}

export interface StoredLandscapeOverview {
  own_blob: Buffer;
  rest_blob: Buffer;
  source_levels_blob: Buffer;
}

export interface LandscapeStoreMetrics {
  returnedLandscapeTiles: number;
  returnedLandscapeOverviewTiles: number;
  landscapeOverviewUpdatedSamples: number;
  landscapeOverviewExaminedSamples: number;
  landscapeOverviewReadBytes: number;
  landscapeOverviewWriteBytes: number;
  landscapeOverviewCachePeakBytes: number;
  landscapeOverviewSourceLookups: number;
  landscapeOverviewFineSourceLookups: number;
}

export function createLandscapeTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE landscape_tiles (
      id INTEGER PRIMARY KEY,
      level INTEGER NOT NULL CHECK(level BETWEEN 0 AND ${LANDSCAPE_MAX_LEVEL}),
      tile_x INTEGER NOT NULL, tile_y INTEGER NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      mask_blob BLOB NOT NULL CHECK(length(mask_blob) = ${LANDSCAPE_TILE_CELLS}),
      values_blob BLOB NOT NULL CHECK(length(values_blob) = ${LANDSCAPE_TILE_CELLS * 4}),
      min_x REAL NOT NULL, max_x REAL NOT NULL,
      min_y REAL NOT NULL, max_y REAL NOT NULL,
      UNIQUE(level,tile_x,tile_y)
    ) STRICT;
    CREATE VIRTUAL TABLE landscape_spatial USING rtree(id,min_x,max_x,min_y,max_y,min_level,max_level);
    CREATE TABLE landscape_overviews (
      power INTEGER NOT NULL CHECK(power BETWEEN 1 AND 24),
      tile_x INTEGER NOT NULL, tile_y INTEGER NOT NULL,
      own_blob BLOB NOT NULL CHECK(length(own_blob) = ${OVERVIEW_SAMPLES * 4}),
      rest_blob BLOB NOT NULL CHECK(length(rest_blob) = ${OVERVIEW_SAMPLES}),
      source_levels_blob BLOB NOT NULL CHECK(length(source_levels_blob) = ${OVERVIEW_SAMPLES}),
      PRIMARY KEY(power,tile_x,tile_y)
    ) STRICT;
    CREATE TABLE landscape_overview_state (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),
      algorithm TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK(sequence>=0)
    ) STRICT;
  `);
  database
    .prepare("INSERT INTO landscape_overview_state VALUES(1,?,0)")
    .run(LANDSCAPE_OVERVIEW_ALGORITHM);
}

export function validateLandscapeMetadata(
  database: Database.Database,
  sequence: number,
): void {
  const row = database
    .prepare(
      "SELECT algorithm,sequence FROM landscape_overview_state WHERE singleton=1",
    )
    .get() as { algorithm: string; sequence: number } | undefined;
  if (
    row?.algorithm !== LANDSCAPE_OVERVIEW_ALGORITHM ||
    row.sequence !== sequence
  )
    throw new Error(
      "Die numerische Landschaftsübersicht fehlt oder gehört zu einem alten Quellenstand.",
    );
  database
    .prepare(
      "SELECT power,tile_x,tile_y,own_blob,rest_blob,source_levels_blob FROM landscape_overviews LIMIT 0",
    )
    .all();
}

export function encodeLandscapeTile(tile: LandscapeTile, key: string) {
  validateLandscapeTile(tile);
  if (tile.key !== key)
    throw new Error("Landschaftsquellen und Schlüssel stimmen nicht überein.");
  const [minX, minY, maxX, maxY] = landscapeTileBounds(tile);
  return {
    level: tile.level,
    tileX: tile.tileX,
    tileY: tile.tileY,
    revision: tile.revision,
    mask: Buffer.from(tile.mask),
    values: Buffer.from(tile.values),
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function decodeLandscapeTile(row: StoredLandscapeTile): LandscapeTile {
  const tile: LandscapeTile = {
    key: landscapeTileKey(row.level, row.tile_x, row.tile_y),
    level: row.level,
    tileX: row.tile_x,
    tileY: row.tile_y,
    revision: row.revision,
    mask: new Uint8Array(row.mask_blob),
    values: new Uint8Array(row.values_blob),
  };
  validateLandscapeTile(tile);
  return tile;
}

export function decodeLandscapeOverview(
  key: string,
  row: StoredLandscapeOverview,
): LandscapeOverviewTile {
  const at = parseLandscapeOverviewKey(key);
  const tile: LandscapeOverviewTile = {
    key,
    ...at,
    own: new Uint8Array(row.own_blob),
    rest: new Uint8Array(row.rest_blob),
    sourceLevels: new Uint8Array(row.source_levels_blob),
  };
  validateLandscapeOverviewTile(tile);
  return tile;
}

/** Repair derived headers in the copied work file, never read author payloads. */
export function rebuildLandscapeSpatialIndex(
  database: Database.Database,
): Map<number, number> {
  const counts = new Map<number, number>();
  database.transaction(() => {
    if (
      database
        .prepare("SELECT 1 FROM landscape_tiles WHERE id<=0 LIMIT 1")
        .get()
    )
      throw new Error("Beschädigte Landschaftskachelkennung.");
    database.exec(
      "DROP TABLE IF EXISTS landscape_spatial; CREATE VIRTUAL TABLE landscape_spatial USING rtree(id,min_x,max_x,min_y,max_y,min_level,max_level)",
    );
    const select = database.prepare(
      "SELECT id,level,tile_x,tile_y,revision,length(mask_blob)+length(values_blob) AS bytes FROM landscape_tiles WHERE id>? ORDER BY id LIMIT 512",
    );
    const update = database.prepare(
      "UPDATE landscape_tiles SET min_x=?,max_x=?,min_y=?,max_y=? WHERE id=?",
    );
    const index = database.prepare(
      "INSERT INTO landscape_spatial VALUES(?,?,?,?,?,?,?)",
    );
    let lastId = 0;
    for (;;) {
      const rows = select.all(lastId) as {
        id: number;
        level: number;
        tile_x: number;
        tile_y: number;
        revision: number;
        bytes: number;
      }[];
      if (!rows.length) break;
      for (const row of rows) {
        const at = parseLandscapeTileKey(
          landscapeTileKey(row.level, row.tile_x, row.tile_y),
        );
        if (
          !Number.isSafeInteger(row.id) ||
          row.id <= 0 ||
          !Number.isSafeInteger(row.revision) ||
          row.revision < 0 ||
          row.bytes !== LANDSCAPE_TILE_BYTES
        )
          throw new Error("Beschädigter Landschaftskachelheader.");
        const [minX, minY, maxX, maxY] = landscapeTileBounds(at);
        if (
          minX >= WORLD_LIMIT ||
          minY >= WORLD_LIMIT ||
          maxX <= -WORLD_LIMIT ||
          maxY <= -WORLD_LIMIT
        )
          throw new Error("Landschaftskachelheader liegt außerhalb der Welt.");
        update.run(minX, maxX, minY, maxY, row.id);
        index.run(row.id, minX, maxX, minY, maxY, row.level, row.level);
        counts.set(row.level, (counts.get(row.level) ?? 0) + 1);
        lastId = row.id;
      }
    }
  })();
  return counts;
}

/** Derived provenance protects finer owners without reading their author rows. */
export function landscapeOverviewWriter(database: Database.Database) {
  const read = database.prepare(
    "SELECT own_blob,rest_blob,source_levels_blob FROM landscape_overviews WHERE power=? AND tile_x=? AND tile_y=?",
  );
  const write =
    database.prepare(`INSERT INTO landscape_overviews VALUES(?,?,?,?,?,?)
    ON CONFLICT(power,tile_x,tile_y) DO UPDATE SET own_blob=excluded.own_blob,rest_blob=excluded.rest_blob,source_levels_blob=excluded.source_levels_blob`);
  const remove = database.prepare(
    "DELETE FROM landscape_overviews WHERE power=? AND tile_x=? AND tile_y=?",
  );
  // Only one cell is fetched. Removing an owner never materializes descendants.
  const source = database.prepare(
    "SELECT substr(mask_blob,?,1) AS mask,substr(values_blob,?,4) AS weights FROM landscape_tiles WHERE level=? AND tile_x=? AND tile_y=?",
  );
  const cache = new Map<
    string,
    { tile: LandscapeOverviewTile; dirty: boolean }
  >();
  const metrics = {
    updatedSamples: 0,
    examinedSamples: 0,
    readBytes: 0,
    writeBytes: 0,
    peakBytes: 0,
    sourceLookups: 0,
    fineSourceLookups: 0,
  };
  const flush = (key: string) => {
    const entry = cache.get(key)!;
    cache.delete(key);
    if (!entry.dirty) return;
    const tile = entry.tile;
    if (tile.sourceLevels.every((level) => level === 255))
      remove.run(tile.power, tile.tileX, tile.tileY);
    else {
      write.run(
        tile.power,
        tile.tileX,
        tile.tileY,
        Buffer.from(tile.own),
        Buffer.from(tile.rest),
        Buffer.from(tile.sourceLevels),
      );
      metrics.writeBytes += LANDSCAPE_OVERVIEW_BYTES;
    }
  };
  const get = (key: string) => {
    let entry = cache.get(key);
    if (entry) {
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    }
    if (cache.size >= OVERVIEW_CACHE_TILES) flush(cache.keys().next().value!);
    const at = parseLandscapeOverviewKey(key);
    const row = read.get(at.power, at.tileX, at.tileY) as
      StoredLandscapeOverview | undefined;
    if (row) metrics.readBytes += LANDSCAPE_OVERVIEW_BYTES;
    entry = {
      tile: row
        ? decodeLandscapeOverview(key, row)
        : createLandscapeOverviewTile(at.power, at.tileX, at.tileY),
      dirty: false,
    };
    cache.set(key, entry);
    metrics.peakBytes = Math.max(
      metrics.peakBytes,
      cache.size * LANDSCAPE_OVERVIEW_BYTES,
    );
    return entry;
  };
  return {
    apply(patch: LandscapePatch) {
      const editLevel = parseLandscapeTileKey(patch.key).level;
      for (const key of landscapeOverviewPatchKeys(patch)) {
        const entry = get(key);
        const result = applyLandscapeOverviewPatch(
          entry.tile,
          patch,
          (level, x, y): LandscapeWeights | null => {
            metrics.sourceLookups++;
            if (level < editLevel) metrics.fineSourceLookups++;
            if (level <= editLevel)
              throw new Error(
                "Landschaftsübersicht darf nur gröbere Vererbung nachlesen.",
              );
            const at = landscapeCellAddress(level, x, y);
            const parsed = parseLandscapeTileKey(at.key);
            const row = source.get(
              at.index + 1,
              at.index * 4 + 1,
              level,
              parsed.tileX,
              parsed.tileY,
            ) as { mask: Buffer; weights: Buffer } | undefined;
            if (!row) return null;
            if (
              row.mask.length !== 1 ||
              row.mask[0] > 1 ||
              row.weights.length !== 4 ||
              (row.mask[0] === 0 && row.weights.some((value) => value !== 0)) ||
              [...row.weights].reduce((a, b) => a + b, 0) > 255
            )
              throw new Error("Beschädigte Landschaftsvererbung.");
            return row.mask[0] ? ([...row.weights] as LandscapeWeights) : null;
          },
        );
        entry.dirty ||= result.changedSamples > 0;
        metrics.updatedSamples += result.changedSamples;
        metrics.examinedSamples += result.examinedSamples;
      }
    },
    finish() {
      for (const key of cache.keys()) flush(key);
      return metrics;
    },
  };
}
