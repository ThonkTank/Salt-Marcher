import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
await build({
  entryPoints: ['src/app/atlas/atlas-raster-presentation.ts'],
  outfile: '.build/atlas-presentation-source.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'object-source',
      setup(b) {
        b.onResolve({ filter: /^\.\/terrain-objects$/ }, (args) =>
          args.importer.endsWith('atlas-raster-presentation.ts')
            ? { path: 'objects', namespace: 'test' }
            : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents:
            'export function terrainObjectSources(){return [{id:"house",scopeId:"house"}];}',
        }));
      },
    },
  ],
});
const { AtlasRasterPresentation } = createRequire(import.meta.url)(
  '../../.build/atlas-presentation-source.cjs',
);
function fixture(t) {
  const previous = globalThis.window;
  let release;
  const calls = { projection: 0, refresh: 0, redraw: 0, errors: [], cancel: 0 };
  globalThis.window = {
    campaign: {
      atlasTerrainProjection: () => {
        calls.projection++;
        return new Promise((r) => (release = r));
      },
      atlasCancelRead: async () => {
        calls.cancel++;
      },
    },
  };
  t.after(() => (globalThis.window = previous));
  const ui = Object.assign(Object.create(AtlasRasterPresentation.prototype), {
    input: { dataset: { terrainQuality: 'detail' } },
    token: 't',
    revision: 7,
    fence: 'first',
    frame: { x: 0, y: 0, width: 100, height: 100 },
    focusHeightM: 0,
    tilt: 0,
    rotation: 0,
    exaggeration: 1,
    failed: false,
    objectKey: '',
    objectRead: null,
    stream: { cancel() {} },
    host: {
      workplane: () => null,
      redraw() {
        calls.redraw++;
      },
      async refresh() {
        calls.refresh++;
      },
    },
    pose: () => ({ metersPerPixel: 1 }),
    repaint() {},
    fail(e) {
      calls.errors.push(e);
    },
  });
  return { ui, calls, release: (value) => release(value) };
}
test('an object source error refreshes the source once instead of permanently disabling the Atlas', async (t) => {
  const f = fixture(t),
    pending = f.ui.loadObjects({});
  f.release({ ok: false, error: 'Gelände inzwischen geändert. Ausschnitt erneut laden.' });
  await pending;
  assert.equal(f.calls.refresh, 1);
  assert.deepEqual(f.calls.errors, []);
  assert.equal(f.ui.objectRead, null);
  assert.equal(f.ui.objectKey, '');
});
test('obsolete object replies cannot fail or relabel a newer source', async (t) => {
  for (const response of [
    { ok: false, error: 'old read failed' },
    { ok: true, value: { revision: 7, fence: 'first', objects: [{ id: 'old' }] } },
  ]) {
    const f = fixture(t),
      pending = f.ui.loadObjects({});
    f.ui.fence = 'second';
    f.ui.revision = 8;
    f.release(response);
    await pending;
    assert.equal(f.calls.refresh, 0);
    assert.deepEqual(f.calls.errors, []);
    assert.equal(f.ui.objects, undefined);
    assert.equal(f.calls.redraw, 0);
  }
});
test('pausing reads retires the object response before a canonical write starts', async (t) => {
  const f = fixture(t),
    pending = f.ui.loadObjects({});
  f.ui.pauseReads();
  f.release({ ok: false, error: 'cancelled' });
  await pending;
  assert.equal(f.calls.cancel, 1);
  assert.deepEqual(f.calls.errors, []);
  assert.equal(f.calls.redraw, 0);
});

test('a superseded surface read retains the useful frame and waits for the newer owner', async (t) => {
  const f = fixture(t);
  Object.defineProperty(f.ui, 'needsTerrainRaster', { value: false });
  Object.assign(f.ui, {
    active: true,
    ready: true,
    generation: 0,
    request: '',
    host: { ...f.ui.host, writing: () => false },
    stream: {
      async load() {
        throw Error('Kartenausschnitt durch neuere Anfrage ersetzt.');
      },
    },
  });
  const pending = f.ui.load();
  assert.equal(
    f.ui.input.dataset.terrainQuality,
    'overview',
    'the previous camera cannot qualify the new read',
  );
  await pending;
  assert.equal(f.ui.ready, true);
  assert.equal(f.ui.request, '');
  assert.deepEqual(f.calls.errors, []);
  assert.equal(f.calls.refresh, 0);
});

