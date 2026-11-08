import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const TILE_SIDE = 64;
const TILE_BYTES = TILE_SIDE * TILE_SIDE * 8;
const SOURCE_BUDGET_BYTES = 256 * 1024 * 1024;
const PROTECTED_BOUNDS = [-3000, -3000, 3000, 3000];
const BATCH_SIZE = 128;

export const SCALING_CASES = Object.freeze([
  { id: "baseline", sourceTiles: 32 },
  { id: "medium", sourceTiles: 1024 },
  { id: "large", sourceTiles: 9000 },
]);

/** All three cases use the same place, viewport and coarse brush. */
export const SCALING_REGION = Object.freeze({
  bounds: [-16000, -16000, 16000, 16000],
  initialCamera: { x: 0, y: 0, scale: 0.25 },
  coarseCamera: { x: 0, y: 0, scale: 0.01 },
  brush: {
    center: [0, 0],
    diameter: 512,
    radius: 25600,
    level: 9,
    amount: 100,
  },
  pixelProbe: [-800, 0],
  // Interior of an added fine tile and a 128-foot coarse raster texel centre.
  // Without its fine residual, this stays underwater even after the coarse dab.
  ridgePixelProbe: [-12608, 192],
  protectedBounds: PROTECTED_BOUNDS,
});

export const SCALING_EXPECTED = Object.freeze({
  points: [
    [-400, 0],
    [320, 0],
    [420, 0],
    [-800, 0],
  ],
  before: [0, 6.31005859375, 41, -20],
  // Analytic positive-cubic sums of a quartic radius-25600, level-9 dab.
  // These constants were derived with rational arithmetic, not the renderer
  // or EditorDocument. They intentionally differ from the small P0 dab oracle.
  afterCoarseDab: [
    1454317397 / 14745600,
    6.31005859375 + 22727717 / 230400,
    41 + 93071640917 / 943718400,
    -20 + 181522909 / 1843200,
  ],
  ridgePoints: [
    [-15520, -15520],
    [15520, -15520],
    [-15520, 15520],
    [15520, 15520],
    [-12640, 160],
  ],
  // Independent 3x3 [1,4,1]/6 sums at integer controls of the documented
  // analytic ridge field, including both dry land and underwater terrain.
  ridgeBefore: [
    -21.695998376963374, -68.35169378234401, -21.416109500128442,
    -68.07180490550908, 54.71319095829017,
  ],
  // Independent rational sums of the same quartic level-9 brush through the
  // positive cubic basis. The four symmetric corners receive the same delta.
  ridgeAfterCoarseDab: [
    -21.695998376963374 + 231143897539 / 30198988800,
    -68.35169378234401 + 231143897539 / 30198988800,
    -21.416109500128442 + 231143897539 / 30198988800,
    -68.07180490550908 + 231143897539 / 30198988800,
    54.71319095829017 + 1666408681 / 29491200,
  ],
  // Analytic ridge-field spline at region.ridgePixelProbe, outside the coast.
  ridgePixelBefore: 71.91076001075123,
  ridgePixelAfterCoarseDab: 71.91076001075123 + 65302281769 / 1152000000,
  ridgePixelWithoutFineAfterCoarseDab: -100 + 65302281769 / 1152000000,
});

function dependencies() {
  if (!process.versions.electron)
    throw new Error(
      "Scaling fixtures must use ELECTRON_RUN_AS_NODE=1 electron.",
    );
  return {
    Database: require("better-sqlite3"),
    ...require(join(root, "desktop-dist/project-store.cjs")),
    ...require(join(root, "desktop-dist/model.cjs")),
  };
}

const intersects = (a, b) =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function tileSupport(x, y) {
  return [x * 320 - 10, y * 320 - 10, (x + 1) * 320 + 10, (y + 1) * 320 + 10];
}

