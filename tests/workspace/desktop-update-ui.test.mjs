import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
await build({
  entryPoints: ['src/app/workspace/update-ui.ts'],
  outfile: '.build/update-ui.test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
async function fixture(t, beforeInstall, updateInstall) {
  const { window, document } = parseHTML('<html><body><header></header></body></html>'),
    oldWindow = globalThis.window,
    oldDocument = globalThis.document;
  globalThis.window = window;
  globalThis.document = document;
  t.after(() => {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  });
  let listener,
    unsubscribed = false;
  const state = {
    phase: 'ready',
    currentVersion: '1.0.0',
    automatic: true,
    lastChecked: null,
    available: { version: '1.0.1', notes: '<script>must remain text</script>' },
    received: 100,
    total: 100,
    message: 'Bereit',
  };
  window.campaign = {
    updateStatus: async () => ({ ok: true, value: state }),
    updateInstall,
    onUpdate: (fn) => {
      listener = fn;
      return () => {
        unsubscribed = true;
      };
    },
  };
  require('../../.build/update-ui.test.cjs').initUpdateUI(beforeInstall);
  await tick();
  const get = (id) => document.querySelector('#updates-' + id);
  const dialog = document.querySelector('dialog');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  return {
    window,
    document,
    get,
    emit: (patch) => listener({ ...state, ...patch }),
    unsubscribed: () => unsubscribed,
  };
}
test('install immediately reports pending saves, resists stale status and blocks duplicate requests until restart', async (t) => {
  const save = deferred(),
    install = deferred();
  let flushes = 0,
    installs = 0;
  const ui = await fixture(
    t,
    () => {
      flushes++;
      return save.promise;
    },
    () => {
      installs++;
      return install.promise;
    },
  );
  assert.equal(ui.document.querySelector('#updates-notes script'), null);
  ui.get('install').click();
  assert.match(ui.get('message').textContent, /Neustart wird vorbereitet/);
  assert.match(ui.get('install').textContent, /Wird vorbereitet/);
  assert.equal(ui.get('progress').hidden, false);
  assert.equal(ui.get('progress').hasAttribute('value'), false);
  assert.equal(ui.get('install').disabled, true);
  assert.equal(ui.get('close').disabled, true);
  assert.equal(ui.get('automatic').disabled, true);
  const escape = new ui.window.Event('cancel', { cancelable: true });
  ui.document.querySelector('dialog').dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  ui.emit({ message: 'Bereit' });
  assert.match(ui.get('message').textContent, /Neustart wird vorbereitet/);
  ui.get('install').click();
  assert.equal(flushes, 1);
  assert.equal(installs, 0);
  save.resolve(true);
  await tick();
  assert.equal(installs, 1);
  assert.match(ui.get('message').textContent, /Installation wird vorbereitet/);
  ui.emit({ phase: 'installing', message: 'Sicherung läuft…' });
  assert.equal(ui.get('message').textContent, 'Sicherung läuft…');
  assert.equal(ui.get('install').hidden, false);
  install.resolve({ ok: true, value: undefined });
  await tick();
  ui.emit({ message: 'Bereit' });
  ui.get('install').click();
  assert.equal(ui.get('install').disabled, true);
  assert.equal(installs, 1);
  ui.window.dispatchEvent(new ui.window.Event('unload'));
  assert.equal(ui.unsubscribed(), true);
});
test('declined editor completion gives a persistent actionable message and permits retry', async (t) => {
  let allowed = false,
    installs = 0;
  const ui = await fixture(
    t,
    async () => allowed,
    async () => {
      installs++;
      return { ok: true, value: undefined };
    },
  );
  ui.get('install').click();
  await tick();
  assert.equal(installs, 0);
  assert.match(
    ui.get('message').textContent,
    /Installation nicht gestartet.*Schließe diesen Dialog/,
  );
  assert.equal(ui.get('close').disabled, false);
  assert.equal(ui.get('progress').hidden, true);
  ui.emit({ message: 'Bereit' });
  assert.match(ui.get('message').textContent, /Arbeitszustand konnte nicht abgeschlossen/);
  allowed = true;
  ui.get('install').click();
  await tick();
  assert.equal(installs, 1);
});
test('save exceptions and failed installation requests remain visible and retryable', async (t) => {
  let saveError = true,
    installs = 0;
  const ui = await fixture(
    t,
    async () => {
      if (saveError) throw new Error('Entwurf konnte nicht gesichert werden');
      return true;
    },
    async () => {
      installs++;
      return { ok: false, error: 'Installationsordner ist nicht beschreibbar' };
    },
  );
  ui.get('install').click();
  await tick();
  assert.equal(installs, 0);
  assert.match(ui.get('message').textContent, /Entwurf konnte nicht/);
  saveError = false;
  ui.get('install').click();
  await tick();
  assert.equal(installs, 1);
  assert.equal(ui.get('install').disabled, false);
  assert.equal(ui.get('close').disabled, false);
  assert.equal(ui.get('progress').hidden, true);
  assert.equal(ui.get('force').hidden, true, 'main-process failures cannot be bypassed');
  ui.emit({ message: 'Bereit' });
  assert.match(ui.get('message').textContent, /nicht beschreibbar/);
  ui.get('install').click();
  await tick();
  assert.equal(installs, 2);
});
test('late status responses cannot erase preparation or a declined attempt; a new action clears the feedback', async (t) => {
  const save = deferred(),
    status = deferred();
  let installs = 0;
  const ui = await fixture(
    t,
    () => save.promise,
    async () => {
      installs++;
      return { ok: true, value: undefined };
    },
  );
  ui.window.campaign.updateStatus = () => status.promise;
  ui.document.dispatchEvent(new ui.window.Event('saltmarcher-open-updates'));
  ui.get('install').click();
  assert.match(ui.get('message').textContent, /Neustart wird vorbereitet/);
  save.resolve(false);
  await tick();
  const ready = {
    phase: 'ready',
    currentVersion: '1.0.0',
    automatic: true,
    lastChecked: null,
    available: { version: '1.0.1', notes: '' },
    received: 100,
    total: 100,
    message: 'Bereit',
  };
  status.resolve({ ok: true, value: ready });
  await tick();
  assert.equal(installs, 0);
  assert.match(ui.get('message').textContent, /Arbeitszustand konnte nicht abgeschlossen/);
  ui.window.campaign.updateCheck = async () => ({ ok: true, value: ready });
  ui.get('check').click();
  await tick();
  assert.equal(ui.get('message').textContent, 'Bereit');
});
test('forced update requires a separate confirmation after failed preparation and skips only that preparation', async (t) => {
  let flushes = 0,
    installs = 0;
  const ui = await fixture(
    t,
    async () => {
      flushes++;
      return false;
    },
    async () => {
      installs++;
      return { ok: true, value: undefined };
    },
  );
  assert.equal(ui.get('force').hidden, true);
  ui.get('force-confirm').click();
  assert.equal(installs, 0);
  ui.get('install').click();
  await tick();
  assert.equal(ui.get('force').hidden, false);
  assert.equal(flushes, 1);
  ui.get('force').click();
  assert.equal(installs, 0);
  assert.equal(ui.get('force-confirmation').hidden, false);
  assert.match(
    ui.get('force-confirmation').textContent,
    /Noch nicht gesicherte Eingaben können verloren gehen/,
  );
  assert.equal(ui.get('install').disabled, true);
  ui.get('install').click();
  assert.equal(flushes, 1);
  ui.get('force-back').click();
  assert.equal(ui.get('force-confirmation').hidden, true);
  assert.equal(installs, 0);
  ui.get('force').click();
  const escape = new ui.window.Event('cancel', { cancelable: true });
  ui.document.querySelector('dialog').dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(ui.get('force-confirmation').hidden, true);
  assert.equal(installs, 0);
  ui.get('force').click();
  ui.get('force-confirm').click();
  await tick();
  assert.equal(flushes, 1);
  assert.equal(installs, 1);
  assert.equal(ui.get('force-confirmation').hidden, true);
  assert.equal(ui.get('install').disabled, true);
  ui.get('force-confirm').click();
  assert.equal(installs, 1);
});
test('confirmation expires when the prepared version changes and force cannot override installation errors', async (t) => {
  let installs = 0;
  const ui = await fixture(
    t,
    async () => {
      throw new Error('Speichern fehlgeschlagen');
    },
    async () => {
      installs++;
      return { ok: false, error: 'Sicherung nicht möglich' };
    },
  );
  ui.get('install').click();
  await tick();
  ui.get('force').click();
  ui.emit({ available: { version: '1.0.2', notes: '' } });
  assert.equal(ui.get('force-confirmation').hidden, true);
  assert.equal(ui.get('force').hidden, true);
  ui.get('force-confirm').click();
  assert.equal(installs, 0);
  ui.get('install').click();
  await tick();
  ui.get('force').click();
  ui.get('force-confirm').click();
  await tick();
  assert.equal(installs, 1);
  assert.equal(ui.get('message').textContent, 'Sicherung nicht möglich');
  assert.equal(ui.get('force').hidden, true);
  assert.equal(ui.get('install').disabled, false);
});
