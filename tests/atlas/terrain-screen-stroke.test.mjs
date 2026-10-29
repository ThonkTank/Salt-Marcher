import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-screen-triangle';export * from './src/app/atlas/atlas-screen-segment';export * from './src/app/atlas/terrain-screen-input';export * from './src/app/atlas/terrain-screen-geometry';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/atlas-camera';export * from './src/app/atlas/atlas-terrain-ray';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-lake-scatter';export * from './src/app/atlas/terrain-lake-brush';export * from './src/app/atlas/landscape-geometry';export * from './src/app/atlas/terrain-stroke-support';export * from './src/app/atlas/terrain-form-brush';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  atlasScreenTriangle,
  atlasScreenSegment,
  planTerrainScreenInput,
  TerrainScreenGeometry,
  validateTerrainScreenInput,
  atlasProject,
  atlasCameraWorldEye,
  atlasCameraClipRange,
  atlasTerrainRay,
  prepareHeightBrush,
  applyTerrainBrush,
  decodeHeights,
  prepareLakeScatter,
  applyLakeBrush,
  lakeHeightStroke,
  contains,
  terrainSupportTiles,
  terrainCentrelineTiles,
  validateHeightStroke,
  validateLakeStroke,
  prepareTerrainForm,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
const view = {
  box: { x: -5, y: -5, width: 10, height: 10 },
  frame: { x: -5, y: -5, width: 10, height: 10 },
  columns: 33,
  rows: 33,
  focusM: 0,
  tilt: 0,
  rotation: 0,
  exaggeration: 1,
  projection: 'perspective',
};
const world = (u, v, depth) => ({
  x: ((u - 0.5) * 10 * depth) / 15,
  y: ((v - 0.5) * 10 * depth) / 15,
  z: 15 - depth,
});
const triangle = (id, points) =>
  atlasScreenTriangle(
    view,
    points.map(([u, v, d]) => world(u, v, d)),
    id,
  );
