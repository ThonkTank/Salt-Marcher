import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';

buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-route-ui';export * from './src/app/atlas/atlas-units';export * from './src/app/atlas/terrain-route';export * from './src/app/atlas/atlas-landscape';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/terrain-route-units-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
const tick = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

async function mounted(t, kind = 'river') {
  // A fresh units module and independent mutable scene per case. No private UI state is exposed.
  delete require.cache[require.resolve('../../.build/terrain-route-units-test.cjs')];
  const api = require('../../.build/terrain-route-units-test.cjs');
  const { document, window } = parseHTML(
    '<html><body><div><canvas></canvas></div><section></section></body></html>',
  );
  const names = ['document', 'window', 'Event', 'Option', 'ResizeObserver', 'localStorage'];
  const globals = new Map(names.map((name) => [name, global[name]]));
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.querySelector('option')?.value ?? '';
    },
    set(value) {
      this._value = String(value);
    },
  });
  window.HTMLSelectElement.prototype.add = function (option) {
    this.append(option);
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {},
  });
  Object.assign(global, {
    document,
    window,
    Event: window.Event,
    Option: function (text, value) {
      const option = document.createElement('option');
      option.textContent = text;
      option.value = value;
      return option;
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    localStorage: { getItem: () => 'metric', setItem() {} },
  });
  const anchors = [
    { x: -180.12345678901234, y: 0.123456789012345 },
    { x: 180.98765432109876, y: 40.98765432109876 },
  ];
  let confirmed = {
    ...api.emptyRecord(kind),
    id: 'unit-river',
    revision: 7,
    name: 'Fluss',
    width: 8.123456789012345,
    points: structuredClone(anchors),
    route: api.routeSpec(kind, anchors),
  };
  Object.assign(confirmed.route.limits, {
    corridor: 200.12345678901235,
    cut: 8.123456789012345,
    shoulder: 20.123456789012344,
    depth: 1.5123456789012345,
    clearance: 3.123456789012345,
    grade: 0.123456789012345,
  });
  confirmed.route.nodes = anchors.map((p, i) => ({ ...p, z: 60 - i, structure: 'ground' }));
  const initial = structuredClone(confirmed),
    calls = [],
    writes = [],
    displays = [];
  const scene = () => ({
    records: [structuredClone(confirmed)],
    revision: 3,
    fence: { revision: 3 },
  });
  window.campaign = {
    async atlasSpatialScene(_token, _box, _scale, action) {
      calls.push(structuredClone(action));
      const value = scene();
      if (action) {
        const record = structuredClone(action.record);
        record.route.nodes = record.route.anchors.map((p, i) => ({
          ...p,
          z: 60 - i,
          structure: 'ground',
        }));
        value.records = [record];
      }
      return { ok: true, value };
    },
  };
  const host = {
    token: 'a',
    box: () => ({ x: -300, y: -100, width: 600, height: 400 }),
    canvas: document.querySelector('canvas'),
    panel: document.querySelector('section'),
    kind,
    record: confirmed,
    point: () => ({ x: 0, y: 0 }),
    hit: () => null,
    navigation: () => false,
    current: () => true,
    closed() {},
    preview: (records, points) => displays.push(structuredClone({ records, points })),
    write: async (action) => {
      writes.push(structuredClone(action));
      if (action.record)
        confirmed = { ...structuredClone(action.record), revision: confirmed.revision + 1 };
      return true;
    },
  };
  api.initAtlasUnits(document);
  const editor = api.openTerrainRoute(host);
  t.after(() => {
    editor.close();
    api.releaseAtlasUnits(document.body);
    for (const [name, value] of globals)
      value === undefined ? delete global[name] : (global[name] = value);
  });
  await editor.ready;
  const field = (id) => document.querySelector('#route-' + id);
  const button = (action) =>
    document.querySelector(`#terrain-route-editor [data-action="${action}"]`);
  const change = (id, value) => {
    field(id).value = value;
    field(id).dispatchEvent(new window.Event('change'));
  };
  const units = (value) => change('units', value);
  const proposal = () => calls.filter(Boolean).at(-1).record;
  return {
    api,
    host,
    document,
    window,
    editor,
    initial,
    calls,
    writes,
    displays,
    field,
    button,
    change,
    units,
    proposal,
    confirmed: () => confirmed,
  };
}

test('public river planner keeps exact coordinates and limits through metric–DnD–metric without preview, write or draft mutation', async (t) => {
  const f = await mounted(t),
    beforeCalls = f.calls.length,
    beforeDisplay = structuredClone(f.displays.at(-1));
  assert.equal(f.editor.hasDraft(), false);
  for (let i = 0; i < 3; i++) {
    f.units('dnd');
    f.units('metric');
  }
  await tick();
  assert.equal(f.calls.length, beforeCalls, 'unit selection must not request a physical proposal');
  assert.equal(f.writes.length, 0);
  assert.equal(f.editor.hasDraft(), false);
  assert.deepEqual(f.confirmed(), f.initial);
  assert.deepEqual(f.displays.at(-1), beforeDisplay);
  f.button('preview').click();
  await tick();
  assert.deepEqual(
    f.proposal().route,
    f.initial.route,
    'even a later explicit preview must receive unrounded canonical values',
  );
  assert.equal(f.proposal().width, f.initial.width);
});

