import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-projection-cache';export * from './src/app/atlas/terrain-field-stream';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-dirty-rects';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-surface-cache-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  TerrainProjectionCache,
  streamTerrainField,
  heightRecord,
  terrainDirtyRects,
} = require('../../.build/terrain-surface-cache-test.cjs');
const lattice = { x: -12.125, y: -10.25, dx: 0.7, dy: 1.3, columns: 19, rows: 17 };
function source() {
  const records = [
      heightRecord(-64, -64, 1, new Float32Array(4096).fill(100)),
      heightRecord(0, -64, 1, new Float32Array(4096).fill(100)),
      heightRecord(-64, 0, 1, new Float32Array(4096).fill(100)),
      heightRecord(0, 0, 1, new Float32Array(4096).fill(100)),
    ],
    calls = [];
  const stream = (kind, box) => {
    calls.push({ kind, box });
    return kind === 'height' ? records : [];
  };
  return { records, calls, stream };
}
test('retained surfaces rebuild only accumulated dirty blocks, with exact fractional edge coordinates', () => {
  const cache = new TerrainProjectionCache(),
    s = source(),
    initial = cache.grid(lattice, 0, s.stream);
  s.calls.length = 0;
  assert.deepEqual(cache.grid(lattice, 0, s.stream), initial);
  assert.equal(s.calls.length, 0);
  // Different corners include a partial block and a boundary shared by two blocks.
  const changes = [
    { x: lattice.x + (4 - 0.5) * lattice.dx, y: lattice.y, width: 0, height: 0 },
    { x: lattice.x + 18 * lattice.dx, y: lattice.y + 16 * lattice.dy, width: 0, height: 0 },
  ];
  cache.invalidate([changes[0]]);
  cache.invalidate([changes[1]]);
  // Small lakes affect exactly the changed sample positions, independent of height interpolation.
  const lake = changes.map((b, i) => ({
    id: 'lake' + i,
    points: [],
    polygons: [
      {
        outer: [
          { x: b.x - 0.01, y: b.y - 0.01 },
          { x: b.x + 0.01, y: b.y - 0.01 },
          { x: b.x + 0.01, y: b.y + 0.01 },
          { x: b.x - 0.01, y: b.y + 0.01 },
        ],
        holes: [],
      },
    ],
    waterLevelM: 200,
  }));
  const stream = (kind, box) => (kind === 'lake' ? lake : s.stream(kind, box));
  const updated = cache.grid(lattice, 0, stream),
    queries = s.calls.filter((c) => c.kind === 'height');
  assert.equal(
    queries.length,
    2,
    'adjacent boundary blocks share one read; the separate corner stays local',
  );
  assert.equal(
    queries.reduce(
      (sum, q) =>
        sum + Math.round(q.box.width / lattice.dx) * Math.round(q.box.height / lattice.dy),
      0,
    ),
    35,
    'two 4x4 blocks and the 3x1 corner; no clean samples rebuilt',
  );
  assert.deepEqual(updated, streamTerrainField(lattice, 0, stream).surface);
  assert.notDeepEqual(updated, initial);
  const retained = updated.slice();
  cache.invalidate(changes);
  cache.grid(lattice, 0, s.stream);
  assert.deepEqual(updated, retained, 'later edits do not mutate an earlier response');
});
test('seed and returned buffers are owned; dirty read failures remain retryable', () => {
  const cache = new TerrainProjectionCache(),
    s = source(),
    seed = streamTerrainField(lattice, 0, s.stream).surface,
    expected = seed.slice();
  cache.seedGrid(lattice, 0, seed);
  seed.fill(999);
  s.calls.length = 0;
  const response = cache.grid(lattice, 0, s.stream);
  assert.deepEqual(response, expected);
  response.fill(888);
  assert.deepEqual(cache.grid(lattice, 0, s.stream), expected);
  assert.equal(s.calls.length, 0);
  cache.invalidate([
    { x: lattice.x, y: lattice.y, width: 0, height: 0 },
    { x: lattice.x + 18 * lattice.dx, y: lattice.y + 16 * lattice.dy, width: 0, height: 0 },
  ]);
  let reads = 0;
  assert.throws(
    () =>
      cache.grid(lattice, 0, (kind, box) => {
        if (kind === 'height' && ++reads === 2) throw Error('source failure');
        return s.stream(kind, box);
      }),
    /source failure/,
  );
  s.calls.length = 0;
  assert.deepEqual(cache.grid(lattice, 0, s.stream), expected);
  assert.equal(
    s.calls.filter((c) => c.kind === 'height').length,
    2,
    'all dirty blocks retried after partial failure',
  );
});
test('full rebuilds, reset and LRU eviction respect the existing shared byte quota', () => {
  const s = source(),
    cache = new TerrainProjectionCache(1800),
    key = JSON.stringify(['surface', lattice, 0]);
  cache.grid(lattice, 0, s.stream);
  assert.equal(
    cache.tiles.bytes,
    key.length * 2 + 19 * 17 * 4 + 5 * 5 + 128,
    'raster, bitmap, key and metadata counted',
  );
  s.calls.length = 0;
  cache.invalidate([{ x: -100, y: -100, width: 200, height: 200 }]);
  cache.grid(lattice, 0, s.stream);
  assert.equal(
    s.calls.filter((c) => c.kind === 'height').length,
    1,
    'mostly dirty view uses one bounded full stream',
  );
  cache.rememberPixels('other', { x: 1000, y: 1000, width: 1, height: 1 }, new Uint8Array(1000));
  assert(cache.tiles.bytes <= 1800);
  assert(cache.tiles.evictions > 0);
  s.calls.length = 0;
  assert.deepEqual(
    cache.grid(lattice, 0, s.stream),
    streamTerrainField(lattice, 0, s.stream).surface,
  );
  assert(s.calls.length > 0);
  cache.invalidate([], true);
  assert.equal(cache.tiles.bytes, 0);
  const tiny = new TerrainProjectionCache(100);
  tiny.seedGrid(lattice, 0, new Float32Array(323));
  assert.equal(tiny.tiles.bytes, 0);
});