const screen = (version, events) => ({ version, events: events.map(([u, v, t]) => ({ u, v, t })) });
const plain = () => ({
  view: structuredClone(view),
  heights: new Float32Array(33 * 33),
  seaLevelM: 0,
});
function ray(v, p) {
  const eye = atlasCameraWorldEye(v),
    c = Math.cos((v.rotation * Math.PI) / 180),
    s = Math.sin((v.rotation * Math.PI) / 180),
    ct = Math.cos((v.tilt * Math.PI) / 180),
    st = Math.sin((v.tilt * Math.PI) / 180),
    d = v.frame.height * 1.5,
    x = (p.u - 0.5) * v.frame.width,
    y = (p.v - 0.5) * v.frame.height,
    plane = {
      x: v.frame.x + v.frame.width / 2 + c * x + s * ct * y,
      y: v.frame.y + v.frame.height / 2 - s * x + c * ct * y,
      z: v.focusM - (st * y) / v.exaggeration,
    },
    range = atlasCameraClipRange(v);
  const at = (t) => [
    eye.x + ((plane.x - eye.x) * t) / d,
    eye.y + ((plane.y - eye.y) * t) / d,
    eye.heightM + ((plane.z - eye.heightM) * t) / d,
  ];
  return [at(range.near), at(range.far)];
}
test('a narrow occluder inside one tile owns its whole positive interval and one-sided limits', () => {
  const bg = triangle('tile:background', [
      [0, 0, 15],
      [1, 0, 15],
      [0.5, 1, 15],
    ]),
    front = triangle('tile:narrow', [
      [0.5001, 0.1, 10],
      [0.5002, 0.1, 10],
      [0.50015, 0.9, 10],
    ]),
    p = { u: 0.4, v: 0.5 },
    q = { u: 0.6, v: 0.5 },
    sections = atlasScreenSegment([bg, front], p, q);
  assert.deepEqual(
    sections.map((s) => s.owner.id),
    ['tile:background', 'tile:narrow', 'tile:background'],
  );
  assert.ok(Math.abs(sections[1].start - 0.500625) < 1e-12);
  assert.ok(Math.abs(sections[1].end - 0.500875) < 1e-12);
  const boundary = { u: p.u + (q.u - p.u) * sections[1].start, v: 0.5 },
    a = sections[0].owner.point(boundary),
    b = sections[1].owner.point(boundary);
  assert.equal(a.z, 0);
  assert.equal(b.z, 5);
  assert.ok(Math.abs(a.x - b.x) > 0.0004);
  assert.equal(
    atlasScreenSegment([bg, front], front.polygon[0], front.polygon[0])[0].owner.id,
    'tile:narrow',
  );
});
test('affine inverse-depth crossings partition the active overlap without a ray sample guess', () => {
  const plane = (id, f) =>
      triangle(id, [
        [0.2, 0.1, 1 / f(0.2)],
        [0.8, 0.1, 1 / f(0.8)],
        [0.5, 0.9, 1 / f(0.5)],
      ]),
    sections = atlasScreenSegment(
      [
        plane('left', (u) => 0.12 - 0.08 * u),
        plane('middle', () => 0.081),
        plane('right', (u) => 0.04 + 0.08 * u),
      ],
      { u: 0.4, v: 0.4 },
      { u: 0.6, v: 0.4 },
    );
  assert.deepEqual([...new Set(sections.map((s) => s.owner.id))], ['left', 'middle', 'right']);
  assert.ok(Math.abs(sections.find((s) => s.owner.id === 'middle').start - 0.4375) < 1e-12);
  assert.ok(Math.abs(sections.findLast((s) => s.owner.id === 'middle').end - 0.5625) < 1e-12);
});
test('near, far and viewport clipping preserve projective attributes and reject degenerate area', () => {
  const near = triangle('near', [
      [0.2, 0.2, 0.001],
      [0.8, 0.2, 1],
      [0.5, 0.8, 1],
    ]),
    sections = atlasScreenSegment([near], { u: 0.65, v: 0.4 }, { u: 0.7, v: 0.4 });
  assert.ok(sections.some((s) => s.owner));
  for (const s of sections)
    if (s.owner)
      for (const f of [s.start, (s.start + s.end) / 2, s.end]) {
        const u = 0.65 + 0.05 * f,
          p = s.owner.point({ u, v: 0.4 }),
          projected = atlasProject(view, p, p.z);
        assert.ok(p.depth >= atlasCameraClipRange(view).near - 1e-12);
        assert.ok(Math.abs(projected.x - u) < 1e-10);
        assert.ok(Math.abs(projected.y - 0.4) < 1e-10);
      }
  assert.equal(
    triangle('flat', [
      [0.1, 0.2, 10],
      [0.5, 0.2, 10],
      [0.9, 0.2, 10],
    ]),
    null,
  );
  assert.equal(
    triangle('far', [
      [0.1, 0.1, 1e6],
      [0.9, 0.1, 1e6],
      [0.5, 0.9, 1e6],
    ]),
    null,
  );
  assert.ok(
    atlasScreenSegment([near], { u: -2, v: -2 }, { u: -1, v: -1 }).every((s) => s.owner === null),
  );
});
test('screen-time integration is event-density invariant; holding outside the viewport loses only its own time', () => {
  const grid = plain(),
    input = screen(1, [
      [0.25, 0.5, 0],
      [0.75, 0.5, 1000],
      [0.75, 0.5, 2000],
      [1.25, 0.5, 3000],
      [1.25, 0.5, 4000],
    ]),
    plan = planTerrainScreenInput(input, 0.7, grid),
    dense = [];
  for (let i = 0; i < input.events.length; i++) {
    const p = input.events[i];
    if (!i) dense.push(p);
    else
      for (const f of [0.25, 0.5, 0.75, 1]) {
        const a = input.events[i - 1];
        dense.push({
          u: a.u + (p.u - a.u) * f,
          v: a.v + (p.v - a.v) * f,
          t: a.t + (p.t - a.t) * f,
        });
      }
  }
  assert.deepEqual(
    planTerrainScreenInput({ version: 1, events: dense }, 0.7, grid).dabs,
    plan.dabs,
  );
  assert.ok(Math.abs(plan.dabs.reduce((sum, d) => sum + d.seconds, 0) - 2.5) < 1e-12);
  assert.ok(plan.dabs.every((d) => d.x <= 5 && d.x >= -5));
  assert.equal(
    planTerrainScreenInput(
      screen(1, [
        [1.2, 0.5, 0],
        [1.2, 0.5, 1000],
      ]),
      0.7,
      grid,
    ).dabs.length,
    0,
  );
});
test('triangle-owned world centres agree with the independent grid-ray kernel through a folded one-tile surface', () => {
  const grid = plain();
  grid.view.tilt = 75;
  for (let y = 0; y < 33; y++)
    for (let x = 0; x < 33; x++)
      grid.heights[y * 33 + x] = x >= 15 && x <= 17 && y >= 17 && y <= 23 ? 5 : 0;
  const input = screen(1, [
      [0.2, 0.5, 0],
      [0.8, 0.5, 1200],
    ]),
    plan = planTerrainScreenInput(input, 0.7, grid);
  assert.ok(plan.sections.length > 3);
  assert.ok(plan.centrelines.length > 1);
  for (const section of plan.sections)
    for (const f of [0.21132486540518713, 0.5, 0.7886751345948129]) {
      const t = (section.startMs + (section.endMs - section.startMs) * f) / 1200,
        p = { u: 0.2 + 0.6 * t, v: 0.5 },
        actual = section.point(f),
        hit = atlasTerrainRay(grid, ray(grid.view, p));
      assert.ok(hit);
      assert.ok(
        Math.hypot(actual.x - hit.point.x, actual.y - hit.point.y, actual.z - hit.point.heightM) <
          1e-7,
      );
    }
  // Geometry retains exact one-sided endpoints. Joining is allowed only
  // across contiguous sections with the same triangle owner, never by distance.
  const expected = [];
  let previous;
  for (const section of plan.sections) {
    const a = section.point(0),
      b = section.point(1);
    if (!previous || previous.owner !== section.owner || previous.endMs !== section.startMs)
      expected.push([{ x: a.x, y: a.y }]);
    const last = expected.at(-1).at(-1);
    if (last.x !== b.x || last.y !== b.y) expected.at(-1).push({ x: b.x, y: b.y });
    previous = section;
  }
  assert.deepEqual(plan.centrelines, expected);
});
test('screen input owns dose and author work even if supplied legacy world samples describe a different bridge', () => {
  const grid = plain(),
    stroke = {
      mode: 'raise',
      radius: 0.7,
      strength: 1,
      feather: 0.7,
      samples: [
        { x: -4, y: -4, t: 0 },
        { x: 4, y: 4, t: 1000 },
      ],
      visibility: grid.view,
      screenInput: screen(1, [
        [0.25, 0.5, 0],
        [0.75, 0.5, 1000],
      ]),
    },
    prepared = prepareHeightBrush(stroke, grid),
    records = applyTerrainBrush([], stroke, undefined, grid);
  assert.equal(prepared.dose({ x: 2, y: 2 }), 0);
  assert.ok(prepared.dose({ x: 0, y: 0 }) > 0);
  assert.ok(records.length > 0);
  let count = 0;
  for (const r of records) {
    const h = r.height,
      data = decodeHeights(h);
    for (let i = 0; i < data.length; i++)
      if (Number.isFinite(data[i]) && data[i] !== 0) {
        assert.ok(
          prepared.dose({ x: h.x + (i % 64) * h.pixel, y: h.y + Math.floor(i / 64) * h.pixel }) > 0,
        );
        count++;
      }
  }
  assert.ok(count > 0);
  assert.throws(() => prepareHeightBrush(stroke), /Geländeoberfläche fehlt/);
});
test('screen transfer rejects malformed time, versions and unknown fields while preserving off-viewport events', () => {
  for (const input of [
    screen(2, [[0.5, 0.5, 0]]),
    screen(1, [[0.5, 0.5, 1]]),
    screen(1, [
      [0.5, 0.5, 0],
      [0.6, 0.5, -1],
    ]),
    screen(1, [[NaN, 0.5, 0]]),
    { ...screen(1, [[0.5, 0.5, 0]]), dabs: [] },
  ])
    assert.throws(() => validateTerrainScreenInput(input, view), /Bildschirmzug/);
  assert.throws(() => validateTerrainScreenInput(screen(1, [[0.5, 0.5, 0]])), /Bildschirmzug/);
  assert.doesNotThrow(() =>
    validateTerrainScreenInput(
      screen(1, [
        [-2, 3, 0],
        [-2, 3, 1000],
      ]),
      view,
    ),
  );
});

