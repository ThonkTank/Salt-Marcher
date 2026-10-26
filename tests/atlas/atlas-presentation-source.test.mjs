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