test('joined dirty rectangles cover every dirty sample once, preserve holes and respect the read budget', () => {
  for (const [columns, rows, edge, budget] of [
    [257, 257, 4, 65536],
    [193, 137, 4, 65536],
    [257, 193, 32, 1048576],
  ])
    for (const mode of ['all', 'diagonal', 'holes']) {
      const across = Math.ceil(columns / edge),
        down = Math.ceil(rows / edge);
      const dirty = Uint8Array.from({ length: across * down }, (_, i) =>
        mode === 'all'
          ? 1
          : mode === 'diagonal'
            ? +(i % across === Math.floor(i / across))
            : +(i % 7 !== 3),
      );
      const seen = new Uint8Array(columns * rows);
      for (const r of terrainDirtyRects(dirty, columns, rows, edge, budget)) {
        assert(r.width * r.height <= budget);
        for (let y = r.y; y < r.y + r.height; y++)
          for (let x = r.x; x < r.x + r.width; x++) {
            assert.equal(
              dirty[Math.floor(y / edge) * across + Math.floor(x / edge)],
              1,
              'clean hole must not be read',
            );
            assert.equal(seen[y * columns + x]++, 0, 'no overlapping work');
          }
      }
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < columns; x++)
          assert.equal(
            seen[y * columns + x],
            dirty[Math.floor(y / edge) * across + Math.floor(x / edge)],
          );
    }
});

test('editable cache retains raw ground and potential water without an extra source pass', () => {
  const s = source(),
    cache = new TerrainProjectionCache(),
    first = cache.gridData(lattice, 150, s.stream);
  assert.equal(first.surface[0], 150);
  assert.equal(first.ground[0], 100);
  assert.equal(first.levels[0], 150);
  const snapshot = structuredClone(first);
  first.ground.fill(999);
  first.levels.fill(888);
  s.calls.length = 0;
  assert.deepEqual(cache.gridData(lattice, 150, s.stream), snapshot);
  assert.equal(s.calls.length, 0);
  const box = { x: lattice.x, y: lattice.y, width: lattice.dx * 3, height: lattice.dy * 3 };
  cache.invalidate([box]);
  const changed = cache.gridData(lattice, 150, s.stream),
    cold = streamTerrainField(lattice, 150, s.stream);
  assert.deepEqual(changed.ground, cold.heights);
  assert.deepEqual(changed.levels, cold.levels);
  assert.deepEqual(changed.surface, cold.surface);
  assert.equal(
    cache.tiles.bytes,
    JSON.stringify(['surface', lattice, 150]).length * 2 + 19 * 17 * 12 + 5 * 5 + 128,
  );
  // Old trusted surface-only seeds must not be misrepresented as ground.
  cache.seedGrid(lattice, 150, snapshot.surface);
  s.calls.length = 0;
  assert.deepEqual(cache.gridData(lattice, 150, s.stream), snapshot);
  assert(s.calls.length > 0);
});

