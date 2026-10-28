import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
for (const [entry, name] of [
  ['src/app/runtime/world-ui.ts', 'world'],
  ['src/app/storage/store.ts', 'store'],
])
  buildSync({
    entryPoints: [entry],
    outfile: '.build/world-owner-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url);
const { createWorldEditor } = require('../../.build/world-owner-world.cjs');
const { CampaignStore } = require('../../.build/world-owner-store.cjs');
const ok = (value) => ({ ok: true, value });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = async () => {
  for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
};
async function fixture(t, name = 'A', loadWorld = true) {
  const dir = mkdtempSync(path.join(tmpdir(), 'world-owner-'));
  const store = new CampaignStore(path.join(dir, 'workbench.sqlite'));
  const campaign = store.create(name),
    w = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const character = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Traveler' } }),
  ).character;
  let roster = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: character.id,
      expectedRevision: character.membershipRevision,
      expectedRosterRevision: roster.rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: roster.focusRevision,
    }),
  );
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const map = store.world(w.token).maps[0];
  store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: scene.id,
      position: { mapId: map.id, q: 0, r: 0, locationId: null },
      expectedSceneRevision: scene.revision,
      expectedPositionRevision: 0,
    }),
  );
  const { document, window } = parseHTML(readWorkspaceMarkup());
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = String(v);
    },
  });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'selectedOptions', {
    configurable: true,
    get() {
      return [...this.options].filter((o) => o.value === this.value);
    },
  });
  const get = (id) => document.getElementById(id);
  const roots = ['world', 'live', 'status'].map(get);
  const calls = [],
    notices = [],
    listeners = new Map();
  const api = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key];
        return async (...args) => {
          calls.push([key, ...args]);
          try {
            return ok(store[key](...args));
          } catch (e) {
            return { ok: false, error: e.message };
          }
        };
      },
    },
  );
  const host = {
    roots,
    api,
    status: (...args) => notices.push(args),
    before: async () => true,
    after: async () => {},
    enter: async () => {},
    camp: async () => {},
    syncScene: () => {},
    changed: () => {},
    write: async (c) => {
      calls.push(['write', structuredClone(c)]);
      try {
        return ok(store.executeWorld(c));
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    settle: () => {},
  };
  const add = window.addEventListener.bind(window),
    remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, fn, ...rest) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    add(type, fn, ...rest);
  };
  window.removeEventListener = (type, fn, ...rest) => {
    listeners.get(type)?.delete(fn);
    remove(type, fn, ...rest);
  };
  const editor = createWorldEditor(host);
  const originalGet = document.getElementById;
  document.getElementById = () => {
    throw Error('Global ID lookup bypassed editor surface');
  };
  try {
    editor.initWorld();
    editor.initWorld();
  } finally {
    document.getElementById = originalGet;
  }
  // The actual Atlas retires this legacy SVG renderer after mounting the shared canvas.
  get('world-map').dataset.sharedAtlas = 'true';
  editor.activateWorld(w);
  if (loadWorld) await editor.openWorld();
  await editor.renderLiveWorld(w.token, scene.id);
  await tick();
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const input = (id, text) => {
    get(id).value = text;
    get(id).dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const writes = () => calls.filter((c) => c[0] === 'write').map((c) => c[1]);
  return {
    dir,
    store,
    campaign,
    w,
    scene,
    document,
    window,
    get,
    host,
    editor,
    calls,
    notices,
    input,
    writes,
    listeners,
  };
}

test('two production World factories keep surfaces, drafts, callbacks and listeners independent; dispose/remount binds once', async (t) => {
  const a = await fixture(t),
    b = await fixture(t, 'B');
  assert.notEqual(a.editor.editorSession, b.editor.editorSession);
  a.input('world-map-name', 'Alpha\r\n map');
  b.input('world-map-name', 'Beta map');
  assert.equal(await a.editor.flushWorld(), true);
  assert.equal(a.store.world(a.w.token).maps[0].name, 'Alpha\r\n map');
  assert.equal(b.writes().length, 0);
  assert.equal(b.get('world-map-name').value, 'Beta map');
  assert.equal(await b.editor.flushWorld(), true);
  assert.equal(b.store.world(b.w.token).maps[0].name, 'Beta map');
  const unrelated = a.get('live-apply');
  const liveAction = () => {};
  unrelated.onclick = liveAction;
  const resizing = a.listeners.get('resize').size;
  assert.equal(resizing, 1);
  assert.equal(await a.editor.dispose(), true);
  assert.equal(a.listeners.get('resize').size, 0);
  assert.equal(unrelated.onclick, liveAction);
  assert.equal(a.listeners.get('blur').size, 0);
  assert.throws(() => a.editor.activateWorld(a.w), /abgebaut/);
  const remounted = createWorldEditor(a.host);
  remounted.initWorld();
  assert.equal(a.listeners.get('resize').size, 1);
  assert.equal(a.document.querySelectorAll('#live-center-tabs').length, 1);
  assert.equal(await remounted.dispose(), true);
  assert.equal(await b.editor.dispose(), true);
});

