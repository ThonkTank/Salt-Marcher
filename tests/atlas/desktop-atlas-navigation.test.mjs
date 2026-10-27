import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const entry of [
  'atlas-navigation-scale',
  'atlas-canvas',
  'atlas-reference-catalog',
  'atlas-landscape-view',
  'atlas-paint',
  'atlas-landscape',
])
  buildSync({
    entryPoints: ['src/app/atlas/' + entry + '.ts'],
    outfile: '.build/' + entry + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
const {
  gridMeters,
  travelHexSizes,
  automaticGrid,
  wheelZoomFactor,
  zoomBox,
  fitReference,
  scaleBar,
  distanceLabel,
} = require('../../.build/atlas-navigation-scale.cjs');
const { geographicReferences: refs } = require('../../.build/atlas-reference-catalog.cjs');
const { drawScale, drawLandscapeGrid } = require('../../.build/atlas-landscape-view.cjs');
const { AtlasPaint } = require('../../.build/atlas-paint.cjs');

test('travel presets have physical across-flat distances and preserve numeric legacy levels', () => {
  assert.deepEqual(
    travelHexSizes.map((p) => p.miles),
    [3, 24, 168, 720, 2160, 8640],
  );
  assert.equal(gridMeters('day'), 38624.256);
  assert(Math.abs(gridMeters(1) - 14484.096) < 1e-8);
  assert.equal(gridMeters('1'), gridMeters(1));
  assert.throws(() => gridMeters('other'));
  for (const preset of travelHexSizes) {
    const root = new AtlasPaint('group');
    drawLandscapeGrid(
      root,
      { x: -preset.meters, y: -preset.meters, width: preset.meters * 2, height: preset.meters * 2 },
      preset.id,
      preset.meters / 100,
    );
    const points = root.children[0].geometry.points;
    assert(
      Math.abs(
        Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) - preset.meters,
      ) < 1e-6,
    );
  }
});
test('scale uses nice physical distances within the available CSS width', () => {
  for (const mpp of [0.0001, 0.5, 100, 100000])
    for (const width of [180, 800, 1800]) {
      const bar = scaleBar(mpp, width);
      assert(bar.pixels <= Math.min(160, width / 3) + 1e-8);
      assert(bar.pixels > Math.min(160, width / 3) / 5);
      assert.equal(bar.meters / mpp, bar.pixels);
      const root = new AtlasPaint('group');
      drawScale(root, { x: 0, y: 0, width: width * mpp, height: 500 * mpp }, mpp);
      const group = root.children[0],
        points = group.children.find((n) => n.kind === 'polyline').geometry.points;
      assert(Math.abs(points[5].x - points[1].x - bar.pixels) < 1e-7);
      assert.equal(group.children.find((n) => n.kind === 'text').style.fontSize, 11);
    }
  assert.equal(
    scaleBar(90, 800).label,
    scaleBar(91, 800).label,
    'nearby zoom levels retain a useful round distance',
  );
});
test('auto grid has hysteresis in both directions and reaches every preset', () => {
  for (const p of travelHexSizes) assert.equal(automaticGrid(p.meters / 100, null), p.id);
  const middle = Math.sqrt(gridMeters('hour') * gridMeters('day')) / 100;
  assert.equal(automaticGrid(middle, 'hour'), 'hour');
  assert.equal(automaticGrid(middle, 'day'), 'day');
  assert.equal(automaticGrid(middle * 1.5, 'hour'), 'day');
  assert.equal(automaticGrid(middle / 1.5, 'day'), 'hour');
});
test('wheel units and pointer anchored zoom respond to magnitude without moving the anchor', () => {
  assert.equal(wheelZoomFactor(16, 0, 800), wheelZoomFactor(1, 1, 800));
  assert.equal(wheelZoomFactor(800, 0, 800), wheelZoomFactor(1, 2, 800));
  assert(wheelZoomFactor(1, 0, 800) < wheelZoomFactor(100, 0, 800));
  assert(Math.abs(wheelZoomFactor(100, 0, 800) * wheelZoomFactor(-100, 0, 800) - 1) < 1e-12);
  const box = { x: 10, y: 20, width: 300, height: 200 },
    anchor = { x: 100, y: 70 },
    z = zoomBox(box, 150, anchor);
  assert.equal((anchor.x - z.x) / z.width, (anchor.x - box.x) / box.width);
  assert.equal((anchor.y - z.y) / z.height, (anchor.y - box.y) / box.height);
});
test('offline comparison catalog covers requested categories with independently reproducible metric extents', () => {
  assert(refs.length >= 340);
  assert.equal(new Set(refs.map((r) => r.id)).size, refs.length);
  assert.equal(refs.filter((r) => r.category === 'Bundesländer').length, 16);
  assert.equal(refs.filter((r) => r.category === 'Städte').length, 12);
  assert.equal(refs.filter((r) => r.category === 'Kontinente').length, 7);
  for (const name of [
    'Deutschland',
    'Europa',
    'Rügen',
    'Sylt',
    'Korsika',
    'Sardinien',
    'Sizilien',
    'Kreta',
    'Mallorca',
    'Grönland',
    'Madagaskar',
    'Welt',
  ])
    assert(
      refs.some((r) => r.name === name),
      name,
    );
  for (const ref of refs) {
    assert(ref.width > 0 && ref.height > 0);
    assert.match(ref.source, /^https:\/\//);
    if (ref.bounds && !ref.method) {
      const [w, s, e, n] = ref.bounds,
        r = 6371008.8;
      const expected = [
        ((r * (e - w) * Math.PI) / 180) * Math.cos((((s + n) / 2) * Math.PI) / 180),
        (r * (n - s) * Math.PI) / 180,
      ];
      for (const [v, i] of [
        [ref.width, 0],
        [ref.height, 1],
      ])
        assert(Math.abs(v / expected[i] - 1) < 0.005, ref.name);
    }
  }
  const germany = refs.find((r) => r.name === 'Deutschland');
  assert(germany.width > 600000 && germany.width < 700000);
  assert(germany.height > 800000 && germany.height < 900000);
  const france = refs.find((r) => r.name === 'Frankreich');
  assert(france.width < 1500000, 'overseas territories must not stretch metropolitan France');
});
test('reference fitting contains the entire metric frame and preserves its center at all window aspects', () => {
  for (const aspect of [0.4, 1, 3])
    for (const name of ['Deutschland', 'Europa', 'Berlin', 'Rügen']) {
      const r = refs.find((r) => r.name === name),
        b = { x: 120, y: -900, width: r.width, height: r.height },
        fit = fitReference(b, aspect);
      assert(fit.x < b.x && fit.y < b.y);
      assert(fit.x + fit.width > b.x + b.width && fit.y + fit.height > b.y + b.height);
      assert(Math.abs(fit.width / fit.height - aspect) < 1e-12);
      assert(Math.abs(fit.x + fit.width / 2 - (b.x + b.width / 2)) < 1e-8);
    }
});

test('metric measurement and scale labels retain fine distances and legacy formatter precision', () => {
  const { formatDistance } = require('../../.build/atlas-landscape.cjs');
  for (const [meters, expected] of [
    [0.015, '0,015 m · 0,00000932 Meilen'],
    [1.524, '1,52 m · 0,000947 Meilen'],
    [4828.032, '4,83 km · 3 Meilen'],
  ]) {
    assert.equal(distanceLabel(meters, 'metric'), expected.split(' · ')[0]);
    assert.equal(formatDistance(meters), expected);
  }
});

test('shared camera writes reject all notified navigation while author input is active, then allow the closed stroke', () => {
  const { AtlasCanvas } = require('../../.build/atlas-canvas.cjs');
  const canvas = Object.create(AtlasCanvas.prototype);
  const initial = { x: 0, y: 0, width: 100, height: 80 },
    next = { x: 10, y: 20, width: 200, height: 160 };
  let active = true,
    changes = 0;
  Object.assign(canvas, {
    box: initial,
    options: { locked: () => active, changed: () => changes++ },
    apply() {},
    refreshControls() {},
    remember() {},
    stopZoom() {},
  });
  canvas.set(next, true);
  assert.deepEqual(
    canvas.view,
    initial,
    'overview/search/programmatic navigation shares the active-stroke lock',
  );
  assert.equal(changes, 0);
  active = false;
  canvas.set(next, true);
  assert.deepEqual(
    canvas.view,
    next,
    'a closed stroke awaiting storage must not retain camera ownership',
  );
  assert.equal(changes, 1);
});