function finish(steps) {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
const largeLattice = { x: -60.125, y: -58.75, dx: 0.73, dy: 0.61, columns: 193, rows: 137 };
test('cooperative cold grids close source iterators before yielding and publish only complete owned buffers', () => {
  const s = source(),
    cache = new TerrainProjectionCache(),
    key = JSON.stringify(['surface', largeLattice, 0]);
  let active = 0,
    yields = 0;
  s.records[0] = heightRecord(
    -64,
    -64,
    1,
    Float32Array.from({ length: 4096 }, (_, i) => 80 + 30 * Math.sin(i / 19)),
  );
  function* stream(kind, box) {
    active++;
    try {
      yield* s.stream(kind, box);
    } finally {
      active--;
    }
  }
  function* checkpoint() {
    assert.equal(active, 0, 'no source cursor may survive a transaction boundary');
    yields++;
    yield;
  }
  const cancelled = cache.gridDataSteps(largeLattice, 0, stream, checkpoint);
  for (let i = 0; i < 2; i++) {
    assert.equal(cancelled.next().done, false);
    assert.equal(cache.tiles.get(key), undefined);
  }
  cancelled.return();
  assert.equal(cache.tiles.get(key), undefined);
  const actual = finish(cache.gridDataSteps(largeLattice, 0, stream, checkpoint)),
    expected = new TerrainProjectionCache().gridData(largeLattice, 0, stream);
  assert(yields > 4);
  assert.deepEqual(actual, expected);
  actual.surface.fill(-999);
  actual.ground.fill(-888);
  assert.deepEqual(
    cache.gridData(largeLattice, 0, stream),
    expected,
    'returned arrays cannot mutate the cached surface',
  );
});
test('cancelling a dirty grid preserves all dirty bits and previous buffers until a complete retry', () => {
  const s = source(),
    cache = new TerrainProjectionCache(),
    before = cache.gridData(largeLattice, 0, s.stream),
    key = JSON.stringify(['surface', largeLattice, 0]);
  const changes = [
    { x: largeLattice.x, y: largeLattice.y, width: 10, height: 8 },
    { x: largeLattice.x + 110, y: largeLattice.y + 70, width: 4, height: 4 },
  ];
  cache.invalidate(changes);
  const retained = cache.tiles.get(key),
    dirty = retained.dirty.slice(),
    heights = retained.heights.slice();
  const lake = {
    id: 'changed-lake',
    points: [],
    polygons: changes.map((b) => ({
      outer: [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height },
      ],
      holes: [],
    })),
    waterLevelM: 500,
  };
  const stream = (kind, box) => (kind === 'lake' ? [lake] : s.stream(kind, box)),
    steps = cache.gridDataSteps(largeLattice, 0, stream, function* () {
      yield;
    });
  assert.equal(steps.next().done, false);
  assert.deepEqual(retained.dirty, dirty);
  assert.deepEqual(retained.heights, heights);
  steps.return();
  const actual = finish(
    cache.gridDataSteps(largeLattice, 0, stream, function* () {
      yield;
    }),
  );
  assert.deepEqual(actual, new TerrainProjectionCache().gridData(largeLattice, 0, stream));
  assert.notDeepEqual(actual.surface, before.surface);
  assert.deepEqual(before.surface, heights);
  assert(!retained.dirty.some(Boolean));
});
test('source failure or invalidation during a paused grid cannot publish stale surface data', () => {
  for (const warm of [false, true])
    for (const mode of ['failure', 'invalidate', 'reset']) {
      const s = source(),
        cache = new TerrainProjectionCache(),
        key = JSON.stringify(['surface', largeLattice, 0]);
      if (warm) {
        cache.gridData(largeLattice, 0, s.stream);
        cache.invalidate([
          { x: -50, y: -50, width: 8, height: 4 },
          { x: 40, y: 10, width: 8, height: 4 },
        ]);
      }
      const retained = cache.tiles.get(key),
        snapshot = retained && { heights: retained.heights.slice(), dirty: retained.dirty.slice() };
      let broken = false;
      const stream = (kind, box) => {
        if (broken) throw Error('source failure');
        return s.stream(kind, box);
      };
      const steps = cache.gridDataSteps(largeLattice, 0, stream, function* () {
        yield;
      });
      assert.equal(steps.next().done, false);
      if (mode === 'failure') broken = true;
      else cache.invalidate([{ x: -48, y: -48, width: 2, height: 2 }], mode === 'reset');
      assert.throws(
        () => finish(steps),
        mode === 'failure' ? /source failure/ : /inzwischen geändert/,
      );
      if (retained) assert.deepEqual(retained.heights, snapshot.heights);
      if (mode === 'reset' || !warm) assert.equal(cache.tiles.get(key), undefined);
      else assert(cache.tiles.get(key).dirty.some(Boolean));
      assert.deepEqual(
        cache.gridData(largeLattice, 0, s.stream),
        new TerrainProjectionCache().gridData(largeLattice, 0, s.stream),
      );
    }
});

