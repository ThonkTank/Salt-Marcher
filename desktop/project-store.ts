import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
} from "node:fs";
import { copyFile, open, rename, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  CommitReceipt,
  CommitRequest,
  ProjectInfo,
  ReadRegionRequest,
  ReadTilesRequest,
  RegionRead,
  SaveResult,
  SourceBoundary,
  SourceRead,
  StoreMetrics,
} from "../src/editor/bridge";
import {
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_OVERVIEW_BYTES,
  MAX_HEIGHT_OVERVIEW_POWER,
  applyPreparedHeightOverviewDelta,
  assertHeightRenderPower,
  createHeightOverviewTile,
  heightOverviewDeltaKeys,
  heightOverviewKeys,
  minimumCoarseHeightLevel,
  parseHeightOverviewKey,
  prepareHeightOverviewDelta,
  type Bounds,
  type HeightOverviewDelta,
  type HeightOverviewTile,
  type HeightPresentationRead,
  type HeightPresentationRequest,
  type HeightTile,
} from "../src/editor/model";

export const PROJECT_FORMAT = 24 as const;
export const MAX_TRANSFER_TILES = 512;
const APPLICATION_ID = 0x5341544c;
const TILE_VALUES = 64 * 64;
const TILE_BYTES = TILE_VALUES * Float64Array.BYTES_PER_ELEMENT;
const WORLD_LIMIT = 100_000_000;
const SCHEMA_KIND = "atlas-p0-height-2";
const OVERVIEW_ALGORITHM = "fine-cubic-centres-128-scale32-v1";
const OVERVIEW_CACHE_TILES = 256;

interface OverviewMetrics {
  returnedOverviewTiles: number;
  returnedOverviewBytes: number;
  overviewUpdatedSamples: number;
  overviewReadBytes: number;
  overviewWriteBytes: number;
  overviewCachePeakBytes: number;
  maxCommitMs: number;
}

interface Metadata {
  projectId: string;
  title: string;
  sequence: number;
}

interface WorkingProject extends Metadata {
  sessionId: string;
  directory: string;
  database: Database.Database;
  path: string | null;
  savedSequence: number | null;
  levelCounts: Map<number, number>;
}

interface StoredTile {
  level: number;
  tile_x: number;
  tile_y: number;
  revision: number;
  values: Buffer;
}

export interface PreparedSave extends SourceBoundary {
  token: string;
  path: string | null;
  title: string;
}

interface Snapshot extends PreparedSave {
  temporaryPath: string;
}

