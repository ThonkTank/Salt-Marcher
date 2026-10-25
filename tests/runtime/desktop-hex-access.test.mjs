import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [entry, name] of [
  ['src/app/storage/store.ts', 'hex-access-store'],
  ['src/app/runtime/world-model.ts', 'hex-access-model'],
  ['src/app/runtime/hex-access-ui.ts', 'hex-access-ui'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../../.build/hex-access-store.cjs'),
  { findRoute, cellAt } = require('../../.build/hex-access-model.cjs'),
  { HexAccessChoices } = require('../../.build/hex-access-ui.cjs');
const cell = (q, r, access) => ({
  q,
  r,
  level: 0,
  terrain: 'plains',
  elevationM: 0,
  climate: null,
  road: false,
  river: false,
  label: '',
  faction: '',
  interrupt: '',
  ...(access ? { access } : {}),
});
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/hex-access-'),
    store = new CampaignStore(root + '/campaign.sqlite'),
    cam = store.create('Passage'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action }),
    pc = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Ada' } }),
    ).character;
  let l = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: pc.id,
      expectedRevision: pc.membershipRevision,
      expectedRosterRevision: l.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: l.focusRevision,
    }),
  );
  const scene = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    ).scene,
    map = {
      ...store.world(w.token).maps[0],
      name: 'Furt',
      hexMeters: 4828.032,
      climate: 'temperate',
      seed: 'fixed',
      cells: [
        cell(1, 0, { mode: 'blocked', requirement: 'Einsturz' }),
        cell(3, 0, { mode: 'requires', requirement: 'Boot' }),
      ],
    };
  store.executeWorld(command({ kind: 'map', map, expectedRevision: map.revision }));
  store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: scene.id,
      expectedSceneRevision: scene.revision,
      expectedPositionRevision: 0,
      position: { mapId: map.id, q: 0, r: 0, locationId: null },
    }),
  );
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const request = {
    sceneId: scene.id,
    mapId: map.id,
    destination: { q: 3, r: 0 },
    destinationLocationId: null,
    waypoints: [],
    paceKmh: 1,
    factor: 1,
    finalSeconds: 12,
  };
  return { root, store, cam, w, scene, map, command, request };
}
test('sparse hexes stay traversable; explicit barriers are avoided and roads do not override a closure', () => {
  const map = {
    id: 'map',
    cells: [{ ...cell(1, 0, { mode: 'blocked', requirement: '' }), road: true }],
  };
  const route = findRoute(map, { q: 0, r: 0 }, { q: 2, r: 0 });
  assert(!route.some((h) => h.q === 1 && h.r === 0));
  assert(route.some((h) => !map.cells.some((c) => c.q === h.q && c.r === h.r)));
  assert.throws(() => findRoute(map, { q: 0, r: 0 }, { q: 1, r: 0 }), /gesperrt/);
  assert.deepEqual(findRoute(map, { q: 1, r: 0 }, { q: 1, r: 0 }), [{ q: 1, r: 0 }]);
});
test('missing transport and final-duration overrides cannot bypass a required or blocked target, with zero writes', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  assert.throws(() => x.store.previewTravel(x.w.token, x.request), /benötigt: Boot/);
  assert.throws(
    () =>
      x.store.previewTravel(x.w.token, {
        ...x.request,
        destination: { q: 1, r: 0 },
        supplies: ['Boot'],
      }),
    /gesperrt/,
  );
  assert.throws(
    () => x.store.previewTravel(x.w.token, { ...x.request, supplies: ['Boot', 'Boot'] }),
    /voraussetzungen/i,
  );
  assert(x.store.db.serialize().equals(before));
  const p = x.store.previewTravel(x.w.token, { ...x.request, supplies: ['Boot'] });
  assert(!p.route.some((h) => h.q === 1 && h.r === 0));
  assert.equal(p.durationSeconds, 12);
  assert.deepEqual(p.request.supplies, ['Boot']);
  assert(x.store.db.serialize().equals(before));
});
test('accepted travel persists declarations and refuses a map changed after preview or acceptance', (t) => {
  const x = fixture(t),
    p = x.store.previewTravel(x.w.token, { ...x.request, supplies: ['Boot'] }),
    j = x.store.executeWorld(x.command({ kind: 'journey', preview: p })).scene.journey;
  assert.deepEqual(j.supplies, ['Boot']);
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '0');
  const map = x.store.world(x.w.token).maps[0];
  x.store.executeWorld(
    x.command({
      kind: 'cell',
      mapId: map.id,
      expectedRevision: map.revision,
      cell: cell(3, 0, { mode: 'blocked', requirement: 'Neu gesperrt' }),
    }),
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeWorld(x.command({ kind: 'journey', preview: p })), /gesperrt/);
  assert.throws(
    () =>
      x.store.executeWorld(
        x.command({ kind: 'journey-step', id: j.id, expectedRevision: j.revision, maxSteps: 1 }),
      ),
    /geändert/,
  );
  assert(x.store.db.serialize().equals(before));
  assert.throws(
    () =>
      x.store.previewTravel(x.w.token, {
        ...x.request,
        supplies: ['Boot'],
        continuation: { journeyId: j.id, expectedRevision: j.revision },
      }),
    /gesperrt/,
  );
});
test('restart and independent campaign transfer retain access, declaration and the committed checkpoint', async (t) => {
  const x = fixture(t),
    p = x.store.previewTravel(x.w.token, { ...x.request, supplies: ['Boot'] }),
    j = x.store.executeWorld(x.command({ kind: 'journey', preview: p })).scene.journey;
  x.store.executeWorld(
    x.command({ kind: 'journey-step', id: j.id, expectedRevision: j.revision, maxSteps: 1 }),
  );
  const facts = x.store.sceneWorld(x.w.token, x.scene.id);
  x.store.close();
  const fresh = new CampaignStore(x.root + '/campaign.sqlite');
  try {
    const w = fresh.activate(x.cam.id),
      v = fresh.sceneWorld(w.token, x.scene.id);
    assert.deepEqual(v.journey.supplies, ['Boot']);
    assert.equal(v.journey.nextIndex, facts.journey.nextIndex);
    assert.equal(v.position.q, facts.position.q);
    assert.equal(v.scene.clock.instantMs, facts.scene.clock.instantMs);
    assert.equal(cellAt(fresh.world(w.token).maps[0], { q: 3, r: 0 }).access.requirement, 'Boot');
    await fresh.campaignSnapshot(w.token, x.root + '/transfer.sqlite');
    const target = new CampaignStore(x.root + '/copy.sqlite');
    try {
      const copy = target.acceptCampaignSnapshot(x.root + '/transfer.sqlite', 'Unabhängig', {}),
        cw = target.activate(copy.id),
        sc = target.live(cw.token).scene;
      assert.deepEqual(target.sceneWorld(cw.token, sc.id).journey.supplies, ['Boot']);
      assert.equal(
        cellAt(target.world(cw.token).maps[0], { q: 3, r: 0 }).access.requirement,
        'Boot',
      );
    } finally {
      target.close();
    }
  } finally {
    fresh.close();
  }
});
test('declarations belong to one scene/map context and detached controls cannot change the new selection', () => {
  const previous = globalThis.document,
    { document } = parseHTML('<html><body><fieldset></fieldset></body></html>');
  globalThis.document = document;
  try {
    let changes = 0;
    const root = document.querySelector('fieldset'),
      choices = new HexAccessChoices(root, () => changes++);
    choices.render('a', ['Boot']);
    const old = root.querySelector('input');
    old.checked = true;
    old.onchange();
    assert.deepEqual(choices.values(), ['Boot']);
    choices.render('b', ['Seil']);
    old.onchange();
    assert.deepEqual(choices.values(), []);
    assert.equal(changes, 1);
    choices.render('fresh', ['Boot'], ['Boot']);
    assert.equal(root.querySelector('input').checked, true);
  } finally {
    globalThis.document = previous;
  }
});
