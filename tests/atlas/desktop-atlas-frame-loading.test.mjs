import { landscapeFixture } from '../helpers/atlas-workbench.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export {setAtlasUnits} from './src/app/atlas/atlas-units';export {LandscapeWorkbench} from './src/app/atlas/atlas-landscape-ui';export {AtlasPaint} from './src/app/atlas/atlas-paint';export {HEX_METERS} from './src/app/atlas/atlas-landscape';export {contains} from './src/app/atlas/landscape-geometry';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-frame-loading.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { setAtlasUnits, LandscapeWorkbench, AtlasPaint, HEX_METERS, contains } = createRequire(
  import.meta.url,
)('../../.build/atlas-frame-loading.cjs');
function fixture(t) {
  const { window, document } = parseHTML(
      '<html><body><div id="atlas-tool-fields"></div><select id="atlas-hex-level"><option value="0">0</option></select><canvas></canvas></body></html>',
    ),
    previous = { window: global.window, document: global.document, Option: global.Option };
  Object.assign(global, {
    window,
    document,
    Option: function (text, value) {
      const o = document.createElement('option');
      o.textContent = text;
      o.value = value;
      return o;
    },
  });
  t.after(() => Object.assign(global, previous));
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.getAttribute('data-value') ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      this.setAttribute('data-value', v);
    },
  });
  window.HTMLSelectElement.prototype.add = function (o) {
    this.append(o);
  };
  let data;
  const errors = [],
    host = {
      point: (e) => ({ x: e.clientX, y: e.clientY }),
      box: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      redraw() {},
      write: async () => {},
      error: (e) => errors.push(e),
      data: () => data,
    },
    ui = landscapeFixture(new LandscapeWorkbench(document.querySelector('canvas'), host));
  ui.context('token');
  return {
    ui,
    scene: new AtlasPaint('group'),
    window,
    document,
    errors,
    host,
    set(r) {
      data = {
        revision: 0,
        region: {
          fence: 'source',
          landscape: {
            state: 'ready',
            records: r,
            tiles: [],
            coverage: {
              complete: true,
              mode: 'detail',
              objects: r.length,
              references: r.filter((x) => x.kind === 'reference').length,
            },
          },
        },
      };
    },
  };
}
const ref = (id) => ({
  id,
  revision: 0,
  kind: 'reference',
  name: id,
  points: [{ x: 0, y: 0 }],
  polygons: [],
  resolution: 1,
  width: 1,
  assetId: id,
  imageWidth: 1,
  imageHeight: 1,
  values: {},
});
test('selecting an exact object does not cancel pending frame images; a different region at the same source replaces its layer', async (t) => {
  const f = fixture(t);
  let release;
  const requested = [];
  f.window.campaign = {
    referenceAssetPreview: async (token, id) => {
      requested.push(id);
      if (id === 'a') await new Promise((r) => (release = r));
      return { ok: true, value: 'image:' + id };
    },
    atlasLandscapeObject: async () => ({
      ok: true,
      value: {
        ...ref('selected'),
        kind: 'road',
        assetId: undefined,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        values: { privateValue: 'preserved' },
      },
    }),
  };
  f.set([ref('a'), ref('b')]);
  const load = f.ui.load();
  await f.ui.selectId('selected');
  release();
  await load;
  assert.deepEqual(requested, ['a', 'b']);
  assert.equal(f.ui.assets.get('b'), 'image:b');
  assert.equal(f.document.querySelector('#land-name').value, 'selected');
  f.set([ref('c')]);
  await f.ui.load();
  assert.deepEqual(
    f.ui.records.map((x) => x.id),
    ['c'],
  );
  assert.equal(f.ui.assets.get('c'), 'image:c');
  assert.equal(f.errors.length, 0);
});
test('drawing an already published frame never starts a landscape read', (t) => {
  const f = fixture(t);
  f.window.campaign = new Proxy(
    {},
    {
      get() {
        throw Error('draw must not read');
      },
    },
  );
  f.ui.draw(f.scene, { x: 0, y: 0, width: 10, height: 10 }, 0.1);
  assert.equal(f.errors.length, 0);
});

test('repeated exact image selections keep the renderer preview cache bounded', async (t) => {
  const f = fixture(t);
  f.set([]);
  f.window.campaign = {
    referenceAssetPreview: async () => ({ ok: true, value: 'x'.repeat(600000) }),
    atlasLandscapeObject: async (token, id) => ({ ok: true, value: ref(id) }),
  };
  for (let i = 0; i < 20; i++) await f.ui.selectId('ref' + i);
  assert([...f.ui.assets.values()].reduce((n, v) => n + v.length * 2, 0) <= 8 * 1024 * 1024);
  assert(f.ui.assets.has('ref19'));
  assert(!f.ui.assets.has('ref0'));
});

