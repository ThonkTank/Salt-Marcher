import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-brush-draft';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-spatial-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-brush-draft-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { TerrainBrushDraft, applyTerrainBrush, TerrainSampler, heightRecord, gridHeight } =
  createRequire(import.meta.url)('../../.build/terrain-brush-draft-test.cjs');
function grid(height = -100) {
  const view = {
    box: { x: -64, y: -64, width: 128, height: 128 },
    frame: { x: -64, y: -64, width: 128, height: 128 },
    columns: 129,
    rows: 129,
    focusM: 0,
    tilt: 0,
    rotation: 0,
    exaggeration: 1,
  };
  return {
    view,
    heights: new Float32Array(129 * 129).fill(Math.max(0, height)),
    seaLevelM: 0,
    editing: {
      author: {
        records: [-1, 0].flatMap((y) =>
          [-1, 0].map((x) =>
            heightRecord(x * 256, y * 256, 4, new Float32Array(4096).fill(height)),
          ),
        ),
      },
      ground: new Float32Array(129 * 129).fill(height),
      water: new Float32Array(129 * 129),
    },
  };
}
const centre = 64 * 129 + 64;
const stroke = {
  mode: 'raise',
  radius: 32,
  strength: 200,
  feather: 0.5,
  samples: [
    { x: 0, y: 0, t: 0 },
    { x: 0, y: 0, t: 1000 },
  ],
};
test('raising starts below the sea; cumulative input is applied once without modifying the confirmed grid', () => {
  const base = grid(),
    draft = new TerrainBrushDraft(base);
  draft.update({ ...stroke, samples: [stroke.samples[0], { x: 0, y: 0, t: 250 }] });
  assert.equal(draft.ground[centre], -50);
  assert.equal(draft.grid.heights[centre], 0);
  draft.update({
    ...stroke,
    samples: [stroke.samples[0], { x: 0, y: 0, t: 250 }, stroke.samples[1]],
  });
  assert.equal(draft.ground[centre], 100);
  assert.equal(draft.grid.heights[centre], 100);
  assert.equal(draft.update(stroke), false);
  assert.equal(base.editing.ground[centre], -100);
  assert.equal(base.heights[centre], 0);
});
test('continuous draft and canonical additive brush agree at authored lattice nodes for raise, lower and roughen', () => {
  for (const mode of ['raise', 'lower', 'roughen']) {
    const s = { ...stroke, mode, roughness: 1.4, seed: 3823 };
    const draft = new TerrainBrushDraft(grid());
    draft.update(s);
    const sampler = new TerrainSampler(applyTerrainBrush([], s));
    for (let y = 50; y <= 78; y += 7)
      for (let x = 50; x <= 78; x += 7)
        assert(
          Math.abs(draft.ground[y * 129 + x] - sampler.sample({ x: x - 64, y: y - 64 }).heightM) <
            0.001,
          mode,
        );
  }
});
test('lowering a dry lake bed reveals its stored water level; levelling and smoothing do not overshoot', () => {
  const base = grid(200);
  base.editing.water.fill(100);
  const draft = new TerrainBrushDraft(base);
  draft.update({ ...stroke, mode: 'lower' });
  assert(Math.abs(draft.ground[centre]) < 0.0001);
  assert.equal(draft.grid.heights[centre], 100);
  const level = new TerrainBrushDraft(base);
  level.update({ ...stroke, mode: 'level', targetM: 180 });
  assert.equal(level.ground[centre], 180);
  const smooth = new TerrainBrushDraft(base);
  smooth.update({ ...stroke, mode: 'smooth' });
  assert.equal(smooth.ground[centre], 200);
});
test('offscreen nodes remain untouched and the display allocation is independent of world author count', () => {
  const base = grid();
  base.view.frame = { x: -10, y: -10, width: 20, height: 20 };
  const draft = new TerrainBrushDraft(base);
  draft.update(stroke);
  assert.equal(draft.ground[64 * 129 + 84], -100);
  assert.equal(draft.ground.length, base.heights.length);
});

