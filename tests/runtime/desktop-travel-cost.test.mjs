import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url),
  base = '.build/travel-cost',
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
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'travel-cost-')),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = new CampaignStore(path.join(root, 'world.sqlite')),
    cam = store.create('Routenkosten'),
    w = store.activate(cam.id),
    cmd = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action }),
    world = (action) => store.executeWorld(cmd(action));
  const c = store.executeLive(
      cmd({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character,
    live = store.live(w.token);
  store.executeLive(
    cmd({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const scene = store.executeLive(
    cmd({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const cell = (q, terrain, road = false) => ({
      q,
      r: 0,
      level: 0,
      terrain,
      road,
      elevationM: 0,
      climate: null,
      river: false,
      label: ' Originaltext\r\n',
      faction: '',
      interrupt: '',
    }),
    map = {
      ...store.world(w.token).maps[0],
      revision: 0,
      name: 'Region',
      hexMeters: 4828.032,
      climate: 'temperate',
      seed: 'travel-cost',
      cells: [cell(0, 'mountains'), cell(1, 'water'), cell(2, 'forest', true), cell(3, 'marsh')],
    };
  world({ kind: 'map', map, expectedRevision: store.world(w.token).maps[0].revision });
  Object.assign(map, store.world(w.token).maps[0]);
  world({
    kind: 'place-scene',
    sceneId: scene.id,
    position: { mapId: map.id, q: 0, r: 0, locationId: null },
    expectedSceneRevision: scene.revision,
    expectedPositionRevision: 0,
  });
  const weather = {
    label: 'GM-Wetter',
    kind: 'clear',
    intensity: 0,
    windKmh: 0,
    effects: {
      visibilityMeters: 10000,
      travelFactor: 1,
      perception: 'Normal',
      temperatureC: 15,
      ambience: [],
      combatNote: '',
    },
    source: 'GM-Override',
  };
  world({
    kind: 'weather-override',
    sceneId: scene.id,
    expectedClockRevision: 0,
    expectedOverrideRevision: store.sceneWorld(w.token, scene.id).weatherOverrideRevision,
    weather,
  });
  const request = {
    sceneId: scene.id,
    mapId: map.id,
    destination: { q: 3, r: 0 },
    destinationLocationId: null,
    waypoints: [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ],
    paceKmh: map.hexMeters / 1000,
    factor: 1,
    finalSeconds: null,
  };
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    cam,
    w,
    cmd,
    world,
    scene,
    map,
    weather,
    request,
    preview: (changes) => store.previewTravel(w.token, { ...request, ...changes }),
  };
}
test('route cost counts each traversed destination using the existing biome and road rule, excluding the initial tile', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    p = x.preview();
  assert.deepEqual(
    p.route,
    [0, 1, 2, 3].map((q) => ({ q, r: 0 })),
  );
  assert.equal(p.terrainCost, 4.2);
  assert.equal(p.durationSeconds, 15120);
  assert.ok(x.store.db.serialize().equals(before), 'evaluation is read-only');
});
test('pace, weather, GM factor and explicit final duration change time without changing route cost', (t) => {
  const x = fixture(t),
    normal = x.preview(),
    faster = x.preview({ paceKmh: x.map.hexMeters / 500, factor: 3 }),
    manual = x.preview({ finalSeconds: 9 });
  assert.equal(normal.terrainCost, 4.2);
  assert.equal(faster.terrainCost, 4.2);
  assert.equal(manual.terrainCost, 4.2);
  assert.notEqual(faster.durationSeconds, normal.durationSeconds);
  assert.equal(manual.durationSeconds, 9);
  const state = x.store.sceneWorld(x.w.token, x.scene.id);
  x.world({
    kind: 'weather-override',
    sceneId: x.scene.id,
    expectedClockRevision: 0,
    expectedOverrideRevision: state.weatherOverrideRevision,
    weather: { ...x.weather, effects: { ...x.weather.effects, travelFactor: 2 } },
  });
  assert.equal(x.preview().terrainCost, 4.2);
  assert.equal(x.preview().durationSeconds, normal.durationSeconds * 2);
});
test('revisiting the initial hex and repeated waypoints counts each actual entry rather than unique tiles', (t) => {
  const x = fixture(t),
    p = x.preview({
      waypoints: [
        { q: 1, r: 0 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ],
      destination: { q: 1, r: 0 },
    });
  assert.deepEqual(
    p.route,
    [0, 1, 0, 1].map((q) => ({ q, r: 0 })),
  );
  assert.equal(p.terrainCost, 4.9);
});
test('cost includes all route stages beyond the forty-row itinerary window', (t) => {
  const x = fixture(t),
    map = {
      ...x.map,
      cells: Array.from({ length: 46 }, (_, q) => ({ ...x.map.cells[0], q, terrain: 'plains' })),
    };
  x.world({ kind: 'map', map, expectedRevision: x.map.revision });
  const p = x.preview({ waypoints: [], destination: { q: 45, r: 0 } });
  assert.equal(p.stages.length, 40);
  assert.equal(p.route.length - 1, 45);
  assert.equal(p.terrainCost, 45);
});
test('checkpoint continuation evaluates only the remaining route and forged cost cannot start a journey', (t) => {
  const x = fixture(t),
    preview = x.preview({ finalSeconds: 9 }),
    before = x.store.db.serialize();
  assert.throws(
    () => x.world({ kind: 'journey', preview: { ...preview, terrainCost: 99 } }),
    /Reisebasis/,
  );
  assert.ok(x.store.db.serialize().equals(before));
  const journey = x.world({ kind: 'journey', preview }).scene.journey,
    step = x.world({
      kind: 'journey-step',
      id: journey.id,
      expectedRevision: journey.revision,
      maxSteps: 1,
    }).scene;
  const p = x.preview({
    waypoints: [],
    continuation: { journeyId: step.journey.id, expectedRevision: step.journey.revision },
  });
  assert.equal(p.terrainCost, 3);
  assert.equal(p.route.length - 1, 2);
  assert.equal(step.scene.clock.instantMs, String(preview.segmentSeconds[0] * 1000));
});
test('the real console renders three evaluation facts from the store and clears all transient cost fields', async (t) => {
  const x = fixture(t),
    saved = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      CustomEvent: globalThis.CustomEvent,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  t.after(() => Object.assign(globalThis, saved));
  const wrap = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  window.campaign = {
    world: async (token) => wrap(() => x.store.world(token)),
    live: async (token) => wrap(() => x.store.live(token)),
    preparation: async (token) => wrap(() => x.store.preparation(token)),
    sceneWorld: async (token, id) => wrap(() => x.store.sceneWorld(token, id)),
    previewTravel: async (token, r) => wrap(() => x.store.previewTravel(token, r)),
  };
  delete require.cache[require.resolve('../../' + base + '/ui.cjs')];
  const ui = require('../../' + base + '/ui.cjs');
  ui.initWorld(
    () => {},
    async () => true,
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.open = false;
    dialog.showModal = () => (dialog.open = true);
    dialog.close = () => (dialog.open = false);
  }
  ui.activateWorld(x.w);
  await ui.openWorld();
  const get = (id) => document.getElementById(id);
  get('travel-waypoints').value = '1,0; 2,0';
  get('travel-q').value = '3';
  get('travel-r').value = '0';
  get('travel-party-pace').checked = false;
  get('travel-pace').value = String(x.map.hexMeters / 1000);
  get('travel-factor').value = '1';
  get('travel-final-hours').value = '';
  get('world-travel-form').onsubmit({ preventDefault() {} });
  for (let i = 0; i < 80 && !get('travel-preview-dialog').open; i++) await tick();
  assert.equal(get('travel-preview-dialog').open, true);
  assert.deepEqual(
    [...get('travel-evaluation').querySelectorAll('dt')].map((n) => n.textContent),
    ['Dauer', 'Hexabschnitte', 'Geländekosten'],
  );
  assert.deepEqual(
    [...get('travel-evaluation').querySelectorAll('dd')].map((n) => n.textContent),
    ['4.20 h', '3', '4.20'],
  );
  assert.match(get('travel-preview-itinerary').textContent, /Geländekosten/);
  get('travel-route-clear').click();
  assert.equal(get('travel-evaluation').querySelectorAll('dd').length, 0);
  assert.match(get('travel-evaluation').textContent, /Keine aktuelle/);
  assert.equal(get('travel-preview-accept').disabled, true);
  assert.equal(get('travel-preview-itinerary').textContent, '');
});