function colorOracle(lattice, sea, stream) {
  const { heights, water, levels } = streamTerrainField(lattice, sea, stream, false);
  return { heights, water, levels };
}
test('coarse colour retains exact water decisions, owns buffers and accounts every retained byte', () => {
  const cache = new TerrainProjectionCache(),
    records = [
      heightRecord(
        0,
        0,
        1,
        Float32Array.from({ length: 4096 }, (_, i) => (i % 2 ? 100.00000762939453 : 100)),
      ),
    ];
  const l = { x: 10.125, y: 12.25, dx: 0.25, dy: 0.25, columns: 19, rows: 17 };
  let reads = 0;
  const stream = (kind) => {
      reads++;
      return kind === 'height' ? records : [];
    },
    read = () => finish(cache.colorFieldSteps(l, 100, stream, function* () {}));
  const expected = colorOracle(l, 100, stream),
    first = read();
  assert.deepEqual(first, expected);
  assert(
    expected.heights.some((h, i) => h <= 100 && expected.water[i] === 0),
    'rounded heights cannot reconstruct the exact shoreline decision',
  );
  first.heights.fill(-500);
  first.water.fill(1);
  reads = 0;
  assert.deepEqual(read(), expected);
  assert.equal(reads, 0);
  const key = JSON.stringify(['surface', l, 100]);
  assert.equal(cache.tiles.bytes, key.length * 2 + l.columns * l.rows * 13 + 5 * 5 + 128);
  cache.seedGrid(l, 100, new Float32Array(l.columns * l.rows).fill(100));
  reads = 0;
  assert.deepEqual(read(), expected);
  assert(reads > 0, 'height-only seeds do not invent water decisions');
  const tiny = new TerrainProjectionCache(100);
  assert.deepEqual(finish(tiny.colorFieldSteps(l, 100, stream, function* () {})), expected);
  assert.equal(tiny.tiles.bytes, 0);
});
test('coarse colour updates and removes local lakes without resampling clean ground or mutating older replies', () => {
  const cache = new TerrainProjectionCache(),
    s = source(),
    read = (stream) => finish(cache.colorFieldSteps(largeLattice, 0, stream, function* () {})),
    before = read(s.stream);
  const b = { x: -30, y: -20, width: 3, height: 3 },
    lake = {
      id: 'lake',
      points: [],
      polygons: [
        {
          outer: [
            { x: b.x, y: b.y },
            { x: b.x + b.width, y: b.y },
            { x: b.x + b.width, y: b.y + b.height },
            { x: b.x, y: b.y + b.height },
          ],
          holes: [],
        },
      ],
      waterLevelM: 200,
    };
  const stream = (kind, box) => (kind === 'lake' ? [lake] : s.stream(kind, box));
  cache.invalidate([b]);
  s.calls.length = 0;
  const after = read(stream),
    samples = s.calls
      .filter((c) => c.kind === 'height')
      .reduce((n, c) => n + ((c.box.width / largeLattice.dx) * c.box.height) / largeLattice.dy, 0);
  assert(samples < (largeLattice.columns * largeLattice.rows) / 10);
  assert.deepEqual(after, colorOracle(largeLattice, 0, stream));
  assert.notDeepEqual(after.water, before.water);
  const saved = structuredClone(after);
  cache.invalidate([b]);
  assert.deepEqual(read(s.stream), before);
  assert.deepEqual(after, saved);
  cache.invalidate([], true);
  assert.deepEqual(read(stream), colorOracle(largeLattice, 0, stream));
});
test('cancelled or invalidated colour fields keep prior water and dirty state until a complete retry', () => {
  for (const mode of ['cancel', 'invalidate', 'reset']) {
    const cache = new TerrainProjectionCache(),
      s = source(),
      read = () => finish(cache.colorFieldSteps(largeLattice, 0, s.stream, function* () {}));
    read();
    const key = JSON.stringify(['surface', largeLattice, 0]),
      retained = cache.tiles.get(key),
      water = retained.water.slice();
    cache.invalidate([
      { x: -40, y: -30, width: 4, height: 4 },
      { x: 30, y: 20, width: 4, height: 4 },
    ]);
    const dirty = retained.dirty.slice();
    const work = cache.colorFieldSteps(largeLattice, 0, s.stream, function* () {
      yield;
    });
    assert.equal(work.next().done, false);
    if (mode === 'cancel') work.return();
    else {
      cache.invalidate([{ x: -40, y: -30, width: 4, height: 4 }], mode === 'reset');
      assert.throws(() => finish(work), /inzwischen geändert/);
    }
    assert.deepEqual(retained.water, water);
    assert.deepEqual(retained.dirty, dirty);
    assert.deepEqual(read(), colorOracle(largeLattice, 0, s.stream));
  }
});
