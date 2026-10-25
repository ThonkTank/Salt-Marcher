import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from './helpers/build.mjs';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
for (const [entry, name] of [
  ['src/app/scene-place-binder.ts', 'place-binder'],
  ['src/app/storage/store.ts', 'place-binder-store'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { ScenePlaceBinder } = require('../.build/place-binder.cjs'),
  { CampaignStore } = require('../.build/place-binder-store.cjs'),
  tick = () => new Promise((r) => setImmediate(r)),
  ok = (value) => ({ ok: true, value });
async function until(fn) {
  for (let i = 0; i < 150 && !fn(); i++) await tick();
  assert(fn());
}
function ui(t, reader) {
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  Object.assign(globalThis, { window, document });
  window.campaign = { locationMaterials: reader };
  const actions = [],
    root = document.getElementById('root'),
    binder = new ScenePlaceBinder(
      root,
      async (ref, current) => {
        if (current()) actions.push(['open', ref]);
      },
      async (ref, current) => {
        if (current()) actions.push(['pin', ref]);
      },
    );
  t.after(() => {
    binder.reset();
    Object.assign(globalThis, previous);
  });
  return { binder, root, actions };
}
const item = (id) => ({ id, title: id, detail: 'Am Ort', ref: { kind: 'note', id } });
test('place binder loads all category pages and opens or pins only explicitly selected records', async (t) => {
  const calls = [],
    x = ui(t, async (token, q) => {
      calls.push(q);
      return ok({
        items:
          q.kind === 'npc'
            ? Array.from({ length: q.offset ? 1 : 40 }, (_, i) => item('NSC-' + (q.offset + i)))
            : [],
        next: q.kind === 'npc' && !q.offset ? 40 : null,
        locationRevision: 1,
      });
    });
  x.binder.show({ token: 'a' }, 'place', 'Hafen', () => true);
  await until(() => x.root.querySelectorAll('.scene-place-row').length === 40);
  assert.equal(x.actions.length, 0);
  const npc = x.root.querySelector('[data-place-kind="npc"]');
  [...npc.querySelectorAll('button')].find((b) => b.textContent === 'Weitere NSCs').click();
  await until(() => x.root.querySelectorAll('.scene-place-row').length === 41);
  assert.equal(calls.at(-1).offset, 40);
  const row = npc.querySelector('.scene-place-row');
  row.querySelectorAll('button')[0].click();
  row.querySelectorAll('button')[1].click();
  await tick();
  assert.deepEqual(x.actions, [
    ['open', { kind: 'note', id: 'NSC-0' }],
    ['pin', { kind: 'note', id: 'NSC-0' }],
  ]);
});
test('location changes discard late categories and old buttons while one failed family can retry independently', async (t) => {
  let release;
  const late = new Promise((r) => (release = r));
  let fail = true;
  const x = ui(t, async (_token, q) =>
    q.locationId === 'old'
      ? late
      : q.kind === 'faction' && fail
        ? { ok: false, error: 'Quelle fehlt' }
        : ok({ items: [item(q.locationId + '-' + q.kind)], next: null, locationRevision: 1 }),
  );
  x.binder.show({ token: 'a' }, 'old', 'Alter Ort', () => true);
  x.binder.show({ token: 'a' }, 'new', 'Neuer Ort', () => true);
  await until(() => x.root.querySelectorAll('.scene-place-row').length === 2);
  release(ok({ items: [item('stale')], next: null, locationRevision: 1 }));
  await tick();
  assert(!x.root.textContent.includes('stale'));
  const oldButton = x.root.querySelector('.scene-place-row button');
  x.binder.reset();
  oldButton.onclick();
  assert.equal(x.actions.length, 0);
  x.binder.show({ token: 'a' }, 'new', 'Neuer Ort', () => true);
  await until(() => x.root.textContent.includes('Quelle fehlt'));
  const faction = x.root.querySelector('[data-place-kind="faction"]');
  fail = false;
  faction.querySelectorAll('button')[1].click();
  await until(() => faction.querySelector('.scene-place-row'));
  assert.equal(x.root.querySelectorAll('.scene-place-row').length, 3);
});
test('shops of directly placed NPCs follow their actual location without requiring any prepared group', (t) => {
  const dir = mkdtempSync(tmpdir() + '/scene-shop-'),
    store = new CampaignStore(dir + '/campaign.sqlite');
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const cam = store.create('Hafen'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const place = (id) => ({
    kind: 'location',
    version: 1,
    id,
    name: id,
    type: 'poi',
    sections: [],
    detailMaps: [],
    keyLinks: [],
  });
  for (const id of ['hafen', 'berg'])
    store.changePreparation({
      ...command(null),
      change: { kind: 'location', expectedRevision: null, document: place(id) },
    });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    person = {
      id: randomUUID(),
      name: 'Händlerin',
      creatureId: null,
      readAloud: '',
      gmNotes: '  Original\r\n',
      record: null,
      locationId: 'hafen',
      health: null,
    };
  person.record = {
    id: person.id,
    revision: 0,
    factionId: null,
    modifier: 0,
    lifecycle: 'active',
    appearance: '',
    behavior: '',
    history: '',
  };
  store.executeNpc({
    ...command(null),
    expectedNoteRevision: null,
    expectedRecordRevision: 0,
    expectedActorRevision: null,
    expectedPositionRevision: null,
    npc: person,
  });
  const shop = store.executeItemShop(
    command({
      kind: 'shop',
      expectedRevision: null,
      shop: {
        id: randomUUID(),
        revision: 0,
        name: 'Hafenladen',
        owner: { kind: 'npc', id: person.id },
        notes: '',
        trashed: false,
        stock: [],
      },
    }),
  ).shop.shop;
  const locate = (id) => {
    const sc = store.liveScene(w.token, scene.id);
    store.executeLive(
      command({
        kind: 'scene-content',
        sceneId: scene.id,
        expectedRevision: sc.revision,
        title: sc.title,
        notes: sc.notes,
        locationId: id,
      }),
    );
  };
  locate('hafen');
  const before = store.db.serialize();
  assert.deepEqual(
    store.sceneShops(w.token, scene.id).map((s) => s.id),
    [shop.id],
  );
  assert(store.db.serialize().equals(before));
  locate('berg');
  assert.equal(store.sceneShops(w.token, scene.id).length, 0);
  locate('hafen');
  assert.equal(
    store.locationMaterials(w.token, { locationId: 'hafen', kind: 'npc', text: '', offset: 0 })
      .items[0].id,
    person.id,
  );
});
