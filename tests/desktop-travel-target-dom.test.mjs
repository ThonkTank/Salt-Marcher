import { fixtureStore } from './helpers/store.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/world-dom-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/world-ui.ts'],
  outfile: '.build/world-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
if (process.env.WORLD_REVIEW_CAPTURE)
  writeFileSync(process.env.WORLD_REVIEW_CAPTURE, readFileSync('.build/world-dom.cjs'));
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await tick();
  }
  assert.ok(check(), 'Expected world state did not arrive.');
}
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'world-dom-')),
    filename = path.join(root, 'store.sqlite');
  const { CampaignStore } = require('../.build/world-dom-store.cjs');
  const store = fixtureStore(CampaignStore, filename),
    campaign = store.create('Welteditor'),
    w = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const baseMap = store.world(w.token).maps[0];
  const map = {
    ...baseMap,
    name: 'Region',
    hexMeters: 4828.032,
    climate: 'temperate',
    seed: 'world-test',
    cells: [],
  };
  const event = {
    id: randomUUID(),
    revision: 0,
    name: 'Markt',
    startMs: '0',
    durationMs: '86400000',
    repeatMs: null,
    locationId: null,
    notes: 'Vorher',
    trashed: false,
  };
  const phenomenon = {
    id: randomUUID(),
    revision: 0,
    mapId: map.id,
    name: 'Nebel',
    kind: 'fog',
    intensity: 0.5,
    center: { q: 0, r: 0 },
    radiusHexes: 3,
    movement: { q: 0, r: 0 },
    startMs: '0',
    durationMs: '86400000',
    state: 'active',
    pausedAtMs: null,
    temperatureC: null,
    travelFactor: null,
    notes: 'Vorher',
  };
  for (const action of [
    { kind: 'map', map, expectedRevision: baseMap.revision },
    { kind: 'calendar-event', event, expectedRevision: null },
    { kind: 'phenomenon', phenomenon, expectedRevision: null },
  ])
    store.executeWorld(command(action));
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
  };
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, {
    window,
    document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  let hold = false,
    release,
    beforeHold = false,
    releaseBefore,
    writes = 0;
  const sent = [],
    statuses = [],
    camps = [],
    atlasReplies = new Map();
  const response = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  window.campaign = {
    world: async (token) => response(() => store.world(token)),
    preparation: async (token) => response(() => store.preparation(token)),
    live: async (token) => response(() => store.live(token)),
    sceneWorld: async (token, id) => response(() => store.sceneWorld(token, id)),
    executeAtlas: async (c) => {
      assert.equal(c.action.kind, 'world');
      const r = await window.campaign.executeWorld(c.action.command);
      return r.ok
        ? {
            ok: true,
            value: {
              atlas: atlasReplies.get(c.commandId) ?? store.campaignAtlas(c.token),
              result: r.value,
            },
          }
        : r;
    },
    reconcileWorld: async (command, token) => response(() => store.reconcileWorld(command, token)),
    executeWorld: async (c) => {
      writes++;
      const captured = structuredClone(c);
      sent.push(captured);
      const result = response(() => {
        if (!['map', 'cell', 'place', 'place-presentation'].includes(captured.action.kind))
          return store.executeWorld(captured);
        const ack = store.executeAtlas({
          ...captured,
          action: { kind: 'world', command: captured },
        });
        atlasReplies.set(captured.commandId, ack.atlas);
        return ack.result;
      });
      if (hold) {
        hold = false;
        return new Promise((resolve) => {
          release = () => resolve(result);
        });
      }
      return result;
    },
  };
  delete require.cache[require.resolve('../.build/world-dom.cjs')];
  const ui = require('../.build/world-dom.cjs');
  ui.initWorld(
    (text) => statuses.push(text),
    async () => {
      if (beforeHold) {
        beforeHold = false;
        await new Promise((resolve) => {
          releaseBefore = resolve;
        });
      }
      return true;
    },
    async () => {},
    async () => {},
    async (sceneId, kind) => {
      camps.push({ sceneId, kind });
    },
  );
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.open = false;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
    };
  }
  ui.activateWorld(w);
  await ui.openWorld();
  const enter = (id, text) => {
    const input = document.getElementById(id);
    input.value = text;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  return {
    root,
    store,
    campaign,
    w,
    scene,
    map,
    event,
    phenomenon,
    ui,
    window,
    document,
    enter,
    statuses,
    sent,
    camps,
    hold: () => {
      hold = true;
    },
    holdBefore: () => {
      beforeHold = true;
    },
    release: () => release(),
    releaseBefore: () => releaseBefore(),
    hasReply: () => !!release,
    hasBefore: () => !!releaseBefore,
    get writes() {
      return writes;
    },
    async select(id, selected) {
      const input = document.getElementById(id);
      input.value = selected;
      input.onchange();
      await tick();
      await tick();
    },
    cleanup() {
      Object.assign(globalThis, saved);
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

async function travelFixture() {
  const x = await fixture(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  const c = x.store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character,
    live = x.store.live(x.w.token);
  x.store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  x.store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: x.scene.id,
      position: { mapId: x.map.id, q: 0, r: 0, locationId: null },
      expectedSceneRevision: x.scene.revision,
      expectedPositionRevision: 0,
    }),
  );
  x.window.campaign.previewTravel = async (token, request) => ({
    ok: true,
    value: x.store.previewTravel(token, request),
  });
  await x.ui.openWorld();
  x.enter('travel-q', '1');
  x.enter('travel-r', '0');
  x.enter('travel-pace', '1');
  x.enter('travel-factor', '1');
  x.enter('travel-final-hours', '');
  x.preview = () =>
    x.document
      .getElementById('world-travel-form')
      .onsubmit(new x.window.Event('submit', { cancelable: true }));
  return x;
}
async function targetFixture() {
  const x = await travelFixture(),
    id = randomUUID(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  x.store.changePreparation({
    ...command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id,
        name: 'Ruine',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  x.store.executeWorld(
    command({
      kind: 'place',
      mapId: x.map.id,
      locationId: id,
      expectedRevision: null,
      hex: { q: 3, r: 0 },
    }),
  );
  await x.ui.openWorld();
  x.document
    .querySelector('#world-map polygon[data-q="1"][data-r="0"]')
    .dispatchEvent(new x.window.Event('click'));
  await until(() => x.document.getElementById('travel-q').value === '1');
  return { ...x, locationId: id };
}
test('returning from a named destination restores the hex actually selected on the map', async () => {
  const x = await targetFixture();
  try {
    await x.select('world-destination', x.locationId);
    assert.equal(x.document.getElementById('travel-q').value, '3');
    await x.select('world-destination', '');
    assert.equal(x.document.getElementById('travel-q').value, '1');
    assert.equal(x.document.getElementById('travel-r').value, '0');
  } finally {
    x.cleanup();
  }
});
test('a manually edited coordinate releases a named place binding and previews the requested hex', async () => {
  const x = await targetFixture();
  try {
    await x.select('world-destination', x.locationId);
    x.enter('travel-q', '2');
    assert.equal(x.document.getElementById('world-destination').value, '');
    let requested;
    const real = x.window.campaign.previewTravel;
    x.window.campaign.previewTravel = async (token, request) => {
      requested = structuredClone(request);
      return real(token, request);
    };
    x.document.getElementById('world-travel-form').onsubmit({ preventDefault() {} });
    await until(() => x.document.getElementById('travel-preview-dialog').open);
    assert.deepEqual(requested.destination, { q: 2, r: 0 });
    assert.equal(requested.destinationLocationId, null);
    assert.equal(x.document.getElementById('travel-preview-accept').disabled, false);
  } finally {
    x.cleanup();
  }
});

test('a fresh travel console derives party pace and the preview explains its speed source', async () => {
  const x = await travelFixture();
  try {
    const box = x.document.getElementById('travel-party-pace');
    box.checked = true;
    box.onchange();
    assert.equal(x.document.getElementById('travel-pace').disabled, true);
    assert.match(x.document.getElementById('travel-pace-context').textContent, /Iri.*30 ft/);
    x.preview();
    await until(() => x.document.getElementById('travel-preview-dialog').open);
    assert.match(
      x.document.getElementById('travel-preview-itinerary').textContent,
      /langsamste Bewegung/,
    );
    assert.match(x.document.getElementById('travel-preview-warnings').textContent, /Iri.*30 ft/);
    box.checked = false;
    box.onchange();
    assert.equal(x.document.getElementById('travel-pace').disabled, false);
  } finally {
    x.cleanup();
  }
});

test('a paused journey does not tell the GM to pause it first', async () => {
  const x = await travelFixture();
  try {
    const p = x.store.previewTravel(x.w.token, {
      sceneId: x.scene.id,
      mapId: x.map.id,
      destination: { q: 1, r: 0 },
      destinationLocationId: null,
      waypoints: [],
      paceKmh: 1,
      factor: 1,
      finalSeconds: null,
    });
    let j = x.store.executeWorld({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action: { kind: 'journey', preview: p },
    }).scene.journey;
    x.store.executeWorld({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action: { kind: 'journey-state', id: j.id, expectedRevision: j.revision, state: 'paused' },
    });
    await x.ui.openWorld();
    assert.match(x.document.getElementById('world-journey-status').textContent, /Pausiert/);
    assert.doesNotMatch(
      x.document.getElementById('world-journey-refresh').textContent,
      /zuerst pausieren/,
    );
    assert.match(
      x.document.getElementById('world-journey-refresh').textContent,
      /Restweg.*neu bewerten/,
    );
    x.ui.activateWorld(x.w);
    await x.ui.openWorld();
    assert.equal(
      x.document.getElementById('world-travel-owner').classList.contains('travel-planning'),
      true,
    );
    assert.equal(x.document.getElementById('journey-controls').hidden, false);
    assert.equal(
      x.document.querySelector('.world-travel>h3').nextElementSibling.id,
      'world-journey-console',
    );
    assert.match(x.document.getElementById('world-journey-status').textContent, /Pausiert/);
  } finally {
    x.cleanup();
  }
});

test('camera zoom and reset preserve an off-centre unsaved hex, its level and travel target without writes', async () => {
  const x = await fixture();
  try {
    x.document
      .querySelector('#world-map polygon[data-q="3"][data-r="0"]')
      .dispatchEvent(new x.window.Event('click'));
    await until(() => x.document.getElementById('travel-q').value === '3');
    x.enter('hex-label', 'Alte Fähre');
    const root = x.document.getElementById('world-map'),
      initial = root.getAttribute('viewBox'),
      writes = x.writes;
    x.document.getElementById('world-zoom-out').onclick();
    assert.notEqual(root.getAttribute('viewBox'), initial);
    assert.equal(x.writes, writes);
    assert.equal(x.document.getElementById('hex-label').value, 'Alte Fähre');
    assert.match(x.document.getElementById('hex-selected').textContent, /Hex 3,0.*4.83/);
    assert.equal(x.document.getElementById('travel-q').value, '3');
    x.document.getElementById('world-zoom-in').onclick();
    assert.equal(root.getAttribute('viewBox'), initial);
    const wheel = new x.window.Event('wheel', { cancelable: true });
    Object.assign(wheel, { deltaY: 100 });
    root.dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, true);
    assert.notEqual(root.getAttribute('viewBox'), initial);
    x.document
      .querySelector('.map-canvas-controls[data-canvas-for="world-map"] button:last-of-type')
      .onclick();
    assert.equal(root.getAttribute('viewBox'), initial);
    assert.equal(x.document.getElementById('hex-label').value, 'Alte Fähre');
    assert.equal(x.writes, writes);
    for (let i = 0; i < 30; i++) x.document.getElementById('world-zoom-out').onclick();
    assert.equal(x.document.getElementById('world-zoom-out').disabled, true);
    assert.ok(root.querySelectorAll('polygon').length <= 631);
    for (let i = 0; i < 30; i++) x.document.getElementById('world-zoom-in').onclick();
    assert.equal(x.document.getElementById('world-zoom-in').disabled, true);
    x.document.getElementById('hex-form').onsubmit({ preventDefault() {} });
    await until(() =>
      x.store
        .world(x.w.token)
        .maps[0].cells.some(
          (c) => c.q === 3 && c.r === 0 && c.level === 0 && c.label === 'Alte Fähre',
        ),
    );
    await until(() => root.textContent.includes('Alte Fähre'));
    const children = [...root.querySelector('[data-map-scene]').children],
      label = children.findIndex(
        (c) => c.tagName.toLowerCase() === 'text' && c.textContent === 'Alte Fähre',
      );
    assert.ok(
      children.every((c, i) => c.tagName.toLowerCase() !== 'polygon' || i < label),
      'neighbouring terrain must not paint over map labels',
    );
  } finally {
    x.cleanup();
  }
});
test('explicit edit raster saves the local cell before changing its separate authored layer', async () => {
  const x = await fixture();
  try {
    x.enter('hex-label', 'Lokaler Ort');
    await x.select('world-edit-level', '1');
    await until(() => /14.48/.test(x.document.getElementById('hex-selected').textContent));
    assert.equal(
      x.store.world(x.w.token).maps[0].cells.find((c) => c.level === 0).label,
      'Lokaler Ort',
    );
    assert.equal(x.document.getElementById('hex-label').value, '');
    await x.select('world-edit-level', '0');
    await until(() => x.document.getElementById('hex-label').value === 'Lokaler Ort');
  } finally {
    x.cleanup();
  }
});
test('arrows select one hex without also panning; Alt arrows pan without changing the selected hex', async () => {
  const x = await fixture();
  try {
    const root = x.document.getElementById('world-map'),
      initial = root.getAttribute('viewBox');
    const key = (altKey) => {
      const e = new x.window.Event('keydown', { cancelable: true });
      Object.assign(e, { key: 'ArrowRight', altKey });
      root.dispatchEvent(e);
    };
    key(false);
    await until(() => x.document.getElementById('travel-q').value === '1');
    assert.equal(root.getAttribute('viewBox'), initial);
    key(true);
    assert.notEqual(root.getAttribute('viewBox'), initial);
    assert.equal(x.document.getElementById('travel-q').value, '1');
    assert.match(x.document.getElementById('hex-selected').textContent, /Hex 1,0/);
  } finally {
    x.cleanup();
  }
});
for (const [field, text] of [
  ['travel-waypoints', '1,0,3'],
  ['travel-waypoints', '1,'],
  ['travel-waypoints', ' ,1'],
  ['travel-q', ''],
  ['travel-r', ''],
])
  test(`incomplete route ${field}=${JSON.stringify(text)} cannot be silently interpreted by the preview`, async () => {
    const x = await travelFixture();
    try {
      const original = x.window.campaign.previewTravel,
        requests = [];
      x.window.campaign.previewTravel = async (...args) => {
        requests.push(structuredClone(args[1]));
        return original(...args);
      };
      x.enter('travel-q', '2');
      x.enter('travel-r', '0');
      x.enter('travel-waypoints', '1,0');
      assert.equal(x.document.getElementById('travel-stops').children.length, 2);
      x.enter(field, text);
      x.preview();
      await tick();
      await tick();
      assert.equal(requests.length, 0);
      assert.equal(x.document.getElementById('travel-preview-dialog').open, false);
      assert.equal(x.document.getElementById('travel-preview-accept').disabled, true);
      assert.equal(x.document.getElementById(field).value, text);
      assert.match(
        x.document.getElementById('travel-draft-status').textContent,
        /q.*r|koordinaten/i,
      );
      assert.equal(x.writes, 0);
      x.enter('travel-q', '2');
      x.enter('travel-r', '0');
      x.enter('travel-waypoints', '1,0');
      x.preview();
      await until(() => x.document.getElementById('travel-preview-dialog').open);
      assert.deepEqual(requests[0].waypoints, [{ q: 1, r: 0 }]);
      assert.deepEqual(requests[0].destination, { q: 2, r: 0 });
      assert.equal(x.document.getElementById('travel-preview-accept').disabled, false);
      assert.equal(x.writes, 0);
    } finally {
      x.cleanup();
    }
  });

test('a rendered hex label selects its own hex in edit and route modes; location labels keep their place binding', async () => {
  const x = await targetFixture();
  try {
    x.document
      .querySelector('#world-map polygon[data-q="3"][data-r="0"]')
      .dispatchEvent(new x.window.Event('click'));
    await until(() => /Hex 3,0/.test(x.document.getElementById('hex-selected').textContent));
    x.enter('hex-label', 'Alte Fähre');
    x.document.getElementById('hex-form').onsubmit({ preventDefault() {} });
    await until(() =>
      [...x.document.querySelectorAll('#world-map text')].some(
        (t) => t.textContent === 'Alte Fähre',
      ),
    );
    const clickText = async (name) => {
      const t = [...x.document.querySelectorAll('#world-map text')].find(
        (t) => t.textContent === name,
      );
      assert.ok(t);
      assert.notEqual(t.getAttribute('pointer-events'), 'none');
      t.dispatchEvent(new x.window.Event('click', { bubbles: true }));
      await tick();
      await tick();
    };
    x.document
      .querySelector('#world-map polygon[data-q="0"][data-r="0"]')
      .dispatchEvent(new x.window.Event('click'));
    await until(() => /Hex 0,0/.test(x.document.getElementById('hex-selected').textContent));
    await clickText('Alte Fähre');
    await until(() => /Hex 3,0/.test(x.document.getElementById('hex-selected').textContent));
    assert.match(x.document.getElementById('hex-selected').textContent, /Hex 3,0/);
    x.document.getElementById('travel-mode-target').onclick();
    await clickText('Ruine');
    assert.equal(x.document.getElementById('world-destination').value, x.locationId);
    await clickText('Alte Fähre');
    assert.equal(x.document.getElementById('world-destination').value, '');
    assert.equal(x.document.getElementById('travel-q').value, '3');
  } finally {
    x.cleanup();
  }
});

for (const response of ['committed', 'not yet sent'])
  test(`a ${response} travel acceptance cannot erase a newer route after its preview was cancelled`, async () => {
    const x = await travelFixture();
    try {
      x.preview();
      await until(() => x.document.getElementById('travel-preview-dialog').open);
      if (response === 'committed') x.hold();
      else x.holdBefore();
      x.document.getElementById('travel-preview-accept').onclick();
      await until(response === 'committed' ? x.hasReply : x.hasBefore);
      x.document.getElementById('travel-preview-cancel').onclick();
      x.enter('travel-q', '4');
      x.enter('travel-waypoints', '1,1; 2,1');
      const before = x.store.sceneWorld(x.w.token, x.scene.id);
      if (response === 'committed') x.release();
      else x.releaseBefore();
      await x.ui.flushWorld();
      await tick();
      await tick();
      assert.equal(x.document.getElementById('travel-q').value, '4');
      assert.equal(x.document.getElementById('travel-waypoints').value, '1,1; 2,1');
      assert.equal(x.document.getElementById('travel-stops').children.length, 3);
      assert.equal(x.document.getElementById('travel-preview-dialog').open, false);
      assert.equal(x.document.getElementById('travel-preview-accept').disabled, true);
      assert.doesNotMatch(
        x.document.getElementById('journey-playback-status').textContent,
        /^Wiedergabe [125]/,
      );
      const after = x.store.sceneWorld(x.w.token, x.scene.id);
      assert.deepEqual(after, before);
      assert.equal(x.writes, response === 'committed' ? 1 : 0);
      if (response === 'committed') assert.deepEqual(after.journey.route.at(-1), { q: 1, r: 0 });
    } finally {
      await x.ui.stopWorldPlayback();
      x.cleanup();
    }
  });

test('renaming above the canvas is saved with the same map and preserves hex edits', async () => {
  const x = await fixture();
  try {
    x.enter('world-map-name', 'Moorfähre');
    x.enter('hex-label', 'Fähre');
    assert.equal(await x.ui.flushWorld(), true);
    const saved = x.store.world(x.w.token).maps.find((m) => m.id === x.map.id);
    assert.equal(saved.name, 'Moorfähre');
    assert.equal(saved.cells.find((c) => c.q === 0 && c.r === 0).label, 'Fähre');
    await x.ui.openWorld();
    assert.equal(x.document.getElementById('world-map-name').value, 'Moorfähre');
    assert.equal(x.store.world(x.w.token).maps.length, 1);
  } finally {
    x.cleanup();
  }
});

test('unpainted map is distinguishable from an explicitly authored plain after reopen', async () => {
  const x = await fixture();
  try {
    const tile = () => x.document.querySelector('#world-map polygon[data-q="0"][data-r="0"]');
    assert.equal(tile().dataset.authored, 'false');
    assert.match(x.document.getElementById('hex-authored-status').textContent, /ungezeichnet/);
    Object.defineProperty(x.document.getElementById('world-map'), 'clientHeight', {
      value: 320,
      configurable: true,
    });
    x.enter('hex-terrain', 'plains');
    x.enter('hex-label', 'Moorfähre');
    assert.equal(await x.ui.flushWorld(), true);
    await x.ui.openWorld();
    assert.equal(
      (Number(x.document.querySelector('#world-map text').getAttribute('font-size')) * 320) / 1360,
      14,
    );
    const camera = x.document.getElementById('world-map').getAttribute('viewBox');
    Object.defineProperty(x.document.getElementById('world-map'), 'clientHeight', { value: 480 });
    x.window.dispatchEvent(new x.window.Event('resize'));
    assert.equal(
      (Number(x.document.querySelector('#world-map text').getAttribute('font-size')) * 480) / 1360,
      14,
    );
    assert.equal(x.document.getElementById('world-map').getAttribute('viewBox'), camera);
    assert.equal(tile().dataset.authored, 'true');
    assert.equal(tile().getAttribute('fill'), '#b8c896');
    assert.equal(
      x.document.querySelector('#world-map polygon[data-q="1"][data-r="0"]').dataset.authored,
      'false',
    );
  } finally {
    x.cleanup();
  }
});

test('travel mode keeps one map and one route form together without discarding working values', async () => {
  const x = await travelFixture();
  try {
    const doc = x.document,
      owner = doc.getElementById('world-travel-owner'),
      form = doc.getElementById('world-travel-form'),
      map = doc.getElementById('world-map'),
      columns = map.closest('.world-map-columns');
    x.enter('hex-label', 'Offene Kartenbeschriftung');
    x.enter('travel-waypoints', '0,1');
    const writes = x.writes;
    doc.getElementById('travel-mode-route').onclick();
    assert.equal(owner.classList.contains('travel-planning'), true);
    assert.equal(form.closest('.world-map-columns'), columns);
    assert.equal(doc.querySelectorAll('#world-travel-form').length, 1);
    assert.equal(doc.querySelectorAll('#world-map').length, 1);
    assert.equal(
      doc.getElementById('travel-advanced').contains(doc.getElementById('travel-waypoints')),
      true,
    );
    assert.equal(
      doc.getElementById('travel-mode-route').closest('#world-map-modes').parentElement.id,
      'world-map-workspace',
    );
    assert.match(doc.getElementById('world-current').textContent, /Hex 0,0/);
    assert.equal(doc.getElementById('journey-controls').hidden, true);
    assert.equal(doc.getElementById('journey-faster').closest('#journey-controls'), null);
    assert.equal(doc.getElementById('journey-faster').disabled, false);
    assert.equal(form.nextElementSibling.id, 'world-journey-console');
    doc.getElementById('travel-mode-edit').onclick();
    assert.equal(owner.classList.contains('travel-planning'), false);
    assert.equal(doc.getElementById('travel-waypoints').value, '0,1');
    assert.equal(doc.getElementById('hex-label').value, 'Offene Kartenbeschriftung');
    assert.equal(x.writes, writes);
  } finally {
    x.cleanup();
  }
});

for (const kind of ['wait', 'rest'])
  for (const switched of [false, true])
    test(`pending travel ${kind} ${switched ? 'is cancelled on focus change' : 'pauses its latest confirmed checkpoint'}`, async () => {
      const x = await travelFixture(),
        command = (action) => ({
          commandId: randomUUID(),
          campaignId: x.campaign.id,
          token: x.w.token,
          action,
        });
      try {
        const c = x.store.executeLive(
          command({ kind: 'create-character', profile: { name: 'Borin' } }),
        ).character;
        let live = x.store.live(x.w.token);
        x.store.executeLive(
          command({
            kind: 'membership',
            characterId: c.id,
            expectedRevision: c.membershipRevision,
            expectedRosterRevision: live.rosterRevision,
            active: true,
            targetSceneId: x.scene.id,
            expectedFocusRevision: live.focusRevision,
          }),
        );
        live = x.store.live(x.w.token);
        const a = x.store.liveScene(x.w.token, x.scene.id);
        const b = x.store.executeLive(
          command({
            kind: 'move',
            sceneId: a.id,
            expectedRosterRevision: live.rosterRevision,
            expectedFocusRevision: live.focusRevision,
            expectedClockRevision: a.clock.revision,
            expectedSceneMembershipRevision: a.membershipRevision,
            memberIds: [c.id],
            target: { kind: 'new', title: 'Nachhut', expectedContentRevision: a.revision },
          }),
        ).session.createdScene;
        x.store.executeWorld(
          command({
            kind: 'place-scene',
            sceneId: b.id,
            expectedSceneRevision: x.store.liveScene(x.w.token, b.id).revision,
            expectedPositionRevision: x.store.sceneWorld(x.w.token, b.id).position.revision,
            position: { mapId: x.map.id, q: 0, r: 0, locationId: null },
          }),
        );
        for (const id of [a.id, b.id]) {
          const p = x.store.previewTravel(x.w.token, {
            sceneId: id,
            mapId: x.map.id,
            destination: { q: 2, r: 0 },
            destinationLocationId: null,
            waypoints: [],
            paceKmh: 1,
            factor: 1,
            finalSeconds: 2,
          });
          x.store.executeWorld(command({ kind: 'journey', preview: p }));
        }
        x.store.executeLive(
          command({
            kind: 'focus',
            sceneId: a.id,
            expectedRevision: x.store.live(x.w.token).focusRevision,
          }),
        );
        await x.ui.openWorld();
        x.ui.setWorldSurface('live');
        await x.ui.renderLiveWorld(x.w.token, a.id);
        x.document.getElementById('live-travel-toggle').onclick();
        await until(() => x.document.getElementById('live-travel-host').hidden === false);
        await tick();
        x.hold();
        x.document.getElementById('journey-play').onclick();
        for (let i = 0; i < 250 && !x.hasReply(); i++)
          await new Promise((resolve) => setTimeout(resolve, 10));
        assert.ok(x.hasReply(), 'the real checkpoint reply must be held before changing focus');
        x.document.getElementById('journey-' + kind).onclick();
        await tick();
        if (switched) {
          x.store.executeLive(
            command({
              kind: 'focus',
              sceneId: b.id,
              expectedRevision: x.store.live(x.w.token).focusRevision,
            }),
          );
          await x.ui.renderLiveWorld(x.w.token, b.id);
        }
        const other = x.store.sceneWorld(x.w.token, b.id),
          writes = x.writes;
        x.release();
        await x.ui.stopWorldPlayback();
        await tick();
        await tick();
        if (!switched) {
          await until(() => x.camps.length === 1);
          assert.deepEqual(x.camps, [{ sceneId: a.id, kind }]);
          assert.equal(x.store.sceneWorld(x.w.token, a.id).journey.status, 'paused');
          assert.equal(x.store.sceneWorld(x.w.token, a.id).position.q, 1);
          assert.equal(x.store.sceneWorld(x.w.token, a.id).scene.clock.instantMs, '1000');
          assert.deepEqual(x.store.sceneWorld(x.w.token, b.id), other);
          return;
        }
        assert.deepEqual(x.camps, [], 'a delayed camp action must not open for the new focus');
        assert.equal(x.writes, writes, 'the new group must not be paused');
        assert.deepEqual(x.store.sceneWorld(x.w.token, b.id), other);
        assert.equal(
          x.store.sceneWorld(x.w.token, a.id).position.q,
          1,
          'only the already confirmed checkpoint remains',
        );
        x.document.getElementById('journey-' + kind).onclick();
        await until(() => x.camps.length === 1);
        assert.deepEqual(x.camps, [{ sceneId: b.id, kind }]);
        assert.equal(x.store.sceneWorld(x.w.token, b.id).journey.status, 'paused');
        assert.deepEqual(x.store.sceneWorld(x.w.token, b.id).position, other.position);
        assert.deepEqual(x.store.sceneWorld(x.w.token, b.id).scene.clock, other.scene.clock);
      } finally {
        if (x.hasReply()) x.release();
        await x.ui.stopWorldPlayback();
        x.cleanup();
      }
    });

async function liveContextFixture() {
  const x = await travelFixture(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    }),
    c = x.store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Borin' } }),
    ).character;
  let live = x.store.live(x.w.token);
  x.store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  live = x.store.live(x.w.token);
  const a = x.store.liveScene(x.w.token, x.scene.id),
    b = x.store.executeLive(
      command({
        kind: 'move',
        sceneId: a.id,
        expectedRosterRevision: live.rosterRevision,
        expectedFocusRevision: live.focusRevision,
        expectedClockRevision: a.clock.revision,
        expectedSceneMembershipRevision: a.membershipRevision,
        memberIds: [c.id],
        target: { kind: 'new', title: 'Nachhut', expectedContentRevision: a.revision },
      }),
    ).session.createdScene;
  x.store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: b.id,
      expectedSceneRevision: x.store.liveScene(x.w.token, b.id).revision,
      expectedPositionRevision: x.store.sceneWorld(x.w.token, b.id).position.revision,
      position: { mapId: x.map.id, q: 3, r: 0, locationId: null },
    }),
  );
  const preview = x.store.previewTravel(x.w.token, {
    sceneId: a.id,
    mapId: x.map.id,
    destination: { q: 2, r: 0 },
    destinationLocationId: null,
    waypoints: [],
    paceKmh: 1,
    factor: 1,
    finalSeconds: 2000,
  });
  x.store.executeWorld(command({ kind: 'journey', preview }));
  x.store.executeLive(
    command({
      kind: 'focus',
      sceneId: a.id,
      expectedRevision: x.store.live(x.w.token).focusRevision,
    }),
  );
  await x.ui.openWorld();
  x.ui.setWorldSurface('live');
  await x.ui.renderLiveWorld(x.w.token, a.id);
  x.document.getElementById('live-travel-toggle').onclick();
  await until(() => !x.document.getElementById('live-travel-host').hidden);
  await tick();
  await tick();
  return { ...x, a, b, command, get: (id) => x.document.getElementById(id) };
}
test('pending focus travel read removes the previous journey; failure stays explicit and a retry binds only the new scene', async () => {
  const x = await liveContextFixture();
  try {
    assert.equal(x.get('journey-end').disabled, false);
    let release;
    const real = x.window.campaign.sceneWorld;
    x.window.campaign.sceneWorld = () => new Promise((resolve) => (release = resolve));
    const before = x.store.db.serialize(),
      read = x.ui.renderLiveWorld(x.w.token, x.b.id);
    assert.equal(x.get('journey-end').disabled, true);
    assert.equal(x.get('journey-play').disabled, true);
    assert.doesNotMatch(x.get('world-journey-status').textContent, /Unterwegs/);
    assert.match(x.get('live-travel-context').textContent, /geladen/);
    release({ ok: false, error: 'Scene momentan nicht lesbar' });
    await read;
    assert.match(x.get('live-travel-empty').textContent, /Scene momentan nicht lesbar/);
    assert.equal(x.get('live-travel-empty').hidden, false);
    assert.equal(x.get('world-current').textContent, '');
    assert.equal(x.get('live-travel-context').textContent, '');
    assert.equal(x.get('travel-place-cursor').disabled, true);
    assert.ok(x.store.db.serialize().equals(before));
    x.window.campaign.sceneWorld = real;
    x.get('live-travel-retry').click();
    await until(() => x.get('live-travel-context').textContent.includes('Nachhut'));
    assert.match(x.get('live-travel-context').textContent, /Nachhut/);
    assert.equal(x.get('live-travel-retry').hidden, true);
    assert.equal(x.get('live-travel-empty').hidden, true);
    assert.equal(x.get('travel-place-cursor').disabled, false);
    assert.match(x.get('world-current').textContent, /3,0/);
    assert.equal(x.get('journey-end').disabled, true);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});
test('a failed refresh of the same scene removes stale preview and playback controls without changing canonical travel', async () => {
  const x = await liveContextFixture();
  try {
    x.enter('travel-q', '1');
    x.enter('travel-r', '0');
    x.preview();
    await until(() => x.get('travel-evaluation').querySelectorAll('dd').length === 3);
    assert.equal(x.get('travel-preview-dialog').open, false);
    assert.equal(x.get('travel-preview-accept').disabled, false);
    const before = x.store.db.serialize();
    x.window.campaign.sceneWorld = async () => ({ ok: false, error: 'Provider ausgefallen' });
    await x.ui.renderLiveWorld(x.w.token, x.a.id);
    assert.equal(x.get('travel-preview-accept').disabled, true);
    assert.equal(x.get('travel-preview-dialog').open, false);
    assert.equal(x.get('travel-evaluation').querySelectorAll('dd').length, 0);
    assert.equal(x.get('journey-end').disabled, true);
    assert.equal(x.get('journey-play').disabled, true);
    assert.match(x.get('live-travel-empty').textContent, /Provider ausgefallen/);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});
test('an obsolete scene read error cannot clear a newer confirmed live travel context', async () => {
  const x = await liveContextFixture();
  try {
    let release;
    const real = x.window.campaign.sceneWorld;
    x.window.campaign.sceneWorld = () => new Promise((resolve) => (release = resolve));
    const old = x.ui.renderLiveWorld(x.w.token, x.b.id);
    x.window.campaign.sceneWorld = real;
    await x.ui.renderLiveWorld(x.w.token, x.a.id);
    release({ ok: false, error: 'Alter Lesefehler' });
    await old;
    assert.equal(x.get('live-travel-empty').hidden, true);
    assert.equal(x.get('journey-end').disabled, false);
    assert.doesNotMatch(x.get('live-travel-context').textContent, /Alter Lesefehler/);
    assert.match(x.get('world-journey-status').textContent, /Unterwegs/);
  } finally {
    x.cleanup();
  }
});

test('a stale unavailable map selection retains root drafts on save failure; retry saves only the real owner', async () => {
  const x = await travelFixture();
  try {
    const unavailable = randomUUID();
    x.enter('travel-waypoints', '0,1');
    x.enter('travel-q', '2');
    x.enter('hex-label', 'Offene A-Prosa');
    const before = x.store.db.serialize(),
      real = x.window.campaign.executeWorld;
    x.window.campaign.executeWorld = async () => ({ ok: false, error: 'Speicherfehler A' });
    await x.select('world-map-select', unavailable);
    await until(() => x.statuses.some((s) => s.includes('Speicherfehler A')));
    assert.equal(x.document.getElementById('world-map-select').value, x.map.id);
    assert.equal(x.document.getElementById('hex-label').value, 'Offene A-Prosa');
    assert.equal(x.document.getElementById('travel-stops').children.length, 2);
    assert.ok(x.store.db.serialize().equals(before));
    x.window.campaign.executeWorld = real;
    await x.select('world-map-select', unavailable);
    await until(() => x.statuses.some((s) => s.includes('nicht mehr verfügbar')));
    const maps = x.store.world(x.w.token).maps;
    assert.equal(maps.length, 1);
    assert.equal(maps[0].id, x.map.id);
    assert.equal(maps[0].cells.find((c) => c.q === 0 && c.r === 0).label, 'Offene A-Prosa');
    assert.equal(x.document.getElementById('world-map-select').value, x.map.id);
    assert.equal(x.document.getElementById('travel-stops').children.length, 2);
    assert.equal(x.document.getElementById('travel-preview-accept').disabled, true);
  } finally {
    x.cleanup();
  }
});

test('a delayed root save cannot adopt unavailable selections or overwrite another campaign root', async () => {
  const x = await travelFixture();
  try {
    const unavailable = randomUUID(),
      newer = randomUUID();
    x.enter('hex-label', 'A behalten');
    x.hold();
    await x.select('world-map-select', unavailable);
    await until(x.hasReply);
    await x.select('world-map-select', newer);
    assert.equal(x.document.getElementById('world-map-select').value, x.map.id);
    x.release();
    await x.ui.flushWorld();
    await until(
      () => x.document.getElementById('world-map-select').getAttribute('aria-busy') === 'false',
    );
    assert.equal(x.document.getElementById('world-map-select').value, x.map.id);
    assert.equal(x.store.world(x.w.token).maps.length, 1);
    x.enter('hex-label', 'A weiter behalten');
    x.hold();
    await x.select('world-map-select', unavailable);
    await until(x.hasReply);
    const campaign = x.store.create('Neue Kampagne'),
      w = x.store.activate(campaign.id),
      root = x.store.world(w.token).maps[0],
      before = x.store.db.serialize();
    x.ui.activateWorld(w);
    await x.ui.openWorld();
    x.release();
    await tick();
    await tick();
    assert.equal(x.document.getElementById('world-map-select').value, root.id);
    assert.equal(x.document.getElementById('world-map-workspace').hidden, false);
    assert.equal(x.document.getElementById('world-map-select').getAttribute('aria-busy'), 'false');
    assert.deepEqual(x.store.world(w.token).maps, [root]);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    if (x.hasReply()) x.release();
    x.cleanup();
  }
});

test('Reise opens the one Hex console without changing the scene center; explicit map opening and map actions choose it', async () => {
  const x = await liveContextFixture();
  try {
    const before = x.store.db.serialize(),
      map = x.get('world-map');
    assert.match(x.get('travel-placement-status').textContent, /Party-Token ziehen/);
    assert.equal(
      x.get('live-center-tools').contains(x.get('live-travel-toggle')),
      true,
      'travel switch must remain beside the scene tabs',
    );
    assert.equal(
      x.get('live-travel-toggle').closest('[role=tablist]'),
      null,
      'the independent travel switch is not a center tab',
    );
    assert.equal(
      x.get('live-world-panel').firstElementChild,
      x.get('live-travel-host'),
      'travel commands precede optional weather',
    );
    assert.equal(x.get('live-travel-weather').open, false);
    assert.equal(x.get('live-travel-navigation').contains(x.get('travel-place-cursor')), true);
    assert.equal(x.get('live-travel-navigation').contains(x.get('world-zoom-in')), true);
    assert.equal(x.get('live-center-scene').hidden, false);
    assert.equal(x.get('live-center-map').hidden, true);
    assert.equal(x.get('live-travel-host').contains(x.get('world-map-select')), true);
    assert.equal(x.get('live-center-map').contains(map), true);
    assert.equal(x.get('live-travel-host').contains(map), false);
    const focusOptions = [];
    map.focus = (options) => focusOptions.push(options);
    x.get('live-travel-map-open').click();
    assert.deepEqual(
      focusOptions,
      [{ preventScroll: true }],
      'keyboard focus must not scroll the center tabs behind the sticky group header',
    );
    assert.equal(x.get('live-center-scene').hidden, true);
    assert.equal(x.get('live-center-map').hidden, false);
    x.get('live-center-scene-tab').click();
    assert.equal(x.get('live-center-scene').hidden, false);
    x.get('travel-mode-route').click();
    assert.equal(x.get('live-center-map').hidden, false);
    x.ui.setWorldSurface('world');
    assert.equal(x.get('live-travel-weather').open, true);
    assert.equal(x.get('live-center-tools').contains(x.get('live-travel-toggle')), true);
    assert.equal(x.get('world-travel-owner').contains(map), true);
    assert.equal(x.get('world-travel-owner').contains(x.get('world-map-select')), true);
    x.ui.setWorldSurface('live');
    assert.equal(x.document.querySelectorAll('#world-map').length, 1);
    assert.equal(x.document.querySelectorAll('#journey-play').length, 1);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});
test('the shared travel map stays visible outside the Atlas inspector and returns to its hidden inspector projection', async () => {
  const x = await liveContextFixture();
  try {
    const map = x.get('world-map'),
      before = x.store.db.serialize(),
      inspector = x.document.createElement('aside');
    inspector.id = 'atlas-panel';
    x.document.body.append(inspector);
    inspector.append(x.get('world'));
    // Match the shipped hide rules against the actual docked DOM. This guards
    // selector scope; native UI verification still supplies the layout evidence.
    const css = readFileSync('src/app/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const hideSelectors = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, declarations]) =>
        /(?:^|;)\s*display\s*:\s*none\s*!important\s*(?:;|$)/.test(declarations),
      )
      .map(([, selector]) => selector.trim());
    const hiddenByStyle = () => hideSelectors.filter((selector) => map.matches(selector));
    x.get('live-travel-map-open').click();
    assert.equal(x.get('live-center-map').hidden, false);
    assert.ok(map.querySelector('polygon'));
    assert.deepEqual(
      hiddenByStyle(),
      [],
      'Atlas-only canvas suppression must not hide the live travel map',
    );
    x.ui.setWorldSurface('atlas');
    assert.equal(inspector.contains(map), true);
    assert.ok(hiddenByStyle().length, 'the Atlas inspector still suppresses its redundant canvas');
    x.ui.setWorldSurface('live');
    x.get('live-center-map-tab').click();
    assert.equal(x.get('live-center-map').contains(map), true);
    assert.deepEqual(hiddenByStyle(), []);
    assert.equal(x.document.querySelectorAll('#world-map').length, 1);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});
test('live keyboard waypoints evaluate inline and start with the preselected presentation speed', async () => {
  const x = await travelFixture(),
    get = (id) => x.document.getElementById(id);
  try {
    let outerScrolls = 0;
    get('world-journey-console').scrollIntoView = () => {
      outerScrolls++;
    };
    const rail = x.document.querySelector('.live-desk-reference');
    rail.scrollTop = 12;
    rail.getBoundingClientRect = () => ({ top: 100 });
    get('travel-evaluation').getBoundingClientRect = () => ({ top: 300 });
    get('world-journey-console').getBoundingClientRect = () => ({ top: 150 });
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    get('live-travel-toggle').click();
    await until(
      () => !get('live-travel-host').hidden && get('travel-place-cursor').disabled === false,
    );
    assert.equal(get('journey-play').disabled, true);
    get('travel-mode-route').click();
    const key = (k) => {
      const e = new x.window.Event('keydown', { cancelable: true });
      Object.assign(e, { key: k });
      get('world-map').dispatchEvent(e);
    };
    key('ArrowRight');
    key('Enter');
    await until(() => get('travel-stops').children.length === 1);
    key('Enter');
    await until(() => get('travel-stops').children.length === 2);
    assert.equal(get('live-center-map').hidden, false);
    assert.match(get('travel-selected-hex').textContent, /1,0.*Kosten/);
    x.preview();
    await until(() => get('travel-evaluation').querySelectorAll('dd').length === 3);
    assert.equal(get('travel-preview-dialog').open, false);
    assert.equal(
      rail.scrollTop,
      212,
      'inline preview reveals its result only inside the reference rail',
    );
    assert.equal(
      get('travel-evaluation').nextElementSibling.id,
      'world-journey-console',
      'evaluated route leads directly to its start control',
    );
    assert.equal(get('journey-play').disabled, false);
    get('journey-faster').click();
    assert.equal(get('journey-speed').textContent, '2×');
    get('journey-play').click();
    await until(() => get('journey-playback-status').textContent.startsWith('Wiedergabe 2×'));
    await x.ui.stopWorldPlayback();
    const journey = x.store.sceneWorld(x.w.token, x.scene.id).journey;
    assert.equal(journey.presentationSpeed, 2);
    assert.equal(outerScrolls, 0, 'starting inline travel must not scroll the whole GM desk');
    assert.equal(rail.scrollTop, 262, 'transport is revealed inside its own reference rail');
    assert.equal(journey.route.length, 2);
    assert.equal(get('travel-stops').children.length, 0);
    get('journey-end').click();
    await until(() => x.store.sceneWorld(x.w.token, x.scene.id).journey.status === 'ended');
    assert.equal(get('world-map').querySelector('[data-travel-route]'), null);
    assert.equal(get('journey-end').disabled, true);
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});

test('cold live travel opening replaces the loading placement hint when its group arrives', async () => {
  const x = await travelFixture(),
    get = (id) => x.document.getElementById(id);
  try {
    x.ui.activateWorld(x.w);
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    get('live-travel-toggle').click();
    await until(
      () => !get('travel-place-cursor').disabled && get('live-travel-host').hidden === false,
    );
    assert.match(get('travel-placement-status').textContent, /Party-Token ziehen/);
    get('travel-place-cursor').click();
    await until(() => get('travel-placement-status').textContent.includes('Standort unverändert'));
    get('world-zoom-in').click();
    assert.match(
      get('travel-placement-status').textContent,
      /Standort unverändert/,
      'ordinary redraws preserve the last placement receipt',
    );
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});

test('a provider missing the real root stays explicit; retry reloads that same map without mutation', async () => {
  const x = await liveContextFixture();
  try {
    const sc = x.store.sceneWorld(x.w.token, x.b.id);
    x.store.executeWorld(
      x.command({
        kind: 'place-scene',
        sceneId: x.b.id,
        expectedSceneRevision: sc.scene.revision,
        expectedPositionRevision: sc.position.revision,
        position: { mapId: x.map.id, q: 8, r: 0, locationId: null },
      }),
    );
    const before = x.store.db.serialize(),
      real = x.window.campaign.world;
    x.window.campaign.world = async (token) => {
      const r = await real(token);
      return r.ok ? { ok: true, value: { ...r.value, maps: [] } } : r;
    };
    await x.ui.openWorld();
    await x.ui.renderLiveWorld(x.w.token, x.b.id);
    assert.equal(x.get('world-map-select').value, '');
    assert.match(x.get('live-travel-empty').textContent, /nicht verfügbar/);
    assert.equal(x.get('live-travel-retry').hidden, false);
    assert.equal(x.get('journey-play').disabled, true);
    x.window.campaign.world = real;
    x.get('live-travel-retry').click();
    await until(
      () => x.get('world-map-select').value === x.map.id && x.get('live-travel-retry').hidden,
    );
    assert.match(x.get('world-current').textContent, /8,0/);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});

test('Atlas group selection removes the prior travel context while loading and after failure, then retries without writes', async () => {
  const x = await liveContextFixture();
  let release;
  try {
    x.ui.setWorldSurface('world');
    const real = x.window.campaign.sceneWorld,
      before = x.store.db.serialize();
    x.window.campaign.sceneWorld = () => new Promise((r) => (release = r));
    await x.select('world-scene', x.b.id);
    await until(() => !!release);
    assert.equal(x.get('journey-end').disabled, true);
    assert.equal(x.get('travel-place-cursor').disabled, true);
    assert.doesNotMatch(x.get('world-journey-status').textContent, /Unterwegs/);
    assert.match(x.get('world-current').textContent, /geladen/);
    release({ ok: false, error: 'Gewählte Gruppe nicht verfügbar' });
    await until(() => x.get('world-current').textContent.includes('nicht verfügbar'));
    assert.equal(x.get('travel-place-cursor').disabled, true);
    assert.equal(x.get('world-journey-status').textContent, 'Reisestand nicht geladen.');
    assert.ok(x.store.db.serialize().equals(before));
    x.window.campaign.sceneWorld = real;
    await x.select('world-scene', x.b.id);
    await until(() => x.get('world-current').textContent.includes('3,0'));
    assert.equal(x.get('travel-place-cursor').disabled, false);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    release?.({ ok: false, error: 'Probe beendet' });
    x.cleanup();
  }
});
test('a failed Atlas group read cannot place the previous group under the new picker selection', async () => {
  const x = await liveContextFixture();
  try {
    x.ui.setWorldSurface('world');
    x.window.campaign.sceneWorld = async () => ({
      ok: false,
      error: 'Gewählte Gruppe nicht verfügbar',
    });
    await x.select('world-scene', x.b.id);
    await until(() => x.statuses.some((s) => s.includes('Gewählte Gruppe nicht verfügbar')));
    const before = x.store.db.serialize(),
      writes = x.sent.length;
    x.get('travel-place-cursor').onclick();
    await tick();
    await tick();
    await tick();
    await tick();
    assert.equal(x.sent.length, writes);
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(x.store.sceneWorld(x.w.token, x.a.id).journey.status, 'active');
  } finally {
    x.cleanup();
  }
});
test('Atlas rejects a provider reply for another group instead of presenting its journey as the selection', async () => {
  const x = await liveContextFixture();
  try {
    x.ui.setWorldSurface('world');
    const foreign = x.store.sceneWorld(x.w.token, x.a.id),
      before = x.store.db.serialize();
    x.window.campaign.sceneWorld = async () => ({ ok: true, value: foreign });
    await x.select('world-scene', x.b.id);
    await tick();
    await tick();
    assert.equal(x.get('travel-place-cursor').disabled, true);
    assert.match(x.get('world-current').textContent, /anderen Gruppe/);
    assert.doesNotMatch(x.get('world-journey-status').textContent, /Unterwegs/);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});
test('an older failed Atlas group read cannot report into a newer recovered context', async () => {
  const x = await liveContextFixture();
  let release;
  try {
    x.ui.setWorldSurface('world');
    const real = x.window.campaign.sceneWorld;
    x.window.campaign.sceneWorld = () => new Promise((r) => (release = r));
    await x.select('world-scene', x.b.id);
    await until(() => !!release);
    x.window.campaign.sceneWorld = real;
    await x.select('world-scene', x.a.id);
    await until(() => !x.get('journey-end').disabled);
    x.statuses.length = 0;
    release({ ok: false, error: 'Alter Providerfehler' });
    await tick();
    await tick();
    assert.equal(x.get('journey-end').disabled, false);
    assert.match(x.get('world-journey-status').textContent, /Unterwegs/);
    assert.deepEqual(x.statuses, []);
  } finally {
    release?.({ ok: false, error: 'Probe beendet' });
    x.cleanup();
  }
});
test('an unavailable live provider cancels placement still waiting for prior editor saves', async () => {
  const x = await liveContextFixture();
  try {
    const before = x.store.db.serialize(),
      writes = x.sent.length;
    const arrow = new x.window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(arrow, 'key', { value: 'ArrowRight' });
    x.get('world-map').dispatchEvent(arrow);
    x.holdBefore();
    x.get('travel-place-cursor').onclick();
    await until(() => x.hasBefore());
    x.window.campaign.sceneWorld = async () => ({
      ok: false,
      error: 'Provider inzwischen nicht verfügbar',
    });
    await x.ui.renderLiveWorld(x.w.token, x.a.id);
    assert.equal(x.get('travel-place-cursor').disabled, true);
    x.releaseBefore();
    await x.ui.flushWorld();
    await tick();
    assert.equal(x.sent.length, writes);
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(x.store.sceneWorld(x.w.token, x.a.id).journey.status, 'active');
  } finally {
    if (x.hasBefore()) x.releaseBefore();
    x.cleanup();
  }
});

test('rejected travel start explains the failure beside its controls without moving or losing the route', async () => {
  const x = await travelFixture(),
    get = (id) => x.document.getElementById(id);
  try {
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    get('live-travel-toggle').click();
    await until(() => !get('live-travel-host').hidden);
    x.enter('travel-q', '1');
    x.enter('travel-r', '0');
    x.preview();
    await until(() => get('journey-play').disabled === false);
    const before = x.store.db.serialize(),
      route = get('travel-stops').textContent,
      real = x.window.campaign.executeWorld;
    x.window.campaign.executeWorld = async (command) =>
      command.action.kind === 'journey'
        ? { ok: false, error: 'Begegnung dieser Gruppe vor der Reise abschließen.' }
        : real(command);
    get('journey-play').click();
    await until(() => get('journey-feedback').textContent.includes('Begegnung dieser Gruppe'));
    assert.equal(get('journey-feedback').hidden, false);
    assert.equal(get('journey-feedback').getAttribute('role'), 'alert');
    assert.equal(get('world-journey-console').contains(get('journey-feedback')), true);
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(get('travel-stops').textContent, route);
    assert.equal(get('journey-play').disabled, false);
    x.ui.activateWorld(x.w);
    assert.equal(
      get('journey-feedback').hidden,
      true,
      'a failed old owner must not follow the next scene',
    );
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});

test('token placement requires its authored map and membership basis, while keyboard placement can use continuous sparse terrain', async () => {
  const x = await travelFixture();
  try {
    const command = (action) => ({
        commandId: randomUUID(),
        campaignId: x.campaign.id,
        token: x.w.token,
        action,
      }),
      m = x.store.world(x.w.token).maps.find((m) => m.id === x.map.id);
    m.cells = [
      {
        q: 1,
        r: 0,
        level: 0,
        terrain: 'plains',
        elevationM: 0,
        climate: null,
        road: false,
        river: false,
        label: 'Furt',
        faction: '',
        interrupt: '',
      },
    ];
    x.store.executeWorld(command({ kind: 'map', expectedRevision: m.revision, map: m }));
    await x.ui.openWorld();
    const basis = () => {
      const f = x.store.sceneWorld(x.w.token, x.scene.id);
      return {
        kind: 'place-scene',
        sceneId: x.scene.id,
        expectedSceneRevision: f.scene.revision,
        expectedPositionRevision: f.position.revision,
        placementBasis: {
          mapRevision: x.store.world(x.w.token).maps.find((m) => m.id === x.map.id).revision,
          membershipRevision: f.scene.membershipRevision,
          requireAuthored: true,
        },
        position: { mapId: x.map.id, q: 1, r: 0, locationId: null },
      };
    };
    for (const modify of [
      (a) => a.placementBasis.mapRevision++,
      (a) => a.placementBasis.membershipRevision++,
      (a) => (a.position.q = 2),
    ]) {
      const a = basis();
      modify(a);
      const before = x.store.db.serialize();
      assert.throws(() => x.store.executeWorld(command(a)));
      assert.deepEqual(x.store.db.serialize(), before);
    }
    const clock = x.store.sceneWorld(x.w.token, x.scene.id).scene.clock;
    x.store.executeWorld(command(basis()));
    assert.deepEqual(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock, clock);
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).position.q, 1);
    const a = basis();
    a.position.q = 2;
    a.placementBasis.requireAuthored = false;
    x.store.executeWorld(command(a));
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).position.q, 2);
    assert.deepEqual(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock, clock);
  } finally {
    x.cleanup();
  }
});

for (const mismatch of ['scene', 'destination', 'waypoints', 'factor', 'duration', 'pace'])
  test(`a genuine preview for a different ${mismatch} cannot start a journey for the visible request`, async () => {
    const x = await liveContextFixture();
    try {
      x.get('travel-party-pace').checked = false;
      x.get('travel-party-pace').onchange();
      const original = x.window.campaign.previewTravel,
        before = x.store.db.serialize();
      x.window.campaign.previewTravel = async (token, request) => {
        const changed = structuredClone(request);
        if (mismatch === 'scene') changed.sceneId = x.b.id;
        if (mismatch === 'destination') changed.destination = { q: 4, r: 0 };
        if (mismatch === 'waypoints') changed.waypoints = [{ q: 0, r: 1 }];
        if (mismatch === 'factor') changed.factor = 2;
        if (mismatch === 'duration') changed.finalSeconds = 9;
        if (mismatch === 'pace') {
          delete changed.usePartyPace;
          changed.paceKmh = 2;
        }
        return original(token, changed);
      };
      x.enter('travel-q', '1');
      x.enter('travel-r', '0');
      x.preview();
      await until(
        () =>
          x.get('travel-evaluation').querySelectorAll('dd').length > 0 ||
          !!x.get('journey-feedback').textContent,
      );
      x.get('travel-preview-accept').onclick();
      await tick();
      await tick();
      await tick();
      await x.ui.stopWorldPlayback();
      assert.equal(x.sent.length, 0);
      assert.equal(x.get('travel-preview-accept').disabled, true);
      assert.match(x.get('journey-feedback').textContent, /angefragten Reise/);
      assert.ok(x.store.db.serialize().equals(before));
      x.window.campaign.previewTravel = original;
      x.preview();
      await until(() => x.get('travel-evaluation').querySelectorAll('dd').length === 3);
      assert.equal(x.get('travel-preview-accept').disabled, false);
      assert.match(x.statuses.at(-1), /Route und Reisezeit ausgewertet/);
      assert.equal(x.sent.length, 0);
      assert.ok(x.store.db.serialize().equals(before));
    } finally {
      await x.ui.stopWorldPlayback();
      x.cleanup();
    }
  });
test('automatic provider pace and reordered request keys retain their authentic preview without writes', async () => {
  const x = await travelFixture();
  try {
    const original = x.window.campaign.previewTravel;
    x.enter('travel-party-pace', '');
    x.document.getElementById('travel-party-pace').checked = true;
    x.document.getElementById('travel-party-pace').onchange();
    x.document.getElementById('travel-pace').value = '99';
    x.window.campaign.previewTravel = async (token, request) => {
      const result = await original(token, request);
      if (result.ok)
        result.value.request = Object.fromEntries(Object.entries(result.value.request).reverse());
      return result;
    };
    const before = x.store.db.serialize();
    x.preview();
    await until(() => x.document.getElementById('travel-preview-dialog').open);
    assert.equal(x.document.getElementById('travel-preview-accept').disabled, false);
    assert.match(
      x.document.getElementById('travel-preview-itinerary').textContent,
      /langsamste Bewegung/,
    );
    assert.ok(Number(x.document.getElementById('travel-pace').value) < 99);
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(x.sent.length, 0);
  } finally {
    x.cleanup();
  }
});
test('a committed administrative placement preserves route input written while its reply is pending', async () => {
  const x = await travelFixture(),
    get = (id) => x.document.getElementById(id);
  try {
    const arrow = new x.window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(arrow, 'key', { value: 'ArrowRight' });
    get('world-map').dispatchEvent(arrow);
    await until(() => get('travel-place-cursor').getAttribute('aria-label').includes('1,0'));
    const before = x.store.sceneWorld(x.w.token, x.scene.id),
      writes = x.sent.length;
    x.hold();
    get('travel-place-cursor').onclick();
    await until(() => x.hasReply());
    assert.equal(x.sent.at(-1).action.kind, 'place-scene');
    x.enter('travel-waypoints', '4,0; 5,0');
    x.enter('travel-q', '6');
    x.enter('travel-r', '0');
    x.release();
    await until(() => get('travel-placement-status').textContent.includes('platziert'));
    assert.equal(get('travel-waypoints').value, '4,0; 5,0');
    assert.equal(get('travel-q').value, '6');
    assert.equal(get('travel-r').value, '0');
    assert.equal(get('travel-preview-accept').disabled, true);
    assert.equal(x.sent.length, writes + 1);
    const after = x.store.sceneWorld(x.w.token, x.scene.id);
    assert.equal(after.position.q, 1);
    assert.equal(after.position.r, 0);
    assert.equal(after.scene.clock.instantMs, before.scene.clock.instantMs);
    x.preview();
    await until(() => get('travel-preview-dialog').open);
    assert.equal(get('travel-preview-accept').disabled, false);
    assert.equal(x.sent.length, writes + 1);
  } finally {
    x.cleanup();
  }
});
test('a late administrative placement refresh cannot publish success in another selected scene', async () => {
  const x = await liveContextFixture();
  try {
    x.ui.setWorldSurface('world');
    const arrow = new x.window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(arrow, 'key', { value: 'ArrowRight' });
    x.get('world-map').dispatchEvent(arrow);
    await until(() => x.get('travel-place-cursor').getAttribute('aria-label').includes('1,0'));
    const real = x.window.campaign.sceneWorld;
    let release,
      held = false;
    x.window.campaign.sceneWorld = (token, id) =>
      id === x.a.id && !held ? ((held = true), new Promise((r) => (release = r))) : real(token, id);
    x.get('travel-place-cursor').onclick();
    await until(() => !!release);
    await x.select('world-scene', x.b.id);
    await until(() => x.get('world-current').textContent.includes('3,0'));
    const status = x.get('travel-placement-status').textContent,
      bytes = x.store.db.serialize();
    release({ ok: true, value: x.store.sceneWorld(x.w.token, x.a.id) });
    for (let i = 0; i < 12; i++) await tick();
    assert.equal(x.get('travel-placement-status').textContent, status);
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.equal(x.store.sceneWorld(x.w.token, x.a.id).position.q, 1);
    assert.equal(x.store.sceneWorld(x.w.token, x.b.id).position.q, 3);
  } finally {
    x.cleanup();
  }
});

for (const direct of [false, true])
  test(`an unavailable root provider cannot resume a paused journey (${direct ? 'direct callback' : 'visible control'})`, async () => {
    const x = await travelFixture();
    try {
      const command = (action) => ({
          commandId: randomUUID(),
          campaignId: x.campaign.id,
          token: x.w.token,
          action,
        }),
        p = x.store.previewTravel(x.w.token, {
          sceneId: x.scene.id,
          mapId: x.map.id,
          destination: { q: 1, r: 0 },
          destinationLocationId: null,
          waypoints: [],
          paceKmh: 1,
          factor: 1,
          finalSeconds: null,
        }),
        j = x.store.executeWorld(command({ kind: 'journey', preview: p })).scene.journey;
      x.store.executeWorld(
        command({ kind: 'journey-state', id: j.id, expectedRevision: j.revision, state: 'paused' }),
      );
      const real = x.window.campaign.world;
      x.window.campaign.world = async (token) => {
        const r = await real(token);
        return r.ok ? { ok: true, value: { ...r.value, maps: [] } } : r;
      };
      await x.ui.openWorld();
      const get = (id) => x.document.getElementById(id),
        bytes = x.store.db.serialize(),
        writes = x.writes;
      if (direct) {
        get('journey-play').onclick();
        for (let i = 0; i < 15; i++) await tick();
        assert.equal(x.writes, writes, 'a missing provider cannot silently reactivate the journey');
      } else
        assert.equal(
          get('journey-play').disabled,
          true,
          'resume must agree with the timer map requirement',
        );
      assert.match(get('journey-playback-status').textContent, /Reisekarte/);
      assert.ok(x.store.db.serialize().equals(bytes));
      assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).journey.status, 'paused');
      x.window.campaign.world = real;
      await x.ui.openWorld();
      assert.equal(get('journey-play').disabled, false);
      get('journey-play').onclick();
      await until(() => x.writes === writes + 1);
      await x.ui.stopWorldPlayback();
      assert.equal(x.sent.at(-1).action.kind, 'journey-state');
      assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).journey.status, 'active');
      assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock.instantMs, '0');
    } finally {
      x.cleanup();
    }
  });