test('reference import refreshes the source frame before starting calibration on its newly registered asset', async () => {
  const prior = { window: global.window, document: global.document, Option: global.Option };
  let cleanup;
  const f = fixture({ after: (run) => (cleanup = run) });
  try {
    f.set([]);
    let refreshed = false;
    f.host.refresh = async () => {
      refreshed = true;
    };
    f.window.campaign = {
      referenceImage: async () => ({
        ok: true,
        value: { id: 'new-image', width: 1600, height: 1000 },
      }),
      referenceAssetPreview: async () => {
        assert(
          refreshed,
          'registration changes source fence, so calibration must use its refreshed frame',
        );
        return { ok: true, value: 'image' };
      },
    };
    f.document.querySelector('#land-reference').click();
    await new Promise((r) => setImmediate(r));
    assert(refreshed);
    assert(f.ui.assets.has('new-image'));
    assert.match(f.document.querySelector('#land-status').textContent, /Zwei Bildpunkte/);
    assert.equal(f.errors.length, 0);
  } finally {
    cleanup();
    Object.assign(global, prior);
  }
});

test('an unavailable frame image keeps the layer usable and exposes a working local retry', async (t) => {
  const f = fixture(t);
  f.set([ref('a')]);
  let failed = true;
  f.window.campaign = {
    referenceAssetPreview: async () =>
      failed ? { ok: false, error: 'unavailable' } : { ok: true, value: 'image:a' },
  };
  await f.ui.load();
  assert.equal(f.ui.records.length, 1);
  assert.equal(f.document.querySelector('#land-reload').hidden, false);
  failed = false;
  f.host.refresh = () => f.ui.load(true);
  f.document.querySelector('#land-reload').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.ui.assets.get('a'), 'image:a');
  assert.equal(f.document.querySelector('#land-reload').hidden, true);
  assert.equal(f.errors.length, 0);
});

test('a rejected reference preview leaves a local outline and does not stop other references or retry', async (t) => {
  const f = fixture(t);
  let broken = true;
  const requests = [];
  f.window.campaign = {
    referenceAssetPreview: async (token, id) => {
      requests.push(id);
      if (id === 'bad' && broken) throw Error('controlled preview transport failure');
      return { ok: true, value: 'image:' + id };
    },
  };
  f.set([ref('bad'), ref('good')]);
  await f.ui.load();
  assert.deepEqual(requests, ['bad', 'good']);
  assert(f.ui.assets.has('good'));
  assert.equal(f.ui.assets.has('bad'), false);
  assert.match(f.document.querySelector('#land-status').textContent, /nicht verfügbar/);
  f.ui.draw(f.scene, { x: 0, y: 0, width: 10, height: 10 }, 0.1);
  assert.equal(
    descendants(f.scene).find((n) => n.data.referenceState === 'unavailable')?.data.referenceId,
    'bad',
  );
  broken = false;
  await f.ui.load(true);
  assert(f.ui.assets.has('bad'));
  assert.equal(f.errors.length, 0);
});

test('reference previews reuse the same source but cannot survive a new source fence under the same asset ID', async (t) => {
  const f = fixture(t);
  let calls = 0;
  f.window.campaign = {
    referenceAssetPreview: async () => ({ ok: true, value: 'preview:' + ++calls }),
  };
  f.set([ref('same')]);
  await f.ui.load();
  assert.equal(f.ui.assets.get('same'), 'preview:1');
  f.set([ref('same')]);
  await f.ui.load();
  assert.equal(calls, 1);
  f.host.data().region.fence = 'new-source';
  await f.ui.load();
  assert.equal(calls, 2);
  assert.equal(f.ui.assets.get('same'), 'preview:2');
});

const descendants = (n) => [n, ...n.children.flatMap(descendants)];
test('landscape background reuses geometry across draft paints and buffered pan, while new source images invalidate it', async (t) => {
  const f = fixture(t);
  f.set([ref('a')]);
  f.window.campaign = { referenceAssetPreview: async () => ({ ok: true, value: 'image:a' }) };
  await f.ui.load();
  const scene = () => new AtlasPaint('group'),
    box = { x: 0, y: 0, width: 10, height: 10 };
  let root = scene();
  f.ui.draw(root, box, 0.1);
  const base = root.children.find((n) => n.data.atlasLandscapeBase === 'true').children[0];
  f.ui.points = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ];
  root = scene();
  f.ui.draw(root, { ...box, x: 2, y: -3 }, 0.1);
  const retained = root.children.find((n) => n.data.atlasLandscapeBase === 'true');
  assert.equal(retained.children[0], base);
  assert.deepEqual(retained.geometry.matrix, [1, 0, 0, 1, -2, 3]);
  assert(descendants(root).some((n) => n.data.editorOnly === 'true'));
  f.ui.assets.set('a', 'replacement');
  root = scene();
  f.ui.draw(root, box, 0.1);
  assert.notEqual(
    root.children.find((n) => n.data.atlasLandscapeBase === 'true').children[0],
    base,
    'new decoded source must not keep old reference geometry',
  );
});

test('a selected reference keeps its original slot below terrain and updates without rebuilding other paths', async (t) => {
  const f = fixture(t),
    reference = ref('a'),
    road = {
      ...ref('road'),
      kind: 'road',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      assetId: undefined,
    };
  f.set([reference, road]);
  f.window.campaign = { referenceAssetPreview: async () => ({ ok: true, value: 'image:a' }) };
  await f.ui.load();
  f.ui.selected = structuredClone(reference);
  const draw = () => {
    const r = new AtlasPaint('group');
    f.ui.draw(r, { x: 0, y: 0, width: 10, height: 10 }, 0.1);
    return r.children.find((n) => n.data.atlasLandscapeBase === 'true').children[0];
  };
  const first = draw();
  f.ui.selected.width = 2;
  const next = draw();
  assert.equal(first.children[1], next.children[1]);
  assert.equal(next.children[0].data.landscapeId, 'a');
  assert.equal(next.children[1].data.landscapeId, 'road');
  assert.equal(next.children[0].children[0].geometry.width, 2);
});

