import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mountAtlasWorkbench } from '../helpers/atlas-mounted-workbench.mjs';
buildSync({
  stdin: {
    contents:
      "export {createWorkspaceViewOpener} from './src/app/workspace/workspace-opening'; export {CampaignAtlasWorkbench} from './src/app/atlas/campaign-atlas-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/workspace-opening.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { createWorkspaceViewOpener, CampaignAtlasWorkbench } = createRequire(import.meta.url)(
  '../../.build/workspace-opening.cjs',
);
function fixture() {
  let owner = {},
    intent = 1,
    request = 0,
    failed = false,
    resolve,
    reject;
  const pending = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const errors = [],
    calls = [],
    frames = [],
    restored = [];
  const open = createWorkspaceViewOpener({
    get owner() {
      return owner;
    },
    get intent() {
      return intent;
    },
    get request() {
      return request;
    },
    get failed() {
      return failed;
    },
    show: () => {
      request++;
      return 42;
    },
    atlas: () => {
      calls.push('atlas');
      return pending;
    },
    areas: {
      live: () => {
        calls.push('live');
        return pending;
      },
    },
    status: (message, error) => errors.push({ message, error }),
    frame: (callback) => frames.push(callback),
    restore: (...args) => restored.push(args),
  });
  return {
    open,
    resolve,
    reject,
    errors,
    calls,
    restored,
    frame: () => frames.splice(0).forEach((callback) => callback()),
    fail: () => (failed = true),
    changeOwner: () => {
      owner = {};
      intent++;
    },
    changeView: () => request++,
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('opening the Atlas releases the workspace while its first region is unresolved', async () => {
  const f = fixture();
  let settled = false;
  const opening = f.open('atlas').then(() => (settled = true));
  try {
    await tick();
    assert.equal(settled, true);
    assert.deepEqual(f.calls, ['atlas']);
  } finally {
    f.resolve();
    await opening;
  }
});

test('Atlas context activation retires only the previous context status', (t) => {
  const { atlas: ui, document } = mountAtlasWorkbench(t, CampaignAtlasWorkbench);
  ui.activate({ token: 'a', campaign: { id: 'a' } });
  const status = document.getElementById('atlas-save-status');
  status.dataset.error = 'true';
  status.textContent = 'Alter Atlasfehler';
  document.getElementById('atlas-search').value = 'Alter Suchtext';
  document.getElementById('commit-pending').hidden = false;
  ui.activate({ token: 'b', campaign: { id: 'b' } });
  assert.equal(document.getElementById('atlas-search').value, '');
  assert.equal(status.dataset.error, 'false');
  assert.equal(status.textContent, 'Kartenausschnitt wird geladen…');
  assert.equal(document.getElementById('commit-pending').hidden, false);
  status.dataset.error = 'true';
  status.textContent = 'Aktueller Fehler';
  document.getElementById('atlas-search').value = 'Aktuelle Suche';
  ui.activate({ token: 'b', campaign: { id: 'b' } });
  assert.equal(status.dataset.error, 'true');
  assert.equal(status.textContent, 'Aktueller Fehler');
  assert.equal(document.getElementById('atlas-search').value, 'Aktuelle Suche');
});
for (const stale of [null, 'changeOwner', 'changeView'])
  test(`late Atlas opening errors belong only to the current view: ${stale ?? 'current'}`, async () => {
    const f = fixture();
    await f.open('atlas');
    if (stale) f[stale]();
    f.reject(Error('Karte nicht verfügbar'));
    await tick();
    assert.deepEqual(f.errors, stale ? [] : [{ message: 'Karte nicht verfügbar', error: true }]);
  });
test('the change preserves awaited entry for other workspace areas', async () => {
  const f = fixture();
  let settled = false;
  const opening = f.open('live').then(() => (settled = true));
  await tick();
  assert.equal(settled, false);
  f.resolve();
  await opening;
  assert.equal(settled, true);
});

for (const stale of [null, 'changeOwner', 'changeView', 'fail'])
  test(`scroll restoration belongs to the current successful view: ${stale ?? 'current'}`, async () => {
    const f = fixture();
    await f.open('atlas', 42, 20, true);
    if (stale) f[stale]();
    f.frame();
    assert.deepEqual(f.restored, stale ? [] : [['atlas', 42, 20, true]]);
    f.resolve();
  });
