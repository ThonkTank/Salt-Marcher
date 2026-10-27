import { readFileSync as readWorkspaceSource } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/map-camera-passivity',
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
  entryPoints: ['src/app/runtime/world-ui.ts'],
  outfile: base + '/world.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'map-camera-')),
    file = path.join(root, 'campaign.sqlite'),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = new CampaignStore(file),
    campaign = store.create('Passive Kamera'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  );
  const map = {
    ...store.world(w.token).maps[0],
    revision: 0,
    name: 'Originalkarte',
    hexMeters: 4828.032,
    climate: 'temperate',
    seed: 'unchanged',
    cells: [],
  };
  store.executeWorld(
    command({ kind: 'map', map, expectedRevision: store.world(w.token).maps[0].revision }),
  );
  Object.assign(map, store.world(w.token).maps[0]);
  const previous = {
      window: globalThis.window,
      document: globalThis.document,
      DOMPoint: globalThis.DOMPoint,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
    },
    { window, document } = parseHTML(readWorkspaceSource('src/app/workspace/index.html', 'utf8'));
  class Matrix {
    inverse() {
      return new Matrix();
    }
  }
  class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    matrixTransform() {
      return new Point(this.x, this.y);
    }
  }
  Object.assign(globalThis, {
    window,
    document,
    DOMPoint: Point,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  const sent = [],
    messages = [];
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
    executeWorld: async (c) => {
      sent.push(structuredClone(c));
      return response(() => store.executeWorld(c));
    },
  };
  window.campaign.executeAtlas = async (envelope) => {
    const reply = await window.campaign.executeWorld(envelope.action.command);
    return reply.ok
      ? { ok: true, value: { atlas: store.campaignAtlas(envelope.token), result: reply.value } }
      : reply;
  };
  delete require.cache[require.resolve('../../' + base + '/world.cjs')];
  const ui = require('../../' + base + '/world.cjs');
  ui.initWorld(
    (text) => messages.push(text),
    async () => true,
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  ui.activateWorld(w);
  await ui.openWorld();
  const get = (id) => document.getElementById(id),
    canvas = get('world-map'),
    captures = new Set();
  canvas.getScreenCTM = () => new Matrix();
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => {
    captures.delete(id);
  };
  const event = (type, fields = {}) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: 0, clientY: 0 }, fields);
    canvas.dispatchEvent(e);
    return e;
  };
  const enter = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const panButton = () => document.querySelector('[data-world-pan="5,0"]').onclick();
  const camera = {
    pan: panButton,
    alt: () => event('keydown', { key: 'ArrowRight', altKey: true }),
    zoom: () => get('world-zoom-in').onclick(),
    wheel: () => event('wheel', { deltaY: -1 }),
    resize: () => window.dispatchEvent(new window.Event('resize')),
    reset: () =>
      document
        .querySelector('.map-canvas-controls[data-canvas-for="world-map"] button:last-of-type')
        .onclick(),
  };
  const digest = () => createHash('sha256').update(store.db.serialize()).digest('hex');
  t.after(() => {
    Object.assign(globalThis, previous);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    w,
    map,
    get,
    canvas,
    event,
    enter,
    camera,
    digest,
    sent,
    messages,
    async saved() {
      for (let i = 0; i < 60; i++) {
        if (sent.length && store.world(w.token).maps[0].cells.length) return;
        await tick();
      }
      assert.fail('Explicit metadata save did not arrive');
    },
  };
}
for (const kind of ['pan', 'alt', 'zoom', 'wheel', 'resize', 'reset'])
  test(
    'camera ' + kind + ' leaves unrelated invalid author inputs and confirmed data unchanged',
    async (t) => {
      const x = await fixture(t);
      if (kind === 'reset') x.camera.pan();
      await tick();

      x.enter('hex-label', '  Ungespeicherte Notiz\r\n');
      x.enter('calendar-name', '');
      const before = x.digest(),
        box = x.canvas.getAttribute('viewBox'),
        selection = x.get('hex-selected').textContent;
      x.camera[kind]();
      await tick();
      await tick();
      assert.equal(x.sent.length, 0, 'Passive camera must not attempt a world command');
      assert.equal(x.digest(), before);

      assert.equal(x.get('hex-label').value, '  Ungespeicherte Notiz\r\n');
      assert.equal(x.get('calendar-name').value, '');
      assert.equal(x.get('hex-selected').textContent, selection);
      if (kind !== 'resize')
        assert.notEqual(
          x.canvas.getAttribute('viewBox'),
          box,
          'Invalid author input must not block camera navigation',
        );
    },
  );
