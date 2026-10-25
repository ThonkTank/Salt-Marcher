import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/session-copy-ui.ts'],
  outfile: '.build/planner-session-copy-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const until = async (check) => {
  const deadline = Date.now() + 3000;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
  assert.ok(check());
};
const require = createRequire(import.meta.url),
  settle = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  },
  deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
async function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  Object.assign(globalThis, { window, document });
  const plans = ['one', 'two'].map((id) => ({
      version: 1,
      id,
      revision: 1,
      name: id,
      scenes: [1, 2].map((i) => ({
        id: id + '-' + i,
        title: id + ' ' + i,
        notes: 'GM',
        locationId: null,
      })),
    })),
    sources = { plans, locations: [], notes: [] },
    workspace = { token: 'token', campaign: { id: 'campaign' } },
    x = { document, window, plans, sources, workspace, completed: [], messages: [], commands: [] };
  x.context = { workspace, plan: plans[0], sources };
  x.preparation = async () => ({ ok: true, value: sources });
  x.session = async (_token, id) => ({
    ok: true,
    value: {
      replacementBasis: 'basis-' + id,
      plan: structuredClone(plans.find((p) => p.id === id)),
      visits: plans
        .find((p) => p.id === id)
        .scenes.map((s) => ({
          visitId: s.id,
          revision: 0,
          readAloud: 'Text',
          groupIds: [],
          noteIds: [],
          reward: null,
        })),
      groups: [],
    },
  });
  x.execute = async (cmd) => ({
    ok: true,
    value: { visits: cmd.action.visitIds.map((visitId) => ({ visitId })) },
  });
  const storage = new Map();
  window.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  window.campaign = {
    preparation: (...a) => x.preparation(...a),
    session: (...a) => x.session(...a),
    executeSession: (cmd) => {
      x.commands.push(structuredClone(cmd));
      return x.execute(cmd);
    },
  };
  delete require.cache[require.resolve('../.build/planner-session-copy-ui.cjs')];
  const { SessionCopy } = require('../.build/planner-session-copy-ui.cjs');
  x.ui = new SessionCopy(
    (...a) => x.messages.push(a),
    () => x.context,
    async () => true,
    async (...a) => x.completed.push(a),
  );
  x.el = (id) => document.getElementById(id);
  const dialog = x.el('session-copy-dialog');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.open = async () => {
    x.el('session-copy-open').click();
    await until(
      () => dialog.open && x.el('session-copy-order').querySelectorAll('li').length === 2,
    );
  };
  t.after(() => {
    x.ui.reset();
    Object.assign(globalThis, previous);
  });
  await x.open();
  return x;
}
test('a preparation response cannot reopen a dismissed copy dialog', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.preparation = () => wait.promise;
  x.el('session-copy-open').click();
  await settle();
  x.ui.reset();
  wait.resolve({ ok: true, value: x.sources });
  await settle();
  assert.equal(x.el('session-copy-dialog').open, false);
});
test('an older failed read cannot replace a newer copy view with its error', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.preparation = () => wait.promise;
  x.el('session-copy-open').click();
  await settle();
  x.ui.reset();
  x.preparation = async () => ({ ok: true, value: x.sources });
  await x.open();
  wait.resolve({ ok: false, error: 'Veralteter Fehler' });
  await settle();
  assert.equal(x.el('session-copy-dialog').open, true);
  assert.doesNotMatch(x.el('session-copy-message').textContent, /Veralteter Fehler/);
  assert.equal(x.messages.length, 0);
});
test('detached visit choices cannot alter the current selection after redraw', async (t) => {
  const x = await fixture(t),
    box = x.el('session-copy-list').querySelector('input');
  x.el('session-copy-search').value = 'one';
  x.el('session-copy-search').oninput();
  box.checked = false;
  box.onchange();
  x.el('session-copy-confirm').click();
  await until(() => x.commands.length > 0);
  assert.deepEqual(x.commands[0].action.visitIds, ['one-1', 'one-2']);
});
test('a previous successful command cannot navigate or close a newly opened copy dialog', async (t) => {
  const x = await fixture(t),
    wait = deferred();
  x.execute = () => wait.promise;
  x.el('session-copy-confirm').click();
  await until(() => x.commands.length === 1);
  x.ui.reset();
  x.execute = async (cmd) => ({
    ok: true,
    value: { visits: cmd.action.visitIds.map((visitId) => ({ visitId })) },
  });
  await x.open();
  wait.resolve({ ok: true, value: { visits: [{ visitId: 'old-1' }, { visitId: 'old-2' }] } });
  await until(() => !x.el('session-copy-confirm').disabled);
  assert.equal(x.el('session-copy-dialog').open, true);
  assert.equal(x.completed.length, 0);
  assert.equal(x.el('session-copy-confirm').disabled, false);
});
test('changing target during a source read does not abandon the chosen source', async (t) => {
  const x = await fixture(t),
    wait = deferred(),
    read = x.session;
  x.session = async (token, id) => (id === 'two' ? wait.promise : read(token, id));
  x.el('session-copy-source').value = 'two';
  x.el('session-copy-source').onchange();
  await settle();
  x.el('session-copy-target').value = 'one';
  x.el('session-copy-target').onchange();
  await settle();
  wait.resolve(await read('token', 'two'));
  await settle();
  assert.equal(x.el('session-copy-confirm').disabled, false);
  x.el('session-copy-confirm').click();
  await until(() => x.commands.length > 0);
  assert.equal(x.commands[0].action.sourcePlanId, 'two');
  assert.equal(x.commands[0].action.planId, 'one');
});