test('drain saves later input in order, refuses invalid input and does not wait on its own writes', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    dispatch = x.host.write;
  x.host.write = async (c) => {
    if (x.writes().length === 0) {
      const ack = await dispatch(c);
      await held.promise;
      return ack;
    }
    return dispatch(c);
  };
  x.input('world-map-name', 'First snapshot');
  const drain = x.editor.flushWorld();
  await tick();
  assert.equal(x.writes().length, 1);
  x.input('world-map-name', 'Later snapshot');
  held.resolve();
  assert.equal(await drain, true);
  assert.deepEqual(
    x.writes().map((c) => c.action.map.name),
    ['First snapshot', 'Later snapshot'],
  );
  x.input('world-hex-size', '0');
  assert.equal(await x.editor.flushWorld(), false);
  assert.equal(x.get('world-hex-size').value, '0');
  x.editor.atlasWorldTarget({ q: 7, r: 0 });
  x.get('world-scene').value = 'rejected-scene';
  x.get('world-scene').onchange();
  await tick();
  assert.equal(x.get('world-scene').value, x.scene.id, 'rejected drain retains the loaded scene');
  assert.equal(x.get('travel-q').value, '7', 'rejected transition retains the route draft');
  assert.equal(x.get('world-hex-size').value, '0');
  assert.equal(await x.editor.dispose(), false);
  x.input('world-hex-size', '4.828032');
  assert.equal(await x.editor.flushWorld(), true, JSON.stringify(x.notices));
});

test('a lost response keeps the original command across activation, reconciles once, and cannot acknowledge another instance', async (t) => {
  const x = await fixture(t),
    other = await fixture(t, 'B'),
    dispatch = x.host.write;
  x.host.write = async (c) => {
    await dispatch(c);
    throw Error('response lost');
  };
  x.input('world-map-name', 'Confirmed but unseen');
  assert.equal(await x.editor.flushWorld(), false);
  const [command] = x.writes();
  assert.equal(x.editor.editorSession.status.unresolvedCommand, true);
  assert.equal(other.editor.editorSession.status.unresolvedCommand, false);
  assert.equal(await x.editor.flushWorld(), false);
  assert.equal(x.writes().length, 1);
  x.editor.activateWorld(other.w);
  assert.equal(x.editor.editorSession.status.unresolvedCommand, true);
  x.editor.activateWorld(x.w);
  await x.editor.openWorld();
  x.input('world-map-name', 'New owner input');
  assert.equal(await x.editor.reconcileWorldWrite(), true);
  const reconciliation = x.calls.find((c) => c[0] === 'reconcileWorld');
  assert.equal(reconciliation[1].commandId, command.commandId);
  assert.equal(reconciliation[2], command.token);
  assert.equal(x.writes().length, 1);
  assert.equal(x.get('world-map-name').value, 'New owner input');
  assert.equal(x.editor.editorSession.status.openInput, true);
  assert.equal(x.editor.editorSession.status.unresolvedCommand, false);
});

test('A→B→A invalidates an earlier scene response and a late write cannot overwrite or unlock the next weather owner', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    frame = x.store.sceneWorld(x.w.token, x.scene.id);
  x.host.api.sceneWorld = async () => held.promise;
  const old = x.editor.renderLiveWorld(x.w.token, x.scene.id);
  x.editor.activateWorld({ ...x.w, token: 'B' });
  x.editor.activateWorld(x.w);
  await x.editor.renderLiveWorld(x.w.token, x.scene.id, {
    ...frame,
    weather: { ...frame.weather, label: 'New owner weather' },
  });
  const shown = x.get('live-world-summary').textContent;
  held.resolve(ok({ ...frame, weather: { ...frame.weather, label: 'Old weather response' } }));
  await old;
  assert.equal(x.get('live-world-summary').textContent, shown);
  const response = deferred(),
    dispatch = x.host.write;
  x.host.write = async (c) => {
    const ack = await dispatch(c);
    await response.promise;
    return ack;
  };
  x.input('weather-override-notes', 'Old owner draft');
  x.get('weather-override-form').onsubmit({ preventDefault() {} });
  await tick();
  assert.equal(x.writes().length, 1, JSON.stringify(x.notices));
  x.editor.activateWorld({ ...x.w, token: 'B' });
  x.editor.activateWorld(x.w);
  await x.editor.renderLiveWorld(x.w.token, x.scene.id, frame);
  x.input('weather-override-notes', 'Current owner draft');
  response.resolve();
  await tick();
  assert.equal(x.get('weather-override-notes').value, 'Current owner draft');
  assert.equal(x.editor.editorSession.status.unresolvedCommand, false);
});