test('missing declared surface members and nonfinite heights fail instead of becoming sky', () => {
  const input = screen(1, [
      [0.5, 0.5, 0],
      [0.5, 0.5, 1000],
    ]),
    missing = plain();
  missing.view.surface = { metersPerPixel: 0.1, tiles: [{ lod: 0, x: 0, y: 0 }] };
  assert.throws(() => planTerrainScreenInput(input, 0.7, missing), /Geländeoberfläche fehlt/);
  missing.surface = [plain()];
  assert.throws(() => planTerrainScreenInput(input, 0.7, missing), /Geländekachel fehlt/);
  const broken = plain();
  broken.heights[10] = NaN;
  assert.throws(() => planTerrainScreenInput(input, 0.7, broken), /Geländeoberfläche fehlt/);
});
test('finite input bytes and author lattice addresses are bounded before planning work', () => {
  const events = Array.from({ length: 20000 }, (_, i) => ({
    u: 0.12345678912345678,
    v: 0.9876543219876543,
    t: i * 0.123456789123456,
  }));
  assert.throws(() => validateTerrainScreenInput({ version: 1, events }, view), /Eingabegröße/);
  assert.throws(
    () => terrainSupportTiles([{ x: 1e12, y: 1e12 }], 1e-7, 2 ** -24),
    /nicht präzise darstellbar/,
  );
});
const real = JSON.parse(
  readFileSync(new URL('../fixtures/terrain-screen-strokes.json', import.meta.url), 'utf8'),
);
for (const fixture of real.cases)
  test(
    'saved ' +
      fixture.label +
      ' gesture excludes its certified old bridge for basic, all forms and lake scatter',
    () => {
      const grid = {
          view: fixture.view,
          heights: new Float32Array(fixture.view.columns * fixture.view.rows),
          seaLevelM: 0,
          surface: fixture.cells.map((c) => ({
            view: { ...fixture.view, box: c.box, columns: 2, rows: 2 },
            heights: Float32Array.from(c.heights),
            seaLevelM: 0,
          })),
        },
        stroke = fixture.stroke,
        plan = prepareHeightBrush(stroke, grid),
        legacy = prepareHeightBrush({ ...stroke, screenInput: undefined });
      assert.equal(plan.dose(fixture.excluded.point), 0);
      assert.ok(legacy.dose(fixture.excluded.point) > 0);
      assert.ok(plan.dose(plan.dabs[0]) > 0);
      assert.ok(plan.sections.length > 0);
      assert.ok(
        Math.abs(
          plan.dabs.reduce((sum, d) => sum + d.seconds, 0) -
            stroke.screenInput.events.at(-1).t / 1000,
        ) < 1e-11,
      );
      // Form exposure uses the union of separate triangle-owned centrelines. It
      // cannot synthesize a ridge or trench along the legacy foreground/back bridge.
      for (const form of ['hills', 'mountains', 'canyon']) {
        const prepared = prepareHeightBrush(
          { ...stroke, form, mode: form === 'canyon' ? 'lower' : 'raise' },
          grid,
        );
        assert.equal(prepared.dose(fixture.excluded.point), 0, form);
        assert.ok(prepared.dose(plan.dabs[0]) > 0, form);
      }
      const lake = {
          ...stroke,
          id: 'real-scatter',
          mode: 'scatter',
          waterLevelM: null,
          noise: 0.7,
          seed: 123,
        },
        scatter = prepareLakeScatter(lake, grid);
      assert.equal(contains(fixture.excluded.point, scatter.footprint), false);
      assert.equal(scatter.dose(fixture.excluded.point), 0);
      const dense = [];
      for (let i = 0; i < lake.screenInput.events.length; i++) {
        const p = lake.screenInput.events[i];
        if (!i) dense.push(p);
        else
          for (const f of [0.25, 0.5, 0.75, 1]) {
            const a = lake.screenInput.events[i - 1];
            dense.push({
              u: a.u + (p.u - a.u) * f,
              v: a.v + (p.v - a.v) * f,
              t: a.t + (p.t - a.t) * f,
            });
          }
      }
      const replay = prepareLakeScatter(
        { ...lake, screenInput: { version: 1, events: dense } },
        grid,
      );
      assert.deepEqual(replay.dabs, scatter.dabs);
      assert.deepEqual(
        replay.basins.map(({ key, anchor, polygons }) => ({ key, anchor, polygons })),
        scatter.basins.map(({ key, anchor, polygons }) => ({ key, anchor, polygons })),
      );
    },
  );

