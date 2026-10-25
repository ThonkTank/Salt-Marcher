import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export * from './src/app/storage/terrain-color-raster';export * from './src/app/atlas/terrain-projection-cache';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-relief';export {emptyRecord} from './src/app/atlas/atlas-landscape';",
  },
  outfile: '.build/terrain-color-cache-context-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  renderTerrainColor,
  TerrainProjectionCache,
  heightRecord,
  settingsRecord,
  DEFAULT_TERRAIN_STYLE,
  emptyRecord,
} = createRequire(import.meta.url)('../../.build/terrain-color-cache-context-test.cjs');
const drain = (g) => {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
};
function fixture(limit = 256 * 1024) {
  const cache = new TerrainProjectionCache(limit),
    height = heightRecord(
      0,
      0,
      32,
      Float32Array.from({ length: 4096 }, (_, i) => 200 + Math.sin(i % 64) * 40),
    );
  const road = {
    ...emptyRecord('road'),
    id: 'raster-road',
    width: 8,
    points: [
      { x: 0, y: 16 },
      { x: 1024, y: 16 },
    ],
  };
  let reads = 0,
    patches = [];
  const stream = (kind) => {
    reads++;
    return kind === 'height' ? [height] : kind === 'line' ? [road] : kind === 'base' ? patches : [];
  };
  const options = {
    settings: settingsRecord(0),
    stream,
    cache,
    batchEdge: 128,
    contours: 0,
    revision: 1,
    denseRoutes: true,
    retainedRoutes: new Set(Array.from({ length: 500 }, (_, i) => 'retained-road-' + i)),
    checkpoint: function* () {},
  };
  const draw = (box, overrides = {}, width = 32, h = 32, mpp = 1) =>
    drain(renderTerrainColor(box, width, h, mpp, { ...options, ...overrides }));
  return {
    cache,
    options,
    draw,
    reads: () => reads,
    patch(value) {
      patches = value;
    },
  };
}
test('many retained roads leave room for warm colour pixels and local edits in the same bounded cache', () => {
  const f = fixture(),
    boxes = Array.from({ length: 48 }, (_, i) => ({
      x: (i % 8) * 128,
      y: Math.floor(i / 8) * 128,
      width: 32,
      height: 32,
    }));
  const cold = boxes.map((b) => f.draw(b)),
    reads = f.reads();
  assert(reads > 0);
  for (let i = 0; i < boxes.length; i++) assert.deepEqual(f.draw(boxes[i]), cold[i]);
  assert.equal(
    f.reads(),
    reads,
    'unchanged tiles must be reused even with a large retained-road context',
  );
  assert.equal(f.cache.tiles.evictions, 0);
  assert(f.cache.tiles.bytes <= f.cache.tiles.limit);
  const patch = {
    ...emptyRecord('patch'),
    id: 'local-paint',
    values: { terrain: 'forest' },
    polygons: [
      {
        outer: [
          { x: 8, y: 8 },
          { x: 24, y: 8 },
          { x: 24, y: 24 },
          { x: 8, y: 24 },
        ],
        holes: [],
      },
    ],
  };
  f.patch([patch]);
  f.cache.invalidate([{ x: 8, y: 8, width: 16, height: 16 }]);
  for (let i = 1; i < boxes.length; i++) assert.deepEqual(f.draw(boxes[i]), cold[i]);
  assert.equal(f.reads(), reads, 'a local edit must leave distant pixels reusable');
  const changed = f.draw(boxes[0]);
  assert.notDeepEqual(changed, cold[0]);
  assert.deepEqual(changed, f.draw(boxes[0], { cache: undefined }));
  f.cache.invalidate([], true);
  const before = f.reads();
  assert.deepEqual(f.draw(boxes[0]), changed);
  assert(f.reads() > before, 'reset rebuilds the same pixels');
});
test('cached colour distinguishes every rendering context, footprint and image size', () => {
  const f = fixture(),
    box = { x: 0, y: 0, width: 64, height: 64 };
  const initial = f.draw(box),
    baselineReads = f.reads();
  assert.deepEqual(f.draw(box), initial);
  assert.equal(f.reads(), baselineReads);
  const sea = settingsRecord(400),
    style = settingsRecord(0);
  style.terrainSettings.style = { ...DEFAULT_TERRAIN_STYLE, land: '#dc8855' };
  const variants = [
    { options: { contours: 20 } },
    { mpp: 2 },
    { options: { settings: sea } },
    { options: { settings: style } },
    { options: { retainedRoutes: new Set([...f.options.retainedRoutes, 'raster-road']) } },
    { options: { denseRoutes: false } },
    { box: { ...box, x: -16 } },
    { width: 16 },
    { height: 16 },
  ];
  for (const v of variants) {
    const at = v.box ?? box,
      w = v.width ?? 32,
      h = v.height ?? 32,
      mpp = v.mpp ?? 1,
      before = f.reads(),
      cached = f.draw(at, v.options, w, h, mpp);
    assert(f.reads() > before, 'changed context must not reuse another image');
    const after = f.reads();
    assert.deepEqual(f.draw(at, v.options, w, h, mpp), cached);
    assert.equal(f.reads(), after);
    assert.deepEqual(cached, f.draw(at, { ...v.options, cache: undefined }, w, h, mpp));
  }
  assert.notDeepEqual(
    f.draw(box, { retainedRoutes: new Set([...f.options.retainedRoutes, 'raster-road']) }),
    initial,
    'retaining a vector removes its raster duplicate',
  );
});

test('colour and forest share warm pieces, local invalidation, undo and the same byte quota', () => {
  const f = fixture(128 * 1024),
    box = { x: 0, y: 0, width: 64, height: 64 };
  const draw = (overrides = {}) => {
    const forest = new Uint8Array(64 * 64),
      pixels = f.draw(box, { ...overrides, forest }, 64, 64);
    return { pixels, forest };
  };
  const oldColor = f.draw(box, {}, 64, 64),
    empty = draw();
  assert.deepEqual(oldColor, empty.pixels);
  assert(empty.forest.every((v) => v === 0));
  const reads = f.reads();
  assert.deepEqual(draw(), empty);
  assert.equal(f.reads(), reads, 'both channels reuse the same cache entry');
  const patch = {
    ...emptyRecord('patch'),
    id: 'woods',
    values: { terrain: 'forest' },
    polygons: [
      {
        outer: [
          { x: 4, y: 4 },
          { x: 58, y: 4 },
          { x: 58, y: 58 },
          { x: 4, y: 58 },
        ],
        holes: [],
      },
    ],
  };
  f.patch([patch]);
  f.cache.invalidate([{ x: 4, y: 4, width: 54, height: 54 }]);
  const changed = draw();
  assert(changed.forest.some((v) => v > 0));
  assert.deepEqual(changed, draw({ cache: undefined }));
  assert(f.cache.tiles.bytes <= f.cache.tiles.limit);
  f.patch([]);
  f.cache.invalidate([box]);
  assert.deepEqual(draw(), empty, 'undo removes the semantic data along with colour');
  f.patch([patch]);
  f.cache.invalidate([], true);
  assert.deepEqual(draw(), changed, 'reset reconstructs both channels');
  assert.throws(() => f.draw(box, { forest: new Uint8Array(2) }), /Waldabdeckung/);
});
