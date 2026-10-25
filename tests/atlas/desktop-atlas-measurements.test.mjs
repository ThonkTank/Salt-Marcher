import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents: `export * from './src/app/atlas/atlas-units';export {chooseRoomGroup} from './src/app/atlas/room-group-ui';export * from './src/app/atlas/atlas-measurements';export * from './src/app/atlas/atlas-navigation-scale';export * from './src/app/atlas/atlas-landscape-view';export * from './src/app/atlas/atlas-paint';export {linePoints,newLine} from './src/app/atlas/landscape-line';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-measurements.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const api = require('../../.build/atlas-measurements.cjs');
const all = (n) => [n, ...n.children.flatMap(all)];
const rectangle = (w, h) => ({
  outer: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
  holes: [],
});
test('physical geometry measures paths, holes, disjoint polygons and stable distant coordinates', () => {
  assert.equal(
    api.pathLength([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 4 },
    ]),
    8,
  );
  const p = rectangle(10, 8);
  p.holes.push(rectangle(2, 3).outer);
  assert.equal(api.polygonArea([p, rectangle(1, 1)]), 75);
  const far = {
    outer: p.outer.map((p) => ({ x: p.x + 1e12, y: p.y - 1e12 })),
    holes: p.holes.map((h) => h.map((p) => ({ x: p.x + 1e12, y: p.y - 1e12 }))),
  };
  assert.equal(api.polygonArea([far]), 74);
  const record = {
    kind: 'river',
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 30 },
      { x: 50, y: 0 },
    ],
    width: 2,
    line: api.newLine('river', 42),
  };
  assert(api.pathLength(api.linePoints(record)) > api.pathLength(record.points));
  assert.deepEqual(api.pathMeasures(api.linePoints(record), 2), [
    `Länge: ${api.lengthLabel(api.pathLength(api.linePoints(record)))}`,
    `Breite: ${api.lengthLabel(2)}`,
  ]);
});
test('DnD and metric labels preserve real-world dimensions and squared conversion', () => {
  assert.equal(api.lengthLabel(1.524, 'dnd'), '5 ft');
  assert.equal(api.lengthLabel(1609.344, 'dnd'), '1 Meile');
  assert.equal(api.areaLabel(1.524 ** 2, 'dnd'), '25 ft²');
  assert.equal(api.areaLabel(1e6, 'metric'), '1 km²');
  assert.equal(api.lengthLabel(1.524, 'metric'), '1,52 m');
  for (const kind of [
    'wall',
    'path',
    'terrain',
    'water',
    'roof',
    'door',
    'stairs',
    'object',
    'text',
    'light',
    'feature',
  ])
    assert(
      api.elementMeasures({
        kind,
        points: rectangle(10, 8).outer,
        width: 2,
        height: 3,
        triggerRadius: 4,
      }).length,
      kind,
    );
});
test('label stays in viewport in CSS pixels and is excluded from author/export hit targets', () => {
  for (const mpp of [0.001, 1, 100000])
    for (const width of [180, 800])
      for (const lines of [
        ['Fläche: 100 ft²', '10 ft × 10 ft'],
        [
          'Höhe: 300 m · Auflösung: 1 m',
          'Pinselauflösung: 2 m',
          'Feine Höhendetails (1 m) bleiben geschützt.',
          'Radius verkleinern oder näher heranzoomen.',
        ],
      ]) {
        const root = new api.AtlasPaint('group'),
          box = { x: -1e6, y: 2e6, width: width * mpp, height: 400 * mpp };
        api.drawMeasurements(
          root,
          box,
          mpp,
          { x: box.x + box.width, y: box.y + box.height },
          lines,
        );
        const label = root.children[0],
          rect = label.children[0];
        assert.equal(label.data.editorOnly, 'true');
        assert.equal(label.geometry.hud, true);
        assert.equal(label.geometry.pointer, false);
        assert(label.geometry.matrix[4] / mpp + rect.geometry.width <= width);
        assert(label.geometry.matrix[5] / mpp + rect.geometry.height <= 400);
        assert.equal(label.children[1].style.fontSize, 12);
      }
});
test('hex reference follows the actual grid, including historical levels and visibility guard', () => {
  assert.deepEqual(
    api.travelHexSizes.map((p) => api.hexTravelLabel(p.meters)),
    ['1 Stunde', '1 Reisetag', '1 Woche', '1 Monat', '3 Monate', '12 Monate'],
  );
  assert.equal(api.hexTravelLabel(api.gridMeters(1)), '3 Stunden');
  for (const level of [undefined, 'hour', 'day', 1]) {
    const root = new api.AtlasPaint('group');
    api.drawScale(root, { x: 0, y: 0, width: 20000, height: 10000 }, 25, level);
    const text = all(root)
      .filter((n) => n.kind === 'text')
      .map((n) => n.text)
      .join(' ');
    assert.equal(text.includes('Kante zu Kante'), level !== undefined);
    assert.equal(text.includes('8 Reisestunden'), level !== undefined);
  }
  const root = new api.AtlasPaint('group');
  api.drawScale(root, { x: 0, y: 0, width: 1e9, height: 1e9 }, 1e6, 'hour');
  assert(!all(root).some((n) => n.text?.includes('Richtzeit')));
});
test('unit switching converts real controls, keeps canonical values and draft snapshots exact, and rejects invalid input', async () => {
  const { document, window } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  const selects = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return selects.get(this) ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      selects.set(this, v);
    },
  });
  const saved = {
    document: global.document,
    Event: global.Event,
    localStorage: global.localStorage,
  };
  global.document = document;
  global.Event = window.Event;
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  try {
    api.initAtlasUnits(document);
    const field = document.getElementById('drawing-brush');
    assert.equal(field.value, '5');
    assert.equal(api.atlasFieldValue(field), '1.524');
    const originalLabel = field.closest('label').textContent;
    for (let i = 0; i < 20; i++) {
      assert(api.setAtlasUnits('metric'));
      assert.equal(field.value, '1.524');
      assert(api.setAtlasUnits('dnd'));
      assert.equal(field.value, '5');
      assert.equal(api.atlasFieldValue(field), '1.524');
    }
    assert.equal(
      field.closest('label').textContent,
      originalLabel,
      'unit suffix must not accumulate',
    );
    field.value = '10';
    assert.equal(Number(api.atlasFieldValue(field)), 3.048);
    api.setAtlasUnits('metric');
    assert.equal(field.value, '3.048');
    api.setAtlasFieldValue(field, 123.456789012345);
    const exact = api.atlasFieldValue(field);
    api.setAtlasUnits('dnd');
    api.setAtlasUnits('metric');
    assert.equal(api.atlasFieldValue(field), exact);
    const points = document.getElementById('drawing-element-points');
    api.setAtlasFieldValue(points, '1.524, 3.048\n-1.524, 0');
    api.setAtlasUnits('dnd');
    assert.equal(points.value, '5, 10\n-5, 0');
    assert.equal(api.atlasFieldValue(points), '1.524, 3.048\n-1.524, 0');
    api.setAtlasFieldValue(document.getElementById('volume-height'), '2');
    assert.equal(document.getElementById('volume-height').value, '10');
    points.value = 'bad, 10';
    assert.equal(
      api.atlasFieldValue(points),
      'bad, 3.048',
      'invalid draft prose survives canonical reads',
    );
    points.setCustomValidity = () => {};
    points.reportValidity = () => {};
    assert.equal(api.setAtlasUnits('metric'), false);
    assert.equal(api.atlasUnits(), 'dnd');
    points.value = '5, 10';
    assert(api.setAtlasUnits('metric'));
    assert.equal(points.value, '1.524, 3.048');
    assert.equal(storage.get('atlas-units-v1'), 'metric');
    api.setAtlasUnits('dnd');
    const proto = window.HTMLElement.prototype,
      show = proto.showModal;
    proto.showModal = function () {
      this.open = true;
    };
    try {
      const chosen = api.chooseRoomGroup({
          version: 1,
          profile: 'Wohnhaus',
          width: 12,
          depth: 8,
          seed: 'exact-units',
        }),
        dialog = document.querySelector('.room-group-dialog'),
        width = dialog.querySelector('[name=width]'),
        depth = dialog.querySelector('[name=depth]');
      assert.match(width.closest('label').textContent, /ft/);
      assert.equal(Number(api.atlasFieldValue(width)), 12);
      assert.equal(Number(api.atlasFieldValue(depth)), 8);
      width.value = '40';
      width.dispatchEvent(new window.Event('input', { bubbles: true }));
      assert.equal(Number(api.atlasFieldValue(width)), 12.192);
      for (let i = 0; i < 10; i++) {
        api.setAtlasUnits('metric');
        assert.equal(width.value, '12.192');
        api.setAtlasUnits('dnd');
        assert.equal(width.value, '40');
      }
      depth.value = '25';
      depth.dispatchEvent(new window.Event('input', { bubbles: true }));
      dialog.returnValue = 'accept';
      dialog.dispatchEvent(new window.Event('close'));
      const recipe = await chosen;
      assert(recipe, dialog.querySelector('[role=status]').textContent);
      assert.equal(recipe.width, 12.192);
      assert.equal(recipe.depth, 7.62);
      assert.equal(recipe.seed, 'exact-units');
    } finally {
      proto.showModal = show;
    }
  } finally {
    Object.assign(global, saved);
  }
});

test('measurement label follows the projected surface anchor while retaining screen-sized furniture', () => {
  const root = new api.AtlasPaint('group'),
    box = { x: -100, y: -100, width: 800, height: 400 },
    anchor = { x: 0, y: 0 };
  api.drawMeasurements(root, box, 1, anchor, ['Radius: 48 m'], (p) => {
    assert.equal(p, anchor);
    return { x: 300, y: 100 };
  });
  const label = root.children[0];
  assert.deepEqual(label.geometry.matrix, [1, 0, 0, 1, 418, 222]);
  assert.equal(label.geometry.hud, true);
});