test('spatial footprint tile work follows complete separate capsules rather than endpoint circles or a union box', () => {
  const separated = terrainCentrelineTiles(
      [
        [
          { x: -5, y: 0 },
          { x: -4, y: 0 },
        ],
        [
          { x: 4, y: 0 },
          { x: 5, y: 0 },
        ],
      ],
      0.7,
      0.015625,
    ),
    joined = terrainCentrelineTiles(
      [
        [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
      ],
      0.7,
      0.015625,
    );
  assert(!separated.some((t) => t.x === 0));
  assert(joined.some((t) => t.x === 0));
  const diagonal = terrainCentrelineTiles(
    [
      [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
    ],
    0.1,
    0.0625,
  );
  assert(diagonal.length < 60);
  assert(diagonal.some((t) => t.x === 6 && t.y === 6));
  assert(!diagonal.some((t) => t.x === 0 && t.y === 10));
});

test('present malformed screen fields cannot silently fall back to legacy world samples at either command boundary', () => {
  const base = {
    radius: 0.7,
    strength: 1,
    feather: 0.7,
    visibility: view,
    samples: [{ x: 0, y: 0, t: 0 }],
  };
  for (const screenInput of [null, false, 0, '']) {
    assert.throws(
      () => validateHeightStroke({ ...base, mode: 'raise', screenInput }),
      /Bildschirmzug/,
    );
    assert.throws(
      () =>
        validateLakeStroke({
          ...base,
          id: 'invalid-screen',
          mode: 'dig',
          waterLevelM: 0,
          screenInput,
        }),
      /Bildschirmzug/,
    );
  }
});

test('long stationary screen holding integrates time without exhausting spatial footprint points or moving basins', () => {
  const grid = plain(),
    s = {
      mode: 'scatter',
      id: 'hold',
      waterLevelM: 0,
      radius: 0.7,
      strength: 1,
      feather: 0.7,
      noise: 0.7,
      seed: 123,
      visibility: grid.view,
      samples: [
        { x: 0, y: 0, t: 0 },
        { x: 0, y: 0, t: 100000 },
      ],
      screenInput: screen(1, [
        [0.5, 0.5, 0],
        [0.5, 0.5, 100000],
      ]),
    },
    held = prepareLakeScatter(s, grid),
    short = prepareLakeScatter(
      {
        ...s,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 1000 },
        ],
        screenInput: screen(1, [
          [0.5, 0.5, 0],
          [0.5, 0.5, 1000],
        ]),
      },
      grid,
    ),
    plan = planTerrainScreenInput(s.screenInput, 0.7, grid);
  assert.equal(plan.centrelines.flat().length, 1);
  assert.equal(plan.dabs.length, 1);
  assert.ok(Math.abs(plan.dabs[0].seconds - 100) < 1e-9);
  assert.deepEqual(held.footprint, short.footprint);
  assert.deepEqual(
    held.basins.map(({ key, anchor, polygons }) => ({ key, anchor, polygons })),
    short.basins.map(({ key, anchor, polygons }) => ({ key, anchor, polygons })),
  );
});