/** Stable nested prefixes spread small cases across the same complete region. */
function detailCoordinates() {
  const anchors = [
    [-49, -49],
    [48, -49],
    [-49, 48],
    [48, 48],
    [-40, 0],
  ];
  const reserved = new Set(anchors.map(([x, y]) => `${x}:${y}`));
  const candidates = [];
  for (let y = -49; y <= 48; y++) {
    for (let x = -49; x <= 48; x++) {
      if (intersects(tileSupport(x, y), PROTECTED_BOUNDS)) continue;
      if (reserved.has(`${x}:${y}`)) continue;
      // A fixed integer permutation selects actual tiles, not dummy headers.
      const rank =
        (Math.imul(x + 49, 73856093) ^ Math.imul(y + 49, 19349663)) >>> 0;
      candidates.push({ x, y, rank });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x);
  return [...anchors, ...candidates.map(({ x, y }) => [x, y])];
}

function ridgeTile(tileX, tileY) {
  const values = new Float64Array(TILE_SIDE * TILE_SIDE);
  for (let y = 0; y < TILE_SIDE; y++) {
    const controlY = tileY * TILE_SIDE + y;
    for (let x = 0; x < TILE_SIDE; x++) {
      const controlX = tileX * TILE_SIDE + x;
      // Smooth, spatially coherent hills and seabeds, fully populated at the
      // finest author spacing. This is source content, never a display texture.
      values[y * TILE_SIDE + x] =
        100 +
        60 * Math.sin(controlX / 31) +
        45 * Math.cos(controlY / 43) +
        25 * Math.sin((controlX + controlY) / 19);
    }
  }
  return {
    key: `height:0:${tileX}:${tileY}`,
    level: 0,
    tileX,
    tileY,
    revision: 0,
    values,
  };
}

function* fixtureTiles(sourceTiles, createCoastFixture) {
  const coast = createCoastFixture();
  assert.equal(coast.length, 8, "The protected coast/trench baseline changed.");
  const candidates = detailCoordinates();
  assert.ok(Number.isSafeInteger(sourceTiles) && sourceTiles >= coast.length);
  assert.ok(sourceTiles - coast.length <= candidates.length);
  yield* coast;
  for (const [x, y] of candidates.slice(0, sourceTiles - coast.length)) {
    const bounds = tileSupport(x, y);
    assert.ok(!intersects(bounds, PROTECTED_BOUNDS));
    for (const px of [bounds[0], bounds[2]]) {
      for (const py of [bounds[1], bounds[3]])
        assert.ok(Math.hypot(px, py) < SCALING_REGION.brush.radius);
    }
    yield ridgeTile(x, y);
  }
}

async function fileSha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function readonlyDatabase(file) {
  const { Database } = dependencies();
  const database = new Database(resolve(file), {
    readonly: true,
    fileMustExist: true,
  });
  database.pragma("trusted_schema = OFF");
  return database;
}

/**
 * Offline observation only: one BLOB at a time, outside timed product work.
 * Keys and raw little-endian payloads are hashed; revisions are deliberately
 * excluded so the digest checks preserved authors across Undo/Redo/Reopen.
 * This never certifies readiness or supplies data to the running application.
 */
export function finePayloadDigest(file) {
  const database = readonlyDatabase(file);
  const hash = createHash("sha256").update("atlas-height-fine-payload-v1\0");
  let fineTiles = 0;
  let nonzeroCells = 0;
  let denseTiles = 0;
  let varyingTiles = 0;
  let minResidual = Infinity;
  let maxResidual = -Infinity;
  try {
    const rows = database.prepare(
      "SELECT tile_x, tile_y, values_blob AS payload FROM height_tiles WHERE level = 0 ORDER BY tile_x, tile_y",
    );
    for (const row of rows.iterate()) {
      assert.equal(
        row.payload.byteLength,
        TILE_BYTES,
        "Wrong fine-source payload size.",
      );
      const key = `height:0:${row.tile_x}:${row.tile_y}`;
      hash.update(key).update("\0").update(row.payload);
      let nonzero = 0;
      let varying = false;
      const first = row.payload.readDoubleLE(0);
      for (let offset = 0; offset < TILE_BYTES; offset += 8) {
        const value = row.payload.readDoubleLE(offset);
        assert.ok(Number.isFinite(value), "Non-finite saved fine height.");
        nonzero += Number(value !== 0);
        varying ||= value !== first;
        minResidual = Math.min(minResidual, value);
        maxResidual = Math.max(maxResidual, value);
      }
      fineTiles++;
      nonzeroCells += nonzero;
      denseTiles += Number(nonzero >= TILE_SIDE * TILE_SIDE * 0.99);
      varyingTiles += Number(varying);
    }
    return {
      algorithm: "sha256-height-key-zero-payload-v1",
      sha256: hash.digest("hex"),
      fineTiles,
      decodedBytes: fineTiles * TILE_BYTES,
      valueCount: fineTiles * TILE_SIDE * TILE_SIDE,
      nonzeroCells,
      denseTiles,
      varyingTiles,
      minResidual: fineTiles ? minResidual : null,
      maxResidual: fineTiles ? maxResidual : null,
      inspectionOnly: true,
    };
  } finally {
    database.close();
  }
}

/** Selective real store reads remain small even when the broad product read fails. */
export async function inspectScalingFixture(
  file,
  { hashFile = true, additionalOrigins = [] } = {},
) {
  file = resolve(file);
  const { ProjectStore, prepareHeightSampler } = dependencies();
  const database = readonlyDatabase(file);
  let counts;
  let levels;
  let containedTiles;
  try {
    counts = database
      .prepare(
        "SELECT COUNT(*) AS sourceTiles, COALESCE(SUM(length(values_blob)), 0) AS decodedBytes FROM height_tiles",
      )
      .get();
    levels = database
      .prepare(
        "SELECT level, COUNT(*) AS tiles, SUM(length(values_blob)) AS decodedBytes FROM height_tiles GROUP BY level ORDER BY level",
      )
      .all();
    const [minX, minY, maxX, maxY] = SCALING_REGION.bounds;
    containedTiles = database
      .prepare(
        "SELECT COUNT(*) AS count FROM height_tiles WHERE min_x >= ? AND min_y >= ? AND max_x <= ? AND max_y <= ?",
      )
      .get(minX, minY, maxX, maxY).count;
  } finally {
    database.close();
  }
  const directory = await mkdtemp(join(tmpdir(), "atlas-p0-scaling-inspect-"));
  const store = new ProjectStore(directory);
  try {
    const project = await store.openProject(file);
    assert.equal(project.sourceTiles, counts.sourceTiles);
    const samplePoints = (points) =>
      points.map(([x, y]) => {
        const read = store.readRegion({
          minLevel: 0,
          sessionId: project.sessionId,
          bounds: [x - 1, y - 1, x + 1, y + 1],
        });
        return prepareHeightSampler(read.tiles)(x, y);
      });
    const samples = samplePoints(SCALING_EXPECTED.points);
    const ridgeSamples = samplePoints(SCALING_EXPECTED.ridgePoints);
    const [ridgePixelSample] = samplePoints([SCALING_REGION.ridgePixelProbe]);
    const additional = additionalOrigins.map((origin) => {
      const points = SCALING_EXPECTED.points.map(([x, y]) => [
        origin[0] + x,
        origin[1] + y,
      ]);
      return { origin, points, samples: samplePoints(points) };
    });
    const digest = finePayloadDigest(file);
    return {
      file,
      sequence: project.sequence,
      ...counts,
      levels,
      regionSourceTiles: containedTiles,
      fileBytes: (await stat(file)).size,
      ...(hashFile ? { sha256: await fileSha256(file) } : {}),
      fineTiles: digest.fineTiles,
      fineSha256: digest.sha256,
      fineDigest: digest,
      points: SCALING_EXPECTED.points,
      samples,
      ridgePoints: SCALING_EXPECTED.ridgePoints,
      ridgeSamples,
      ridgePixelSample,
      ...(additional.length ? { additionalOrigins: additional } : {}),
      selectiveProbeReads: store.metrics().reads,
      probeReadBytes: store.metrics().returnedBytes,
      inspectionOnly: true,
    };
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function verifyFixture(saved, definition) {
  assert.equal(saved.sourceTiles, definition.sourceTiles);
  assert.equal(saved.regionSourceTiles, definition.sourceTiles);
  assert.equal(saved.decodedBytes, definition.sourceTiles * TILE_BYTES);
  assert.equal(saved.fineTiles, definition.sourceTiles - 4);
  assert.equal(saved.fineDigest.denseTiles, definition.sourceTiles - 8);
  assert.equal(saved.fineDigest.varyingTiles, saved.fineTiles);
  assert.ok(saved.fineDigest.minResidual < 0);
  assert.ok(saved.fineDigest.maxResidual > 100);
  for (const [values, expected] of [
    [saved.samples, SCALING_EXPECTED.before],
    [saved.ridgeSamples, SCALING_EXPECTED.ridgeBefore],
    [[saved.ridgePixelSample], [SCALING_EXPECTED.ridgePixelBefore]],
  ]) {
    assert.equal(values.length, expected.length);
    values.forEach((value, i) =>
      assert.ok(
        Number.isFinite(value) && Math.abs(value - expected[i]) < 1e-7,
        `Saved analytic probe ${i} differs: ${value} / ${expected[i]}`,
      ),
    );
  }
  if (definition.id === "medium") assert.ok(saved.sourceTiles > 512);
  if (definition.id === "large")
    assert.ok(saved.fineDigest.decodedBytes > SOURCE_BUDGET_BYTES);
}

export async function createScalingFixtures(
  directory,
  { ids, onProgress } = {},
) {
  directory = resolve(directory);
  await mkdir(directory, { recursive: true });
  const definitions =
    ids === undefined
      ? SCALING_CASES
      : SCALING_CASES.filter(({ id }) => ids.includes(id));
  if (!definitions.length || (ids && definitions.length !== new Set(ids).size))
    throw new Error("Unknown or empty scaling fixture selection.");
  const { ProjectStore, createCoastFixture } = dependencies();
  const report = {
    schemaVersion: 1,
    scope:
      "Real populated height sources at three sizes within one unchanged coarse region; no product cap bypass",
    sourceBudgetBytes: SOURCE_BUDGET_BYTES,
    bytesPerSourceTile: TILE_BYTES,
    region: SCALING_REGION,
    expected: SCALING_EXPECTED,
    workload: {
      authorSpacingFeet: 5,
      field:
        "100 + 60*sin(controlX/31) + 45*cos(controlY/43) + 25*sin((controlX+controlY)/19)",
      controlsPerAddedTile: TILE_SIDE * TILE_SIDE,
      protectedCoastAndTrench: true,
      nestedDetailPrefixes: true,
      allDetailsInsideCoarseBrush: true,
      commitBatchSize: BATCH_SIZE,
      timingExcludesFixtureConstructionAndOfflineInspection: true,
    },
    fixtures: [],
  };
  for (const definition of definitions) {
    const file = join(directory, `scaling-${definition.id}.saltatlas`);
    try {
      await access(file);
      throw new Error(
        `Refusing to replace an existing scaling fixture: ${file}`,
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const startedAt = performance.now();
    const store = new ProjectStore(join(directory, `work-${definition.id}`));
    let constructionMetrics;
    try {
      let batch = [];
      const commit = () => {
        if (!batch.length) return;
        const status = store.status();
        store.commit({
          sessionId: status.sessionId,
          sequence: status.sequence + 1,
          transactionId: `scaling-${definition.id}-${status.sequence + 1}`,
          patches: batch.map((after) => ({ key: after.key, after })),
        });
        batch = [];
      };
      for (const tile of fixtureTiles(
        definition.sourceTiles,
        createCoastFixture,
      )) {
        batch.push(tile);
        if (batch.length === BATCH_SIZE) commit();
      }
      commit();
      const status = store.status();
      assert.equal(status.sourceTiles, definition.sourceTiles);
      await store.saveProject(
        { sessionId: status.sessionId, sequence: status.sequence },
        file,
      );
      constructionMetrics = store.metrics();
    } finally {
      store.close();
    }
    const saved = await inspectScalingFixture(file);
    verifyFixture(saved, definition);
    const result = {
      id: definition.id,
      ...saved,
      creationAndVerificationMs: performance.now() - startedAt,
      // One-time real construction work, not hidden navigation setup.
      constructionMetrics,
      verified: true,
    };
    report.fixtures.push(result);
    onProgress?.(result);
  }
  await writeFile(
    join(directory, "scaling-fixture.json"),
    JSON.stringify(report, null, 2),
  );
  return report;
}

/**
 * A genuine large saved project for concurrent Save/navigation/edit tests.
 * Local views contain the same eight-tile coast as the small pilot; the saved
 * background is populated source data. No clock delay or extra work is injected
 * into ProjectStore, and its normal transfer/source limits remain unchanged.
 */
export async function createBusyFixture(
  directory,
  { baseFile, onProgress } = {},
) {
  directory = resolve(directory);
  await mkdir(directory, { recursive: true });
  const file = join(directory, "busy-coast.saltatlas");
  try {
    await access(file);
    throw new Error(`Refusing to replace an existing busy fixture: ${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const startedAt = performance.now();
  if (!baseFile) {
    const created = await createScalingFixtures(join(directory, "base"), {
      ids: ["large"],
      onProgress,
    });
    baseFile = created.fixtures[0].file;
  }
  baseFile = resolve(baseFile);
  const base = await inspectScalingFixture(baseFile);
  verifyFixture(
    base,
    SCALING_CASES.find(({ id }) => id === "large"),
  );
  const { ProjectStore, createCoastFixture } = dependencies();
  const activity = [];
  const store = new ProjectStore(join(directory, "working"), (event) =>
    activity.push(event),
  );
  const targetOrigin = [80_000, 0];
  try {
    const project = await store.openProject(baseFile);
    const targetTiles = createCoastFixture({ origin: targetOrigin });
    assert.equal(targetTiles.length, 8);
    store.commit({
      sessionId: project.sessionId,
      sequence: project.sequence + 1,
      transactionId: "busy-fixture-cold-target",
      patches: targetTiles.map((after) => ({ key: after.key, after })),
    });
    const status = store.status();
    assert.equal(status.sourceTiles, 9008);
    await store.saveProject(
      { sessionId: status.sessionId, sequence: status.sequence },
      file,
    );
  } finally {
    store.close();
  }
  const saved = await inspectScalingFixture(file, {
    additionalOrigins: [targetOrigin],
  });
  assert.equal(saved.sourceTiles, 9008);
  assert.equal(saved.decodedBytes, 9008 * TILE_BYTES);
  assert.equal(saved.fineTiles, 9000);
  assert.equal(saved.fineDigest.denseTiles, 8992);
  const target = saved.additionalOrigins[0];
  for (const values of [saved.samples, target.samples])
    values.forEach((value, i) =>
      assert.ok(
        Number.isFinite(value) &&
          Math.abs(value - SCALING_EXPECTED.before[i]) < 1e-7,
        "Busy fixture changed a protected origin/target height.",
      ),
    );
  const intervals = activity
    .filter((event) => event.phase === "start")
    .map((start) => {
      const end = activity.find(
        (event) =>
          event.kind === start.kind &&
          event.token === start.token &&
          event.phase === "end",
      );
      assert.equal(
        end?.success,
        true,
        "Actual busy-fixture save did not succeed.",
      );
      return {
        kind: start.kind,
        start,
        end,
        milliseconds: end.epochMs - start.epochMs,
      };
    });
  const report = {
    schemaVersion: 1,
    scope:
      "Real saved background terrain plus two identical selectively loaded coast/trench scenes; concurrent-load fixture, not timing acceptance",
    ...saved,
    origins: [[0, 0], targetOrigin],
    expected: {
      points: SCALING_EXPECTED.points,
      before: SCALING_EXPECTED.before,
    },
    origin: { origin: [0, 0], points: saved.points, samples: saved.samples },
    target,
    baseFile,
    baseSha256: base.sha256,
    creationSaveIntervals: intervals,
    creationAndVerificationMs: performance.now() - startedAt,
    verified: true,
  };
  await writeFile(
    join(directory, "busy-fixture.json"),
    JSON.stringify(report, null, 2),
  );
  return report;
}
