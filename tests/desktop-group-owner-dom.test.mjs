import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/groups-ui';export {initCommitControls} from './src/app/commit-confirmation';",
    resolveDir: process.cwd(),
    sourcefile: 'group-owner.ts',
  },
  outfile: '.build/group-owner.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'expected group editor state');
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
}
async function fixture(t) {
  const old = {
      window: globalThis.window,
      document: globalThis.document,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  for (const s of document.querySelectorAll('select'))
    Object.defineProperty(s, 'value', { value: '', writable: true });
  const timers = [],
    writes = [],
    enters = [],
    messages = [],
    drafts = new Map(),
    ok = (value) => ({ ok: true, value }),
    book = (id, title) => ({
      id,
      title,
      revision: 1,
      notes: '',
      locationId: null,
      sourceEncounterId: '',
      sourceRevision: 0,
      draftPlanId: null,
      actors: [],
      plan: { entries: [], sources: [] },
    }),
    books = new Map([
      ['a', book('a', 'Alpha')],
      ['b', book('b', 'Beta')],
    ]);
  let keepGate = null,
    discardGate = null,
    afterGate = null;
  globalThis.setTimeout = (fn) => {
    timers.push(fn);
    return timers.length;
  };
  globalThis.clearTimeout = () => {};
  const local = new Map();
  window.localStorage = {
    getItem: (k) => local.get(k) ?? null,
    setItem: (k, v) => local.set(k, v),
    removeItem: (k) => local.delete(k),
  };
  window.campaign = {
    ledgerParties: async () => ok([]),
    encounterPlans: async () => ok([]),
    preparedGroups: async () =>
      ok({ items: [...books.values()].map((g) => ({ ...g, count: 0 })), next: null }),
    groupView: async (_token, id) => ok(structuredClone(books.get(id))),
    groupDraft: async (_token, id) => ok(drafts.get(id) ?? null),
    keepGroupDraft: async (token, d, expected) => {
      writes.push({ token, d: structuredClone(d), expected });
      const gate = keepGate;
      keepGate = null;
      if (gate) await gate.promise;
      drafts.set(d.groupId, structuredClone(d));
      return ok();
    },
    discardGroupDraft: async (_token, id) => {
      const gate = discardGate;
      discardGate = null;
      if (gate) await gate.promise;
      drafts.delete(id);
      return ok();
    },
    executeProgress: async () =>
      ok({ characters: [], notices: [], treasureId: null, groupId: 'a', ledgerIds: [] }),
  };
  const file = require.resolve('../.build/group-owner.cjs');
  delete require.cache[file];
  const ui = require(file);
  let active = { token: 'A', campaign: { id: 'campaign-A' } };
  ui.initCommitControls(
    () => active,
    (text, error) => messages.push({ text, error }),
  );
  ui.initGroups(
    (text, error) => messages.push({ text, error }),
    async () => {
      const gate = afterGate;
      afterGate = null;
      if (gate) await gate.promise;
    },
    async (id) => {
      enters.push(id);
      await ui.openGroups(id);
    },
  );
  ui.activateGroups(active);
  await ui.openGroups('a');
  const el = (id) => document.getElementById(id),
    edit = (text) => {
      el('groups-notes').value = text;
      el('groups-notes').oninput();
    },
    switchTo = () => {
      active = { token: 'B', campaign: { id: 'campaign-B' } };
      ui.activateGroups(active);
      return ui.openGroups('b');
    };
  t.after(() => {
    ui.activateGroups(null);
    Object.assign(globalThis, old);
  });
  return {
    ui,
    el,
    edit,
    switchTo,
    writes,
    timers,
    enters,
    messages,
    holdKeep() {
      keepGate = deferred();
      return keepGate;
    },
    holdDiscard() {
      discardGate = deferred();
      return discardGate;
    },
    holdAfter() {
      afterGate = deferred();
      return afterGate;
    },
  };
}
test('pending Alpha input does not block Beta or become its next write basis', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const gate = x.holdKeep(),
    a = x.ui.flushGroups();
  await until(() => x.writes.length === 1);
  const b = x.switchTo();
  await tick();
  assert.equal(x.el('groups-title').value, 'Beta');
  x.edit('Beta raw');
  gate.resolve();
  await a;
  await b;
  assert.equal(await x.ui.flushGroups(), true);
  assert.equal(x.writes.at(-1).token, 'B');
  assert.equal(x.writes.at(-1).d.groupId, 'b');
  assert.equal(x.writes.at(-1).expected, null);
});
test('expired Alpha timer cannot write Beta input', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const old = x.timers.at(-1);
  await x.ui.flushGroups();
  await x.switchTo();
  x.edit('Beta raw');
  const n = x.writes.length;
  old();
  await tick();
  assert.equal(x.writes.length, n);
  assert.equal(await x.ui.flushGroups(), true);
  assert.equal(x.writes.at(-1).d.notes, 'Beta raw');
});
test('a late discard cannot clear or reopen a different group editor', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  await x.ui.flushGroups();
  const gate = x.holdDiscard();
  x.el('groups-reload').click();
  await tick();
  await x.switchTo();
  x.edit('Beta later');
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.el('groups-notes').value, 'Beta later');
  assert.equal(await x.ui.flushGroups(), true);
  assert.equal(x.writes.at(-1).d.groupId, 'b');
});
test('later input during discard stays intact and receives a fresh draft basis', async (t) => {
  const x = await fixture(t);
  x.edit('Before discard');
  await x.ui.flushGroups();
  const gate = x.holdDiscard();
  x.el('groups-reload').click();
  await tick();
  x.edit('  Later prose\r\n');
  gate.resolve();
  await tick();
  await tick();
  assert.equal(x.el('groups-notes').value, '  Later prose\r\n');
  assert.equal(await x.ui.flushGroups(), true);
  assert.equal(x.writes.at(-1).expected, null);
  assert.equal(x.writes.at(-1).d.notes, '  Later prose\r\n');
});
test('post-commit navigation cannot move Beta back to an Alpha group', async (t) => {
  const x = await fixture(t),
    gate = x.holdAfter();
  x.edit('Alpha commit');
  x.el('groups-apply').click();
  await until(() => x.writes.length === 1);
  await tick();
  await tick();
  await x.switchTo();
  x.edit('Beta after commit');
  gate.resolve();
  await tick();
  await tick();
  assert.deepEqual(x.enters, []);
  assert.equal(x.el('groups-notes').value, 'Beta after commit');
  assert.equal(await x.ui.flushGroups(), true);
  assert.equal(x.writes.at(-1).d.groupId, 'b');
});

test('reselecting the current group cannot overwrite typing after the click', async (t) => {
  const x = await fixture(t);
  x.el('groups-list').querySelector('button').click();
  x.edit('  Later current-group input\r\n');
  await x.ui.flushGroups();
  await tick();
  await tick();
  assert.equal(x.el('groups-notes').value, '  Later current-group input\r\n');
  assert.equal(x.writes.at(-1).d.notes, '  Later current-group input\r\n');
});

test('local group creation cannot execute after its draft flush loses the editor owner', async (t) => {
  const x = await fixture(t);
  x.edit('Alpha raw');
  const gate = x.holdKeep();
  let commands = 0;
  window.campaign.executeProgress = async () => {
    commands++;
    throw new Error('unexpected write');
  };
  const created = x.ui.createGroupAtLocation('place', 'New');
  const rejected = assert.rejects(created, /sichern/);
  await until(() => x.writes.length === 1);
  await x.switchTo();
  gate.resolve();
  await rejected;
  assert.equal(commands, 0);
  assert.equal(x.el('groups-title').value, 'Beta');
});