test('unapplied lost response is clarified without sending again and preserves the failed draft', async (t) => {
  const x = await fixture(t),
    before = x.store.world(x.w.token).maps[0];
  const original = x.host.write;
  let sent;
  x.host.write = async (command) => {
    sent = command;
    throw Error('connection lost before receipt');
  };
  x.input('world-map-name', 'Unsaved draft');
  assert.equal(await x.editor.flushWorld(), false);
  assert.equal(x.store.world(x.w.token).maps[0].name, before.name);
  assert.equal(await x.editor.reconcileWorldWrite(), true);
  assert.equal(
    x.calls.filter((c) => c[0] === 'reconcileWorld').at(-1)[1].commandId,
    sent.commandId,
  );
  assert.equal(x.get('world-map-name').value, 'Unsaved draft');
  assert.equal(x.editor.editorSession.status.openInput, true);
  x.host.write = original;
  assert.equal(await x.editor.flushWorld(), true);
  assert.equal(x.store.world(x.w.token).maps[0].name, 'Unsaved draft');
});

test('later weather input survives its own acknowledgement and uses the confirmed override revision on the next save', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    dispatch = x.host.write;
  x.host.write = async (c) => {
    const ack = await dispatch(c);
    if (x.writes().length === 1) await held.promise;
    return ack;
  };
  x.input('weather-override-notes', 'Sent note');
  x.get('weather-override-form').onsubmit({ preventDefault() {} });
  await tick();
  assert.equal(x.writes().length, 1, JSON.stringify(x.notices));
  x.input('weather-override-notes', 'Later note');
  held.resolve();
  await tick();
  assert.equal(x.get('weather-override-notes').value, 'Later note');
  x.get('weather-override-form').onsubmit({ preventDefault() {} });
  await tick();
  assert.equal(x.writes().length, 2, JSON.stringify(x.notices));
  assert.equal(x.writes()[1].action.expectedOverrideRevision, 1);
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).weather.effects.combatNote, 'Later note');
});

test('a preview read from before scene A→B→A cannot publish into the reopened route', async (t) => {
  const x = await fixture(t),
    held = deferred();
  let response;
  x.host.api.previewTravel = async (token, request) => {
    response = x.store.previewTravel(token, request);
    return held.promise;
  };
  x.editor.atlasWorldTarget({ q: 1, r: 0 });
  const preview = x.editor.previewAtlasWorldTravel();
  await tick();
  assert.ok(response, JSON.stringify(x.notices));
  const picker = x.get('world-scene');
  picker.value = 'scene-B';
  picker.onchange();
  await tick();
  picker.value = x.scene.id;
  picker.onchange();
  await tick();
  x.editor.atlasWorldTarget({ q: 2, r: 0 });
  held.resolve(ok(response));
  await preview;
  assert.equal(x.editor.atlasWorldTravelState().preview, null);
  assert.equal(x.get('travel-q').value, '2');
});

test('calendar controls keep their surface after moving into the dialog and agenda saves share its writer without moving group time', async (t) => {
  const x = await fixture(t),
    clock = x.store.liveScene(x.w.token, x.scene.id).clock;
  const create = x.document.createElement.bind(x.document);
  x.document.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'dialog') {
      node.showModal = () => {
        node.open = true;
      };
      node.close = () => {
        node.open = false;
      };
    }
    return node;
  };
  // The existing dialog was created by the production mount before the adapter.
  const dialog = x.get('calendar-rules');
  x.get('calendar-rules-status').scrollIntoView = () => {};
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  await x.editor.openWorldCalendar();
  assert.equal(dialog.open, true);
  x.input('calendar-hours', '');
  assert.equal(await x.editor.flushWorld(), false);
  assert.equal(x.get('calendar-hours').value, '');
  x.input('calendar-hours', '1.5');
  x.input('calendar-name', 'Small days');
  assert.equal(await x.editor.flushWorld(), true);
  const calendar = x.store.world(x.w.token).calendar;
  assert.equal(calendar.daySeconds, 5400);
  const event = {
    id: randomUUID(),
    revision: 0,
    name: 'Deadline',
    startMs: '32400000',
    durationMs: '5400000',
    repeatMs: null,
    locationId: null,
    notes: 'Agenda input',
    trashed: false,
  };
  const saved = await x.editor.saveAgendaEvent(
    event,
    null,
    { calendarRevision: calendar.revision, sceneId: null, clockRevision: null, instantMs: null },
    x.w.token,
  );
  assert.equal(saved.id, event.id);
  assert.equal(saved.revision, 1);
  assert.deepEqual(x.store.liveScene(x.w.token, x.scene.id).clock, clock);
  assert.equal(x.writes().filter((c) => c.action.kind === 'calendar-event').length, 1);
});