test('editing one river axis in DnD preserves the other axis and all untouched limits; cancel preserves the confirmed route', async (t) => {
  const f = await mounted(t);
  f.units('dnd');
  f.change('point-y-0', '25');
  f.button('preview').click();
  await tick();
  assert.equal(f.proposal().route.anchors[0].x, f.initial.route.anchors[0].x);
  assert.equal(f.proposal().route.anchors[0].y, 7.62);
  assert.deepEqual(f.proposal().route.anchors[1], f.initial.route.anchors[1]);
  assert.deepEqual(f.proposal().route.limits, f.initial.route.limits);
  assert.equal(f.proposal().width, f.initial.width);
  f.button('cancel').click();
  assert.equal(f.editor.hasDraft(), false);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.confirmed(), f.initial);
  assert.deepEqual(f.displays.at(-1).points, f.initial.route.anchors);
  f.units('metric');
  f.button('preview').click();
  await tick();
  assert.deepEqual(f.proposal().route, f.initial.route);
});

test('explicit river changes cross the real unit fields and commit the intended metric values exactly once', async (t) => {
  const f = await mounted(t);
  f.units('dnd');
  f.change('point-x-0', '-500');
  f.change('width', '40');
  f.change('cut', '30');
  f.units('metric');
  assert.equal(Number(f.api.atlasFieldValue(f.field('width'))), 12.192);
  f.button('preview').click();
  await tick();
  const planned = structuredClone(
    f.displays.at(-1).records.find((record) => record.id === 'unit-river'),
  );
  assert.equal(planned.route.anchors[0].x, -152.4);
  assert.equal(planned.route.anchors[0].y, f.initial.route.anchors[0].y);
  assert.equal(planned.width, 12.192);
  assert.equal(planned.route.limits.cut, 9.144);
  assert.equal(planned.route.limits.depth, f.initial.route.limits.depth);
  assert.equal(f.writes.length, 0);
  f.button('save').click();
  f.button('save').click();
  await tick();
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].kind, 'landscape-route');
  assert.equal(f.writes[0].expectedRevision, 7);
  assert.equal(f.writes[0].sourceRevision, 3);
  assert.deepEqual(f.writes[0].record, planned);
  assert.deepEqual(f.confirmed().route, planned.route);
  assert.equal(f.editor.hasDraft(), false);
  const before = f.calls.length;
  f.units('dnd');
  f.units('metric');
  await tick();
  assert.equal(f.calls.length, before);
  assert.equal(f.writes.length, 1);
});

test('road history owns busy state through write, refresh and source reload before cancel/close and a new river', async (t) => {
  const f = await mounted(t, 'road');
  const pending = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  for (const kind of ['undo', 'redo']) {
    const write = pending(),
      refresh = pending(),
      source = pending(),
      originalRead = f.window.campaign.atlasSpatialScene;
    f.host.write = async () => {
      await write.promise;
      return true;
    };
    f.host.changed = () => refresh.promise;
    f.window.campaign.atlasSpatialScene = async () => {
      await source.promise;
      return originalRead();
    };
    f.button(kind).click();
    const panel = f.document.querySelector('#terrain-route-editor');
    const busy = () => {
      assert.equal(panel.getAttribute('aria-busy'), 'true');
      assert.equal(panel.inert, true);
      assert.equal(f.editor.hasDraft(), true);
      f.button('cancel').click();
      f.button('close').click();
      assert.equal(panel.isConnected, true);
      assert.equal(f.field('name').value, f.initial.name);
    };
    busy();
    write.resolve();
    await tick();
    busy();
    refresh.resolve();
    await tick();
    busy();
    source.resolve();
    await tick();
    assert.equal(panel.getAttribute('aria-busy'), 'false');
    assert.equal(panel.inert, false);
    assert.equal(f.editor.hasDraft(), false);
    f.window.campaign.atlasSpatialScene = originalRead;
  }
  f.change('cut', '1');
  f.button('cancel').click();
  f.button('close').click();
  assert.equal(f.document.querySelector('#terrain-route-editor'), null);
  assert.deepEqual(f.confirmed(), f.initial);
  const river = f.api.openTerrainRoute({ ...f.host, record: undefined, kind: 'river' });
  await river.ready;
  assert.match(f.document.querySelector('#terrain-route-editor strong').textContent, /^Fluss/);
  assert.equal(f.document.querySelectorAll('#route-points li').length, 0);
  assert.equal(f.field('name').value, '');
  river.close();
});
