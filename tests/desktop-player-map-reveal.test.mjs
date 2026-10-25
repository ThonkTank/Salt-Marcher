import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [source, name] of [
  ['storage/store', 'store'],
  ['player-map-controls', 'map'],
  ['player-ui', 'ui'],
  ['storage/atlas-landscape', 'landscape'],
])
  buildSync({
    entryPoints: ['src/app/' + source + '.ts'],
    outfile: '.build/player-map-reveal-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../.build/player-map-reveal-store.cjs'),
  { renderPlayerMapPicker } = require('../.build/player-map-reveal-map.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/player-map-reveal-'),
    store = new CampaignStore(root + '/workbench.sqlite'),
    cam = store.create('Nordpass'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const hero = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Mira' } }),
    ).character,
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 1 })).scene;
  store.executeLive(
    command({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: hero.membershipRevision,
      expectedRosterRevision: 1,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: 0,
    }),
  );
  let map = store.world(w.token).maps[0];
  map = {
    ...map,
    cells: ['Eichenfurt', 'Nordpass', 'GM_GEHEIM_Drache'].map((label, q) => ({
      q,
      r: 0,
      level: 0,
      terrain: q === 2 ? 'mountains' : 'plains',
      elevationM: 0,
      climate: null,
      road: false,
      river: false,
      label,
      faction: 'GM_GEHEIM_Kult',
      interrupt: '',
    })),
  };
  store.executeWorld(command({ kind: 'map', map, expectedRevision: map.revision }));
  const position = store.sceneWorld(w.token, scene.id).position;
  store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: scene.id,
      expectedSceneRevision: scene.revision,
      expectedPositionRevision: position.revision,
      position: { mapId: map.id, q: 0, r: 0, locationId: null, dungeon: null },
    }),
  );
  const request = (action) => {
      const v = store.playerView(w.token);
      return {
        ...command(action),
        expectedRevision: v.settings.revision,
        expectedFocusId: v.focusId,
        expectedFocusRevision: v.focusRevision,
        expectedFocusMembershipRevision: v.focusMembershipRevision,
        expectedFocusLocationId: v.focusLocationId,
      };
    },
    send = (action) => store.executePlayer(request(action));
  send({
    kind: 'observer',
    observer: {
      characterId: hero.id,
      enabled: false,
      rangeMeters: 10000,
      darkvisionMeters: 0,
      eyeHeightMeters: 1.7,
    },
  });
  const discover = (q, label) => ({
    kind: 'discover',
    characterIds: [hero.id],
    mapId: map.id,
    q,
    r: 0,
    locationId: null,
    publicLabel: label,
  });
  return { root, store, cam, w, map, hero, request, send, discover };
}
test('hex discovery publishes the explicit label atomically and never the GM name', (t) => {
  const x = fixture(t);
  x.send(x.discover(0, 'Öffentliche Furt'));
  x.send(x.discover(1, 'Nordpass'));
  let v = x.store.playerView(x.w.token);
  x.send({
    kind: 'settings',
    settings: { ...v.settings, mode: 'follow', blank: false, labels: true },
  });
  const frame = x.store.currentPlayerFrame();
  assert.deepEqual(
    frame.map.cells.map((c) => [c.q, c.label]),
    [
      [0, 'Öffentliche Furt'],
      [1, 'Nordpass'],
    ],
  );
  assert.doesNotMatch(JSON.stringify(frame), /GM_GEHEIM|Eichenfurt/);
  assert(x.store.playerView(x.w.token).maps[0].cells.some((c) => c.name === 'GM_GEHEIM_Drache'));
  x.send({ kind: 'blank' });
  assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  assert.equal(x.store.playerView(x.w.token).maps[0].cells.filter((c) => c.known).length, 2);
});
test('discovery preserves hidden and sight-blocking masks and receipt replay', (t) => {
  const x = fixture(t);
  x.send({
    kind: 'mask',
    mapId: x.map.id,
    q: 2,
    r: 0,
    hidden: true,
    blocksSight: true,
    publicLabel: 'Alt',
  });
  const command = x.request(x.discover(2, 'Bestätigt'));
  x.store.executePlayer(command);
  const mask = x.store.playerView(x.w.token).maps[0].cells.find((c) => c.q === 2);
  assert.deepEqual(
    [mask.hidden, mask.blocksSight, mask.publicLabel, mask.known],
    [true, true, 'Bestätigt', true],
  );
  const before = x.store.db.serialize();
  x.store.executePlayer(command);
  assert(x.store.db.serialize().equals(before));
  let v = x.store.playerView(x.w.token);
  x.send({
    kind: 'settings',
    settings: { ...v.settings, mode: 'follow', blank: false, labels: true },
  });
  assert(!x.store.currentPlayerFrame().map.cells.some((c) => c.q === 2));
});
test('invalid recipients roll back the public label with the entire discovery', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  assert.throws(
    () => x.send({ ...x.discover(0, 'Nicht speichern'), characterIds: [x.hero.id, 'missing'] }),
    /Charakter fehlt/,
  );
  assert(x.store.db.serialize().equals(before));
});
test('GM map stays bounded and keyboard selection works at distant coordinates', () => {
  const { document } = parseHTML('<div id="map"></div>'),
    previous = globalThis.document;
  globalThis.document = document;
  try {
    const root = document.getElementById('map'),
      cells = [];
    for (let q = -20; q <= 20; q++)
      for (let r = -20; r <= 20; r++)
        cells.push({
          q: q + 1e8,
          r: r - 1e8,
          terrain: 'plains',
          name: 'Ort',
          known: false,
          hidden: false,
        });
    let selected;
    renderPlayerMapPicker(root, cells, { q: 1e8, r: -1e8 }, (cell) => (selected = cell));
    assert.equal(root.querySelectorAll('[role=button]').length, 61);
    assert(!root.querySelector('svg').getAttribute('viewBox').includes('100000000'));
    const tile = root.querySelector('[data-player-cell="100000000,-100000000"]');
    tile.onkeydown({ key: 'Enter', preventDefault() {} });
    assert.equal(selected.q, 1e8);
  } finally {
    globalThis.document = previous;
  }
});
test('UI selection keeps GM names private until explicit copy and sends one discovery', async (t) => {
  const x = fixture(t),
    old = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLInputElement: globalThis.HTMLInputElement,
    },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, HTMLInputElement: window.HTMLInputElement });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const writes = [];
  window.campaign = {
    playerScreens: async () => ({ ok: true, value: [] }),
    playerView: async () => ({ ok: true, value: x.store.playerView(x.w.token) }),
    executePlayer: async (c) => {
      writes.push(c);
      return { ok: true, value: x.store.executePlayer(c) };
    },
    playerWindow: async () => ({ ok: true }),
  };
  delete require.cache[require.resolve('../.build/player-map-reveal-ui.cjs')];
  const ui = require('../.build/player-map-reveal-ui.cjs');
  const el = (id) => document.getElementById(id),
    until = async (check) => {
      for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setImmediate(r));
      assert(check());
    };
  try {
    ui.initPlayerUI(
      () => {},
      () => x.w,
      async () => true,
    );
    el('player-open-controls').onclick();
    await until(() => el('player-dialog').open);
    document.querySelector('[data-player-cell="1,0"]').onclick();
    assert.equal(el('player-q').value, '1');
    assert.equal(el('player-public-label').value, '');
    assert.equal(writes.length, 0);
    el('player-copy-label').onclick();
    assert.equal(el('player-public-label').value, 'Nordpass');
    document.querySelector('[data-player-character]').setAttribute('checked', '');
    el('player-discover').onclick();
    await until(() => writes.length === 1 && !el('player-feedback').hidden);
    assert.match(
      el('player-feedback').textContent,
      /Kenntnis und öffentliche Beschriftung gespeichert/,
    );
    assert.equal(writes[0].action.publicLabel, 'Nordpass');
    assert.equal(writes[0].action.q, 1);
    assert.equal(writes[0].action.locationId, null);
    assert.equal(
      x.store.playerView(x.w.token).maps[0].cells.find((c) => c.q === 1).publicLabel,
      'Nordpass',
      JSON.stringify(
        x.store.db.prepare("SELECT payload FROM player_record WHERE kind='mask'").all(),
      ),
    );
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    el('player-map-search').value = 'GM_GEHEIM';
    el('player-map-search').oninput();
    assert.equal(el('player-map-matches').querySelectorAll('button').length, 1);
  } finally {
    ui.deactivatePlayer();
    Object.assign(globalThis, old);
  }
});
test('canonical landscape remains selectable and distant names are searched in bounded replies', (t) => {
  const x = fixture(t),
    map = x.store.world(x.w.token).maps[0];
  x.store.executeWorld({
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.cam.id,
    action: {
      kind: 'cell',
      mapId: map.id,
      expectedRevision: map.revision,
      cell: { ...map.cells[0], q: 1000, label: 'Fernhafen' },
    },
  });
  let v = x.store.playerView(x.w.token);
  assert(
    v.maps[0].cells.some((c) => c.name === 'Eichenfurt'),
    JSON.stringify(v.maps[0].cells),
  );
  assert(!v.maps[0].cells.some((c) => c.name === 'Fernhafen'));
  v = x.store.playerView(x.w.token, { mapId: map.id, q: 0, r: 0, search: 'Fernhafen' });
  const far = v.maps[0].cells.find((c) => c.name === 'Fernhafen');
  assert(far);
  assert.equal(far.q, 1000);
  assert(v.maps[0].cells.length <= 82);
  v = x.store.playerView(x.w.token, { mapId: map.id, q: 1000, r: 0, search: '' });
  assert(v.maps[0].cells.some((c) => c.name === 'Fernhafen'));
  assert(v.maps[0].cells.length <= 61);
});