test('overlapping forms and multiscale smoothing share exact author nodes across seams, display resolutions and pending successors', () => {
  const merge = (records, changes) => [
    ...new Map([...records, ...changes].map((r) => [r.id, r])).values(),
  ];
  let original = [];
  for (let y = -2; y <= 1; y++)
    for (let x = -2; x <= 1; x++) {
      original.push(
        heightRecord(
          x * 256,
          y * 256,
          4,
          Float32Array.from(
            { length: 4096 },
            (_, i) =>
              220 +
              0.12 * (x * 256 + (i % 64) * 4) +
              15 * Math.cos((y * 256 + Math.floor(i / 64) * 4) / 25),
          ),
          2,
        ),
      );
      original.push(
        heightRecord(
          x * 64,
          y * 64,
          1,
          Float32Array.from(
            { length: 4096 },
            (_, i) => 6 * Math.sin((y * 64 + Math.floor(i / 64)) / 3),
          ),
          2,
        ),
      );
    }
  const makeGrid = (records, columns) => {
    const view = {
      ...grid().view,
      box: { x: -63.7, y: -63.3, width: 127.1, height: 126.7 },
      frame: { x: -63.7, y: -63.3, width: 127.1, height: 126.7 },
      columns,
      rows: columns,
    };
    const sampler = new TerrainSampler(records, false),
      ground = Float32Array.from(
        { length: columns * columns },
        (_, i) =>
          sampler.sample({
            x: view.box.x + ((i % columns) * view.box.width) / (columns - 1),
            y: view.box.y + (Math.floor(i / columns) * view.box.height) / (columns - 1),
          }).heightM,
      );
    return {
      view,
      heights: ground.slice(),
      seaLevelM: 0,
      editing: { ground, water: new Float32Array(ground.length), author: { records } },
    };
  };
  const curve = [
    { x: -30, y: -15, t: 0 },
    { x: 0, y: 5, t: 500 },
    { x: 30, y: 12, t: 1100 },
  ];
  const sequence = ['hills', 'mountains', 'canyon'].map((form, i) => ({
    mode: form === 'canyon' ? 'lower' : 'raise',
    form,
    seed: 0x51a7c3,
    radius: i === 2 ? 8 : 32,
    strength: 45,
    feather: 0.7,
    samples: curve.map((p) => ({ ...p, x: p.y, y: p.x })),
  }));
  for (const preserveDetails of [true, false]) {
    const actions = [
      ...sequence,
      ...[64, 16].map((radius) => ({
        mode: 'smooth',
        radius,
        strength: 50,
        feather: 0.8,
        samples: curve,
      })),
      { mode: 'raise', radius: 64, strength: 30, feather: 0.8, samples: curve },
    ].map((s) => ({ ...s, preserveDetails }));
    let canonical = original;
    const drafts = [67, 98].map((n) => makeGrid(original, n));
    let maximum = 0;
    for (const action of actions) {
      canonical = merge(
        canonical,
        applyTerrainBrush(canonical, { ...action, visibility: drafts[0].view }),
      );
      for (let k = 0; k < drafts.length; k++) {
        const draft = new TerrainBrushDraft(drafts[k]);
        assert(draft.update(action));
        const expected = makeGrid(canonical, drafts[k].view.columns);
        for (let i = 0; i < draft.ground.length; i++)
          maximum = Math.max(maximum, Math.abs(draft.ground[i] - expected.editing.ground[i]));
        // Both display planes interpolate the same canonical authored surface.
        for (const p of [
          { x: -0.13, y: 0.27 },
          { x: 31.83, y: -0.27 },
          { x: -31.91, y: 20.23 },
        ])
          assert(Math.abs(gridHeight(draft.grid, p) - gridHeight(expected, p)) <= 0.0001);
        const hash = (rs) =>
          createHash('sha256')
            .update(JSON.stringify(rs.map((r) => [r.id, r.height.data]).sort()))
            .digest('hex');
        assert.equal(hash(draft.records), hash(canonical));
        assert.equal(draft.update(action), false, 'response adoption cannot apply the dose twice');
        drafts[k] = draft.grid;
      }
    }
    // Six f32 additions at heights below 500 m: <= 6 * 2^-15 m, well below 1 mm.
    assert(maximum <= 6 * 2 ** -15, 'Float32 forward error: ' + maximum);
    console.log(
      JSON.stringify({ preserveDetails, maximumHeightErrorM: maximum, gestures: actions.length }),
    );
  }
});
