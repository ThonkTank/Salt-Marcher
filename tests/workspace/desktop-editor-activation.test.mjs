import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
for (const [entry, name] of [
  ['src/app/workspace/workspace-activation.ts', 'workspace-activation'],
  ['src/app/shared/editor-session.ts', 'activation-session'],
  ['src/app/shared/editor-registry.ts', 'activation-registry'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
const require = createRequire(import.meta.url);
const { createWorkspaceActivation } = require('../../.build/workspace-activation.cjs');
const { EditorSession } = require('../../.build/activation-session.cjs');
const { EditorRegistry } = require('../../.build/activation-registry.cjs');
function fixture({ failures = 0, empty = false } = {}) {
  const session = new EditorSession(),
    controls = new Map(),
    main = { inert: false },
    header = { inert: false },
    nav = { inert: false };
  const el = (id) => {
    if (!controls.has(id)) controls.set(id, { value: '', textContent: '' });
    return controls.get(id);
  };
  let workspace = empty ? null : { token: 'A', campaign: { id: 'A', name: 'A' } };
  let allowed = true,
    paused = 0,
    shellHook = null;
  const attempts = [],
    messages = [];
  if (empty) session.deactivate();
  const editors = new EditorRegistry([
    {
      id: 'writer',
      session,
      flush: () => allowed && session.capture()(),
      activate: { order: 0, run: () => session.generation++ },
      deactivate: () => {
        paused++;
      },
      suspendBeforeActivation: true,
    },
  ]);
  const api = {
    activateShell: async (id) => {
      attempts.push(id);
      if (shellHook) return shellHook(id);
      if (failures-- > 0) return { ok: false, error: 'held source unavailable' };
      return { ok: true, value: { token: id } };
    },
    workspaceInitial: async (token) => ({
      ok: true,
      value: { token, campaign: { id: token, name: token } },
    }),
  };
  const activation = createWorkspaceActivation({
    get workspace() {
      return workspace;
    },
    set workspace(value) {
      workspace = value;
    },
    controls: { main, header, nav },
    el,
    editors,
    api,
    roomEditor: { setDraft: async () => {}, renderList() {}, updateHistory() {}, saved: true },
    rememberView() {},
    geometryOnly: (w) => w,
    setWorkspaceAvailable() {},
    readView: () => ({ tab: 'atlas', scrollY: 0 }),
    reopenView: async () => {},
    preparationHasDrafts: () => false,
    status: (text, error) => messages.push({ text, error }),
  });
  return {
    activate: activation.activate,
    session,
    main,
    attempts,
    messages,
    allow: (v) => (allowed = v),
    shell: (fn) => (shellHook = fn),
    state: () => ({ workspace, activationFailed: activation.failed, paused }),
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('a failed campaign load remains read-only but can retry the drained source session', async () => {
  const x = fixture({ failures: 1 }),
    old = x.session.capture();
  await x.activate('B');
  assert.equal(x.state().activationFailed, true);
  assert.equal(x.main.inert, true);
  assert.equal(x.session.status.attached, true);
  assert.equal(x.state().workspace.token, 'A');
  await x.activate('B');
  assert.equal(x.state().activationFailed, false);
  assert.equal(x.main.inert, false);
  assert.equal(x.state().workspace.token, 'B');
  assert.deepEqual(x.attempts, ['B', 'B']);
  assert.equal(old(), false);
});
test('a refused source drain neither detaches editors nor silences native output', async () => {
  const x = fixture();
  x.allow(false);
  await x.activate('B');
  assert.deepEqual(x.attempts, []);
  assert.equal(x.state().paused, 0);
  assert.equal(x.session.status.attached, true);
  assert.equal(x.main.inert, false);
  assert.equal(x.state().workspace.token, 'A');
});
test('a newer queued campaign owns the only new editor activation', async () => {
  const x = fixture();
  let release;
  const held = new Promise((resolve) => (release = resolve));
  x.shell((id) => (id === 'B' ? held : { ok: true, value: { token: id } }));
  const first = x.activate('B');
  await tick();
  const second = x.activate('C');
  assert.equal(first, second);
  assert.equal(x.session.generation, 0);
  release({ ok: true, value: { token: 'B' } });
  await first;
  assert.deepEqual(x.attempts, ['B', 'C']);
  assert.equal(x.state().workspace.token, 'C');
  assert.equal(x.session.generation, 2);
});
test('opening after removal of the old workspace does not flush detached editors', async () => {
  const x = fixture({ empty: true });
  await x.activate('B');
  assert.equal(x.state().workspace.token, 'B');
  assert.equal(x.state().activationFailed, false);
  assert.equal(x.main.inert, false);
});