test('Hex fill previews every crossed cell and commits each released stroke exactly once', async (t) => {
  const f = fixture(t);
  f.set([]);
  const writes = [];
  f.host.write = async (action) => {
    writes.push(action);
    return true;
  };
  f.ui.setActive(true);
  const tool = f.document.querySelector('#land-tool');
  tool.value = 'hex';
  tool.dispatchEvent(new f.window.Event('change'));
  f.host.hit = () => null;
  f.host.point = (e) => ({ x: e.clientX, y: e.clientY });
  const canvas = f.document.querySelector('canvas');
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  const pointer = (type, x) => {
    const e = new f.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { button: 0, pointerId: 1, clientX: x, clientY: 0 });
    canvas.dispatchEvent(e);
  };
  const palette = f.document.createElement('select');
  palette.id = 'atlas-terrain';
  palette.append(new Option('Wald', 'forest'));
  f.document.body.append(palette);
  f.document.querySelector('#land-radius').value = '1000000';
  f.document.querySelector('#land-auto-level').checked = false;
  pointer('pointerdown', -4 * HEX_METERS);
  pointer('pointermove', 4 * HEX_METERS);
  pointer('pointermove', 0);
  f.ui.draw(
    f.scene,
    { x: -5 * HEX_METERS, y: -HEX_METERS, width: 10 * HEX_METERS, height: 2 * HEX_METERS },
    10,
  );
  assert.equal(writes.length, 0);
  const preview = f.scene.children.find((n) => n.data.landHexDraft === 'true');
  pointer('pointerup', 0);
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 1);
  const patch = writes[0].record;
  assert.equal(patch.values.terrain, 'forest');
  for (let q = -4; q <= 4; q++)
    assert(contains({ x: q * HEX_METERS, y: 0 }, patch.polygons), 'Missing intermediate hex ' + q);
  assert(!contains({ x: 5 * HEX_METERS, y: 0 }, patch.polygons));
  assert(preview);
  const relativePatch = patch.polygons.map((p) => ({
    ...p,
    outer: p.outer.map((v) => ({ x: v.x + 5 * HEX_METERS, y: v.y + HEX_METERS })),
  }));
  assert.deepEqual(
    preview.geometry.polygons,
    relativePatch,
    'Preview and committed footprint must match',
  );
  pointer('pointerdown', 10 * HEX_METERS);
  pointer('pointermove', 11 * HEX_METERS);
  assert.equal(writes.length, 1);
  pointer('pointerup', 11 * HEX_METERS);
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 2);
  for (const q of [10, 11])
    assert(contains({ x: q * HEX_METERS, y: 0 }, writes[1].record.polygons));
  assert(
    !contains({ x: 5 * HEX_METERS, y: 0 }, writes[1].record.polygons),
    'Distinct strokes must not become a connecting line',
  );
});

for (const tool of ['property', 'reset'])
  test(`${tool} strokes cover sparse samples and repeated points without bridging separate gestures`, async (t) => {
    const f = fixture(t);
    f.set([]);
    const writes = [];
    f.host.write = async (action) => {
      writes.push(action);
      return true;
    };
    f.ui.setActive(true);
    const input = f.document.querySelector('#land-tool');
    input.value = tool;
    input.onchange();
    f.document.querySelector('#land-field').value = 'elevationM';
    f.document.querySelector('#land-value').value = '321';
    f.document.querySelector('#land-radius').value = '5';
    f.ui.brushStrokes = [
      [
        { x: -100, y: -20 },
        { x: -80, y: -20 },
      ],
    ];
    f.ui.points = [
      { x: 100, y: 20 },
      { x: 100, y: 20 },
    ];
    await f.ui.finish();
    assert.equal(writes.length, 1);
    const action = writes[0],
      polygons = tool === 'property' ? action.record.polygons : action.polygons;
    for (const p of [
      { x: -100, y: -20 },
      { x: -90, y: -16 },
      { x: -80, y: -20 },
      { x: 100, y: 24 },
    ])
      assert(contains(p, polygons), 'Missing intended brush coverage ' + JSON.stringify(p));
    assert(!contains({ x: 0, y: 0 }, polygons), 'Independent gestures must not paint a connector');
    assert(!contains({ x: 100, y: 26 }, polygons), 'Brush radius remains bounded');
    if (tool === 'property') {
      assert.equal(action.kind, 'landscape-put');
      assert.equal(action.record.propertyOnly, true);
      assert.deepEqual(action.record.values, { elevationM: 321 });
      assert(!action.record.mask && !action.record.paint);
    } else {
      assert.equal(action.kind, 'landscape-reset');
      assert.equal(action.propertyOnly, true);
      assert.equal(action.field, 'elevationM');
    }
    assert.equal(f.ui.hasDraft(), false);
    assert.deepEqual(f.errors, []);
  });