test('form exposure uses exact owner weights without radial work and preserves the complete spatial field', () => {
  const grid = plain(),
    input = screen(1, [
      [0.1, 0.5, 0],
      [0.9, 0.5, 12000],
    ]),
    radius = 0.7,
    radial = planTerrainScreenInput(input, radius, grid),
    exact = planTerrainScreenInput(input, radius, grid, 'exposure');
  assert.deepEqual(exact.centrelines, radial.centrelines);
  assert.deepEqual(
    exact.sections.map(({ owner, startMs, endMs, seconds }) => ({
      owner,
      startMs,
      endMs,
      seconds,
    })),
    radial.sections.map(({ owner, startMs, endMs, seconds }) => ({
      owner,
      startMs,
      endMs,
      seconds,
    })),
  );
  assert(exact.dabs.length <= exact.sections.length);
  assert(radial.dabs.length > exact.dabs.length * 5);
  for (const form of ['hills', 'mountains', 'canyon']) {
    const stroke = {
        form,
        seed: 0x51a7c3,
        mode: form === 'canyon' ? 'lower' : 'raise',
        radius,
        strength: 1,
        feather: 0.7,
        visibility: grid.view,
        screenInput: input,
        samples: [
          { x: 0, y: 0, t: 0 },
          { x: 0, y: 0, t: 12000 },
        ],
      },
      before = prepareTerrainForm(stroke, radial.dabs, radial.centrelines),
      after = prepareHeightBrush(stroke, grid);
    assert.deepEqual(after.dabs, exact.dabs);
    for (let y = -1; y <= 1; y += 0.2)
      for (let x = -5; x <= 5; x += 0.2)
        assert.equal(
          Math.fround(after.dose({ x, y })),
          Math.fround(before({ x, y })),
          form + ' field at ' + x + ',' + y,
        );
    assert(after.dabs.length * after.tiles.length * 4096 < 60000000);
    assert(
      radial.dabs.length * after.tiles.length * 4096 > 60000000,
      'unused radial samples reproduce the old spurious work rejection',
    );
  }
});

