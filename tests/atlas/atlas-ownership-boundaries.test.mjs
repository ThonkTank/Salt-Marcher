import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mountAtlasWorkbench } from '../helpers/atlas-mounted-workbench.mjs';
await build({
  stdin: {
    contents:
      "export {CampaignAtlasWorkbench} from './src/app/atlas/campaign-atlas-ui'; export {initDrawing} from './src/app/atlas/drawing-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-ownership-boundaries.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignAtlasWorkbench, initDrawing } = createRequire(import.meta.url)(
  '../../.build/atlas-ownership-boundaries.cjs',
);
function mounted(t, capabilities = {}, overrides = {}) {
  const fixture = mountAtlasWorkbench(t, CampaignAtlasWorkbench, capabilities, overrides);
  initDrawing(
    () => {},
    () => null,
    () => null,
    async () => true,
    async () => {},
    () => {},
  );
  return fixture;
}
const owner = (token) => ({ token, campaign: { id: token } });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const focus = (id) => ({
  ok: true,
  value: {
    kind: 'room',
    scopeId: 'scope-' + id,
    floorId: 'ground',
    point: { x: 1, y: 2 },
    box: { width: 12, height: 8 },
  },
});
const readFailure = () => ({ ok: false, error: 'Controlled unavailable geometry' });

test('a refused navigation and tool switch preserve selection and author draft in the production composition', async (t) => {
  let reads = 0;
  const { atlas } = mounted(t, {
    atlasObjectFocus: async () => {
      reads++;
      return focus('new');
    },
    atlasRegion: async () => readFailure(),
  });
  atlas.activate(owner('a'));
  atlas.author.selectRoom({ id: 'old', scopeId: 'old-scope', floorId: 'upper' });
  atlas.author.beginEntrance();
  await atlas.navigate('room', 'new');
  assert.equal(await atlas.setFamily('city'), false);
  assert.equal(reads, 0, 'no target read is authorized before the draft boundary accepts');
  assert.deepEqual(atlas.author.selection, { kind: 'room', id: 'old' });
  assert.equal(atlas.author.scopeId, 'old-scope');
  assert.equal(atlas.author.floorId, 'upper');
  assert.equal(atlas.author.hasDraft(), true);
});
test('navigation, scope and element requests share the author lease; retired replies cannot replace a newer choice', async (t) => {
  const pending = deferred(),
    calls = [];
  const { atlas } = mounted(t, {
    atlasObjectFocus: async (_token, kind, id) => {
      calls.push([kind, id]);
      return id === 'old' ? pending.promise : focus(id);
    },
    atlasRegion: async () => readFailure(),
  });
  atlas.activate(owner('a'));
  const first = atlas.navigate('room', 'old');
  await tick();
  await atlas.navigateScope('current');
  pending.resolve(focus('old'));
  await first;
  assert.deepEqual(calls, [
    ['room', 'old'],
    ['scope', 'current'],
  ]);
  assert.deepEqual(atlas.author.selection, { kind: 'scope', id: 'current' });
  assert.equal(atlas.author.scopeId, 'current');
});
for (const transition of ['hide', 'A–B–A'])
  test(`a late object read after ${transition} has no selection authority`, async (t) => {
    const pending = deferred();
    const { atlas } = mounted(t, {
      atlasObjectFocus: () => pending.promise,
      atlasRegion: async () => readFailure(),
    });
    const a = owner('a');
    atlas.activate(a);
    const navigation = atlas.navigate('room', 'retired');
    await tick();
    if (transition === 'hide') atlas.hide();
    else {
      atlas.activate(owner('b'));
      atlas.activate(a);
    }
    atlas.author.selectRoom({ id: 'current', scopeId: 'current-scope', floorId: 'upper' });
    pending.resolve(focus('retired'));
    await navigation;
    assert.deepEqual(atlas.author.selection, { kind: 'room', id: 'current' });
    assert.equal(atlas.author.scopeId, 'current-scope');
    assert.equal(atlas.author.floorId, 'upper');
  });
test('Live docking moves the production surface and preserves author selection and camera', async (t) => {
  const { atlas, document } = mounted(t);
  atlas.activate(owner('a'));
  atlas.author.selectRoom({ id: 'room', scopeId: 'dungeon', floorId: 'upper' });
  const before = { ...atlas.camera.view },
    surface = atlas.liveSurface(),
    map = document.createElement('section'),
    controls = document.createElement('section'),
    console = document.createElement('section');
  document.body.append(map, controls, console);
  surface.mount(map, controls, console);
  assert.equal(map.contains(atlas.root), true);
  surface.unmount();
  assert.deepEqual(atlas.author.selection, { kind: 'room', id: 'room' });
  assert.equal(atlas.author.scopeId, 'dungeon');
  assert.equal(atlas.author.floorId, 'upper');
  assert.deepEqual(atlas.camera.view, before);
});

test('a new placement intent revokes a previously requested selection', async (t) => {
  const pending = deferred();
  const { atlas } = mounted(t, { atlasObjectFocus: () => pending.promise });
  atlas.activate(owner('a'));
  const navigation = atlas.navigate('room', 'retired');
  await tick();
  assert.equal(atlas.author.beginPlacement('city'), true);
  pending.resolve(focus('retired'));
  await navigation;
  assert.equal(atlas.author.selection, null);
  assert.equal(atlas.author.creation, 'city');
});

test('an old secondary element read cannot replace a newer city selection', async (t) => {
  const pending = deferred();
  const { atlas } = mounted(t, {
    atlasObjectFocus: async (_token, _kind, id) => focus(id),
    drawingElement: () => pending.promise,
    atlasRegion: async () => readFailure(),
  });
  atlas.activate(owner('a'));
  const navigation = atlas.navigateElement('old-element');
  await tick();
  await atlas.navigate('city', 'current-city');
  pending.resolve({ ok: true, value: { id: 'old-element', kind: 'path' } });
  await navigation;
  assert.deepEqual(atlas.author.selection, { kind: 'city', id: 'current-city' });
  assert.equal(atlas.author.cityId, 'current-city');
});

test('hide and reopen give the new opening sole authority over its source reply', async (t) => {
  const sources = [deferred(), deferred()];
  let reads = 0,
    regions = 0;
  const { atlas, document } = mounted(t, {
    atlasTerrainSource: () => sources[reads++].promise,
    atlasRegion: async () => {
      regions++;
      return readFailure();
    },
  });
  atlas.activate(owner('a'));
  const first = atlas.open();
  await tick();
  atlas.hide();
  const second = atlas.open();
  await tick();
  sources[1].resolve({ ok: false, error: 'Current bootstrap unavailable' });
  await second;
  const message = document.getElementById('atlas-save-status').textContent;
  sources[0].resolve({ ok: false, error: 'Retired bootstrap unavailable' });
  await first;
  assert.equal(reads, 2);
  assert.equal(regions, 1);
  assert.equal(document.getElementById('atlas-save-status').textContent, message);
  assert.equal(atlas.root.hidden, false);
});

test('location navigation preserves its lease through its own terrain tool switch', async (t) => {
  const calls = [];
  const { atlas } = mounted(t, {
    atlasRegion: async () => readFailure(),
    landscapeFind: async (token, id) => {
      calls.push([token, id]);
      return { ok: false, error: 'Location unavailable' };
    },
  });
  atlas.activate(owner('a'));
  await assert.rejects(atlas.navigateLocation('location'), /Location unavailable/);
  assert.deepEqual(calls, [['a', 'location']]);
});