test('automatic Hex grid follows the draft size through zoom and resumes after cancellation', (t) => {
  const f = fixture(t);
  f.set([]);
  f.ui.setActive(true);
  f.document.querySelector('#land-auto-level').checked = true;
  f.document.querySelector('#land-grid').checked = true;
  const tool = f.document.querySelector('#land-tool');
  tool.value = 'hex';
  tool.onchange();
  const draw = (width) => {
    const scene = new AtlasPaint('group'),
      box = { x: -width / 2, y: -width / 2, width, height: width };
    f.ui.drawOverlay(scene, box, width / 800);
    f.ui.draw(scene, box, width / 800);
    return scene;
  };
  const gridWidth = (scene) => {
    const points = scene.children
      .flatMap((n) => (n.kind === 'group' ? n.children : [n]))
      .find((n) => n.data.landscapeGrid === 'true').geometry.points;
    return Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  };
  assert(Math.abs(gridWidth(draw(12 * HEX_METERS)) - HEX_METERS) < 0.001);
  f.ui.points = [{ x: 0, y: 0 }];
  const zoomed = draw(36 * HEX_METERS);
  assert.equal(f.document.querySelector('#atlas-hex-level').value, 'hour');
  const footprint = zoomed.children.find((n) => n.data.landHexDraft === 'true').geometry.polygons[0]
    .outer;
  assert(
    Math.abs(
      gridWidth(zoomed) -
        (Math.max(...footprint.map((p) => p.x)) - Math.min(...footprint.map((p) => p.x))),
    ) < 0.001,
    'Visible grid and authored footprint must use one Hex size',
  );
  f.ui.cancel();
  draw(96 * HEX_METERS);
  f.ui.gridFade = null;
  assert(
    Math.abs(gridWidth(draw(96 * HEX_METERS)) - 8 * HEX_METERS) < 0.001,
    'Automatic grid resumes with the day preset when no draft is open',
  );
  assert.equal(f.document.querySelector('#atlas-hex-level').value, 'day');
});

test('an oversized Hex draft fails visibly without saving or discarding its points', async (t) => {
  const f = fixture(t);
  f.set([]);
  let writes = 0;
  f.host.write = async () => {
    writes++;
    return true;
  };
  f.ui.tool = 'hex';
  f.ui.points = [
    { x: 0, y: 0 },
    { x: 6000 * HEX_METERS, y: 0 },
  ];
  f.document.querySelector('#land-auto-level').checked = false;
  f.ui.draw(f.scene, { x: 0, y: 0, width: HEX_METERS, height: HEX_METERS }, 10);
  assert.match(f.document.querySelector('#land-status').textContent, /5.000 Hexes/);
  await assert.rejects(f.ui.finish(), /5.000 Hexes/);
  assert.equal(writes, 0);
  assert(f.ui.hasDraft());
  f.ui.cancel();
  assert.equal(f.ui.hasDraft(), false);
});

test('a missing shared landscape frame never starts an independent read and has a local reload', async (t) => {
  const f = fixture(t);
  f.set([]);
  let calls = 0;
  f.window.campaign = new Proxy(
    {},
    {
      get() {
        calls++;
        throw Error('No independent landscape reads');
      },
    },
  );
  f.host.data().region.landscape = undefined;
  await f.ui.load();
  assert.equal(calls, 0);
  assert.equal(f.document.querySelector('#land-reload').hidden, false);
  assert.match(f.document.querySelector('#land-status').textContent, /Frame|frame/);
  f.host.refresh = async () => {
    f.set([]);
    await f.ui.load();
  };
  f.document.querySelector('#land-reload').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.document.querySelector('#land-reload').hidden, true);
  assert.equal(f.errors.length, 0);
});
test('a confirmed edit revokes pending frame images and waits for a matching map revision', async (t) => {
  const f = fixture(t);
  f.set([ref('old')]);
  let release,
    calls = 0;
  f.window.campaign = {
    referenceAssetPreview: async () => {
      calls++;
      await new Promise((r) => (release = r));
      return { ok: false, error: 'old image failed' };
    },
  };
  const before = f.ui.load();
  assert.equal(calls, 1);
  f.ui.invalidate(1);
  release();
  await before;
  assert.deepEqual(f.errors, []);
  assert.equal(f.ui.assets.size, 0);
  await f.ui.load();
  assert.equal(calls, 1, 'old map revision must not restart image loading');
  f.set([ref('fresh')]);
  f.host.data().revision = 1;
  f.host.data().region.fence = 'updated-source';
  f.window.campaign.referenceAssetPreview = async () => {
    calls++;
    return { ok: true, value: 'fresh-image' };
  };
  await f.ui.load();
  assert.equal(calls, 2);
  assert.deepEqual(
    f.ui.records.map((r) => r.id),
    ['fresh'],
  );
  assert.equal(f.ui.assets.get('fresh'), 'fresh-image');
  assert.deepEqual(f.errors, []);
});