test('pan buttons preserve valid dirty cell and calendar edits until an explicit save', async (t) => {
  const x = await fixture(t);
  x.enter('hex-label', '  Unbestätigte Prosa\r\n');
  x.enter('calendar-name', 'Anderer Kalender');
  const before = x.digest(),
    box = x.canvas.getAttribute('viewBox');
  x.camera.pan();
  await tick();
  await tick();
  assert.equal(x.sent.length, 0);
  assert.equal(x.digest(), before);
  assert.notEqual(x.canvas.getAttribute('viewBox'), box);
  assert.equal(x.get('hex-label').value, '  Unbestätigte Prosa\r\n');
  x.get('hex-form').onsubmit({ preventDefault() {} });
  await x.saved();
  for (let i = 0; i < 50 && x.sent.length < 2; i++) await tick();
  assert.equal(x.store.world(x.w.token).maps[0].cells[0].label, '  Unbestätigte Prosa\r\n');
  assert.equal(x.store.world(x.w.token).calendar.name, 'Anderer Kalender');
});
test('Alt arrows retain a fractional camera position and resize releases a shared middle drag', async (t) => {
  const x = await fixture(t),
    before = x.digest();
  x.event('pointerdown', { pointerId: 12, button: 1, clientX: 0, clientY: 0 });
  x.event('pointermove', { pointerId: 12, clientX: 50, clientY: 0 });
  x.event('pointerup', { pointerId: 12, button: 1 });
  const left = Number(x.canvas.getAttribute('viewBox').split(' ')[0]);
  x.camera.alt();
  assert.equal(Number(x.canvas.getAttribute('viewBox').split(' ')[0]), left + 100);
  x.event('pointerdown', { pointerId: 13, button: 1, clientX: 0, clientY: 0 });
  x.event('pointermove', { pointerId: 13, clientX: 30, clientY: 0 });
  const box = x.canvas.getAttribute('viewBox');
  x.camera.resize();
  x.event('pointermove', { pointerId: 13, clientX: 800, clientY: 0 });
  x.event('pointerup', { pointerId: 13, button: 1 });
  assert.equal(x.canvas.getAttribute('viewBox'), box);
  await tick();
  assert.equal(x.digest(), before);
  assert.equal(x.sent.length, 0);
});

for (const action of ['previous', 'next', 'reset'])
  test(
    'shared ' + action + ' control preserves dirty authoring inputs and sends no command',
    async (t) => {
      const x = await fixture(t);
      x.camera.pan();
      x.camera.zoom();
      const controls = document.querySelector('.map-canvas-controls[data-canvas-for="world-map"]'),
        buttons = controls.querySelectorAll('button');
      if (action === 'next') buttons[0].onclick();

      x.enter('hex-label', 'Originaler Entwurf');
      const before = x.digest(),
        box = x.canvas.getAttribute('viewBox');
      buttons[action === 'previous' ? 0 : action === 'next' ? 1 : 2].onclick();
      await tick();
      assert.notEqual(x.canvas.getAttribute('viewBox'), box);

      assert.equal(x.get('hex-label').value, 'Originaler Entwurf');
      assert.equal(x.sent.length, 0);
      assert.equal(x.digest(), before);
    },
  );