test('disposal refuses an open manual weather draft and leaves its controls and listeners usable', async (t) => {
  const x = await fixture(t);
  x.input('weather-override-notes', 'Keep this unfinished note');
  assert.equal(await x.editor.dispose(), false);
  assert.equal(x.get('weather-override-notes').value, 'Keep this unfinished note');
  assert.equal(x.listeners.get('resize').size, 1);
  x.get('weather-discard-input').onclick();
  await tick();
  assert.equal(await x.editor.dispose(), true);
  assert.equal(x.listeners.get('resize').size, 0);
});

test('a drain preserves later map, calendar and weather-area input through each owner acknowledgement', async (t) => {
  const x = await fixture(t);
  x.get('phen-new').onclick();
  await tick();
  x.input('phen-name', 'First weather area');
  x.input('calendar-name', 'First calendar');
  x.input('world-map-name', 'First map');
  const held = new Map(),
    dispatch = x.host.write;
  x.host.write = async (command) => {
    const ack = await dispatch(command);
    const wait = held.get(command.action.kind);
    if (wait) {
      held.delete(command.action.kind);
      await wait.promise;
    }
    return ack;
  };
  const map = deferred(),
    calendar = deferred(),
    phenomenon = deferred();
  held.set('map', map);
  held.set('calendar', calendar);
  held.set('phenomenon', phenomenon);
  const saving = x.editor.flushWorld();
  await tick();
  x.input('world-map-name', 'Later map');
  map.resolve();
  await tick();
  assert.equal(x.writes().at(-1).action.kind, 'calendar');
  x.input('calendar-name', 'Later calendar');
  calendar.resolve();
  await tick();
  assert.equal(x.writes().at(-1).action.kind, 'phenomenon');
  x.input('phen-name', 'Later weather area');
  phenomenon.resolve();
  assert.equal(await saving, true, JSON.stringify(x.notices));
  const world = x.store.world(x.w.token);
  assert.equal(world.maps[0].name, 'Later map');
  assert.equal(world.calendar.name, 'Later calendar');
  assert.equal(world.phenomena[0].name, 'Later weather area');
  assert.deepEqual(
    x.writes().map((c) => c.action.kind),
    ['map', 'calendar', 'phenomenon', 'map', 'calendar', 'phenomenon'],
  );
});

test('a late live travel projection cannot replace a new campaign map draft or its selected context', async (t) => {
  const x = await fixture(t);
  x.editor.setWorldSurface('live');
  x.get('live-travel-toggle').onclick();
  await tick();
  const oldFrame = x.store.sceneWorld(x.w.token, x.scene.id),
    response = deferred();
  x.host.api.sceneWorld = async () => response.promise;
  const read = x.editor.renderLiveWorld(x.w.token, x.scene.id);
  await tick();
  const campaign = x.store.create('Independent campaign'),
    next = x.store.activate(campaign.id);
  x.editor.activateWorld(next);
  await x.editor.openWorld();
  const selected = x.get('world-map-select').value;
  x.input('world-map-name', 'Keep this campaign map draft');
  response.resolve(ok(oldFrame));
  await read;
  assert.equal(x.get('world-map-select').value, selected);
  assert.equal(x.get('world-map-name').value, 'Keep this campaign map draft');
  assert.equal(x.editor.atlasWorldTravelState().frame, null);
  assert.equal(x.editor.editorSession.status.openInput, true);
  assert.equal(await x.editor.flushWorld(), true, JSON.stringify(x.notices));
  assert.equal(x.store.world(next.token).maps[0].name, 'Keep this campaign map draft');
});