test('a stale floor source waits for the pending geometry owner before issuing another read', async (t) => {
  const f = fixture(t);
  f.ui.host.refresh = async () => {
    f.calls.refresh++;
    return false;
  };
  const first = f.ui.loadObjects({});
  f.release({ ok: false, error: 'Gelände inzwischen geändert. Ausschnitt erneut laden.' });
  await first;
  const repeated = f.ui.loadObjects({});
  f.release({ ok: false, error: 'Gelände inzwischen geändert. Ausschnitt erneut laden.' });
  await repeated;
  assert.equal(
    f.calls.projection,
    1,
    'Do not retry the obsolete source while geometry owns refresh',
  );
  assert.equal(f.calls.refresh, 1);
  assert.deepEqual(f.calls.errors, []);
  f.ui.fence = 'second';
  f.ui.revision = 8;
  const current = f.ui.loadObjects({});
  f.release({ ok: true, value: { revision: 8, fence: 'second', objects: [] } });
  await current;
  assert.equal(f.calls.projection, 2);
  assert.equal(f.calls.redraw, 1);
});

test('surface tiles also wait for a new confirmed fence after a deferred source refresh', async (t) => {
  const f = fixture(t);
  let reads = 0;
  Object.defineProperty(f.ui, 'needsTerrainRaster', { value: false });
  Object.assign(f.ui, {
    active: true,
    ready: true,
    generation: 0,
    request: '',
    host: { ...f.ui.host, writing: () => false },
    settleFirst() {},
    stream: {
      cancel() {},
      async load() {
        reads++;
        throw Error('Gelände inzwischen geändert');
      },
    },
  });
  await f.ui.load();
  await f.ui.load();
  assert.equal(reads, 1);
  assert.equal(f.calls.refresh, 1);
  assert.deepEqual(f.calls.errors, []);
  f.ui.fence = 'second';
  f.ui.revision = 8;
  await f.ui.load();
  assert.equal(reads, 2, 'A newly confirmed fence reopens tile loading');
  assert.equal(f.calls.refresh, 2);
  assert.deepEqual(f.calls.errors, []);
});

test('navigation anchors prefer physical terrain and use the focus plane only for absent coverage', (t) => {
  const { ui } = fixture(t);
  Object.assign(ui, {
    input: { clientWidth: 800, clientHeight: 600, dataset: {} },
    focusHeightM: 125,
    pixel: () => ({ x: 240, y: 420 }),
    terrainHit: () => ({ point: { x: 12, y: 34, heightM: 180 } }),
    planePoint: () => {
      throw Error('Terrain must own the anchor when it is hit');
    },
  });
  const terrain = ui.navigationAnchor({ clientX: 0, clientY: 0 });
  assert.deepEqual(terrain, { point: { x: 12, y: 34, heightM: 180 }, screen: { x: 0.3, y: 0.7 } });
  assert.equal(JSON.parse(ui.input.dataset.navigationAnchor).source, 'terrain');
  ui.terrainHit = () => null;
  ui.planePoint = (x, y, height, occlude) => {
    assert.equal(height, 125);
    assert.equal(occlude, false);
    return { x: 50, y: 60 };
  };
  const fallback = ui.navigationAnchor({ clientX: 0, clientY: 0 });
  assert.deepEqual(fallback.point, { x: 50, y: 60, heightM: 125 });
  assert.equal(JSON.parse(ui.input.dataset.navigationAnchor).source, 'focus-plane');
  ui.planePoint = () => null;
  assert.equal(
    ui.navigationAnchor({ clientX: 0, clientY: 0 }),
    null,
    'sky does not invent an infinite plane point',
  );
});

test('pose controls use the navigation lock rather than a closed stroke awaiting acknowledgement', (t) => {
  const { ui } = fixture(t),
    calls = [];
  let locked = true;
  Object.assign(ui, {
    gesturing: false,
    input: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    host: {
      hasDraft: () => true,
      navigationLocked: () => locked,
      navigate: (box) => calls.push(box),
      redraw() {},
    },
    navigationAnchor: () => null,
    loadedHeight: () => 0,
    eyeIntersects: () => false,
    applyCameraPose(pose) {
      this.tilt = pose.tilt;
      this.rotation = pose.rotation;
    },
    refocusCamera() {},
  });
  ui.setPose(35, 25);
  assert.equal(ui.tilt, 0);
  assert.equal(calls.length, 0);
  locked = false;
  ui.setPose(35, 25);
  assert.equal(ui.tilt, 35);
  assert.equal(ui.rotation, 25);
  assert.equal(calls.length, 1);
});

