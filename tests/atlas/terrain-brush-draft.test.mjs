import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  stdin: {
    contents:
      "export {receiveTimedBrushInput,LandscapeBrushSession} from './src/app/atlas/landscape-brush-session';export * from './src/app/atlas/terrain-lake-brush';export * from './src/app/atlas/atlas-surface-draft';export * from './src/app/atlas/terrain-brush-draft';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-lake-coupling';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-spatial-model';export {TerrainDraftStroke} from './src/app/atlas/terrain-stroke-queue';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-brush-draft-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  receiveTimedBrushInput,
  LandscapeBrushSession,
  TerrainDraftStroke,
  applyLakeBrush,
  mergeLakeBrush,
  AtlasSurfaceDraft,
  TerrainBrushDraft,
  applyCoupledTerrainBrush: applyTerrainBrush,
  TerrainSampler,
  heightRecord,
  gridHeight,
} = createRequire(import.meta.url)('../../.build/terrain-brush-draft-test.cjs');
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

test('lake draft equals commit for stationary holding, deepening, partial/full erasure and a following gesture', () => {
  const base = grid(20),
    s = {
      id: 'lake-first',
      mode: 'dig',
      radius: 48,
      strength: 2,
      feather: 0.8,
      waterLevelM: 20,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 1000 },
      ],
    };
  let original = base.editing.author.records;
  const draft = new TerrainBrushDraft(base);
  assert(draft.update(s));
  assert.equal(draft.ground[centre], 18);
  assert.equal(draft.grid.heights[centre], 20);
  assert.equal(draft.grid.editing.water[centre], 20);
  const held = { ...s, samples: [s.samples[0], s.samples[1], { x: 0, y: 0, t: 3000 }] };
  assert(draft.update(held));
  assert.equal(draft.ground[centre], 14);
  let expected = mergeLakeBrush(original, applyLakeBrush(original, held, base));
  assert.deepEqual(draft.records, expected);
  const at = (x, y) => ({ x: x - 64, y: y - 64 });
  for (let y = 25; y <= 100; y += 5)
    for (let x = 25; x <= 100; x += 5) {
      const sample = new TerrainSampler(expected);
      const p = at(x, y);
      assert(Math.abs(draft.ground[y * 129 + x] - sample.sample(p).heightM) < 0.001);
      assert.equal(
        draft.grid.heights[y * 129 + x],
        Math.fround(Math.max(sample.sample(p).heightM, sample.waterLevel(p, -Infinity) ?? 0)),
      );
    }
  const erase = { ...s, id: 'erase', mode: 'erase', radius: 12 };
  const partial = new TerrainBrushDraft(draft.grid);
  assert(partial.update(erase));
  assert.equal(partial.ground[centre], 20);
  assert.equal(partial.grid.editing.water[centre], 0);
  assert(partial.records.some((r) => r.lakeBed));
  const all = new TerrainBrushDraft(partial.grid);
  all.update({ ...erase, radius: 64 });
  assert.equal(all.ground[centre], 20);
  assert(!all.records.some((r) => r.lakeBed));
  assert(all.grid.editing.author.removed.includes(s.id));
  const again = new TerrainBrushDraft(all.grid);
  again.update({ ...s, id: 'lake-again' });
  assert.equal(again.ground[centre], 18);
  for (const r of again.records) assert(!again.grid.editing.author.removed.includes(r.id));
  assert.equal(base.editing.ground[centre], 20);
  assert.equal(base.editing.water[centre], 0);
});

test('a normal height draft lifts the complete lake level before release, preserving depth and following erase', () => {
  const base = grid(20),
    dig = {
      id: 'lake-lift',
      mode: 'dig',
      radius: 24,
      strength: 2,
      feather: 0.8,
      waterLevelM: 20,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 3000 },
      ],
    };
  const lake = new TerrainBrushDraft(base);
  lake.update(dig);
  const draft = new TerrainBrushDraft(lake.grid),
    lift = {
      ...stroke,
      radius: 128,
      strength: 2,
      feather: 0.5,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 2000 },
      ],
    };
  draft.update(lift);
  assert.equal(draft.ground[centre], 18);
  assert.equal(draft.grid.editing.water[centre], 24);
  assert.equal(draft.grid.heights[centre], 24);
  const expected = mergeLakeBrush(lake.records, {
    records: applyTerrainBrush(lake.records, { ...lift, visibility: base.view }, undefined, base),
    remove: [],
  });
  assert.deepEqual(
    [...draft.records].sort((a, b) => a.id.localeCompare(b.id)),
    [...expected].sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.equal(lake.grid.editing.water[centre], 20);
  const erased = new TerrainBrushDraft(draft.grid);
  erased.update({ ...dig, mode: 'erase', radius: 32 });
  assert.equal(erased.ground[centre], 24);
  assert.equal(erased.grid.editing.water[centre], 0);
});