test('a confirmed travel action from before a scene switch does not publish over the new route owner', async (t) => {
  const x = await fixture(t),
    held = deferred(),
    dispatch = x.host.write;
  x.editor.atlasWorldTarget({ q: 2, r: 0 });
  await x.editor.previewAtlasWorldTravel();
  assert.ok(x.editor.atlasWorldTravelState().preview);
  x.host.write = async (c) => {
    const ack = await dispatch(c);
    await held.promise;
    return ack;
  };
  const started = x.editor.startAtlasWorldTravel();
  await tick();
  assert.equal(x.writes().at(-1).action.kind, 'journey');
  const picker = x.get('world-scene');
  picker.value = 'another-scene';
  picker.onchange();
  picker.value = x.scene.id;
  picker.onchange();
  x.editor.atlasWorldTarget({ q: 5, r: 0 });
  held.resolve();
  await started;
  await tick();
  assert.equal(x.get('travel-q').value, '5');
  assert.equal(x.editor.atlasWorldTravelState().preview, null);
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).journey.route.at(-1).q, 2);
  assert.equal(x.writes().filter((c) => c.action.kind === 'journey').length, 1);
});

test('an old transport finally cannot unlock controls belonging to a later scene-selection lease', async (t) => {
  const x = await fixture(t);
  x.editor.atlasWorldTarget({ q: 3, r: 0 });
  await x.editor.previewAtlasWorldTravel();
  await x.editor.startAtlasWorldTravel();
  const old = deferred(),
    current = deferred(),
    dispatch = x.host.write;
  x.host.write = async (c) => {
    const ack = await dispatch(c);
    await old.promise;
    return ack;
  };
  x.get('journey-step').onclick();
  await tick();
  assert.equal(x.writes().at(-1).action.kind, 'journey-step');
  const picker = x.get('world-scene');
  picker.value = 'other-scene';
  picker.onchange();
  picker.value = x.scene.id;
  picker.onchange();
  x.host.before = () => current.promise;
  x.get('journey-step').onclick();
  await tick();
  assert.equal(x.get('journey-end').disabled, true);
  old.resolve();
  await tick();
  assert.equal(
    x.get('journey-end').disabled,
    true,
    'late owner cleanup must not release the active transport lease',
  );
  current.resolve(true);
  await tick();
  assert.equal(x.get('world-scene').value, x.scene.id);
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).journey.nextIndex, 2);
});

test('calendar receipt reconciliation adopts its own revision while retaining later dialog input', async (t) => {
  const x = await fixture(t),
    dialog = x.get('calendar-rules');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.get('calendar-rules-status').scrollIntoView = () => {};
  await x.editor.openWorldCalendar();
  const dispatch = x.host.write;
  x.host.write = async (c) => {
    await dispatch(c);
    throw Error('calendar acknowledgement lost');
  };
  x.input('calendar-name', 'Sent calendar name');
  assert.equal(await x.editor.flushWorld(), false);
  const command = x.writes()[0];
  x.input('calendar-name', 'Later calendar name');
  assert.equal(await x.editor.reconcileWorldWrite(), true);
  assert.equal(x.get('calendar-name').value, 'Later calendar name');
  assert.equal(x.calls.find((c) => c[0] === 'reconcileWorld')[1].commandId, command.commandId);
  x.host.write = dispatch;
  assert.equal(await x.editor.flushWorld(), true, JSON.stringify(x.notices));
  assert.equal(x.writes()[1].action.expectedRevision, command.action.expectedRevision + 1);
  assert.equal(x.store.world(x.w.token).calendar.name, 'Later calendar name');
  assert.equal(x.writes().length, 2);
});

test('calendar opens and saves its own complete basis directly from Live before any map read', async (t) => {
  const x = await fixture(t, 'Calendar before Atlas', false),
    dialog = x.get('calendar-rules');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  x.get('calendar-rules-status').scrollIntoView = () => {};
  const before = x.store.world(x.w.token).calendar,
    clock = x.store.liveScene(x.w.token, x.scene.id).clock;
  await x.editor.openWorldCalendar();
  assert.equal(
    x.get('calendar-months').value,
    before.months.map((m) => m.name + ': ' + m.days).join('\n'),
  );
  assert.equal(x.get('calendar-weekdays').value, before.weekdays.join(', '));
  x.input('calendar-hours', '1.5');
  assert.equal(await x.editor.flushWorld(), true, JSON.stringify(x.notices));
  const saved = x.store.world(x.w.token).calendar;
  assert.equal(saved.daySeconds, 5400);
  assert.deepEqual(saved.months, before.months);
  assert.deepEqual(saved.weekdays, before.weekdays);
  assert.deepEqual(x.store.liveScene(x.w.token, x.scene.id).clock, clock);
});