test('an unavailable bounded preview never falls back to loading the complete original image', async (t) => {
  const f = fixture(t);
  f.set([ref('large')]);
  let originals = 0;
  f.window.campaign = {
    referenceAsset: async () => {
      originals++;
      return { ok: true, value: 'complete-original' };
    },
  };
  await f.ui.load();
  assert.equal(originals, 0);
  assert.equal(f.ui.assets.size, 0);
  assert.equal(f.document.querySelector('#land-reload').hidden, false);
  assert.match(f.document.querySelector('#land-status').textContent, /nicht verfügbar/);
  f.window.campaign.referenceAssetPreview = async () => ({ ok: true, value: 'bounded-preview' });
  await f.ui.load(true);
  assert.equal(f.ui.assets.get('large'), 'bounded-preview');
  assert.equal(originals, 0);
});

test('line and selection tools hide irrelevant palettes but keep manual grid level and terrain painting reachable', (t) => {
  const f = fixture(t),
    palette = f.document.createElement('label');
  palette.innerHTML = '<select id="atlas-terrain"><option value="plain">Ebene</option></select>';
  f.document.body.append(palette);
  const hex = f.document.querySelector('#atlas-hex-level'),
    levelLabel = f.document.createElement('label');
  hex.replaceWith(levelLabel);
  levelLabel.append(hex);
  f.document.querySelector('#land-auto-level').checked = true;
  f.ui.setActive(true);
  const tool = f.document.querySelector('#land-tool'),
    choose = (value) => {
      tool.value = value;
      tool.dispatchEvent(new f.window.Event('change'));
    };
  choose('road');
  assert.equal(palette.hidden, true);
  assert.equal(levelLabel.hidden, true);
  assert.equal(f.document.querySelector('#land-width').closest('label').hidden, false);
  const auto = f.document.querySelector('#land-auto-level');
  auto.checked = false;
  auto.onchange();
  assert.equal(levelLabel.hidden, false);
  choose('hex');
  assert.equal(palette.hidden, false);
  assert.equal(levelLabel.hidden, false);
  f.document.querySelector('#land-field').value = 'elevationM';
  f.document.querySelector('#land-field').onchange();
  assert.equal(palette.hidden, true);
  assert.equal(f.document.querySelector('#land-value-field').hidden, false);
  f.ui.setActive(false);
  assert.equal(palette.hidden, false);
  assert.equal(levelLabel.hidden, false);
});

for (const kind of ['road', 'river'])
  test(`${kind} endpoint drag commits on release, keeps other geometry, and does not write on click or cancellation`, async (t) => {
    const f = fixture(t),
      road = {
        ...ref('line'),
        kind,
        assetId: undefined,
        points: [
          { x: 1, y: 2 },
          { x: 8, y: 2 },
        ],
        width: 1,
      },
      writes = [];
    let latest = road;
    f.set([road]);
    f.host.write = async (a) => {
      writes.push(structuredClone(a));
      latest = { ...structuredClone(a.record), revision: latest.revision + 1 };
      f.set([latest]);
      return true;
    };
    f.window.campaign = { atlasLandscapeObject: async () => ({ ok: true, value: latest }) };
    await f.ui.select(road);
    f.ui.setActive(true);
    const canvas = f.document.querySelector('canvas');
    canvas.setPointerCapture = () => {};
    canvas.hasPointerCapture = () => false;
    f.host.hit = () => ({ data: { landVertex: '1' } });
    const pointer = (type, x, y = 2) => {
      const e = new f.window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { button: 0, pointerId: 4, clientX: x, clientY: y });
      canvas.dispatchEvent(e);
    };
    pointer('pointerdown', 8);
    pointer('pointerup', 8);
    await new Promise((r) => setImmediate(r));
    assert.equal(writes.length, 0, 'selecting a handle is not an edit');
    pointer('pointerdown', 8);
    pointer('pointermove', 5);
    assert.equal(writes.length, 0, 'preview stays a draft');
    pointer('pointercancel', 5);
    assert.equal(writes.length, 0, 'an interrupted drag must never save');
    pointer('pointerdown', 5);
    pointer('pointermove', 4);
    pointer('pointerup', 4);
    await new Promise((r) => setImmediate(r));
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].record.points, [
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]);
    assert.equal(writes[0].expectedRevision, 0);
    assert.equal(
      f.document.querySelector('#land-object').value,
      road.id,
      'saved line remains selected in its object list',
    );
    pointer('pointerdown', 4);
    pointer('pointermove', 3);
    pointer('pointerup', 3);
    await new Promise((r) => setImmediate(r));
    assert.equal(writes.length, 2, 'a second handle drag needs no reselection');
    assert.equal(writes[1].expectedRevision, 1, 'second drag uses the confirmed revision');
    assert.deepEqual(writes[1].record.points, [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
    ]);
    let picked = 0;
    canvas.addEventListener('click', () => picked++);
    f.host.hit = () => null;
    const release = new f.window.Event('click', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(release);
    assert.equal(
      picked,
      0,
      'release click cannot clear the saved landscape selection through the Atlas picker',
    );
    assert.equal(release.defaultPrevented, true);
    pointer('pointerdown', 12);
    pointer('pointerup', 12);
    canvas.dispatchEvent(new f.window.Event('click', { bubbles: true, cancelable: true }));
    assert.equal(picked, 1, 'a new ordinary click still reaches the Atlas picker');
  });

