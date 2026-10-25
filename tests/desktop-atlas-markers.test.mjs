import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/atlas-markers-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/world-ui.ts'],
  outfile: '.build/atlas-markers-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../.build/atlas-markers-store.cjs');
const style = {
  title: 'Die versunkene Krone',
  symbol: 'ruin',
  size: 1.7,
  labelPosition: 'below',
  curve: 0.6,
};
const tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check());
}
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-markers-')),
    store = new CampaignStore(path.join(dir, 'world.sqlite')),
    campaign = store.create('Nordmark'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    }),
    id = randomUUID();
  const location = {
    kind: 'location',
    version: 1,
    id,
    name: 'Kronenruine',
    type: 'poi',
    sections: [{ id: randomUUID(), title: 'Geheimnis', markdown: '  Originaltext\r\n' }],
    detailMaps: [],
    keyLinks: [],
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  const map = {
    ...store.world(w.token).maps[0],
    revision: 0,
    name: 'Nordmark',
    hexMeters: 4828.032,
    climate: 'temperate',
    seed: 'fixed',
    cells: [
      {
        q: 0,
        r: 0,
        level: 0,
        terrain: 'forest',
        elevationM: 0,
        climate: null,
        road: false,
        river: false,
        label: '',
        faction: '',
        interrupt: '',
      },
    ],
  };
  store.executeWorld(
    command({ kind: 'map', map, expectedRevision: store.world(w.token).maps[0].revision }),
  );
  Object.assign(map, store.world(w.token).maps[0]);
  store.executeWorld(
    command({
      kind: 'place',
      mapId: map.id,
      locationId: id,
      expectedRevision: null,
      hex: { q: 0, r: 0 },
    }),
  );
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, store, campaign, w, command, id, location, map };
}
test('marker presentation survives move, fresh and independent campaign copy without changing catalog or terrain', async (t) => {
  const x = fixture(t),
    before = x.store.preparation(x.w.token).locations[0];
  x.store.executeWorld(
    x.command({
      kind: 'place-presentation',
      locationId: x.id,
      expectedRevision: null,
      presentation: style,
    }),
  );
  assert.equal(x.store.world(x.w.token).maps[0].revision, x.map.revision);
  assert.deepEqual(x.store.preparation(x.w.token).locations[0], before);
  assert.throws(
    () =>
      x.store.executeWorld(
        x.command({
          kind: 'place-presentation',
          locationId: x.id,
          expectedRevision: null,
          presentation: { ...style, title: 'Stale' },
        }),
      ),
    /geändert/,
  );
  x.store.executeWorld(
    x.command({
      kind: 'place',
      mapId: x.map.id,
      locationId: x.id,
      expectedRevision: 1,
      hex: { q: 2, r: 1 },
    }),
  );
  let p = x.store.world(x.w.token).places[0];
  assert.deepEqual(p.presentation, style);
  assert.equal(p.presentationRevision, 1);
  assert.equal(p.revision, 2);
  const snapshot = path.join(x.dir, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const target = new CampaignStore(path.join(x.dir, 'copy.sqlite'));
  let copyId;
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Unabhängige Nordmark', {});
    copyId = copy.id;
    const w = target.activate(copy.id);
    p = target.world(w.token).places[0];
    assert.notEqual(p.locationId, x.id);
    assert.deepEqual(p.presentation, style);
    assert.equal(p.q, 2);
    assert.equal(
      target.preparation(w.token).locations[0].document.sections[0].markdown,
      '  Originaltext\r\n',
    );
  } finally {
    target.close();
  }
  const fresh = new CampaignStore(path.join(x.dir, 'copy.sqlite'));
  try {
    p = fresh.world(fresh.activate(copyId).token).places[0];
    assert.deepEqual(p.presentation, style);
    assert.equal(p.presentationRevision, 1);
  } finally {
    fresh.close();
  }
});
test('placing a second location in a shared Atlas hex retains both canonical markers', (t) => {
  const x = fixture(t),
    id = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: { ...x.location, id, name: 'Anderer Ort' },
    },
  });
  x.store.executeWorld(
    x.command({
      kind: 'place',
      mapId: x.map.id,
      locationId: id,
      expectedRevision: null,
      hex: { q: 0, r: 0 },
    }),
  );
  assert.deepEqual(
    x.store
      .world(x.w.token)
      .places.map((p) => p.locationId)
      .sort(),
    [x.id, id].sort(),
  );
  assert.equal(x.store.preparation(x.w.token).locations.length, 2);
});
test('marker sliders preview, coalesce, preserve camera and restore confirmed presentation after conflict', async (t) => {
  const x = fixture(t),
    saved = {
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
  t.after(() => Object.assign(globalThis, saved));
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  let hold = false,
    release;
  const sent = [],
    statuses = [];
  window.campaign = {
    world: async (token) => response(() => x.store.world(token)),
    preparation: async (token) => response(() => x.store.preparation(token)),
    live: async (token) => response(() => x.store.live(token)),
    sceneWorld: async (token, id) => response(() => x.store.sceneWorld(token, id)),
    executeWorld: async (c) => {
      sent.push(c);
      const result = response(() => x.store.executeWorld(c));
      if (hold) {
        hold = false;
        return new Promise((r) => (release = () => r(result)));
      }
      return result;
    },
  };
  window.campaign.executeAtlas = async (envelope) => {
    const reply = await window.campaign.executeWorld(envelope.action.command);
    return reply.ok
      ? { ok: true, value: { atlas: x.store.campaignAtlas(envelope.token), result: reply.value } }
      : reply;
  };
  const ui = require('../.build/atlas-markers-ui.cjs');
  ui.initWorld(
    (text) => statuses.push(text),
    async () => true,
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  ui.activateWorld(x.w);
  await ui.openWorld();
  const el = (id) => document.getElementById(id),
    input = (id, v) => {
      el(id).value = v;
      el(id).oninput();
    };
  el('world-anchor-location').value = x.id;
  el('world-anchor-location').onchange();
  await until(() => !el('world-marker-fields').disabled);
  const camera = el('world-map').getAttribute('viewBox');
  input('world-marker-size', '1.5');
  input('world-marker-size', '1.8');
  assert.equal(sent.length, 0);
  assert.match(
    el('world-map').querySelector('[data-location-id]').getAttribute('transform'),
    /scale\(1.8\)/,
  );
  hold = true;
  el('world-marker-size').onpointerup();
  await until(() => !!release);
  input('world-marker-size', '2.2');
  el('world-marker-size').onpointerup();
  release();
  await until(() => x.store.world(x.w.token).places[0].presentation.size === 2.2);
  assert.equal(sent.length, 2);
  assert.equal(await ui.flushWorld(), true);
  assert.equal(el('world-map').getAttribute('viewBox'), camera);
  // A second writer changes the independently revisioned presentation.
  x.store.executeWorld(
    x.command({
      kind: 'place-presentation',
      locationId: x.id,
      expectedRevision: 2,
      presentation: style,
    }),
  );
  input('world-marker-title', 'Unbestätigter Titel');
  el('world-marker-title').onblur();
  await until(() => el('world-marker-title').value === style.title);
  assert.equal(x.store.world(x.w.token).places[0].presentation.title, style.title);
  assert.ok(statuses.some((s) => s.includes('wiederhergestellt')));
  assert.equal(x.store.world(x.w.token).maps[0].revision, x.map.revision);
  assert.deepEqual(x.store.preparation(x.w.token).locations[0].document, x.location);
  input('world-anchor-search', 'Nordmark');
  assert.match(el('world-anchor-location').textContent, /Kronenruine/);
  assert.match(
    el('world-map').querySelector('[data-marker-label]').textContent,
    /versunkene Krone/,
  );
});