test('a normal height preview restores its source when the prepared author result retracts to no effect', () => {
  const base = grid(20),
    draft = new TerrainBrushDraft(base),
    s = { ...stroke, radius: 16, strength: 2, feather: 0 };
  assert(draft.update(s));
  assert.equal(draft.ground[centre], 22);
  assert(draft.update({ ...s, samples: [...s.samples, { x: 0, y: 0, t: 2000 }] }, []));
  assert.deepEqual(draft.records, base.editing.author.records);
  assert.deepEqual(draft.ground, base.editing.ground);
  assert.deepEqual(draft.grid.heights, base.heights);
  assert.deepEqual(draft.grid.editing.water, base.editing.water);
});

test('a corrected scatter release restores its earlier speculative ground and water support', () => {
  const base = grid(20),
    draft = new TerrainBrushDraft(base),
    s = {
      id: 'speculative',
      mode: 'scatter',
      noise: 1,
      seed: 123456,
      radius: 48,
      strength: 2,
      feather: 0.8,
      waterLevelM: 20,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 2000 },
      ],
    };
  assert(draft.update(s));
  assert(draft.records.some((r) => r.lakeBed));
  receiveTimedBrushInput(s.samples, 0, { x: 0, y: 0 }, 0);
  assert(draft.update(s));
  assert.deepEqual(draft.records, base.editing.author.records);
  assert.deepEqual(draft.ground, base.editing.ground);
  assert.deepEqual(draft.grid.heights, base.heights);
  assert.deepEqual(draft.grid.editing.water, base.editing.water);
});

test('closing a screen gesture waits for its complete final preview; source rejection cancels without enqueue', async () => {
  for (const fail of [false, true]) {
    let resolve,
      reject,
      saving = false,
      previewComplete = false,
      cancelled = 0;
    const writes = [],
      errors = [],
      gate = new Promise((a, b) => {
        resolve = a;
        reject = b;
      }),
      stroke = {
        mode: 'raise',
        radius: 8,
        strength: 1,
        feather: 0.7,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 1, y: 0, t: 1000 },
        ],
        screenInput: {
          version: 1,
          events: [
            { u: 0.4, v: 0.5, t: 0 },
            { u: 0.6, v: 0.5, t: 1000 },
          ],
        },
      },
      host = {
        pointer: null,
        lastPoint: { x: 1, y: 0 },
        points: [],
        get saving() {
          return saving;
        },
        setSaving(v) {
          saving = v;
        },
        endInput() {},
        disable() {},
        say() {},
        clearDraft() {},
        clearHeightPreview() {},
        token: 'test',
        effects: {
          data: () => null,
          error: (e) => errors.push(e),
          previewHeight() {},
          completeHeightPreview: async (s) => {
            assert.equal(s, stroke);
            await gate;
            previewComplete = true;
          },
          redraw() {},
          terrainGesture() {},
          writeTerrain() {
            throw Error('wrong writer');
          },
          localTerrain: () => ({
            cancel() {
              cancelled++;
            },
          }),
        },
      };
    const session = new LandscapeBrushSession(host);
    session.maskStroke = stroke;
    session.live = new TerrainDraftStroke(async (action) => {
      assert(previewComplete, 'no writer before final exact source');
      writes.push(action);
    });
    const completion = session.finishLive();
    await Promise.resolve();
    assert.equal(writes.length, 0);
    assert.equal(saving, true);
    assert.equal(session.livePainting, true);
    if (fail) reject(Error('source missing'));
    else resolve();
    await completion;
    assert.equal(writes.length, fail ? 0 : 1);
    assert.equal(cancelled, fail ? 1 : 0);
    assert.equal(errors.length, fail ? 1 : 0);
    if (!fail) assert.deepEqual(writes[0].stroke, stroke);
    assert.equal(session.livePainting, false);
    assert.equal(session.maskStroke, null);
    assert.equal(saving, false);
  }
});