// The ruler does not author persistent geometry; other drafts still need a decision.
test('leaving a measurement needs no explicit finish while an authored line remains protected', (t) => {
  const f = fixture(t);
  f.set([]);
  const tool = f.document.querySelector('#land-tool');
  f.ui.setActive(true);
  tool.value = 'measure';
  tool.onchange();
  f.ui.points = [
    { x: 0, y: 0 },
    { x: 3, y: 4 },
  ];
  tool.value = 'select';
  tool.onchange();
  assert.equal(tool.value, 'select');
  assert.equal(f.ui.hasDraft(), false);
  tool.value = 'road';
  tool.onchange();
  f.ui.points = [
    { x: 0, y: 0 },
    { x: 3, y: 4 },
  ];
  tool.value = 'select';
  tool.onchange();
  assert.equal(tool.value, 'road');
  assert.equal(f.ui.hasDraft(), true);
  assert.match(f.document.querySelector('#land-status').textContent, /abschließen/);
});

for (const failure of ['reply', 'transport'])
  test(`a failed selection refresh after a confirmed line edit never reuses its old revision (${failure})`, async (t) => {
    const f = fixture(t),
      road = {
        ...ref('saved-road'),
        kind: 'road',
        assetId: undefined,
        points: [
          { x: 1, y: 2 },
          { x: 8, y: 2 },
        ],
        width: 1,
      };
    let writes = 0;
    f.set([road]);
    f.host.write = async () => {
      writes++;
      return true;
    };
    f.window.campaign = {
      atlasLandscapeObject: async () => {
        if (failure === 'transport') throw Error('offline');
        return { ok: false, error: 'unavailable' };
      },
    };
    f.ui.setActive(true);
    await f.ui.select(road);
    f.ui.dirty = true;
    await f.ui.finish();
    assert.equal(writes, 1);
    assert.equal(f.ui.hasDraft(), false);
    assert.equal(f.document.querySelector('#land-object').value, '');
    assert.equal(f.document.querySelector('#land-selection').children.length, 0);
    assert.match(
      f.document.querySelector('#land-status').textContent,
      /Gespeichert.*erneut auswählen/,
    );
    assert.deepEqual(f.errors, []);
  });

