import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/calendar-rules',
  require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/world-ui.ts'],
  outfile: base + '/world.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
async function until(predicate) {
  for (let i = 0; i < 80; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail('Calendar operation did not finish');
}
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'calendar-rules-')),
    { CampaignStore } = require('../' + base + '/store.cjs'),
    store = new CampaignStore(path.join(root, 'campaign.sqlite')),
    campaign = store.create('Kalender'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
  store.executeWorld(
    command({
      kind: 'calendar-event',
      event: {
        id: randomUUID(),
        revision: 0,
        name: 'Frist',
        startMs: '54000000',
        durationMs: '60000',
        repeatMs: null,
        locationId: null,
        notes: '  Originale Frist\r\n',
        trashed: false,
      },
      expectedRevision: null,
    }),
  );
  const previous = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
    },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  const sent = [];
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {
    world: async (token) => response(() => store.world(token)),
    preparation: async (token) => response(() => store.preparation(token)),
    live: async (token) => response(() => store.live(token)),
    sceneWorld: async (token, id) => response(() => store.sceneWorld(token, id)),
    reconcileWorld: async (c, token) => response(() => store.reconcileWorld(c, token)),
    executeWorld: async (c) => {
      sent.push(structuredClone(c));
      return response(() => store.executeWorld(c));
    },
  };
  delete require.cache[require.resolve('../' + base + '/world.cjs')];
  const ui = require('../' + base + '/world.cjs');
  ui.initWorld(
    () => {},
    async () => true,
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  const get = (id) => document.getElementById(id),
    dialog = get('calendar-rules');
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  get('calendar-rules-status').scrollIntoView = () => {};
  ui.activateWorld(w);
  await ui.openWorld();
  const enter = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const click = async (name) => {
    [...dialog.querySelectorAll('button')].find((b) => b.textContent === name).click();
    await tick();
  };
  const submit = () => get('calendar-form').onsubmit({ preventDefault() {} });
  const saved = async () => {
    try {
      await until(
        () =>
          get('calendar-rules-status').textContent.startsWith('Kalender gespeichert.') &&
          !get('calendar-name').disabled,
      );
    } catch (error) {
      throw Error(get('calendar-rules-status').textContent, { cause: error });
    }
  };
  const snapshot = () => ({
    calendar: store.world(w.token).calendar,
    events: store.world(w.token).events,
    scene: store.live(w.token).scene,
  });
  t.after(() => {
    Object.assign(globalThis, previous);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    ui,
    w,
    store,
    command,
    get,
    dialog,
    enter,
    click,
    submit,
    saved,
    snapshot,
    sent,
    window,
  };
}
test('calendar rules open directly, save fractional hours through the existing writer, and preserve event/scene instants', async (t) => {
  const x = await fixture(t),
    before = x.snapshot();
  await x.ui.openWorldCalendar();
  assert.equal(x.dialog.open, true);
  assert.equal(x.sent.length, 0);
  assert.equal(x.get('calendar-form').closest('dialog'), x.dialog);
  x.enter('calendar-hours', '1.5');
  x.submit();
  await x.saved();
  const after = x.snapshot();
  assert.equal(after.calendar.daySeconds, 5400);
  assert.equal(after.calendar.revision, before.calendar.revision + 1);
  assert.deepEqual(after.events, before.events);
  assert.deepEqual(after.scene, before.scene);
  assert.equal(x.sent.length, 1);
  await x.click('Schließen');
  await x.ui.openWorldCalendar();
  assert.equal(x.get('calendar-hours').value, '1.5');
  assert.equal(x.sent.length, 1);
});
test('close and Escape preserve dirty raw values until explicit discard; stale background reads cannot replace them', async (t) => {
  const x = await fixture(t),
    before = x.snapshot();
  await x.ui.openWorldCalendar();
  x.enter('calendar-name', '  Mein Entwurf');
  x.enter('calendar-months', 'Ungültige Rohfassung');
  await x.click('Schließen');
  assert.equal(x.dialog.open, true);
  x.dialog.dispatchEvent(new x.window.Event('cancel', { cancelable: true }));
  assert.equal(x.dialog.open, true);
  await x.ui.openWorld();
  assert.equal(x.get('calendar-months').value, 'Ungültige Rohfassung');
  assert.deepEqual(x.snapshot(), before);
  await x.click('Eingaben verwerfen');
  assert.equal(x.dialog.open, false);
  await x.ui.openWorldCalendar();
  assert.equal(x.get('calendar-name').value, before.calendar.name);
  assert.equal(x.sent.length, 0);
});
test('a newer calendar revision is never silently adopted beneath a dirty draft', async (t) => {
  const x = await fixture(t);
  await x.ui.openWorldCalendar();
  x.enter('calendar-name', 'Eigene Änderung');
  const old = x.snapshot().calendar;
  x.store.executeWorld(
    x.command({
      kind: 'calendar',
      calendar: { ...old, name: 'Fremde Änderung' },
      expectedRevision: old.revision,
    }),
  );
  await x.ui.openWorld();
  x.submit();
  await until(() => !x.get('calendar-name').disabled);
  assert.equal(x.snapshot().calendar.name, 'Fremde Änderung');
  assert.equal(x.get('calendar-name').value, 'Eigene Änderung');
  assert.match(x.get('calendar-rules-status').textContent, /Eingaben bleiben offen/);
  await x.click('Eingaben verwerfen');
  await x.ui.openWorldCalendar();
  assert.equal(x.get('calendar-name').value, 'Fremde Änderung');
});
test('a lost calendar save reply is checked by original command without resending or discarding later input', async (t) => {
  const x = await fixture(t);
  await x.ui.openWorldCalendar();
  const execute = x.window.campaign.executeWorld;
  x.window.campaign.executeWorld = async (c) => {
    await execute(c);
    throw Error('Antwort verloren');
  };
  x.enter('calendar-name', 'Gespeicherter Kalender');
  x.submit();
  await until(() => !x.get('calendar-name').disabled);
  x.enter('calendar-name', 'Spätere Eingabe');
  await x.click('Eingaben verwerfen');
  assert.equal(x.dialog.open, true);
  assert.equal(x.get('calendar-write-check').hidden, false);
  await x.click('Speicherauftrag prüfen');
  await until(() => !x.get('calendar-name').disabled && x.get('calendar-write-check').hidden);
  assert.equal(x.sent.length, 1);
  assert.equal(x.snapshot().calendar.name, 'Gespeicherter Kalender');
  assert.equal(x.get('calendar-name').value, 'Spätere Eingabe');
  await x.click('Schließen');
  assert.equal(x.dialog.open, true);
  x.window.campaign.executeWorld = execute;
  x.submit();
  await x.saved();
  assert.equal(x.snapshot().calendar.name, 'Spätere Eingabe');
  assert.equal(x.sent.length, 2);
  await x.click('Schließen');
  assert.equal(x.dialog.open, false);
});
test('campaign activation invalidates delayed calendar opening', async (t) => {
  const x = await fixture(t),
    read = x.window.campaign.world;
  let release;
  x.window.campaign.world = () => new Promise((r) => (release = r));
  const opening = x.ui.openWorldCalendar();
  await until(() => !!release);
  x.ui.activateWorld(x.w);
  release(await read(x.w.token));
  await opening;
  assert.equal(x.dialog.open, false);
  assert.equal(x.sent.length, 0);
});
test('editing another field retains a seconds-precise calendar day', async (t) => {
  const x = await fixture(t),
    old = x.snapshot().calendar;
  x.store.executeWorld(
    x.command({
      kind: 'calendar',
      calendar: { ...old, daySeconds: 3601 },
      expectedRevision: old.revision,
    }),
  );
  await x.ui.openWorldCalendar();
  x.enter('calendar-name', 'Sekundentag');
  x.submit();
  await x.saved();
  assert.equal(x.snapshot().calendar.daySeconds, 3601);
});
test('a calendar write known not to have run keeps the draft and permits an explicit retry', async (t) => {
  const x = await fixture(t);
  await x.ui.openWorldCalendar();
  const execute = x.window.campaign.executeWorld,
    before = x.snapshot();
  x.window.campaign.executeWorld = async () => {
    throw Error('Vor Dispatch unterbrochen');
  };
  x.enter('calendar-name', 'Offener Kalender');
  x.submit();
  await until(() => !x.get('calendar-name').disabled);
  await x.click('Speicherauftrag prüfen');
  await until(() => !x.get('calendar-name').disabled && x.get('calendar-write-check').hidden);
  assert.deepEqual(x.snapshot(), before);
  assert.equal(x.get('calendar-name').value, 'Offener Kalender');
  assert.match(x.get('calendar-rules-status').textContent, /nicht übernommen/);
  x.window.campaign.executeWorld = execute;
  x.submit();
  await x.saved();
  assert.equal(x.sent.length, 1);
  assert.equal(x.snapshot().calendar.name, 'Offener Kalender');
});
test('a pending save locks fields and cannot close or unlock a later campaign dialog', async (t) => {
  const x = await fixture(t);
  await x.ui.openWorldCalendar();
  const execute = x.window.campaign.executeWorld;
  let release;
  const held = new Promise((r) => (release = r));
  let committed = false;
  x.window.campaign.executeWorld = async (c) => {
    const result = await execute(c);
    committed = true;
    await held;
    return result;
  };
  x.enter('calendar-name', 'Bestätigter Kalender');
  x.submit();
  await until(() => committed);
  assert.equal(x.get('calendar-name').disabled, true);
  x.dialog.dispatchEvent(new x.window.Event('cancel', { cancelable: true }));
  assert.equal(x.dialog.open, true);
  const other = x.store.create('Andere Kampagne'),
    active = x.store.activate(other.id);
  x.ui.activateWorld(active);
  await x.ui.openWorldCalendar();
  x.enter('calendar-name', 'Neuer Rohentwurf');
  release();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(x.dialog.open, true);
  assert.equal(x.get('calendar-name').value, 'Neuer Rohentwurf');
  assert.equal(x.get('calendar-name').disabled, false);
});