export interface StoreActivity extends SourceBoundary {
  kind: "snapshot" | "publish";
  phase: "start" | "end";
  token: string;
  epochMs: number;
  success?: boolean;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function finiteInteger(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

function text(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

function tileKey(level: number, tileX: number, tileY: number) {
  return `height:${level}:${tileX}:${tileY}`;
}

function coordinates(key: unknown) {
  check(text(key, 80), "Ungültiger Höhenschlüssel.");
  const match = /^height:(\d+):(-?\d+):(-?\d+)$/.exec(key);
  check(match, "Ungültiger Höhenschlüssel.");
  const [level, tileX, tileY] = match.slice(1).map(Number);
  check(finiteInteger(level, 0, 21), "Ungültige Höhenstufe.");
  const span = 320 * 2 ** level;
  const low = Math.floor(-WORLD_LIMIT / span);
  const high = Math.floor(WORLD_LIMIT / span);
  check(
    finiteInteger(tileX, low, high) && finiteInteger(tileY, low, high),
    "Höhenkachel liegt außerhalb der Welt.",
  );
  check(
    key === tileKey(level, tileX, tileY),
    "Nichtkanonischer Höhenschlüssel.",
  );
  return { level, tileX, tileY };
}

function validateBoundary(boundary: SourceBoundary) {
  check(
    boundary && text(boundary.sessionId, 100),
    "Ungültige Dokumentsitzung.",
  );
  check(
    finiteInteger(boundary.sequence, 0, Number.MAX_SAFE_INTEGER),
    "Ungültige Aktionssequenz.",
  );
}

function validateBounds(bounds: Bounds) {
  check(Array.isArray(bounds) && bounds.length === 4, "Ungültiger Ausschnitt.");
  check(
    bounds.every(
      (value) => Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT,
    ) &&
      bounds[0] < bounds[2] &&
      bounds[1] < bounds[3],
    "Ungültiger oder außerhalb der Welt liegender Ausschnitt.",
  );
}

function encodeTile(tile: HeightTile, key: string) {
  const at = coordinates(key);
  check(
    tile &&
      tile.key === key &&
      tile.level === at.level &&
      tile.tileX === at.tileX &&
      tile.tileY === at.tileY &&
      finiteInteger(tile.revision, 0, Number.MAX_SAFE_INTEGER),
    "Höhenkachel und Schlüssel stimmen nicht überein.",
  );
  check(
    tile.values instanceof Float64Array && tile.values.length === TILE_VALUES,
    "Eine Höhenkachel benötigt genau 4096 Float64-Werte.",
  );
  // The file is explicitly little endian; host endianness is not a file format.
  const buffer = Buffer.allocUnsafe(TILE_BYTES);
  for (let i = 0; i < TILE_VALUES; i++) {
    check(
      Number.isFinite(tile.values[i]),
      "Nichtendlicher relativer Höhenwert.",
    );
    buffer.writeDoubleLE(tile.values[i], i * Float64Array.BYTES_PER_ELEMENT);
  }
  const spacing = 5 * 2 ** at.level;
  const span = 64 * spacing;
  return {
    ...at,
    revision: tile.revision,
    values: buffer,
    // Conservative cubic support, rather than a huge query halo at every level.
    minX: at.tileX * span - 2 * spacing,
    maxX: (at.tileX + 1) * span + 2 * spacing,
    minY: at.tileY * span - 2 * spacing,
    maxY: (at.tileY + 1) * span + 2 * spacing,
  };
}

function decodeTile(row: StoredTile): HeightTile {
  const key = tileKey(row.level, row.tile_x, row.tile_y);
  coordinates(key);
  check(
    finiteInteger(row.revision, 0, Number.MAX_SAFE_INTEGER) &&
      Buffer.isBuffer(row.values) &&
      row.values.byteLength === TILE_BYTES,
    "Beschädigte Höhenkachel.",
  );
  const values = new Float64Array(TILE_VALUES);
  for (let i = 0; i < TILE_VALUES; i++) {
    const value = row.values.readDoubleLE(i * Float64Array.BYTES_PER_ELEMENT);
    check(
      Number.isFinite(value),
      "Beschädigte Höhenkachel: nichtendlicher Wert.",
    );
    values[i] = value;
  }
  return {
    key,
    level: row.level,
    tileX: row.tile_x,
    tileY: row.tile_y,
    revision: row.revision,
    values,
  };
}

const littleEndian = new Uint8Array(new Float64Array([1]).buffer)[7] === 63;

function encodeOverview(values: Float64Array): Buffer {
  check(
    values.byteLength === HEIGHT_OVERVIEW_BYTES,
    "Ungültige Übersichtslänge.",
  );
  if (littleEndian)
    return Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  const buffer = Buffer.allocUnsafe(values.byteLength);
  values.forEach((value, index) => buffer.writeDoubleLE(value, index * 8));
  return buffer;
}

function decodeOverview(key: string, buffer: Buffer): HeightOverviewTile {
  const at = parseHeightOverviewKey(key);
  check(
    Buffer.isBuffer(buffer) && buffer.byteLength === HEIGHT_OVERVIEW_BYTES,
    "Beschädigte numerische Höhenübersicht.",
  );
  const tile = createHeightOverviewTile(at.power, at.tileX, at.tileY);
  if (littleEndian) Buffer.from(tile.values.buffer).set(buffer);
  else
    for (let i = 0; i < tile.values.length; i++)
      tile.values[i] = buffer.readDoubleLE(i * 8);
  check(tile.values.every(Number.isFinite), "Nichtendliche Höhenübersicht.");
  return tile;
}

/** A bounded transaction-local cache; its work depends on changed authors only. */
function overviewWriter(database: Database.Database) {
  const read = database.prepare(
    "SELECT values_blob FROM height_overviews WHERE power=? AND tile_x=? AND tile_y=?",
  );
  const write = database.prepare(`
    INSERT INTO height_overviews(power,tile_x,tile_y,values_blob) VALUES(?,?,?,?)
    ON CONFLICT(power,tile_x,tile_y) DO UPDATE SET values_blob=excluded.values_blob
  `);
  const remove = database.prepare(
    "DELETE FROM height_overviews WHERE power=? AND tile_x=? AND tile_y=?",
  );
  const cache = new Map<string, { tile: HeightOverviewTile; dirty: boolean }>();
  const metrics = {
    updatedSamples: 0,
    readBytes: 0,
    writeBytes: 0,
    peakBytes: 0,
  };
  const flush = (key: string) => {
    const entry = cache.get(key)!;
    cache.delete(key);
    if (!entry.dirty) return;
    const { tile } = entry;
    if (tile.values.every((value) => value === 0))
      remove.run(tile.power, tile.tileX, tile.tileY);
    else {
      write.run(
        tile.power,
        tile.tileX,
        tile.tileY,
        encodeOverview(tile.values),
      );
      metrics.writeBytes += HEIGHT_OVERVIEW_BYTES;
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
    const at = parseHeightOverviewKey(key);
    const row = read.get(at.power, at.tileX, at.tileY) as
      { values_blob: Buffer } | undefined;
    if (row) metrics.readBytes += row.values_blob.byteLength;
    entry = {
      tile: row
        ? decodeOverview(key, row.values_blob)
        : createHeightOverviewTile(at.power, at.tileX, at.tileY),
      dirty: false,
    };
    cache.set(key, entry);
    metrics.peakBytes = Math.max(
      metrics.peakBytes,
      cache.size * HEIGHT_OVERVIEW_BYTES,
    );
    return entry;
  };
  return {
    apply(delta: HeightOverviewDelta) {
      for (
        let power = delta.level + 3;
        power <= MAX_HEIGHT_OVERVIEW_POWER;
        power++
      ) {
        for (const key of heightOverviewDeltaKeys(delta, power)) {
          const entry = get(key);
          const changed = applyPreparedHeightOverviewDelta(entry.tile, delta);
          entry.dirty ||= changed > 0;
          metrics.updatedSamples += changed;
        }
      }
    },
    finish() {
      for (const key of cache.keys()) flush(key);
      return metrics;
    },
  };
}

function configure(database: Database.Database) {
  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = FULL");
  database.pragma("foreign_keys = ON");
  database.pragma("trusted_schema = OFF");
}

function createDatabase(path: string): Database.Database {
  const database = new Database(path);
  try {
    configure(database);
    database.pragma(`application_id = ${APPLICATION_ID}`);
    database.pragma(`user_version = ${PROJECT_FORMAT}`);
    database.exec(`
      CREATE TABLE project_meta (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_kind TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence >= 0)
      ) STRICT;
      CREATE TABLE height_tiles (
        id INTEGER PRIMARY KEY,
        level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 21),
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        values_blob BLOB NOT NULL CHECK (length(values_blob) = ${TILE_BYTES}),
        min_x REAL NOT NULL, max_x REAL NOT NULL,
        min_y REAL NOT NULL, max_y REAL NOT NULL,
        UNIQUE (level, tile_x, tile_y)
      ) STRICT;
      CREATE VIRTUAL TABLE height_spatial USING rtree(id, min_x, max_x, min_y, max_y, min_level, max_level);
      CREATE TABLE height_overviews (
        power INTEGER NOT NULL CHECK(power BETWEEN 3 AND ${MAX_HEIGHT_OVERVIEW_POWER}),
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL,
        values_blob BLOB NOT NULL CHECK(length(values_blob) = ${HEIGHT_OVERVIEW_BYTES}),
        PRIMARY KEY(power,tile_x,tile_y)
      ) STRICT;
      CREATE TABLE height_overview_state (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1),
        algorithm TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK(sequence>=0)
      ) STRICT;
      CREATE TABLE transaction_receipts (
        sequence INTEGER PRIMARY KEY,
        transaction_id TEXT NOT NULL UNIQUE,
        payload_hash TEXT NOT NULL
      ) STRICT;
    `);
    database
      .prepare("INSERT INTO project_meta VALUES (1, ?, ?, ?, 0)")
      .run(SCHEMA_KIND, randomUUID(), "Neue Welt");
    database
      .prepare("INSERT INTO height_overview_state VALUES (1,?,0)")
      .run(OVERVIEW_ALGORITHM);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function metadata(database: Database.Database): Metadata {
  check(
    database.pragma("application_id", { simple: true }) === APPLICATION_ID &&
      database.pragma("user_version", { simple: true }) === PROJECT_FORMAT,
    "Diese Datei ist kein unterstütztes Atlas-Höhenprojekt (Format 24).",
  );
  const row = database
    .prepare(
      "SELECT schema_kind, project_id, title, sequence FROM project_meta WHERE singleton = 1",
    )
    .get() as
    | {
        schema_kind: string;
        project_id: string;
        title: string;
        sequence: number;
      }
    | undefined;
  check(
    row &&
      row.schema_kind === SCHEMA_KIND &&
      text(row.project_id, 100) &&
      text(row.title, 200) &&
      finiteInteger(row.sequence, 0, Number.MAX_SAFE_INTEGER),
    "Ungültige Projektmetadaten oder nicht unterstütztes Projektschema.",
  );
  const overview = database
    .prepare(
      "SELECT algorithm,sequence FROM height_overview_state WHERE singleton=1",
    )
    .get() as { algorithm: string; sequence: number } | undefined;
  check(
    overview?.algorithm === OVERVIEW_ALGORITHM &&
      overview.sequence === row.sequence,
    "Die numerische Höhenübersicht fehlt oder gehört zu einem alten Quellenstand.",
  );
  database
    .prepare(
      "SELECT power,tile_x,tile_y,values_blob FROM height_overviews LIMIT 0",
    )
    .all();
  return {
    projectId: row.project_id,
    title: row.title,
    sequence: row.sequence,
  };
}

function rebuildSpatialIndex(database: Database.Database) {
  const counts = new Map<number, number>();
  // The index is derived, so an old/missing index must never certify an author
  // tile absent. Rebuild from headers in the private workcopy, without loading
  // tile payloads into the editor or changing the source project file.
  database.transaction(() => {
    check(
      !database
        .prepare("SELECT 1 FROM height_tiles WHERE id <= 0 LIMIT 1")
        .get(),
      "Beschädigte Höhenkachelkennung.",
    );
    database.exec(
      "DROP TABLE IF EXISTS height_spatial; CREATE VIRTUAL TABLE height_spatial USING rtree(id, min_x, max_x, min_y, max_y, min_level, max_level)",
    );
    const index = database.prepare(
      "INSERT INTO height_spatial VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const bounds = database.prepare(
      "UPDATE height_tiles SET min_x=?, max_x=?, min_y=?, max_y=? WHERE id=?",
    );
    const headers = database.prepare(
      "SELECT id, level, tile_x, tile_y, revision, length(values_blob) AS bytes FROM height_tiles WHERE id > ? ORDER BY id LIMIT 512",
    );
    let lastId = 0;
    for (;;) {
      // Finish each bounded query before writing through this same connection.
      const rows = headers.all(lastId) as {
        id: number;
        level: number;
        tile_x: number;
        tile_y: number;
        revision: number;
        bytes: number;
      }[];
      if (rows.length === 0) break;
      for (const row of rows) {
        coordinates(tileKey(row.level, row.tile_x, row.tile_y));
        check(
          finiteInteger(row.id, 1, Number.MAX_SAFE_INTEGER) &&
            finiteInteger(row.revision, 0, Number.MAX_SAFE_INTEGER) &&
            row.bytes === TILE_BYTES,
          "Beschädigter Höhenkachelheader.",
        );
        const step = 5 * 2 ** row.level;
        const span = 64 * step;
        const minX = row.tile_x * span - 2 * step;
        const maxX = (row.tile_x + 1) * span + 2 * step;
        const minY = row.tile_y * span - 2 * step;
        const maxY = (row.tile_y + 1) * span + 2 * step;
        bounds.run(minX, maxX, minY, maxY, row.id);
        index.run(row.id, minX, maxX, minY, maxY, row.level, row.level);
        counts.set(row.level, (counts.get(row.level) ?? 0) + 1);
        lastId = row.id;
      }
    }
  })();
  return counts;
}

/** One SQLite owner; pure derived-index updates never make author decisions. */
export class ProjectStore {
  private current: WorkingProject | null = null;
  private readonly snapshots = new Map<string, Snapshot>();
  private readonly counters: StoreMetrics & OverviewMetrics = {
    reads: 0,
    returnedTiles: 0,
    returnedBytes: 0,
    commits: 0,
    committedTiles: 0,
    snapshots: 0,
    returnedOverviewTiles: 0,
    returnedOverviewBytes: 0,
    overviewUpdatedSamples: 0,
    overviewReadBytes: 0,
    overviewWriteBytes: 0,
    overviewCachePeakBytes: 0,
    maxCommitMs: 0,
  };

  constructor(
    private readonly rootDirectory: string,
    private readonly observe?: (event: StoreActivity) => void,
  ) {
    mkdirSync(rootDirectory, { recursive: true });
    this.newProject();
  }

  private activity(
    boundary: SourceBoundary,
    token: string,
    kind: StoreActivity["kind"],
    phase: StoreActivity["phase"],
    success?: boolean,
  ) {
    this.observe?.({
      sessionId: boundary.sessionId,
      sequence: boundary.sequence,
      token,
      kind,
      phase,
      epochMs: performance.timeOrigin + performance.now(),
      ...(success === undefined ? {} : { success }),
    });
  }

  private project() {
    check(this.current, "Die Projektspeicherung ist geschlossen.");
    return this.current;
  }

  private session(sessionId: string) {
    const project = this.project();
    check(
      text(sessionId, 100) && project.sessionId === sessionId,
      "Veraltete Dokumentsitzung.",
    );
    return project;
  }

  private exactBoundary(boundary: SourceBoundary) {
    validateBoundary(boundary);
    const project = this.session(boundary.sessionId);
    check(
      project.sequence === boundary.sequence,
      "Der Dokumentstand hat sich inzwischen geändert.",
    );
    return project;
  }

  status(): ProjectInfo {
    const project = this.project();
    return {
      sessionId: project.sessionId,
      projectId: project.projectId,
      format: PROJECT_FORMAT,
      title: project.title,
      sequence: project.sequence,
      savedSequence: project.savedSequence,
      path: project.path,
      activeLevels: [...project.levelCounts.keys()].sort((a, b) => a - b),
      sourceTiles: [...project.levelCounts.values()].reduce(
        (sum, count) => sum + count,
        0,
      ),
    };
  }

  metrics(): StoreMetrics & OverviewMetrics {
    return { ...this.counters };
  }

  newProject(expected?: SourceBoundary): ProjectInfo {
    if (expected) this.exactBoundary(expected);
    const directory = mkdtempSync(join(this.rootDirectory, "working-"));
    let database: Database.Database;
    try {
      database = createDatabase(join(directory, "working.sqlite"));
    } catch (error) {
      rmSync(directory, { recursive: true, force: true });
      throw error;
    }
    const candidate: WorkingProject = {
      ...metadata(database),
      database,
      directory,
      sessionId: randomUUID(),
      path: null,
      savedSequence: null,
      levelCounts: new Map(),
    };
    this.replace(candidate);
    return this.status();
  }

  async openProject(
    path: string,
    expected?: SourceBoundary,
  ): Promise<ProjectInfo> {
    if (expected) this.exactBoundary(expected);
    check(text(path, 4096), "Ungültiger Projektpfad.");
    const absolute = resolve(path);
    const source = new Database(absolute, {
      readonly: true,
      fileMustExist: true,
    });
    source.pragma("trusted_schema = OFF");
    let candidate: WorkingProject | null = null;
    let candidateDb: Database.Database | null = null;
    let directory: string | null = null;
    try {
      metadata(source);
      check(
        source.pragma("quick_check", { simple: true }) === "ok",
        "Beschädigte SQLite-Projektdatei.",
      );
      directory = mkdtempSync(join(this.rootDirectory, "working-"));
      const workingPath = join(directory, "working.sqlite");
      // SQLite's backup API includes the committed snapshot even with a live WAL.
      await source.backup(workingPath);
      candidateDb = new Database(workingPath, { fileMustExist: true });
      const meta = metadata(candidateDb);
      const counts = rebuildSpatialIndex(candidateDb);
      // Do not materialize all source payloads during open. Each selected read
      // validates its binary payload before returning it to the active document.
      candidateDb
        .prepare(
          "SELECT transaction_id, payload_hash FROM transaction_receipts LIMIT 0",
        )
        .all();
      configure(candidateDb);
      if (expected) this.exactBoundary(expected);
      candidate = {
        ...meta,
        database: candidateDb,
        directory,
        sessionId: randomUUID(),
        path: absolute,
        savedSequence: meta.sequence,
        levelCounts: counts,
      };
    } catch (error) {
      candidateDb?.close();
      if (directory) rmSync(directory, { recursive: true, force: true });
      throw error;
    } finally {
      source.close();
    }
    this.replace(candidate);
    return this.status();
  }

  private replace(candidate: WorkingProject) {
    const previous = this.current;
    this.current = candidate;
    if (previous) {
      previous.database.close();
      rmSync(previous.directory, { recursive: true, force: true });
    }
  }

  private sourceRead(project: WorkingProject, rows: StoredTile[]): SourceRead {
    check(
      rows.length <= MAX_TRANSFER_TILES,
      "Der Ausschnitt enthält zu viele Höhenkacheln; bitte näher heranzoomen.",
    );
    const tiles = rows.map(decodeTile);
    this.counters.reads++;
    this.counters.returnedTiles += tiles.length;
    this.counters.returnedBytes += tiles.length * TILE_BYTES;
    return { sessionId: project.sessionId, sequence: project.sequence, tiles };
  }

  readTiles(request: ReadTilesRequest): SourceRead {
    const project = this.session(request.sessionId);
    check(
      Array.isArray(request.keys) && request.keys.length <= MAX_TRANSFER_TILES,
      "Zu viele Höhenschlüssel.",
    );
    const keys = [...new Set(request.keys)].map(coordinates);
    const statement = project.database.prepare(
      "SELECT level, tile_x, tile_y, revision, values_blob AS 'values' FROM height_tiles WHERE level = ? AND tile_x = ? AND tile_y = ?",
    );
    const rows: StoredTile[] = [];
    for (const key of keys) {
      const row = statement.get(key.level, key.tileX, key.tileY) as
        StoredTile | undefined;
      if (row) rows.push(row);
    }
    return this.sourceRead(project, rows);
  }

  readRegion(request: ReadRegionRequest): RegionRead {
    const project = this.session(request.sessionId);
    validateBounds(request.bounds);
    const minLevel = request.minLevel ?? 0;
    check(finiteInteger(minLevel, 0, 22), "Ungültige benötigte Höhenstufe.");
    check(
      request.level === undefined ||
        (finiteInteger(request.level, 0, 21) && request.level >= minLevel),
      "Ungültige Höhenstufe.",
    );
    const [minX, minY, maxX, maxY] = request.bounds;
    // Filter the author level inside the RTree as well as the exact row. A
    // coarse view must not enumerate every fine spatial hit just to reject it
    // after the author lookup. REAL bounds remove Float32 false positives;
    // the support footprint includes the cubic halo.
    const rows = project.database
      .prepare(
        `
      SELECT t.level, t.tile_x, t.tile_y, t.revision, t.values_blob AS 'values'
      FROM height_spatial s JOIN height_tiles t ON t.id = s.id
      WHERE s.min_x < @maxX AND s.max_x > @minX
        AND s.min_y < @maxY AND s.max_y > @minY
        AND s.min_level <= @maxLevel AND s.max_level >= @minLevel
        AND t.min_x < @maxX AND t.max_x > @minX
        AND t.min_y < @maxY AND t.max_y > @minY
        AND t.level >= @minLevel
        ${request.level === undefined ? "" : "AND t.level = @level"}
      ORDER BY t.level, t.tile_x, t.tile_y LIMIT ${MAX_TRANSFER_TILES + 1}
    `,
      )
      .all({
        minX,
        minY,
        maxX,
        maxY,
        minLevel: request.level ?? minLevel,
        maxLevel: request.level ?? 21,
        ...(request.level === undefined ? {} : { level: request.level }),
      }) as StoredTile[];
    return {
      ...this.sourceRead(project, rows),
      bounds: [...request.bounds] as Bounds,
      ...(request.level === undefined ? {} : { level: request.level }),
    };
  }

  /** One sequence certifies both the numerical fine sum and the coarse authors. */
  readPresentation(request: HeightPresentationRequest): HeightPresentationRead {
    const project = this.session(request.sessionId);
    validateBounds(request.bounds);
    assertHeightRenderPower(request.power);
    const overviewKeys = heightOverviewKeys(request.bounds, request.power);
    const coarse = this.readRegion({
      sessionId: request.sessionId,
      bounds: request.bounds,
      minLevel: minimumCoarseHeightLevel(request.power),
    });
    const select = project.database.prepare(
      "SELECT values_blob FROM height_overviews WHERE power=? AND tile_x=? AND tile_y=?",
    );
    const overviews: HeightOverviewTile[] = [];
    if (request.power >= 3) {
      for (const key of overviewKeys) {
        const at = parseHeightOverviewKey(key);
        const row = select.get(at.power, at.tileX, at.tileY) as
          { values_blob: Buffer } | undefined;
        if (row) overviews.push(decodeOverview(key, row.values_blob));
      }
    }
    const bytes = overviews.length * HEIGHT_OVERVIEW_BYTES;
    this.counters.returnedOverviewTiles += overviews.length;
    this.counters.returnedOverviewBytes += bytes;
    this.counters.returnedBytes += bytes;
    return {
      sessionId: project.sessionId,
      sequence: project.sequence,
      bounds: [...request.bounds] as Bounds,
      power: request.power,
      tiles: coarse.tiles,
      overviewKeys,
      overviews,
    };
  }

  commit(request: CommitRequest): CommitReceipt {
    const commitStartedAt = performance.now();
    validateBoundary(request);
    const project = this.session(request.sessionId);
    check(text(request.transactionId, 200), "Ungültige Transaktionskennung.");
    check(
      Array.isArray(request.patches) &&
        request.patches.length > 0 &&
        request.patches.length <= HEIGHT_MAX_ACTION_TILES,
      "Ungültige oder zu große Quellenänderung.",
    );
    const seen = new Set<string>();
    const hash = createHash("sha256");
    const patches = request.patches.map((patch) => {
      check(
        patch && !seen.has(patch.key),
        "Doppelter Höhenschlüssel in einer Aktion.",
      );
      seen.add(patch.key);
      const at = coordinates(patch.key);
      const after =
        patch.after === null ? null : encodeTile(patch.after, patch.key);
      hash.update(`${patch.key}\0${after?.revision ?? "absent"}\0`);
      if (after) hash.update(after.values);
      return { ...at, key: patch.key, source: patch.after, after };
    });
    const payloadHash = hash.digest("hex");
    const prior = project.database
      .prepare(
        "SELECT sequence, transaction_id, payload_hash FROM transaction_receipts WHERE transaction_id = ? OR sequence = ?",
      )
      .all(request.transactionId, request.sequence) as {
      sequence: number;
      transaction_id: string;
      payload_hash: string;
    }[];
    if (prior.length) {
      check(
        prior.length === 1 &&
          prior[0].sequence === request.sequence &&
          prior[0].transaction_id === request.transactionId &&
          prior[0].payload_hash === payloadHash,
        "Widersprüchliche Wiederholung einer Quellenänderung.",
      );
      return {
        sessionId: project.sessionId,
        sequence: request.sequence,
        transactionId: request.transactionId,
      };
    }
    check(
      request.sequence === project.sequence + 1,
      "Quellenänderungen müssen in lückenloser Reihenfolge gespeichert werden.",
    );
    const database = project.database;
    const existing = database.prepare(
      "SELECT id,level,tile_x,tile_y,revision,values_blob AS 'values' FROM height_tiles WHERE level = ? AND tile_x = ? AND tile_y = ?",
    );
    const upsert = database.prepare(`
      INSERT INTO height_tiles(level, tile_x, tile_y, revision, values_blob, min_x, max_x, min_y, max_y)
      VALUES (@level, @tileX, @tileY, @revision, @values, @minX, @maxX, @minY, @maxY)
      ON CONFLICT(level, tile_x, tile_y) DO UPDATE SET revision=excluded.revision, values_blob=excluded.values_blob
    `);
    const spatial = database.prepare(
      "INSERT OR REPLACE INTO height_spatial VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const counts = new Map(project.levelCounts);
    let derivedMetrics = {
      updatedSamples: 0,
      readBytes: 0,
      writeBytes: 0,
      peakBytes: 0,
    };
    database.transaction(() => {
      const overviews = overviewWriter(database);
      for (const patch of patches) {
        const previous = existing.get(patch.level, patch.tileX, patch.tileY) as
          (StoredTile & { id: number }) | undefined;
        const delta = prepareHeightOverviewDelta({
          key: patch.key,
          before: previous ? decodeTile(previous) : null,
          after: patch.source,
        });
        if (delta) overviews.apply(delta);
        if (patch.after) {
          upsert.run(patch.after);
          const row = existing.get(patch.level, patch.tileX, patch.tileY) as {
            id: number;
          };
          spatial.run(
            row.id,
            patch.after.minX,
            patch.after.maxX,
            patch.after.minY,
            patch.after.maxY,
            patch.level,
            patch.level,
          );
          if (!previous)
            counts.set(patch.level, (counts.get(patch.level) ?? 0) + 1);
        } else if (previous) {
          database
            .prepare("DELETE FROM height_spatial WHERE id = ?")
            .run(previous.id);
          database
            .prepare("DELETE FROM height_tiles WHERE id = ?")
            .run(previous.id);
          const count = (counts.get(patch.level) ?? 1) - 1;
          if (count > 0) counts.set(patch.level, count);
          else counts.delete(patch.level);
        }
      }
      derivedMetrics = overviews.finish();
      database
        .prepare(
          "UPDATE height_overview_state SET sequence=? WHERE singleton=1",
        )
        .run(request.sequence);
      database
        .prepare("UPDATE project_meta SET sequence = ? WHERE singleton = 1")
        .run(request.sequence);
      database
        .prepare("INSERT INTO transaction_receipts VALUES (?, ?, ?)")
        .run(request.sequence, request.transactionId, payloadHash);
      database
        .prepare("DELETE FROM transaction_receipts WHERE sequence < ?")
        .run(request.sequence - 1024);
    })();
    this.counters.overviewUpdatedSamples += derivedMetrics.updatedSamples;
    this.counters.overviewReadBytes += derivedMetrics.readBytes;
    this.counters.overviewWriteBytes += derivedMetrics.writeBytes;
    this.counters.overviewCachePeakBytes = Math.max(
      this.counters.overviewCachePeakBytes,
      derivedMetrics.peakBytes,
    );
    this.counters.maxCommitMs = Math.max(
      this.counters.maxCommitMs,
      performance.now() - commitStartedAt,
    );
    project.sequence = request.sequence;
    project.levelCounts = counts;
    this.counters.commits++;
    this.counters.committedTiles += patches.length;
    return {
      sessionId: project.sessionId,
      sequence: project.sequence,
      transactionId: request.transactionId,
    };
  }

  async prepareSave(request: SourceBoundary): Promise<PreparedSave> {
    const project = this.exactBoundary(request);
    check(this.snapshots.size < 2, "Es sind bereits Speichervorgänge offen.");
    const token = randomUUID();
    const temporaryPath = join(
      this.rootDirectory,
      `snapshot-${token}.saltatlas`,
    );
    this.activity(request, token, "snapshot", "start");
    let completed = false;
    const reader = new Database(project.database.name, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      // Pin S with a real SQLite read transaction. Even writes through the live
      // WAL connection while backup yields cannot move this snapshot to S+1.
      reader.exec("BEGIN");
      check(
        metadata(reader).sequence === request.sequence,
        "Der reservierte Speicherstand ist nicht mehr verfügbar.",
      );
      await reader.backup(temporaryPath);
      const snapshotDb = new Database(temporaryPath, { fileMustExist: true });
      try {
        check(
          metadata(snapshotDb).sequence === request.sequence,
          "Der Speichersnapshot besitzt den falschen Stand.",
        );
        snapshotDb.pragma("journal_mode = DELETE");
      } finally {
        snapshotDb.close();
      }
      completed = true;
    } finally {
      if (reader.inTransaction) reader.exec("ROLLBACK");
      reader.close();
      if (!completed) await rm(temporaryPath, { force: true });
      this.activity(request, token, "snapshot", "end", completed);
    }
    const snapshot: Snapshot = {
      ...request,
      token,
      temporaryPath,
      path: project.path,
      title: project.title,
    };
    this.snapshots.set(token, snapshot);
    this.counters.snapshots++;
    return { ...request, token, path: project.path, title: project.title };
  }

  async publishSave(token: string, target: string): Promise<SaveResult> {
    const snapshot = this.snapshots.get(token);
    check(snapshot, "Speichersnapshot ist nicht mehr verfügbar.");
    const project = this.session(snapshot.sessionId);
    check(text(target, 4096), "Ungültiger Speicherpfad.");
    const destination = resolve(target);
    check(
      destination !== join(project.directory, "working.sqlite"),
      "Die Arbeitskopie ist kein Projektziel.",
    );
    const temporary = join(
      dirname(destination),
      `.${basename(destination)}.${randomUUID()}.tmp`,
    );
    let renamed = false;
    let completed = false;
    this.activity(snapshot, token, "publish", "start");
    try {
      await copyFile(
        snapshot.temporaryPath,
        temporary,
        fsConstants.COPYFILE_EXCL,
      );
      const file = await open(temporary, "r+");
      try {
        await file.sync();
      } finally {
        await file.close();
      }
      // Session changes cannot overtake this operation through the dispatcher.
      this.session(snapshot.sessionId);
      await rename(temporary, destination);
      renamed = true;
      if (process.platform !== "win32") {
        const directory = openSync(dirname(destination), "r");
        try {
          fsyncSync(directory);
        } finally {
          closeSync(directory);
        }
      }
      project.path = destination;
      project.savedSequence = snapshot.sequence;
      completed = true;
      return {
        sessionId: project.sessionId,
        sequence: project.sequence,
        savedSequence: snapshot.sequence,
        path: destination,
      };
    } finally {
      if (!renamed) await rm(temporary, { force: true });
      await this.discardSave(token);
      this.activity(snapshot, token, "publish", "end", completed);
    }
  }

  async discardSave(token: string) {
    const snapshot = this.snapshots.get(token);
    if (!snapshot) return;
    this.snapshots.delete(token);
    await rm(snapshot.temporaryPath, { force: true });
  }

  async saveProject(
    request: SourceBoundary,
    target: string,
  ): Promise<SaveResult> {
    const prepared = await this.prepareSave(request);
    return this.publishSave(prepared.token, target);
  }

  close(expected?: SourceBoundary) {
    if (expected) this.exactBoundary(expected);
    if (this.current) {
      this.current.database.close();
      rmSync(this.current.directory, { recursive: true, force: true });
      this.current = null;
    }
    for (const snapshot of this.snapshots.values())
      rmSync(snapshot.temporaryPath, { force: true });
    this.snapshots.clear();
  }
}