test('a valid route for the focused scene is not blocked by another scene journey on the same root', async () => {
  const x = await travelFixture();
  try {
    const command = (action) => ({
        commandId: randomUUID(),
        campaignId: x.campaign.id,
        token: x.w.token,
        action,
      }),
      pc = x.store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Bela', speedFeet: 30 } }),
      ).character;
    let live = x.store.live(x.w.token);
    x.store.executeLive(
      command({
        kind: 'membership',
        characterId: pc.id,
        expectedRevision: pc.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: x.scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    live = x.store.live(x.w.token);
    const a = x.store.liveScene(x.w.token, x.scene.id),
      b = x.store.executeLive(
        command({
          kind: 'move',
          sceneId: a.id,
          expectedRosterRevision: live.rosterRevision,
          expectedFocusRevision: live.focusRevision,
          expectedClockRevision: a.clock.revision,
          expectedSceneMembershipRevision: a.membershipRevision,
          memberIds: [pc.id],
          target: { kind: 'new', title: 'Nachhut', expectedContentRevision: a.revision },
        }),
      ).session.createdScene;
    const f = x.store.sceneWorld(x.w.token, b.id);
    x.store.executeWorld(
      command({
        kind: 'place-scene',
        sceneId: b.id,
        expectedSceneRevision: f.scene.revision,
        expectedPositionRevision: f.position.revision,
        position: { mapId: x.map.id, q: 0, r: 0, locationId: null },
      }),
    );
    const p = x.store.previewTravel(x.w.token, {
      sceneId: a.id,
      mapId: x.map.id,
      destination: { q: 1, r: 0 },
      destinationLocationId: null,
      waypoints: [],
      paceKmh: 1,
      factor: 1,
      finalSeconds: null,
    });
    x.store.executeWorld(command({ kind: 'journey', preview: p }));
    const original = x.store.sceneWorld(x.w.token, a.id);
    x.store.executeLive(
      command({
        kind: 'focus',
        sceneId: b.id,
        expectedRevision: x.store.live(x.w.token).focusRevision,
      }),
    );
    await x.ui.openWorld();
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, b.id);
    x.document.getElementById('live-travel-toggle').click();
    await until(() => !x.document.getElementById('live-travel-host').hidden);
    x.enter('travel-q', '1');
    x.enter('travel-r', '0');
    x.preview();
    await until(
      () => x.document.getElementById('travel-evaluation').querySelectorAll('dd').length === 3,
    );
    assert.equal(x.document.getElementById('journey-play').disabled, false);
    x.document.getElementById('journey-play').click();
    await until(() => !!x.store.sceneWorld(x.w.token, b.id).journey);
    await x.ui.stopWorldPlayback();
    assert.equal(x.sent.at(-1).action.kind, 'journey');
    assert.equal(x.sent.at(-1).action.preview.request.sceneId, b.id);
    assert.equal(x.store.sceneWorld(x.w.token, b.id).scene.clock.instantMs, '0');
    assert.deepEqual(x.store.sceneWorld(x.w.token, a.id), original);
  } finally {
    await x.ui.stopWorldPlayback();
    x.cleanup();
  }
});

test('crowded Hex labels favour the selected Hex, return with zoom, and leave complete map facts intact', async () => {
  const x = await fixture(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  try {
    const map = x.store.world(x.w.token).maps[0],
      cell = (q, label) => ({
        q,
        r: 0,
        level: 0,
        terrain: 'plains',
        elevationM: 0,
        climate: null,
        road: false,
        river: false,
        label,
        faction: '',
        interrupt: '',
      });
    map.cells = [cell(1, 'Spuren'), cell(2, 'Zielpunkt')];
    x.store.executeWorld(command({ kind: 'map', map, expectedRevision: map.revision }));
    await x.ui.openWorld();
    const root = x.document.getElementById('world-map'),
      shown = () => [...root.querySelectorAll('[data-hex-label]')].map((n) => n.textContent),
      bytes = x.store.db.serialize(),
      writes = x.writes;
    assert.deepEqual(shown(), ['Spuren']);
    assert.match(
      root.querySelector('polygon[data-q="2"][data-r="0"] title').textContent,
      /Zielpunkt/,
    );
    root
      .querySelector('polygon[data-q="2"][data-r="0"]')
      .dispatchEvent(new x.window.Event('click'));
    await until(() => x.document.getElementById('hex-label').value === 'Zielpunkt');
    assert.deepEqual(shown(), ['Zielpunkt']);
    for (let i = 0; i < 6; i++) x.document.getElementById('world-zoom-in').onclick();
    assert.deepEqual(shown(), ['Spuren', 'Zielpunkt']);
    root.querySelector('[data-hex-label="1,0"]').dispatchEvent(new x.window.Event('click'));
    await until(() => x.document.getElementById('hex-label').value === 'Spuren');
    assert.equal(x.document.getElementById('travel-q').value, '1');
    x.document
      .querySelector('.map-canvas-controls[data-canvas-for="world-map"] button:last-of-type')
      .onclick();
    assert.deepEqual(shown(), ['Spuren']);
    assert.equal(x.writes, writes);
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.deepEqual(x.store.world(x.w.token).maps[0].cells, map.cells);
  } finally {
    x.cleanup();
  }
});

test('the shared map observes both accepted and invalidated Hex evaluations without reloading or writing travel', async () => {
  const x = await travelFixture();
  try {
    const observed = [],
      read = x.window.campaign.sceneWorld;
    let reads = 0;
    x.window.campaign.sceneWorld = (...args) => {
      reads++;
      return read(...args);
    };
    x.document.addEventListener('atlas-draft', () =>
      observed.push(structuredClone(x.ui.atlasWorldTravelState().preview?.route ?? [])),
    );
    const before = x.store.db.serialize();
    x.preview();
    await until(() => x.document.getElementById('travel-preview-dialog').open);
    assert.deepEqual(observed.at(-1), [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ]);
    x.document.getElementById('travel-route-clear').click();
    assert.deepEqual(observed.at(-1), []);
    x.enter('travel-q', '2');
    x.enter('travel-r', '0');
    x.preview();
    await until(() => x.document.getElementById('travel-preview-dialog').open);
    assert.equal(observed.at(-1).at(-1).q, 2);
    x.enter('travel-factor', '2');
    assert.deepEqual(observed.at(-1), []);
    assert.equal(x.document.getElementById('travel-preview-accept').disabled, true);
    assert.equal(reads, 0);
    assert.equal(x.sent.length, 0);
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});

test('focused travel loads one provider frame and one agenda, shared by the console and weather', async () => {
  const x = await travelFixture();
  try {
    const get = (id) => x.document.getElementById(id);
    let frames = 0,
      agendas = 0;
    const read = x.window.campaign.sceneWorld;
    x.window.campaign.sceneWorld = async (...args) => {
      frames++;
      return read(...args);
    };
    x.window.campaign.agenda = async (token, query) => {
      agendas++;
      return { ok: true, value: x.store.agenda(token, query) };
    };
    const before = x.store.db.serialize();
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    await tick();
    assert.equal(frames, 1);
    assert.equal(agendas, 1, 'drawing weather must not start a second agenda request');
    assert.equal(get('live-agenda-upcoming').querySelectorAll('p').length, 1);
    assert.match(get('live-agenda-upcoming').textContent, /Markt/);
    frames = agendas = 0;
    get('live-travel-toggle').click();
    await until(() => !get('live-travel-toggle').disabled);
    await tick();
    await tick();
    assert.equal(frames, 1, 'opening must reuse the confirmed frame returned by openWorld');
    assert.equal(agendas, 1);
    assert.equal(
      get('live-center-map').hidden,
      true,
      'selecting travel alone keeps the scene in the center',
    );
    assert.match(get('live-travel-context').textContent, /Figuren/);
    assert.ok(x.store.db.serialize().equals(before));
    frames = agendas = 0;
    get('live-travel-retry').click();
    await until(() => agendas > 0);
    await tick();
    assert.equal(frames, 1);
    assert.equal(agendas, 1);
    assert.ok(x.store.db.serialize().equals(before));
    const context = get('live-travel-context').textContent;
    frames = agendas = 0;
    await x.ui.renderLiveWorld('obsolete-token', x.scene.id);
    assert.equal(frames, 0);
    assert.equal(agendas, 0);
    assert.equal(get('live-travel-context').textContent, context);
  } finally {
    x.cleanup();
  }
});

test('superseded agenda responses cannot append duplicate or stale events to the focused console', async () => {
  const x = await travelFixture();
  try {
    const replies = [];
    x.window.campaign.agenda = () => new Promise((resolve) => replies.push(resolve));
    const get = (id) => x.document.getElementById(id),
      value = x.store.agenda(x.w.token, {
        sceneId: x.scene.id,
        search: '',
        location: 'current',
        horizonDays: 1,
        includePast: false,
        after: null,
      });
    x.ui.setWorldSurface('live');
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    assert.equal(replies.length, 1);
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    assert.equal(replies.length, 2);
    replies[1]({ ok: true, value });
    await tick();
    const shown = get('live-agenda-upcoming').textContent;
    replies[0]({
      ok: true,
      value: {
        ...value,
        items: value.items.map((i) => ({
          ...i,
          event: { ...i.event, name: 'Veraltetes Ereignis' },
        })),
      },
    });
    await tick();
    assert.equal(get('live-agenda-upcoming').textContent, shown);
    assert.equal(get('live-agenda-upcoming').querySelectorAll('p').length, 1);
    x.window.campaign.sceneWorld = async () => ({ ok: false, error: 'Provider ausgefallen' });
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    assert.doesNotMatch(get('live-agenda-upcoming').textContent, /Markt/);
    assert.match(get('live-agenda-upcoming').textContent, /nicht verfügbar/);
  } finally {
    x.cleanup();
  }
});

test('a reused older frame cannot regress live membership or leave the agenda permanently loading', async () => {
  const x = await travelFixture();
  try {
    x.window.campaign.agenda = async (token, query) => ({
      ok: true,
      value: x.store.agenda(token, query),
    });
    x.ui.setWorldSurface('live');
    const older = x.store.sceneWorld(x.w.token, x.scene.id);
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    const command = (action) => ({
        commandId: randomUUID(),
        campaignId: x.campaign.id,
        token: x.w.token,
        action,
      }),
      pc = x.store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Nachzügler' } }),
      ).character,
      live = x.store.live(x.w.token);
    x.store.executeLive(
      command({
        kind: 'membership',
        characterId: pc.id,
        expectedRevision: pc.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: x.scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    await x.ui.renderLiveWorld(x.w.token, x.scene.id);
    await tick();
    await x.ui.renderLiveWorld(x.w.token, x.scene.id, older);
    await tick();
    const agenda = x.document.getElementById('live-agenda-upcoming');
    assert.equal(agenda.getAttribute('aria-busy'), 'false');
    assert.match(agenda.textContent, /Markt/);
    x.document.getElementById('live-travel-toggle').click();
    await until(() => !x.document.getElementById('live-travel-toggle').disabled);
    await tick();
    assert.match(x.document.getElementById('live-travel-context').textContent, /2 Figuren/);
  } finally {
    x.cleanup();
  }
});

test('agenda entries with another clock or location are explicit unavailable data rather than a mixed live context', async () => {
  const x = await travelFixture();
  try {
    const value = x.store.agenda(x.w.token, {
      sceneId: x.scene.id,
      search: '',
      location: 'current',
      horizonDays: 1,
      includePast: false,
      after: null,
    });
    for (const scene of [
      { ...value.scene, clockRevision: value.scene.clockRevision + 1 },
      { ...value.scene, locationId: 'another-place' },
    ]) {
      x.window.campaign.agenda = async () => ({ ok: true, value: { ...value, scene } });
      await x.ui.renderLiveWorld(x.w.token, x.scene.id);
      await tick();
      const root = x.document.getElementById('live-agenda-upcoming');
      assert.match(root.textContent, /Gruppenstand.*verschieden/);
      assert.doesNotMatch(root.textContent, /Markt/);
      assert.equal(root.getAttribute('aria-busy'), 'false');
    }
  } finally {
    x.cleanup();
  }
});

test('the shared Atlas does not rebuild the hidden legacy Hex scene while travel inputs change', async () => {
  const x = await travelFixture();
  try {
    const map = x.document.getElementById('world-map'),
      scene = map.firstChild;
    assert.ok(scene);
    const before = x.store.db.serialize();
    x.ui.setWorldSurface('atlas');
    x.enter('travel-q', '2');
    x.enter('travel-r', '1');
    assert.equal(
      map.firstChild,
      scene,
      'the Atlas owns the visible scene; legacy drawing is unnecessary',
    );
    x.ui.setWorldSurface('world');
    await x.ui.openWorld();
    assert.notEqual(
      map.firstChild,
      scene,
      'the standalone legacy surface can still rebuild when explicitly opened',
    );
    assert.equal(x.document.getElementById('travel-q').value, '2');
    assert.ok(x.store.db.serialize().equals(before));
  } finally {
    x.cleanup();
  }
});

for (const clear of ['clear', 'remove-last'])
  test(`empty route stays empty after ${clear} and unrelated travel settings`, async () => {
    const x = await travelFixture();
    try {
      const get = (id) => x.document.getElementById(id),
        requests = [],
        original = x.window.campaign.previewTravel;
      x.window.campaign.previewTravel = async (...args) => {
        requests.push(structuredClone(args[1]));
        return original(...args);
      };
      if (clear === 'clear') get('travel-route-clear').click();
      else get('travel-stops').lastElementChild.querySelector('button:last-child').click();
      await tick();
      await tick();
      assert.equal(get('travel-stops').children.length, 0);
      assert.equal(get('travel-q').value, '');
      assert.equal(get('travel-r').value, '');
      x.enter('travel-factor', '2');
      assert.equal(get('travel-stops').children.length, 0);
      x.preview();
      await tick();
      await tick();
      assert.equal(requests.length, 0);
      assert.equal(get('journey-play').disabled, true);
      x.ui.atlasWorldTarget({ q: 0, r: 0 });
      assert.equal(get('travel-q').value, '0');
      assert.equal(get('travel-r').value, '0');
      x.ui.atlasWorldTarget({ q: 2, r: 0 });
      x.preview();
      await until(() => get('travel-preview-dialog').open);
      assert.deepEqual(requests.at(-1).destination, { q: 2, r: 0 });
      assert.deepEqual(requests.at(-1).waypoints, []);
      assert.equal(x.writes, 0);
    } finally {
      x.cleanup();
    }
  });

async function arrivedHistoryFixture() {
  const x = await travelFixture(),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: x.campaign.id,
      token: x.w.token,
      action,
    });
  const p = x.store.previewTravel(x.w.token, {
      sceneId: x.scene.id,
      mapId: x.map.id,
      destination: { q: 1, r: 0 },
      destinationLocationId: null,
      waypoints: [],
      paceKmh: 1,
      factor: 1,
      finalSeconds: 3600,
    }),
    j = x.store.executeWorld(command({ kind: 'journey', preview: p })).scene.journey;
  x.store.executeWorld(
    command({ kind: 'journey-step', id: j.id, expectedRevision: j.revision, maxSteps: 1 }),
  );
  await x.ui.openWorld();
  return x;
}
test('arrived travel exposes causal undo before the planning form and repeats only on an explicit click', async () => {
  const x = await arrivedHistoryFixture();
  try {
    const get = (id) => x.document.getElementById(id);
    assert.equal(get('journey-play').parentElement.hidden, true);
    assert.equal(
      x.document.querySelector('.world-travel>h3').nextElementSibling.id,
      'world-journey-console',
    );
    assert.equal(get('travel-undo').hidden, false);
    assert.equal(get('travel-undo').disabled, false);
    get('travel-undo').onclick();
    await until(() => x.store.sceneWorld(x.w.token, x.scene.id).position.q === 0);
    await until(() => get('travel-redo').hidden === false && !get('travel-redo').disabled);
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock.instantMs, '0');
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).journey.status, 'paused');
    const n = x.sent.length;
    await tick();
    await tick();
    assert.equal(x.sent.length, n, 'undo never automatically resumes playback');
    get('travel-redo').onclick();
    await until(() => x.store.sceneWorld(x.w.token, x.scene.id).position.q === 1);
    await until(() => get('journey-play').parentElement.hidden);
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock.instantMs, '3600000');
  } finally {
    x.cleanup();
  }
});
test('a delayed inverse reply cannot target a newly activated campaign or issue a second inverse', async () => {
  const x = await arrivedHistoryFixture();
  try {
    x.hold();
    x.document.getElementById('travel-undo').onclick();
    await until(x.hasReply);
    assert.equal(x.document.getElementById('travel-undo').disabled, true);
    x.document.getElementById('travel-undo').onclick();
    await tick();
    assert.equal(x.sent.filter((c) => c.action.kind === 'travel-history').length, 1);
    const c = x.store.create('Neue Kampagne'),
      w = x.store.activate(c.id);
    x.ui.activateWorld(w);
    await x.ui.openWorld();
    const before = x.store.db.serialize();
    x.release();
    await tick();
    await tick();
    assert.deepEqual(x.store.db.serialize(), before);
    assert.equal(x.document.getElementById('travel-history-controls').hidden, true);
    assert.equal(x.sent.filter((c) => c.action.kind === 'travel-history').length, 1);
  } finally {
    x.cleanup();
  }
});

test('a lost inverse acknowledgement is reconciled by receipt without another write', async () => {
  const x = await arrivedHistoryFixture();
  try {
    const original = x.window.campaign.executeWorld;
    let lost = true;
    x.window.campaign.executeWorld = async (command) => {
      const result = await original(command);
      if (command.action.kind === 'travel-history' && lost) {
        lost = false;
        throw Error('Antwort verloren');
      }
      return result;
    };
    x.document.getElementById('travel-undo').onclick();
    await until(() => !x.document.getElementById('world-write-recovery').hidden);
    const n = x.sent.length;
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).position.q, 0);
    assert.equal(x.document.getElementById('travel-undo').disabled, true);
    assert.equal(await x.ui.reconcileWorldWrite(), true);
    await x.ui.openWorld();
    assert.equal(x.sent.length, n);
    assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).scene.clock.instantMs, '0');
    assert.equal(x.document.getElementById('travel-redo').hidden, false);
  } finally {
    x.cleanup();
  }
});
