import type Database from "better-sqlite3";
import {
  WATER_MAX_REGION_SOURCES,
  WATER_MAX_SOURCE_BYTES,
  cloneWaterSource,
  parseWaterKey,
  validateWaterSource,
  waterBounds,
  waterKey,
  type WaterSource,
} from "../src/editor/model/water";
import type { Bounds } from "../src/editor/model/types";

interface StoredWaterHeader {
  row_id: number;
  water_id: string;
  kind: string;
  revision: number;
  bytes: number;
}

const HEADERS =
  "row_id,water_id,kind,revision,length(CAST(source_json AS BLOB)) AS bytes";

export function createWaterTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE water_sources (
      row_id INTEGER PRIMARY KEY,
      water_id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK(kind IN ('lake','river')),
      revision INTEGER NOT NULL CHECK(revision>=0),
      source_json TEXT NOT NULL CHECK(length(CAST(source_json AS BLOB))<=${WATER_MAX_SOURCE_BYTES}),
      min_x REAL NOT NULL, max_x REAL NOT NULL,
      min_y REAL NOT NULL, max_y REAL NOT NULL
    ) STRICT;
    CREATE VIRTUAL TABLE water_spatial USING rtree(row_id,min_x,max_x,min_y,max_y);
  `);
}

export function validateWaterMetadata(database: Database.Database): void {
  database
    .prepare(
      "SELECT row_id,water_id,kind,revision,source_json,min_x,max_x,min_y,max_y FROM water_sources LIMIT 0",
    )
    .all();
}

export function encodeWaterSource(source: WaterSource, key: string) {
  validateWaterSource(source);
  if (waterKey(source.id) !== key)
    throw new Error("Gewässerquelle und Schlüssel stimmen nicht überein.");
  // The shared clone has a closed, fixed field order. Property insertion order
  // and unrelated incoming fields cannot alter the replay receipt identity.
  const sourceJson = JSON.stringify(cloneWaterSource(source));
  if (Buffer.byteLength(sourceJson, "utf8") > WATER_MAX_SOURCE_BYTES)
    throw new Error("Die Gewässerquelle ist zu groß.");
  const [minX, minY, maxX, maxY] = waterBounds(source);
  return {
    id: source.id,
    kind: source.kind,
    revision: source.revision,
    sourceJson,
    minX,
    minY,
    maxX,
    maxY,
  };
}

function validateStoredHeader(row: StoredWaterHeader): void {
  if (
    !Number.isSafeInteger(row.row_id) ||
    row.row_id <= 0 ||
    typeof row.water_id !== "string" ||
    (row.kind !== "lake" && row.kind !== "river") ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    !Number.isSafeInteger(row.bytes) ||
    row.bytes <= 0 ||
    row.bytes > WATER_MAX_SOURCE_BYTES
  )
    throw new Error("Beschädigte Gewässerquelle oder ungültige Quellengröße.");
  parseWaterKey(`water:${row.water_id}`);
}

/** Check SQL byte lengths before fetching any potentially hostile JSON value. */
function sourceReader(database: Database.Database) {
  const select = database.prepare(
    "SELECT source_json FROM water_sources WHERE row_id=?",
  );
  return (row: StoredWaterHeader): WaterSource => {
    validateStoredHeader(row);
    const result = select.get(row.row_id) as
      { source_json: unknown } | undefined;
    if (
      typeof result?.source_json !== "string" ||
      Buffer.byteLength(result.source_json, "utf8") !== row.bytes
    )
      throw new Error("Beschädigte Gewässerdaten.");
    let source: WaterSource;
    try {
      source = JSON.parse(result.source_json) as WaterSource;
    } catch {
      throw new Error("Beschädigte Gewässerdaten.");
    }
    validateWaterSource(source);
    if (
      source.id !== row.water_id ||
      source.kind !== row.kind ||
      source.revision !== row.revision
    )
      throw new Error("Gewässerheader und Quelldaten stimmen nicht überein.");
    return cloneWaterSource(source);
  };
}

/** Validate bounded payloads and rebuild derived bounds only in the workcopy. */
export function rebuildWaterSpatialIndex(database: Database.Database): number {
  let count = 0;
  database.transaction(() => {
    if (
      database
        .prepare("SELECT 1 FROM water_sources WHERE row_id<=0 LIMIT 1")
        .get()
    )
      throw new Error("Beschädigte Gewässerzeilenkennung.");
    database.exec(
      "DROP TABLE IF EXISTS water_spatial; CREATE VIRTUAL TABLE water_spatial USING rtree(row_id,min_x,max_x,min_y,max_y)",
    );
    const headers = database.prepare(
      `SELECT ${HEADERS} FROM water_sources WHERE row_id>? ORDER BY row_id LIMIT 128`,
    );
    const readSource = sourceReader(database);
    const writeBounds = database.prepare(
      "UPDATE water_sources SET min_x=?,max_x=?,min_y=?,max_y=? WHERE row_id=?",
    );
    const writeSpatial = database.prepare(
      "INSERT INTO water_spatial VALUES(?,?,?,?,?)",
    );
    let lastId = 0;
    for (;;) {
      const rows = headers.all(lastId) as StoredWaterHeader[];
      if (!rows.length) break;
      for (const row of rows) {
        const source = readSource(row);
        const [minX, minY, maxX, maxY] = waterBounds(source);
        writeBounds.run(minX, maxX, minY, maxY, row.row_id);
        writeSpatial.run(row.row_id, minX, maxX, minY, maxY);
        lastId = row.row_id;
        count++;
      }
    }
  })();
  return count;
}

export function readWaterSources(
  database: Database.Database,
  bounds: Bounds,
): WaterSource[] {
  const [minX, minY, maxX, maxY] = bounds;
  const rows = database
    .prepare(
      `
    SELECT w.row_id,w.water_id,w.kind,w.revision,length(CAST(w.source_json AS BLOB)) AS bytes
    FROM water_spatial s JOIN water_sources w ON w.row_id=s.row_id
    WHERE s.min_x<@maxX AND s.max_x>@minX AND s.min_y<@maxY AND s.max_y>@minY
      AND w.min_x<@maxX AND w.max_x>@minX AND w.min_y<@maxY AND w.max_y>@minY
    LIMIT ${WATER_MAX_REGION_SOURCES + 1}
  `,
    )
    .all({ minX, minY, maxX, maxY }) as StoredWaterHeader[];
  if (rows.length > WATER_MAX_REGION_SOURCES)
    throw new Error(
      "Der Ausschnitt enthält zu viele Gewässer; bitte näher heranzoomen.",
    );
  // No SQL sort over an arbitrarily large region and no payload fetch before
  // the hard region cap. The accepted result alone is decoded and ordered.
  return rows
    .map(sourceReader(database))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function waterWriter(database: Database.Database) {
  const existing = database.prepare(
    "SELECT row_id FROM water_sources WHERE water_id=?",
  );
  const upsert = database.prepare(`
    INSERT INTO water_sources(water_id,kind,revision,source_json,min_x,max_x,min_y,max_y)
    VALUES(@id,@kind,@revision,@sourceJson,@minX,@maxX,@minY,@maxY)
    ON CONFLICT(water_id) DO UPDATE SET kind=excluded.kind,revision=excluded.revision,
      source_json=excluded.source_json,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y
  `);
  const spatial = database.prepare(
    "INSERT OR REPLACE INTO water_spatial VALUES(?,?,?,?,?)",
  );
  const removeSource = database.prepare(
    "DELETE FROM water_sources WHERE row_id=?",
  );
  const removeSpatial = database.prepare(
    "DELETE FROM water_spatial WHERE row_id=?",
  );
  return (
    key: string,
    after: ReturnType<typeof encodeWaterSource> | null,
  ): number => {
    const id = parseWaterKey(key);
    const previous = existing.get(id) as { row_id: number } | undefined;
    if (after) {
      upsert.run(after);
      const row = existing.get(id) as { row_id: number };
      spatial.run(row.row_id, after.minX, after.maxX, after.minY, after.maxY);
      return previous ? 0 : 1;
    }
    if (previous) {
      removeSpatial.run(previous.row_id);
      removeSource.run(previous.row_id);
      return -1;
    }
    return 0;
  };
}