test('map focus survives redraw, arrows only move focus, and Tab leaves one map entry', () => {
  const { document } = parseHTML('<div id="map"></div><input id="label">'),
    previous = globalThis.document;
  globalThis.document = document;
  const root = document.getElementById('map'),
    cells = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
    ].map((cell) => ({ ...cell, terrain: 'plains', name: 'Ort', known: false, hidden: false }));
  let active = document.getElementById('label'),
    selected = { q: 0, r: 0 },
    choices = 0;
  Object.defineProperty(document, 'activeElement', { get: () => active, configurable: true });
  const prototype = Object.getPrototypeOf(
      document.createElementNS('http://www.w3.org/2000/svg', 'g'),
    ),
    oldFocus = prototype.focus;
  prototype.focus = function () {
    active = this;
    this.onfocus?.();
  };
  const draw = () =>
    renderPlayerMapPicker(root, cells, selected, (cell) => {
      choices++;
      selected = cell;
      draw();
    });
  const key = (node, key) => node.onkeydown({ key, preventDefault() {} });
  try {
    draw();
    assert.equal(active.id, 'label');
    assert.equal(root.querySelectorAll('[tabindex="0"]').length, 1);
    root.querySelector('[data-player-cell="0,0"]').focus();
    key(active, 'ArrowRight');
    assert.equal(active.dataset.playerCell, '1,0');
    assert.equal(choices, 0);
    key(active, 'Enter');
    assert.equal(choices, 1);
    assert.equal(selected.q, 1);
    assert.equal(active.dataset.playerCell, '1,0');
    assert.equal(active.isConnected, true);
    assert.equal(root.querySelectorAll('[tabindex="0"]').length, 1);
    key(active, 'ArrowDown');
    assert.equal(active.dataset.playerCell, '0,1');
    assert.equal(choices, 1);
    draw();
    assert.equal(active.dataset.playerCell, '0,1');
    active = document.getElementById('label');
    draw();
    assert.equal(active.id, 'label');
  } finally {
    if (oldFocus) prototype.focus = oldFocus;
    else delete prototype.focus;
    globalThis.document = previous;
  }
});