test('LOD publication after history refresh completes without navigating the stationary camera', async (t) => {
  const { ui, calls } = fixture(t),
    navigations = [],
    frame = { x: -370, y: -325, width: 1000, height: 650 };
  Object.defineProperty(ui, 'needsTerrainRaster', { value: false });
  Object.assign(ui, {
    active: true,
    ready: true,
    generation: 0,
    request: '',
    frame,
    tilt: 45,
    focusHeightM: 7,
    tiles: [],
    input: {
      dataset: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }),
    },
    surface: { gpuMemory: {} },
    host: {
      ...ui.host,
      writing: () => false,
      navigate: (box) => navigations.push(box),
    },
    reconcileCamera() {},
    // Overview and detail interpolate the deep basin differently. Refocusing
    // either arrival changes the next tile plan despite an unchanged world eye.
    terrainHit() {
      return { point: { x: 130, y: 0, heightM: this.tiles[0].centreHeight } };
    },
    applyCameraPose(pose) {
      this.frame = pose.frame;
      this.focusHeightM = pose.focusM;
    },
    show() {},
    stream: {
      statistics: {},
      async load(input, fetch, publish) {
        for (const [lod, centreHeight, complete] of [
          [4, 7.5, false],
          [3, 6.5, false],
          [2, 6.75, true],
        ]) {
          publish({
            tiles: [{ tile: { lod, x: 0, y: 0 }, revision: 7, centreHeight }],
            overviewComplete: true,
            complete,
          });
          await Promise.resolve();
        }
      },
    },
  });
  await ui.load();
  assert.deepEqual(calls.errors, []);
  assert.equal(ui.input.dataset.terrainQuality, 'detail');
  assert.deepEqual(navigations, [], 'tile arrivals must not restart navigation and tile loading');
  assert.deepEqual(ui.frame, frame);
  assert.equal(ui.focusHeightM, 7);
  ui.navigationGesture(true);
  ui.navigationGesture(false);
  assert.equal(navigations.length, 1, 'a completed author navigation still rebases focus');
  assert.equal(ui.focusHeightM, 6.75);
});

for (const restore of [true, false])
  test(`first overview and later detail ${restore ? 'preserve a restored complete pose' : 'initialize a view without a saved pose'}`, async (t) => {
    const { ui, calls } = fixture(t),
      original = {
        frame: { x: -370, y: -325, width: 1000, height: 650 },
        focusM: 18.4375,
        tilt: 45,
        rotation: 12,
        exaggeration: 1,
        projection: 'perspective',
      },
      cameras = [];
    Object.defineProperty(ui, 'needsTerrainRaster', { value: false });
    Object.assign(ui, {
      active: true,
      ready: false,
      generation: 0,
      request: '',
      tiles: [],
      input: { dataset: {} },
      toggle: {},
      controls: { querySelector: () => ({}) },
      surface: {
        gpuMemory: {},
        setCamera: (pose) => cameras.push(pose),
        waitForFrame: async () => {},
      },
      host: { ...ui.host, writing: () => false },
      reconcileCamera() {},
      settleFirst() {},
      show() {},
      height() {
        return this.tiles[0].centreHeight;
      },
      stream: {
        statistics: {},
        async load(_input, _fetch, publish) {
          for (const [lod, centreHeight, complete] of [
            [4, 28, false],
            [3, 27.8, false],
            [2, 27.999999523, true],
          ]) {
            publish({
              tiles: [{ tile: { lod, x: 0, y: 0 }, revision: 7, centreHeight }],
              overviewComplete: true,
              complete,
            });
            await Promise.resolve();
          }
        },
      },
    });
    ui.restoreCameraPose(original);
    if (!restore) ui.restoreCameraPose();
    await ui.load();
    assert.deepEqual(calls.errors, []);
    assert.equal(ui.ready, true);
    assert.equal(ui.input.dataset.terrainQuality, 'detail');
    assert.equal(ui.savedCameraPose.focusM, restore ? 18.4375 : 28);
    if (restore) {
      assert.deepEqual(ui.savedCameraPose, original);
      assert.equal(
        cameras.length,
        1,
        'only restoration publishes a camera, never terrain arrivals',
      );
    }
  });
