import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { randomUUID } from 'node:crypto';
const base = '.build/planner-extension-recovery';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/workspace/extensions-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../' + base + '/store.cjs'),
  tick = () => new Promise((r) => setImmediate(r));
async function until(f) {
  for (let i = 0; i < 100; i++) {
    if (f()) return;
    await tick();
  }
  assert.ok(f(), 'expected recovery state');
}
const bytes = () =>
  Buffer.from(
    JSON.stringify({
      format: 'Kampagnenwerkstatt Extension',
      version: 1,
      manifest: {
        id: 'own.way-note',
        name: 'Wegnotiz',
        version: '1.0.0',
        hostApi: 1,
        unitCodec: 'way-note:1',
        rights: ['ownedUnits.read', 'ownedUnits.write'],
      },
      renderer: { html: '<p>Own</p>', script: 'throw new Error("not executed");', styles: '' },
    }),
  );
async function fixture(t, journal) {
  const root = mkdtempSync(path.join(tmpdir(), 'extension-recovery-')),
    store = new CampaignStore(root + '/store.sqlite'),
    preview = store.extensionPreview(bytes()),
    installed = store.executeExtension({
      commandId: randomUUID(),
      action: {
        kind: 'install',
        ticket: preview.ticket,
        hash: preview.hash,
        expectedRevision: null,
        rights: preview.manifest.rights,
      },
    });
  store.create('Eigene Kampagne');
  if (typeof journal === 'function') journal = journal({ store, installed });
  const { window, document } = parseHTML(readWorkspaceMarkup()),
    saved = { window: globalThis.window, document: globalThis.document },
    storage = new Map(journal === undefined ? [] : [['extension-pending-write', journal]]),
    commands = [],
    messages = [];
  Object.assign(globalThis, { window, document });
  window.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const el = (id) => document.getElementById(id),
    dialog = el('extensions-dialog');
  Object.defineProperty(dialog, 'open', { value: false, writable: true });
  dialog.showModal = () => (dialog.open = true);
  dialog.close = () => (dialog.open = false);
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {
    extensions: async (a) => response(() => store.extensions(a)),
    extensionPreview: async () => response(() => store.extensionPreview(bytes())),
    executeExtension: async (c) => {
      commands.push(c);
      return response(() => store.executeExtension(c));
    },
    extensionOutcome: async (c) => response(() => store.extensionOutcome(c)),
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs');
  ui.initExtensions((text, error) => messages.push({ text, error }));
  el('extensions-open').click();
  await until(() => el('extension-list').textContent.includes('Wegnotiz'));
  t.after(() => {
    store.close();
    Object.assign(globalThis, saved);
    rmSync(root, { recursive: true, force: true });
  });
  return { store, installed, window, el, storage, commands, messages };
}
for (const raw of [
  '{broken',
  JSON.stringify({ commandId: 'lost', action: { kind: 'install' } }),
  JSON.stringify(null),
])
  test(
    'damaged recovery metadata blocks writes until explicit preservation and reset: ' + raw,
    (t) =>
      fixture(t, raw).then(async (x) => {
        const before = x.store.db.serialize();
        assert.equal(x.el('extension-pick').disabled, true);
        const reset = x.el('extension-reset-recovery');
        assert.ok(reset, 'recovery action exists');
        assert.equal(x.el('extension-recovery').hidden, false);
        assert.equal(reset.disabled, false);
        assert.equal(x.el('extension-outcome').hidden, true);
        assert.equal(x.storage.get('extension-pending-write'), raw);
        reset.click();
        await until(() => !x.el('extension-pick').disabled);
        assert.equal(x.storage.has('extension-pending-write'), false);
        assert.ok(
          [...x.storage.entries()].some(
            ([key, value]) => key.startsWith('extension-damaged-write:') && value === raw,
          ),
        );
        assert.ok(x.store.db.serialize().equals(before));
        assert.equal(x.commands.length, 0);
        assert.deepEqual(x.store.extensions(null).items[0], x.installed);
        assert.equal(x.store.list().campaigns.length, 1);
        const revoke = [...x.el('extension-list').querySelectorAll('button')].find(
          (b) => b.textContent === 'Rechte widerrufen',
        );
        revoke.click();
        await until(() => x.store.extensions(null).items[0].grants.length === 0);
        assert.equal(x.commands.length, 1);
      }),
  );
test('a valid unconfirmed command is retained for outcome lookup and cannot be discarded as damaged', async (t) => {
  const command = {
      commandId: randomUUID(),
      action: { kind: 'revoke', id: 'own.way-note', expectedRevision: 1 },
    },
    raw = JSON.stringify(command),
    x = await fixture(t, raw);
  assert.equal(x.el('extension-pick').disabled, true);
  assert.equal(x.el('extension-recovery').hidden, true);
  assert.equal(x.el('extension-outcome').hidden, false);
  const before = x.store.db.serialize();
  x.el('extension-outcome').click();
  await until(() => !x.storage.has('extension-pending-write'));
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.commands.length, 0);
  assert.equal(x.el('extension-pick').disabled, false);
});
test('failure to preserve damaged metadata keeps the original and all writes blocked', async (t) => {
  const raw = '{original',
    x = await fixture(t, raw),
    before = x.store.db.serialize();
  x.window.localStorage.setItem = () => {
    throw new Error('Speicher nicht verfügbar');
  };
  assert.ok(x.el('extension-reset-recovery'));
  x.el('extension-reset-recovery').click();
  await tick();
  assert.equal(x.storage.get('extension-pending-write'), raw);
  assert.equal(x.el('extension-pick').disabled, true);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.commands.length, 0);
  assert.ok(x.messages.some((m) => m.text.includes('Speicher nicht verfügbar')));
});
test('malformed command cannot replay an acknowledged installation or produce an outcome', async (t) => {
  const x = await fixture(t),
    command = {
      commandId: randomUUID(),
      action: { kind: 'revoke', id: x.installed.id, expectedRevision: 1 },
    },
    result = x.store.executeExtension(command),
    before = x.store.db.serialize(),
    bad = { ...command, unexpected: 'data' };
  assert.throws(() => x.store.executeExtension(bad), /Auftrag|Installations/);
  assert.throws(() => x.store.extensionOutcome(bad), /Auftrag|Installations/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(result.grants.length, 0);
});
test('restart recovery confirms a committed revocation without replaying the writer', async (t) => {
  let command;
  const x = await fixture(t, ({ store, installed }) => {
      command = {
        commandId: randomUUID(),
        action: { kind: 'revoke', id: installed.id, expectedRevision: installed.revision },
      };
      store.executeExtension(command);
      return JSON.stringify(command);
    }),
    before = x.store.db.serialize();
  assert.equal(x.el('extension-recovery').hidden, true);
  x.el('extension-outcome').click();
  await until(() => !x.storage.has('extension-pending-write'));
  assert.equal(x.store.extensions(null).items[0].revision, 2);
  assert.equal(x.store.extensions(null).items[0].grants.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.commands.length, 0);
});
test('damaged recovery reset requires a fresh successful installation list', async (t) => {
  const x = await fixture(t, '{preserve'),
    before = x.store.db.serialize();
  x.el('extensions-close').click();
  x.window.campaign.extensions = async () => ({
    ok: false,
    error: 'Installationsliste ausgefallen',
  });
  x.el('extensions-open').click();
  await until(() => x.messages.some((m) => m.text.includes('Installationsliste ausgefallen')));
  assert.equal(x.el('extension-reset-recovery').disabled, true);
  x.el('extension-reset-recovery').onclick();
  assert.equal(x.storage.get('extension-pending-write'), '{preserve');
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.commands.length, 0);
});
test('changed recovery record cannot be deleted by an old reset and is re-read on reopen', async (t) => {
  const x = await fixture(t, '{old'),
    newer = {
      commandId: randomUUID(),
      action: { kind: 'remove', id: x.installed.id, expectedRevision: x.installed.revision },
    },
    raw = JSON.stringify(newer),
    before = x.store.db.serialize();
  x.storage.set('extension-pending-write', raw);
  x.el('extension-reset-recovery').click();
  await tick();
  assert.equal(x.storage.get('extension-pending-write'), raw);
  assert.equal(x.el('extension-pick').disabled, true);
  x.el('extensions-close').click();
  x.el('extensions-open').click();
  await tick();
  assert.equal(x.el('extension-recovery').hidden, true);
  assert.equal(x.el('extension-outcome').hidden, false);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.commands.length, 0);
});
test('temporary recovery storage read failure stays blocked and can recover by reopening', async (t) => {
  const x = await fixture(t),
    get = x.window.localStorage.getItem,
    before = x.store.db.serialize();
  x.el('extensions-close').click();
  x.window.localStorage.getItem = () => {
    throw Error('Lesen nicht verfügbar');
  };
  x.el('extensions-open').click();
  await tick();
  assert.equal(x.el('extension-pick').disabled, true);
  assert.equal(x.el('extension-reset-recovery').disabled, true);
  x.el('extensions-close').click();
  x.window.localStorage.getItem = get;
  x.el('extensions-open').click();
  await tick();
  assert.equal(x.el('extension-pick').disabled, false);
  assert.equal(x.el('extension-recovery').hidden, true);
  assert.ok(x.store.db.serialize().equals(before));
});