test('gesture geometry reuses exact candidates while replacement timed input recomputes every dose', () => {
  const grid = plain(),
    source = { token: 'campaign', revision: 3, fence: 'base' };
  const geometry = new TerrainScreenGeometry(grid, source);
  const input = screen(1, [
    [0.4, 0.5, 0],
    [0.6, 0.5, 400],
  ]);
  const stroke = {
    mode: 'raise',
    radius: 0.7,
    strength: 2,
    feather: 0.7,
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 400 },
    ],
    visibility: grid.view,
    screenInput: input,
  };
  const compare = () => {
    const fresh = prepareHeightBrush(stroke, grid),
      reused = prepareHeightBrush(stroke, grid, geometry);
    assert.deepEqual(reused.dabs, fresh.dabs);
    assert.deepEqual(reused.centrelines, fresh.centrelines);
    assert.deepEqual(reused.tiles, fresh.tiles);
    assert.deepEqual(
      reused.sections.map((s) => [
        s.owner,
        s.startMs,
        s.endMs,
        s.point(0),
        s.point(0.5),
        s.point(1),
      ]),
      fresh.sections.map((s) => [
        s.owner,
        s.startMs,
        s.endMs,
        s.point(0),
        s.point(0.5),
        s.point(1),
      ]),
    );
    assert.deepEqual(
      applyTerrainBrush([], stroke, undefined, grid, undefined, true, reused),
      applyTerrainBrush([], stroke, undefined, grid, undefined, true, fresh),
    );
    return reused;
  };
  compare();
  assert(geometry.retainedBytes > 0);
  assert(geometry.retainedTriangles > 0);
  // A real event replaces the speculative hold suffix and bends the path.
  input.events[1] = { u: 0.55, v: 0.52, t: 170 };
  input.events.push({ u: 0.55, v: 0.52, t: 500 });
  compare();
  const first = compare();
  input.events.at(-1).t = 250;
  const second = compare();
  assert.notDeepEqual(second.dabs, first.dabs, 'geometry reuse cannot retain stale time dose');
  geometry.dispose();
  assert.equal(geometry.retainedBytes, 0);
  assert.equal(geometry.retainedTriangles, 0);
  assert.throws(() => geometry.query(input.events), /freigegeben/);
});