test('a docked location inspector retains its own text reads, focus and write lock', async (t) => {
  const f = fixture(t);
  f.set([]);
  const root = f.document.querySelector('#land-selection'),
    dock = f.document.createElement('aside');
  f.document.body.append(dock);
  dock.append(root);
  const record = {
      ...ref('place'),
      kind: 'place',
      assetId: undefined,
      locationId: 'location',
      width: 0,
    },
    doc = {
      id: 'location',
      name: 'Furt',
      sections: [
        { id: 'prose', title: 'Beschreibung', markdown: '  Original\r\n' },
        { id: 'note', title: 'Notizen', markdown: 'Unverändert.' },
      ],
    };
  f.window.campaign = {
    atlasLandscapeObject: async () => ({ ok: true, value: record }),
    deskContent: async () => ({
      ok: true,
      value: { location: doc, revision: 4, unavailable: false },
    }),
    landscapeFind: async () => ({ ok: true, value: [record] }),
  };
  await f.ui.selectId(record.id);
  assert.equal(f.ui.panel.contains(root), false);
  f.document.querySelector('#land-name').value = 'Neue Furt';
  root.querySelector('[data-section-title="prose"]').value = 'Zum Vorlesen';
  root.querySelector('[data-section-body="prose"]').value =
    '  Überarbeitet\r\nWortlaut bleibt.\r\n';
  let release, sent;
  f.host.write = async (a) => {
    sent = structuredClone(a);
    await new Promise((r) => (release = r));
    return true;
  };
  const saving = f.ui.finish();
  await new Promise((r) => setImmediate(r));
  assert.equal(sent.kind, 'landscape-place');
  assert.equal(sent.expectedLocationRevision, 4);
  assert.equal(sent.document.sections[0].markdown, '  Überarbeitet\r\nWortlaut bleibt.\r\n');
  assert.equal(sent.document.sections[1].markdown, 'Unverändert.');
  assert.equal(sent.document.name, 'Neue Furt');
  assert([...root.querySelectorAll('input,textarea,button')].every((n) => n.disabled));
  await f.ui.finish();
  release();
  await saving;
  let focused;
  const proto = f.window.HTMLTextAreaElement.prototype,
    oldFocus = proto.focus,
    oldScroll = proto.scrollIntoView;
  proto.focus = function () {
    focused = this;
  };
  proto.scrollIntoView = () => {};
  t.after(() => {
    proto.focus = oldFocus;
    proto.scrollIntoView = oldScroll;
  });
  await f.ui.openLocation('location', 'note');
  assert.equal(focused.dataset.sectionBody, 'note');
  assert.equal(focused.value, 'Unverändert.');
  assert.equal(f.errors.length, 0);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function heightRead(f, reader) {
  f.window.campaign = { atlasHeight: reader };
  f.ui.setActive(true);
  const tool = f.document.getElementById('land-tool');
  tool.value = 'height';
  tool.onchange();
  f.document.getElementById('land-radius').value = '120';
  f.ui.hovering = true;
  f.ui.lastPoint = { x: 3, y: 4 };
  f.ui.cursorHeight();
  await delay(120);
}
test('height feedback explains how finer data moves with a broad brush and clears when the chosen radius becomes fine enough', async (t) => {
  const f = fixture(t);
  await heightRead(f, async () => ({ ok: true, value: { heightM: 300, resolutionM: 1 } }));
  assert.match(
    f.document.getElementById('land-cursor-height').textContent,
    /984 ft.*Auflösung: 3,28 ft/,
  );
  assert.match(f.document.getElementById('land-brush-resolution').textContent, /6,56 ft/);
  const hint = f.document.getElementById('land-height-protection');
  assert.equal(hint.hidden, false);
  assert.match(hint.textContent, /3,28 ft.*bewegen sich mit.*Radius verkleinern/);
  const protectedOverlay = new AtlasPaint('group');
  f.ui.drawMeasurements(protectedOverlay, { x: 0, y: 0, width: 10, height: 10 }, 0.02);
  assert.match(
    descendants(protectedOverlay)
      .map((n) => n.text)
      .join(' '),
    /Feine Geländeformen.*bewegen sich mit.*Radius verkleinern/,
  );
  f.document.getElementById('land-radius').value = '32';
  f.ui.renderHeightPrecision();
  assert.equal(hint.hidden, true);
  const editableOverlay = new AtlasPaint('group');
  f.ui.drawMeasurements(editableOverlay, { x: 0, y: 0, width: 10, height: 10 }, 0.02);
  assert.doesNotMatch(
    descendants(editableOverlay)
      .map((n) => n.text)
      .join(' '),
    /bewegen sich mit/,
  );
  assert.match(f.document.getElementById('land-brush-resolution').textContent, /3,28 ft/);
});
for (const change of ['context', 'gesture', 'leave'])
  test('a late height query cannot label a replacement ' + change, async (t) => {
    const f = fixture(t);
    let resolve;
    await heightRead(f, () => new Promise((r) => (resolve = r)));
    assert.equal(typeof resolve, 'function');
    if (change === 'context') f.ui.context('other');
    else if (change === 'gesture') f.ui.maskGeneration++;
    else f.document.querySelector('canvas').dispatchEvent(new f.window.Event('pointerleave'));
    resolve({ ok: true, value: { heightM: 300, resolutionM: 1 } });
    await delay(10);
    assert.equal(f.document.getElementById('land-height-protection').hidden, true);
    assert.doesNotMatch(f.document.getElementById('land-cursor-height').textContent, /300/);
  });
test('an untouched point has no invented zero-metre resolution or fine-detail warning', async (t) => {
  const f = fixture(t);
  await heightRead(f, async () => ({ ok: true, value: { heightM: -100, resolutionM: null } }));
  assert.equal(f.document.getElementById('land-cursor-height').textContent, 'Höhe: -328 ft');
  assert.equal(f.document.getElementById('land-height-protection').hidden, true);
});

test('unit changes reformat cached height and preview without another read or write', async (t) => {
  const f = fixture(t),
    previous = global.Event;
  global.Event = f.window.Event;
  t.after(() => {
    setAtlasUnits('dnd');
    global.Event = previous;
  });
  let reads = 0;
  await heightRead(f, async () => {
    reads++;
    return { ok: true, value: { heightM: 300, resolutionM: 1 } };
  });
  setAtlasUnits('metric');
  f.ui.drawOverlay(f.scene, { x: 0, y: 0, width: 10, height: 10 }, 0.02);
  assert.equal(
    f.document.getElementById('land-cursor-height').textContent,
    'Höhe: 300 m · Auflösung: 1 m',
  );
  assert.match(f.document.getElementById('land-height-protection').textContent, /1 m/);
  f.ui.heightPreviewM = 350;
  f.ui.renderHeightPrecision();
  assert.equal(
    f.document.getElementById('land-cursor-height').textContent,
    'Höhe: 350 m · Vorschau',
  );
  setAtlasUnits('dnd');
  f.ui.renderHeightPrecision();
  assert.equal(
    f.document.getElementById('land-cursor-height').textContent,
    'Höhe: 1.150 ft · Vorschau',
  );
  assert.equal(reads, 1);
  f.document.querySelector('canvas').dispatchEvent(new f.window.Event('pointerleave'));
  assert.equal(f.document.getElementById('land-cursor-height').textContent, 'Höhe: –');
});

test('camera frames and read retries retain the complete unsubmitted relief form without writing', async (t) => {
  const f = fixture(t);
  f.set([]);
  await f.ui.load();
  const field = (id) => f.document.getElementById('land-relief-' + id);
  const edited = { mode: 'height', land: '#243546', ink: '#aabbcc', light: '290', strength: '0.7' };
  for (const [id, value] of Object.entries(edited)) field(id).value = value;
  f.host.write = async () => {
    throw Error('Reading a camera frame must not write');
  };
  f.set([]);
  await f.ui.load();
  await f.ui.load(true);
  for (const [id, value] of Object.entries(edited)) assert.equal(field(id).value, value, id);
  f.set([]);
  f.host.data().region.landscape.state = 'error';
  await f.ui.load();
  f.host.data().region.landscape = undefined;
  await f.ui.load();
  f.set([]);
  await f.ui.load();
  for (const [id, value] of Object.entries(edited))
    assert.equal(field(id).value, value, id + ' after failed read');
});

test('confirmed style changes including undo replace all relief fields, even the focused field', async (t) => {
  const f = fixture(t);
  f.set([]);
  await f.ui.load();
  const field = (id) => f.document.getElementById('land-relief-' + id);
  field('light').value = '290';
  Object.defineProperty(f.document, 'activeElement', { configurable: true, value: field('light') });
  const style = {
    version: 1,
    mode: 'height',
    land: '#243546',
    ink: '#aabbcc',
    lightDegrees: 80,
    strength: 0.4,
  };
  f.set([]);
  f.host.data().region.landscape.terrainStyle = style;
  await f.ui.load();
  assert.equal(field('light').value, '80');
  assert.equal(field('mode').value, 'height');
  assert.equal(field('strength').value, '0.4');
  f.set([]);
  await f.ui.load();
  assert.equal(field('light').value, '315');
  assert.equal(field('mode').value, 'drawn');
});

test('a different campaign resets unsubmitted relief choices even when both confirmed styles are default', async (t) => {
  const f = fixture(t);
  f.set([]);
  await f.ui.load();
  f.document.getElementById('land-relief-light').value = '290';
  f.ui.context('other-campaign');
  f.set([]);
  await f.ui.load();
  assert.equal(f.document.getElementById('land-relief-light').value, '315');
});

for (const tool of ['height', 'smooth', 'color'])
  test(`${tool} hover and direct input update only the transient layer, retaining the author scene`, (t) => {
    const f = fixture(t);
    f.set([]);
    f.ui.setActive(true);
    f.ui.tool = tool;
    f.document.querySelector('#land-tool').value = tool;
    const canvas = f.document.querySelector('canvas');
    canvas.setPointerCapture = () => {};
    canvas.hasPointerCapture = () => false;
    f.host.hit = () => null;
    f.host.terrainGesture = () => {};
    f.ui.cursorHeight = () => {};
    const oldRAF = {
      requestAnimationFrame: global.requestAnimationFrame,
      cancelAnimationFrame: global.cancelAnimationFrame,
    };
    let frame = 0;
    global.requestAnimationFrame = () => ++frame;
    global.cancelAnimationFrame = () => {};
    t.after(() => Object.assign(global, oldRAF));
    const counts = { scene: 0, overlay: 0 };
    f.host.redraw = () => counts.scene++;
    f.host.redrawOverlay = () => counts.overlay++;
    const pointer = (type, x) => {
      const e = new f.window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { button: 0, pointerId: 7, clientX: x, clientY: 2 });
      canvas.dispatchEvent(e);
    };
    pointer('pointermove', 1);
    pointer('pointerdown', 1);
    pointer('pointermove', 2);
    assert.equal(f.ui.livePainting, true);
    assert.equal(counts.scene, 0, 'pointer input must not invalidate persistent map geometry');
    assert.equal(counts.overlay, 3);
    assert.deepEqual(f.ui.lastPoint, { x: 2, y: 2 });
    assert.equal(f.ui.pointer, 7);
    f.ui.live = null;
    f.ui.pointer = null;
    f.ui.maskStroke = null;
    pointer('pointerleave', 2);
    assert.equal(counts.scene, 0);
    assert.equal(counts.overlay, 4);
    assert.equal(f.ui.hovering, false);
    // Geometry-changing drafts continue through the full redraw path.
    f.ui.tool = 'property';
    pointer('pointermove', 4);
    pointer('pointerdown', 4);
    pointer('pointermove', 8);
    assert(counts.scene >= 3);
    assert(f.ui.points.length > 0);
  });

test('fallback brush cursor lives in the overlay; the main GPU brush has exactly its own cursor', (t) => {
  const f = fixture(t);
  f.set([]);
  f.ui.setActive(true);
  f.ui.hovering = true;
  f.ui.lastPoint = { x: 7, y: 9 };
  f.document.querySelector('#land-radius').value = '5';
  const box = { x: 2, y: 3, width: 40, height: 40 },
    mpp = 0.1;
  const cursor = (scene) =>
    scene.children.filter((n) => n.kind === 'circle' && n.data.editorOnly === 'true');
  for (const tool of ['height', 'smooth', 'color', 'property']) {
    f.ui.tool = tool;
    f.host.visibility = () => undefined;
    const scene = new AtlasPaint('group');
    f.ui.draw(scene, box, mpp);
    assert.equal(cursor(scene).length, 0);
    const overlay = new AtlasPaint('group');
    f.ui.drawOverlay(overlay, box, mpp);
    assert.equal(cursor(overlay).length, 1);
    const { x, y, radius } = overlay.children[0].geometry;
    assert.deepEqual({ x, y, radius }, { x: 5, y: 6, radius: 5 });
    assert.equal(overlay.children[0].geometry.pointer, false);
    f.host.visibility = () => ({ tilt: 45 });
    const gpu = new AtlasPaint('group');
    f.ui.drawOverlay(gpu, box, mpp);
    assert.equal(cursor(gpu).length, tool === 'property' ? 1 : 0);
  }
  f.ui.hovering = false;
  const outside = new AtlasPaint('group');
  f.ui.drawOverlay(outside, box, mpp);
  assert.equal(cursor(outside).length, 0);
});
