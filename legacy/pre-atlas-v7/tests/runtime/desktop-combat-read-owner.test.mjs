import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  stdin: {
    contents: `export {CombatReadOwner} from './src/app/runtime/combat-read-owner'; export {EditorSession} from './src/app/shared/editor-session';`,
    resolveDir: process.cwd(),
  },
  outfile: '.build/combat-read-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CombatReadOwner, EditorSession } = createRequire(import.meta.url)(
  '../../.build/combat-read-owner.cjs',
);
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const tick = async () => {
  for (let n = 0; n < 5; n++) await new Promise((r) => setImmediate(r));
};
const combat = (id) => ({
  id,
  sceneId: 'scene',
  participants: [{ id: 'fighter' }, { id: 'other' }],
});
function fixture() {
  const session = new EditorSession(),
    events = [],
    calls = [];
  let workspace = { token: 'A', campaign: { id: 'A' } },
    current = combat('first');
  const api = {
    combat: async (_token, _scene, id) => ({
      ok: true,
      value: { combat: combat(id || 'first'), recent: [] },
    }),
  };
  const cache = {
    load: async (...args) => {
      calls.push(args);
      return null;
    },
  };
  let owner;
  owner = new CombatReadOwner({
    session,
    api,
    cache,
    context: () => ({ workspace, sceneId: 'scene', combat: current, partyBasis: 'party' }),
    accept: (view) => {
      current = view.combat;
      owner.accept(view);
    },
    clear: () => {
      current = null;
    },
    render: () => {
      events.push(['render', current?.id]);
      owner.retainSelection(current);
    },
    lock: () => events.push(['lock']),
    renderFighter: () => events.push(['fighter', owner.selected]),
    renderSelection() {},
    renderNotes: () => events.push(['notes', current?.id]),
    revealFighter() {},
    listDrafts: async () => {},
    partyChanged() {},
    loadingStarted() {},
    loaded() {},
    tell: (text) => events.push(['tell', text]),
  });
  return {
    owner,
    session,
    api,
    cache,
    calls,
    events,
    context: (id) => {
      workspace = { token: id, campaign: { id } };
      session.generation++;
      owner.reset();
    },
  };
}
test('Combat target read A→B→A cannot publish or release the newer load, including after campaign reactivation', async () => {
  const x = fixture(),
    old = deferred(),
    newer = deferred();
  x.api.combat = async () => old.promise;
  const first = x.owner.load('first');
  x.context('B');
  x.context('A');
  x.api.combat = async () => newer.promise;
  const next = x.owner.load('first');
  const before = structuredClone(x.events);
  old.resolve({ ok: true, value: { combat: combat('first'), recent: [] } });
  assert.equal(await first, false);
  assert.equal(x.owner.loading, true);
  assert.deepEqual(x.events, before);
  newer.resolve({ ok: true, value: { combat: combat('first'), recent: [] } });
  assert.equal(await next, true);
  assert.equal(x.owner.loading, false);
  assert.equal(x.session.reading, 0);
});
test('Combat fighter selection owns its loading state and late old input cannot unlock the replacement', async () => {
  const x = fixture(),
    old = deferred(),
    next = deferred();
  x.cache.load = async (_t, _c, _combat, _kind, id) =>
    id === 'fighter' ? old.promise : next.promise;
  const first = x.owner.choose('fighter');
  const second = x.owner.choose('other');
  const before = structuredClone(x.events);
  old.resolve(null);
  await first;
  assert.equal(x.owner.selected, 'other');
  assert.equal(x.owner.editorLoading, true);
  assert.deepEqual(x.events, before);
  next.resolve(null);
  await second;
  assert.equal(x.owner.editorLoading, false);
  assert.equal(x.session.reading, 0);
});
test('Combat notes reads of equal targets have separate leases and the older finally cannot release a newer read', async () => {
  const x = fixture(),
    old = deferred(),
    next = deferred();
  let count = 0;
  x.cache.load = async () => (++count === 1 ? old.promise : next.promise);
  const first = x.owner.loadNotes(),
    second = x.owner.loadNotes();
  const before = structuredClone(x.events);
  old.resolve(null);
  await first;
  assert.equal(x.owner.notesLoading, true);
  assert.deepEqual(x.events, before);
  next.resolve(null);
  await second;
  assert.equal(x.owner.notesLoading, false);
  assert.equal(x.events.filter((e) => e[0] === 'notes').length, 1);
});
test('Combat refresh replaces a pending fighter lease and drains it through the replacement selection', async () => {
  const x = fixture(),
    old = deferred(),
    next = deferred();
  let count = 0;
  x.cache.load = async (_t, _c, _combat, kind) =>
    kind === 'fighter' ? (++count === 1 ? old.promise : next.promise) : null;
  const first = x.owner.choose('fighter'),
    refresh = x.owner.load('first');
  await tick();
  assert.equal(x.owner.editorLoading, true);
  old.resolve(null);
  await first;
  assert.equal(x.owner.editorLoading, true);
  next.resolve(null);
  assert.equal(await refresh, true);
  assert.equal(x.owner.editorLoading, false);
});
test('Combat independent owners isolate selected fighter and detach revokes every pending read publication', async () => {
  const x = fixture(),
    other = fixture(),
    gate = deferred();
  await other.owner.choose('other');
  x.cache.load = async () => gate.promise;
  const choice = x.owner.choose('fighter');
  x.session.deactivate();
  const before = structuredClone(x.events);
  gate.resolve(null);
  await choice;
  assert.deepEqual(x.events, before);
  assert.equal(x.owner.selected, 'fighter');
  assert.equal(other.owner.selected, 'other');
  assert.equal(x.session.reading, 0);
});