test('geometry identity binds source, camera, complete layout and the actual frozen height array', () => {
  const grid = plain(),
    source = { token: 'campaign', revision: 3, fence: 'base' };
  const geometry = new TerrainScreenGeometry(grid, source);
  assert(geometry.matches(grid, source));
  for (const changed of [
    { ...source, token: 'other' },
    { ...source, revision: 4 },
    { ...source, fence: 'other' },
  ])
    assert(!geometry.matches(grid, changed));
  for (const changed of [
    { ...grid, heights: grid.heights.slice() },
    { ...grid, view: { ...grid.view, rotation: 1 } },
    { ...grid, view: { ...grid.view, frame: { ...grid.view.frame, x: 1 } } },
    { ...grid, view: { ...grid.view, refinement: { x: -1, y: -1, width: 2, height: 2 } } },
  ]) {
    assert(!geometry.matches(changed, source));
    assert.throws(
      () =>
        planTerrainScreenInput(
          screen(1, [
            [0.5, 0.5, 0],
            [0.5, 0.5, 100],
          ]),
          0.7,
          changed,
          'radial',
          geometry,
        ),
      /inzwischen geändert/,
    );
  }
  geometry.dispose();
  assert(!geometry.matches(grid, source));
});

test('same hold query projects no unchanged triangles again and retains only its current candidates', () => {
  const grid = plain(),
    geometry = new TerrainScreenGeometry(grid, { token: 'c', revision: 1, fence: 'f' });
  globalThis.__saltTerrainTrace = { events: [], dropped: 0 };
  try {
    const input = screen(1, [
      [0.5, 0.5, 0],
      [0.5, 0.5, 300],
    ]);
    planTerrainScreenInput(input, 0.7, grid, 'radial', geometry);
    input.events[1].t = 600;
    planTerrainScreenInput(input, 0.7, grid, 'radial', geometry);
    const stages = globalThis.__saltTerrainTrace.events.filter(
      (e) => e.stage === 'screen.projection',
    );
    assert.equal(stages.length, 2);
    assert.equal(stages[0].counts.projected, 2048);
    assert.equal(stages[1].counts.projected, 0);
    assert.equal(stages[1].counts.reused, geometry.retainedTriangles);
    assert.equal(geometry.retainedBytes, 2048 * 4 * 8);
  } finally {
    geometry.dispose();
    delete globalThis.__saltTerrainTrace;
  }
});

test('lake support and writer consume one exact height plan for scatter, dig and erase', () => {
  const grid = plain(),
    input = screen(1, [
      [0.5, 0.5, 0],
      [0.5, 0.5, 350],
    ]);
  const base = {
    id: 'bounded-lake',
    radius: 1,
    strength: 2,
    feather: 0.7,
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 350 },
    ],
    visibility: grid.view,
    screenInput: input,
    waterLevelM: 1,
  };
  let records = [];
  for (const mode of ['dig', 'scatter', 'erase']) {
    const stroke = {
      ...base,
      mode,
      ...(mode === 'scatter' ? { id: 'scatter', seed: 0x51a7, noise: 0.5 } : {}),
    };
    const plan = prepareHeightBrush(lakeHeightStroke(stroke), grid);
    const fresh = applyLakeBrush(records, stroke, grid),
      shared = applyLakeBrush(records, stroke, grid, plan);
    assert.deepEqual(shared, fresh);
    if (mode === 'scatter') {
      const scatter = prepareLakeScatter(stroke, grid, plan),
        ordinary = prepareLakeScatter(stroke, grid);
      assert.deepEqual(
        scatter.basins.map(({ profile, ...basin }) => basin),
        ordinary.basins.map(({ profile, ...basin }) => basin),
      );
      for (const [index, basin] of scatter.basins.entries()) {
        for (const point of [basin.anchor, ...basin.polygons.flatMap((p) => p.outer)])
          assert.equal(basin.profile(point), ordinary.basins[index].profile(point));
      }
      assert.deepEqual(scatter.tiles, ordinary.tiles);
    }
    if (mode === 'dig') records = fresh.records;
  }
});
