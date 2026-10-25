import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/dungeon-pace-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/dungeon-pace-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'dungeon-pace-')),
    file = path.join(root, 'work.sqlite'),
    store = new CampaignStore(file),
    room = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Langer Gang',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 45.72, y: 0 },
            { x: 45.72, y: 6.096 },
            { x: 0, y: 6.096 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Autorentext\r\n' }],
    },
    cam = store.create('Tempo', [room]),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const x = { root, file, store, cam, w, room, command };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  store.executeDrawing(
    command({
      kind: 'volume-initialize',
      roomId: room.id,
      expectedRoomRevision: 0,
      expectedVolumeRevision: null,
      heightSteps: 4,
    }),
  );
  x.ids = [];
  for (const [name, speedFeet] of [
    ['Ada', 30],
    ['Borin', 20],
  ]) {
    const c = store.executeLive(
        command({ kind: 'create-character', profile: { name, speedFeet } }),
      ).character,
      v = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: v.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: v.focusRevision,
      }),
    );
    x.ids.push(c.id);
  }
  x.scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  x.view = () => x.store.dungeon(x.w.token);
  x.run = (action) => x.store.executeDungeon({ ...x.command(action), token: x.w.token });
  x.save = (changes) => {
    const p = x.view().travelPace;
    return x.run({
      kind: 'pace-settings',
      sceneId: x.scene.id,
      settings: { ...p.settings, ...changes },
      expectedMembershipRevision: p.membershipRevision,
    });
  };
  x.origin = { scopeId: 'local', floorId: 'ground', roomId: room.id, x: 2.286, y: 2.286, z: 0 };
  x.run({ kind: 'place', sceneId: x.scene.id, expectedPositionRevision: 0, pose: x.origin });
  x.preview = () =>
    x.store.previewDungeon(x.w.token, {
      sceneId: x.scene.id,
      destination: { ...x.origin, x: 41.91 },
      speedMetersPerMinute: 999,
      factor: 1,
      finalSeconds: null,
      useGroupPace: true,
      movement: x.view().travelPace.settings.movement,
    });
  return x;
}
test('slowest group, exclusions and effective overrides share one stored preview without changing roster or geometry', (t) => {
  const x = fixture(t),
    live = x.store.live(x.w.token),
    geometry = x.store.drawing(x.w.token),
    a = x.preview();
  assert.equal(a.request.speedMetersPerMinute, 60.96);
  assert.deepEqual(a.pace.limitingIds, [x.ids[1]]);
  x.save({ members: [{ characterId: x.ids[1], excluded: true, metersPerMinute: null }] });
  const b = x.preview();
  assert.equal(b.request.speedMetersPerMinute, 91.44);
  assert.ok(b.durationSeconds < a.durationSeconds);
  assert.equal(b.actorIds.length, 2, 'excluded from pace still arrives with everyone');
  x.save({ members: [{ characterId: x.ids[1], excluded: false, metersPerMinute: 120 }] });
  assert.equal(x.preview().request.speedMetersPerMinute, 91.44);
  x.save({ groupMetersPerMinute: 18 });
  const explicit = x.preview();
  assert.equal(explicit.request.speedMetersPerMinute, 18);
  assert.deepEqual(explicit.pace.limitingIds, []);
  x.save({ groupMetersPerMinute: null, members: [], movement: 'crawl' });
  assert.equal(x.preview().request.speedMetersPerMinute, 30.48);
  assert.deepEqual(x.store.live(x.w.token), live);
  assert.deepEqual(x.store.drawing(x.w.token), geometry);
});
test('stale previews reject changed pace, accepted journeys retain their time through later settings and Fresh', (t) => {
  const x = fixture(t),
    old = x.preview();
  x.save({ groupMetersPerMinute: 12 });
  const before = x.store.db.serialize();
  assert.throws(() => x.run({ kind: 'journey', preview: old }), /Wegvorschau/);
  assert.ok(x.store.db.serialize().equals(before));
  const accepted = x.preview();
  x.run({ kind: 'journey', preview: accepted });
  x.save({ groupMetersPerMinute: 24 });
  assert.equal(x.view().journey.request.speedMetersPerMinute, 12);
  const j = x.view().journey,
    step = x.command({
      kind: 'step',
      sceneId: x.scene.id,
      id: j.id,
      expectedRevision: j.revision,
      maxSteps: 1,
    });
  x.store.executeDungeon(step);
  assert.equal(x.view().instantMs, String(accepted.segmentSeconds[0] * 1000));
  const bytes = x.store.db.serialize();
  x.store.executeDungeon(step);
  assert.ok(x.store.db.serialize().equals(bytes));
  const saved = x.view();
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.view(), saved);
});
test('missing, zero and flight speeds require an explicit usable effective pace', (t) => {
  const x = fixture(t);
  x.save({ movement: 'fly' });
  assert.throws(x.preview, /Tempo fehlt/);
  x.save({ groupMetersPerMinute: 6 });
  assert.equal(x.preview().request.speedMetersPerMinute, 6);
  x.save({ movement: 'walk', groupMetersPerMinute: 0 });
  assert.throws(x.preview, /Gruppenvorgabe/);
  x.save({
    groupMetersPerMinute: null,
    members: x.ids.map((characterId) => ({ characterId, excluded: true, metersPerMinute: null })),
  });
  assert.throws(x.preview, /Alle Figuren/);
  const before = x.store.db.serialize();
  assert.throws(
    () => x.save({ members: [{ characterId: 'foreign', excluded: true, metersPerMinute: 5 }] }),
    /Gruppenmitglieder/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});
test('independent campaign transfer remaps pace references and preserves its accepted frozen journey', async (t) => {
  const x = fixture(t);
  x.save({ members: [{ characterId: x.ids[0], excluded: true, metersPerMinute: 4 }] });
  const preview = x.preview();
  x.run({ kind: 'journey', preview });
  const packet = path.join(x.root, 'copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, packet);
  const source = x.store.db.serialize(),
    bytes = readFileSync(packet),
    copy = new CampaignStore(path.join(x.root, 'destination.sqlite'));
  try {
    const imported = copy.acceptCampaignSnapshot(packet, 'Unabhängiges Tempo', {}).id,
      w = copy.activate(imported),
      v = copy.dungeon(w.token);
    assert.equal(v.travelPace.pace.metersPerMinute, 60.96);
    assert.equal(v.travelPace.settings.members[0].excluded, true);
    assert.ok(!x.ids.includes(v.travelPace.settings.members[0].characterId));
    assert.deepEqual(v.journey.pace.limitingIds, [
      v.travelPace.pace.members.find((m) => m.name === 'Borin').characterId,
    ]);
    const j = v.journey;
    copy.executeDungeon({
      commandId: randomUUID(),
      campaignId: imported,
      token: w.token,
      action: {
        kind: 'step',
        sceneId: v.sceneId,
        id: j.id,
        expectedRevision: j.revision,
        maxSteps: 1,
      },
    });
    assert.equal(copy.dungeon(w.token).instantMs, String(j.segmentSeconds[0] * 1000));
    assert.ok(x.store.db.serialize().equals(source));
    assert.deepEqual(readFileSync(packet), bytes);
  } finally {
    copy.close();
  }
});

// Reuse the actual panel and DOM; these cases exercise pending-save ownership,
// not another copy of the pace arithmetic.
buildSync({
  entryPoints: ['src/app/dungeon-pace-ui.ts'],
  outfile: '.build/dungeon-pace-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
test('pace panel retains newer edits after an earlier acknowledgement and discards against the latest read', async (t) => {
  const { parseHTML } = await import('linkedom'),
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, previous));
  Object.defineProperty(document.getElementById('dungeon-movement'), 'value', {
    writable: true,
    value: 'walk',
  });
  const ui = createRequire(import.meta.url)('../.build/dungeon-pace-ui.cjs'),
    settings = {
      sceneId: 'scene',
      revision: 0,
      movement: 'walk',
      groupMetersPerMinute: null,
      members: [],
    },
    pace = {
      profile: 'dnd5e-2014-dungeon-pace-v1',
      metersPerMinute: 60.96,
      reason: 'Langsamste Figur',
      limitingIds: ['borin'],
      members: [
        {
          characterId: 'borin',
          name: 'Borin',
          feet: 20,
          metersPerMinute: 60.96,
          excluded: false,
          overridden: false,
        },
      ],
    },
    context = { settings, pace, membershipRevision: 1 };
  ui.clearDungeonPace();
  ui.renderDungeonPace(context, () => {});
  const field = document.getElementById('dungeon-group-speed');
  field.value = '12';
  assert.equal(ui.dungeonPaceDirty(), true);
  const submitted = ui.dungeonPaceDraft().settings;
  field.value = '24';
  const next = { ...context, settings: { ...submitted, revision: 1 } };
  ui.acceptDungeonPace(submitted, next);
  ui.renderDungeonPace(next, () => {});
  assert.equal(field.value, '24');
  assert.equal(ui.dungeonPaceDraft().settings.revision, 1);
  assert.equal(ui.dungeonPaceDirty(), true);
  const foreign = {
    ...next,
    settings: { ...next.settings, revision: 2, groupMetersPerMinute: 36 },
  };
  ui.renderDungeonPace(foreign, () => {});
  assert.equal(field.value, '24');
  assert.equal(
    ui.dungeonPaceDraft().settings.revision,
    1,
    'foreign revision cannot authorize an old draft',
  );
  ui.renderDungeonPace(foreign, () => {}, true);
  assert.equal(field.value, '36');
  assert.equal(ui.dungeonPaceDirty(), false);
  ui.clearDungeonPace();
  assert.equal(ui.dungeonPaceDirty(), false);
});

for (const field of ['group', 'member', 'exclude'])
  test(`acknowledged ${field} setting retains a newer return to the original input until explicitly saved`, async (t) => {
    const x = fixture(t),
      geometry = x.store.drawing(x.w.token),
      live = x.store.live(x.w.token),
      { parseHTML } = await import('linkedom'),
      { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
      previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document });
    t.after(() => Object.assign(globalThis, previous));
    Object.defineProperty(document.getElementById('dungeon-movement'), 'value', {
      writable: true,
      value: 'walk',
    });
    const ui = createRequire(import.meta.url)('../.build/dungeon-pace-ui.cjs');
    ui.clearDungeonPace();
    ui.renderDungeonPace(x.view().travelPace, () => {});
    const row = [...document.querySelectorAll('#dungeon-pace-members [data-character-id]')].find(
        (r) => r.dataset.characterId === x.ids[1],
      ),
      input =
        field === 'group'
          ? document.getElementById('dungeon-group-speed')
          : row.querySelector(field === 'member' ? 'input[type=number]' : 'input[type=checkbox]');
    const edit = (value) => {
        if (field === 'exclude') input.checked = value;
        else input.value = value;
      },
      original = field === 'exclude' ? true : '';
    edit(field === 'exclude' ? false : '12');
    const submitted = ui.dungeonPaceDraft(),
      ack = x.run({ kind: 'pace-settings', sceneId: x.scene.id, ...submitted });
    edit(original);
    ui.acceptDungeonPace(submitted.settings, ack.travelPace);
    ui.renderDungeonPace(ack.travelPace, () => {});
    assert.equal(field === 'exclude' ? input.checked : input.value, original);
    assert.equal(input.isConnected, true, 'do not replace newer input nodes');
    assert.equal(
      ui.dungeonPaceDirty(),
      true,
      'the original input now differs from the acknowledged setting',
    );
    assert.equal(ui.dungeonPaceDraft().settings.revision, 1);
    assert.equal(
      document.getElementById('dungeon-speed').value,
      String(ack.travelPace.pace.metersPerMinute),
      'confirmed effective speed updates while draft remains open',
    );
    ui.renderDungeonPace(x.view().travelPace, () => {});
    assert.equal(field === 'exclude' ? input.checked : input.value, original);
    assert.equal(ui.dungeonPaceDirty(), true);
    const desired = ui.dungeonPaceDraft();
    assert.equal(desired.settings.groupMetersPerMinute, null);
    assert.deepEqual(desired.settings.members, []);
    const latest = x.run({ kind: 'pace-settings', sceneId: x.scene.id, ...desired });
    ui.acceptDungeonPace(desired.settings, latest.travelPace);
    ui.renderDungeonPace(latest.travelPace, () => {});
    assert.equal(ui.dungeonPaceDirty(), false);
    assert.equal(x.view().travelPace.settings.revision, 2);
    assert.equal(x.view().travelPace.settings.groupMetersPerMinute, null);
    assert.deepEqual(x.view().travelPace.settings.members, []);
    assert.deepEqual(x.store.drawing(x.w.token), geometry);
    assert.deepEqual(x.store.live(x.w.token), live);
    const fresh = new CampaignStore(x.file);
    try {
      const w = fresh.activate(x.cam.id);
      assert.deepEqual(fresh.dungeon(w.token).travelPace, latest.travelPace);
    } finally {
      fresh.close();
    }
  });

buildSync({
  entryPoints: ['src/app/dungeon-ui.ts'],
  outfile: '.build/dungeon-pace-panel.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
async function panel(t) {
  const x = fixture(t),
    { parseHTML } = await import('linkedom'),
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document, Event: window.Event });
  t.after(() => Object.assign(globalThis, previous));
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', {
      configurable: true,
      writable: true,
      value: select.options[0]?.value ?? '',
    });
  const statuses = [],
    sent = [],
    tick = () => new Promise((r) => setImmediate(r));
  const until = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (predicate()) return;
      await tick();
    }
    throw Error('Dungeon panel did not settle');
  };
  window.campaign = {
    dungeon: async () => ({ ok: true, value: x.view() }),
    previewDungeon: async (token, request) => ({
      ok: true,
      value: x.store.previewDungeon(token, request),
    }),
    executeDungeon: async (command) => {
      sent.push(command);
      return { ok: true, value: x.store.executeDungeon(command) };
    },
  };
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve('../.build/dungeon-pace-panel.cjs')];
  const ui = require('../.build/dungeon-pace-panel.cjs');
  ui.initDungeon((message) => statuses.push(message));
  ui.activateDungeon(x.w);
  await ui.openDungeon();
  const get = (id) => document.getElementById(id);
  return { ...x, window, ui, get, statuses, sent, tick, until };
}
for (const mismatch of ['destination', 'scene', 'movement', 'factor', 'duration', 'pace-source'])
  test(`Dungeon preview rejects a response for different ${mismatch} before any journey is confirmed`, async (t) => {
    const x = await panel(t),
      original = x.window.campaign.previewDungeon,
      before = x.store.db.serialize();
    x.get('dungeon-plan').click();
    await x.until(() => !x.get('dungeon-confirm').disabled);
    x.window.campaign.previewDungeon = async (token, request) => {
      const changed = structuredClone(request);
      if (mismatch === 'destination') changed.destination.x += 1.524;
      if (mismatch === 'scene') {
        const response = await original(token, request);
        response.value.request.sceneId = 'other-scene';
        return response;
      }
      if (mismatch === 'movement') {
        changed.useGroupPace = false;
        changed.movement = 'crawl';
      }
      if (mismatch === 'factor') changed.factor = 2;
      if (mismatch === 'duration') changed.finalSeconds = 100;
      if (mismatch === 'pace-source') changed.useGroupPace = false;
      return original(token, changed);
    };
    x.get('dungeon-plan').click();
    await x.until(() => x.get('dungeon-confirm').disabled === false || x.statuses.length > 0);
    assert.equal(x.get('dungeon-confirm').disabled, true);
    assert.equal(x.ui.atlasDungeonState().preview, null);
    assert.match(x.statuses.at(-1), /angefragten Dungeonreise/);
    assert.equal(x.sent.length, 0);
    assert.ok(x.store.db.serialize().equals(before));
    x.window.campaign.previewDungeon = original;
    x.get('dungeon-plan').click();
    await x.until(() => !x.get('dungeon-confirm').disabled);
    x.get('dungeon-confirm').click();
    await x.until(() => x.sent.length === 1);
    await x.ui.flushDungeon();
    assert.equal(x.sent[0].action.kind, 'journey');
    assert.deepEqual(x.view().journey.request.destination, x.ui.atlasDungeonState().target);
    assert.equal(x.view().instantMs, '0');
  });
test('Dungeon preview accepts provider group speed and reordered keys, but drops a delayed response after a target edit', async (t) => {
  const x = await panel(t),
    original = x.window.campaign.previewDungeon,
    before = x.store.db.serialize();
  let release;
  x.get('dungeon-speed').value = '999';
  x.window.campaign.previewDungeon = async (token, request) => {
    const result = await original(token, request);
    result.value.request = Object.fromEntries(Object.entries(result.value.request).reverse());
    return result;
  };
  x.get('dungeon-plan').click();
  await x.until(() => !x.get('dungeon-confirm').disabled);
  assert.equal(x.ui.atlasDungeonState().preview.request.speedMetersPerMinute, 60.96);
  assert.equal(x.sent.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
  x.get('dungeon-refresh').click();
  await x.ui.flushDungeon();
  x.window.campaign.previewDungeon = async (token, request) => {
    const result = await original(token, request);
    return new Promise((r) => (release = () => r(result)));
  };
  x.get('dungeon-plan').click();
  await x.until(() => !!release);
  x.get('dungeon-height-step').value = '1';
  x.get('dungeon-height-step').oninput();
  release();
  await x.ui.flushDungeon();
  assert.equal(x.get('dungeon-confirm').disabled, true);
  assert.equal(x.ui.atlasDungeonState().preview, null);
  assert.equal(x.sent.length, 0);
  assert.ok(x.store.db.serialize().equals(before));
});
test('replacing a Dungeon preview immediately notifies the shared Atlas that it can no longer start', async (t) => {
  const x = await panel(t);
  x.get('dungeon-plan').click();
  await x.until(() => !x.get('dungeon-confirm').disabled);
  let cleared = false,
    release;
  x.window.document.addEventListener('atlas-runtime', () => {
    if (x.ui.atlasDungeonState().preview === null) cleared = true;
  });
  const original = x.window.campaign.previewDungeon;
  x.window.campaign.previewDungeon = async (...args) => {
    const result = await original(...args);
    return new Promise((r) => (release = () => r(result)));
  };
  x.get('dungeon-plan').click();
  await x.until(() => !!release);
  const announced = cleared;
  release();
  await x.ui.flushDungeon();
  assert.equal(announced, true);
  assert.equal(x.sent.length, 0);
});

buildSync({
  entryPoints: ['src/app/dungeon-travel-console.ts'],
  outfile: '.build/dungeon-console-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
test('the actual Dungeon controls work beside the Scene with room text, exact pose, rounds and retained perception', async (t) => {
  const x = await panel(t),
    { mountDungeonTravelConsole } = createRequire(import.meta.url)(
      '../.build/dungeon-console-ui.cjs',
    );
  const host = document.createElement('section');
  document.body.append(host);
  const original = x.get('dungeon-plan');
  mountDungeonTravelConsole(host);
  mountDungeonTravelConsole(host);
  await x.ui.openDungeon();
  assert.equal(host.querySelectorAll('#dungeon-travel-console').length, 1);
  assert.equal(host.querySelector('#dungeon-plan'), original);
  assert.equal(x.get('dungeon-travel-decisions').contains(original), true);
  assert.equal(x.get('dungeon-travel-settings').contains(original), false);
  assert.equal(x.get('dungeon').children.length, 0);
  assert.match(x.get('dungeon-position-facts').textContent, /2,?\.?29|2\.29/);
  assert.match(x.get('dungeon-position-facts').textContent, /Ada, Borin/);
  assert.match(x.get('dungeon-key-description').textContent, /Autorentext/);
  x.get('dungeon').hidden = true;
  host.hidden = false;
  x.get('dungeon-round-seconds').value = '17';
  x.get('dungeon-round-seconds').oninput();
  x.get('dungeon-pace-save').click();
  await x.until(() => x.sent.length === 1);
  await x.ui.flushDungeon();
  assert.equal(x.view().travelPace.settings.explorationRoundSeconds, 17);
  x.get('dungeon-sense-score').value = '18';
  x.get('dungeon-active-score').click();
  await x.until(() => x.sent.length === 2);
  await x.ui.flushDungeon();
  assert.equal(x.view().senses.settings.activeScore, 18);
  await x.ui.openDungeon();
  assert.equal(x.get('dungeon-sense-score').value, '18');
  assert.equal(x.get('dungeon-travel-controls').inert, false);
  x.get('dungeon-plan').click();
  await x.until(() => !x.get('dungeon-confirm').disabled);
  x.get('dungeon-confirm').click();
  await x.until(() => x.sent.length === 3);
  await x.ui.flushDungeon();
  assert.ok(x.view().journey);
  const before = x.view().instantMs;
  x.get('dungeon-place').click();
  await x.until(() => x.sent.length === 4);
  await x.ui.flushDungeon();
  assert.equal(x.view().instantMs, before, 'explicit placement adds no time');
  assert.match(x.get('dungeon-position-facts').textContent, /22\.86/);
  await x.ui.atlasDungeonTarget(x.room.id, { x: 41.91, y: 2.286 });
  assert.match(x.get('dungeon-target').textContent, /41\.91, 2\.29/);
  x.get('dungeon-plan').click();
  await x.until(() => !x.get('dungeon-confirm').disabled);
  assert.equal(x.ui.atlasDungeonState().preview.request.destination.x, 41.91);
  assert.equal(document.getElementById('dungeon-map'), null);
  x.get('dungeon-confirm').click();
  await x.until(() => x.sent.length === 5);
  await x.ui.flushDungeon();
  assert.equal(x.view().journey.request.destination.x, 41.91);
});

test('a delayed or changed live focus revokes old Dungeon commands and preserves pending settings until discard', async (t) => {
  const x = await panel(t),
    { mountDungeonTravelConsole } = createRequire(import.meta.url)(
      '../.build/dungeon-console-ui.cjs',
    );
  const host = document.createElement('div');
  document.body.append(host);
  mountDungeonTravelConsole(host);
  await x.ui.openDungeon();
  let reads = 0;
  const originalRead = x.window.campaign.dungeon;
  x.window.campaign.dungeon = async (...args) => {
    reads++;
    return originalRead(...args);
  };
  host.hidden = true;
  x.ui.syncDungeonLiveContext(x.w.token, 'hidden-scene');
  await x.tick();
  assert.equal(reads, 0, 'a hidden travel console must not load all Dungeon data on Live focus');
  host.hidden = false;
  x.get('dungeon-group-speed').value = '12';
  assert.equal(await x.ui.flushDungeon(), false);
  let v = x.store.live(x.w.token),
    scene = x.store.liveScene(x.w.token, x.scene.id);
  const next = x.store.executeLive(
    x.command({
      kind: 'move',
      sceneId: scene.id,
      expectedRosterRevision: v.rosterRevision,
      expectedFocusRevision: v.focusRevision,
      expectedClockRevision: scene.clock.revision,
      expectedSceneMembershipRevision: scene.membershipRevision,
      memberIds: [x.ids[1]],
      target: { kind: 'new', title: 'Nachhut', expectedContentRevision: scene.revision },
    }),
  ).session.createdScene;
  x.store.executeLive(
    x.command({
      kind: 'focus',
      sceneId: next.id,
      expectedRevision: x.store.live(x.w.token).focusRevision,
    }),
  );
  const old = x.view(),
    real = x.window.campaign.dungeon;
  let release;
  x.window.campaign.dungeon = () => new Promise((r) => (release = r));
  x.ui.syncDungeonLiveContext(x.w.token, next.id);
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  x.get('dungeon-place').click();
  await x.tick();
  assert.equal(x.sent.length, 0);
  release({ ok: true, value: old });
  await x.until(() => x.get('dungeon-read-status').textContent.includes('verwerfen'));
  assert.equal(x.get('dungeon-group-speed').value, '12');
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  x.window.campaign.dungeon = real;
  x.get('dungeon-input-discard').click();
  await x.until(() => x.get('dungeon-travel-controls').inert === false);
  assert.equal(x.ui.atlasDungeonState().data.sceneId, next.id);
  assert.equal(x.get('dungeon-group-speed').value, '');
  assert.equal(x.sent.length, 0);
});

test('Dungeon route rendering retains its last checkpoint and hides ended or unrelated journeys', () => {
  const { dungeonTravelRoute } = createRequire(import.meta.url)('../.build/dungeon-console-ui.cjs'),
    route = [{ x: 1 }, { x: 2 }, { x: 3 }],
    j = { request: { sceneId: 'scene' }, route, nextIndex: 2, status: 'active' };
  assert.deepEqual(dungeonTravelRoute(j, null, 'scene'), route.slice(1));
  j.status = 'decision';
  assert.deepEqual(dungeonTravelRoute(j, null, 'scene'), route.slice(1));
  j.status = 'ended';
  assert.deepEqual(dungeonTravelRoute(j, null, 'scene'), []);
  j.status = 'arrived';
  assert.deepEqual(dungeonTravelRoute(j, null, 'scene'), []);
  j.status = 'active';
  assert.deepEqual(dungeonTravelRoute(j, null, 'other'), []);
  assert.deepEqual(dungeonTravelRoute(null, { request: { sceneId: 'other' }, route }, 'scene'), []);
});

async function lostDungeonRound(t, applied = true) {
  const x = await panel(t),
    { mountDungeonTravelConsole } = createRequire(import.meta.url)(
      '../.build/dungeon-console-ui.cjs',
    ),
    host = document.createElement('section');
  document.body.append(host);
  mountDungeonTravelConsole(host);
  await x.ui.openDungeon();
  x.get('dungeon-round-seconds').value = '60';
  x.get('dungeon-pace-save').click();
  await x.ui.flushDungeon();
  x.get('dungeon-duration').value = '6000';
  x.get('dungeon-plan').click();
  await x.until(() => !x.get('dungeon-confirm').disabled);
  x.get('dungeon-confirm').click();
  await x.ui.flushDungeon();
  const write = x.window.campaign.executeDungeon,
    queries = [];
  let lost;
  x.window.campaign.executeDungeon = async (c) => {
    if (c.action.kind === 'round' && !lost) {
      lost = structuredClone(c);
      if (applied) await write(c);
      throw Error('Verlorene Rundenantwort');
    }
    return write(c);
  };
  x.window.campaign.dungeonCommandState = async (c) => {
    queries.push(structuredClone(c));
    return { ok: true, value: x.store.dungeonCommandState(c) };
  };
  x.get('dungeon-round-step').click();
  await x.until(() => x.statuses.some((s) => s.includes('Verlorene Rundenantwort')));
  await x.tick();
  return { ...x, queries, lost: () => lost };
}
test('a lost Dungeon round blocks subsequent writes and leaving until its original receipt is checked without replay', async (t) => {
  const x = await lostDungeonRound(t),
    saved = x.store.db.serialize(),
    writes = x.sent.length;
  assert.equal(x.view().instantMs, '60000');
  assert.equal(await x.ui.flushDungeon(), false);
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  assert.equal(x.get('dungeon-reconcile').hidden, false);
  x.get('dungeon-round-step').click();
  x.get('dungeon-place').click();
  await x.tick();
  assert.equal(x.sent.length, writes);
  assert.deepEqual(x.store.db.serialize(), saved);
  x.get('dungeon-reconcile').click();
  await x.until(() => x.get('dungeon-reconcile').hidden);
  assert.deepEqual(x.queries, [x.lost()]);
  assert.equal(x.sent.length, writes);
  assert.deepEqual(x.store.db.serialize(), saved);
  assert.match(x.get('dungeon-context').textContent, /bestätigte Zeit 1 min/);
  assert.equal(x.ui.atlasDungeonState().data.journey.segmentElapsedSeconds, 60);
  assert.equal(await x.ui.flushDungeon(), true);
});

test('an unsent Dungeon round is identified read-only and requires a new explicit action', async (t) => {
  const x = await lostDungeonRound(t, false),
    before = x.store.db.serialize();
  assert.equal(x.view().instantMs, '0');
  x.get('dungeon-reconcile').click();
  await x.until(() => x.get('dungeon-reconcile').hidden);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.match(x.statuses.at(-1), /nicht gespeichert/);
  assert.equal(x.queries.length, 1);
  assert.equal(x.sent.filter((c) => c.action.kind === 'round').length, 0);
  x.get('dungeon-round-step').click();
  await x.until(() => x.view().instantMs === '60000');
  await x.ui.flushDungeon();
  assert.equal(x.sent.filter((c) => c.action.kind === 'round').length, 1);
  assert.notEqual(x.sent.at(-1).commandId, x.lost().commandId);
});
test('failed status reads retain the original Dungeon command and never retry or unblock on their own', async (t) => {
  const x = await lostDungeonRound(t),
    read = x.window.campaign.dungeonCommandState,
    saved = x.store.db.serialize(),
    writes = x.sent.length;
  let queries = 0;
  x.window.campaign.dungeonCommandState = async () => {
    queries++;
    throw Error('Status offline');
  };
  x.get('dungeon-reconcile').click();
  await x.until(() => x.statuses.at(-1)?.includes('Status offline'));
  await x.tick();
  assert.equal(x.get('dungeon-reconcile').hidden, false);
  assert.equal(await x.ui.flushDungeon(), false);
  assert.equal(queries, 1);
  assert.equal(x.sent.length, writes);
  assert.deepEqual(x.store.db.serialize(), saved);
  x.window.campaign.dungeonCommandState = read;
  x.get('dungeon-reconcile').click();
  await x.until(() => x.get('dungeon-reconcile').hidden);
  assert.deepEqual(x.queries, [x.lost()]);
  assert.equal(x.sent.length, writes);
});
test('a confirmed receipt survives a failed view read and later refresh preserves newer pace input', async (t) => {
  const x = await lostDungeonRound(t),
    read = x.window.campaign.dungeon,
    writes = x.sent.length,
    saved = x.store.db.serialize();
  x.get('dungeon-group-speed').value = '12';
  x.get('dungeon-group-speed').oninput();
  x.window.campaign.dungeon = async () => ({
    ok: false,
    error: 'Lesestand vorübergehend nicht verfügbar',
  });
  x.get('dungeon-reconcile').click();
  await x.until(() => x.statuses.at(-1)?.includes('Speicherung bestätigt'));
  assert.equal(x.queries.length, 1);
  assert.equal(x.get('dungeon-group-speed').value, '12');
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  x.window.campaign.dungeon = read;
  x.get('dungeon-reconcile').click();
  await x.until(() => x.get('dungeon-reconcile').hidden);
  assert.equal(x.queries.length, 1, 'known outcome needs only the failed view read again');
  assert.equal(x.get('dungeon-group-speed').value, '12');
  assert.equal(await x.ui.flushDungeon(), false, 'newer settings remain an explicit draft');
  assert.equal(x.sent.length, writes);
  assert.deepEqual(x.store.db.serialize(), saved);
});
test('a conflicting Dungeon receipt remains blocked, and a late answer cannot repaint another campaign', async (t) => {
  const x = await lostDungeonRound(t),
    saved = x.store.db.serialize();
  x.window.campaign.dungeonCommandState = async () => ({
    ok: true,
    value: { outcome: 'conflict' },
  });
  x.get('dungeon-reconcile').click();
  await x.until(() => x.statuses.at(-1)?.includes('anderem Inhalt'));
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  assert.equal(x.get('dungeon-reconcile').hidden, false);
  assert.deepEqual(x.store.db.serialize(), saved);
  let release;
  x.window.campaign.dungeonCommandState = () => new Promise((r) => (release = r));
  x.get('dungeon-reconcile').click();
  await x.until(() => !!release);
  x.ui.activateDungeon({ ...x.w, token: 'other-campaign' });
  release({ ok: true, value: { outcome: 'applied' } });
  await x.tick();
  assert.equal(x.ui.atlasDungeonState().data, null);
  assert.equal(x.get('dungeon-reconcile').hidden, true);
  assert.deepEqual(x.store.db.serialize(), saved);
});
test('Dungeon command outcome uses the original receipt fingerprint without parsing the travel world or writing data', (t) => {
  const x = fixture(t),
    view = x.view(),
    c = x.command({
      kind: 'place',
      sceneId: x.scene.id,
      expectedPositionRevision: view.positionRevision,
      pose: view.position,
    }),
    before = x.store.db.serialize();
  assert.deepEqual(x.store.dungeonCommandState(c), { outcome: 'not-applied' });
  assert.deepEqual(x.store.db.serialize(), before);
  x.store.executeDungeon(c);
  const saved = x.store.db.serialize();
  assert.deepEqual(x.store.dungeonCommandState(c), { outcome: 'applied' });
  assert.deepEqual(x.store.dungeonCommandState({ ...c, action: { ...c.action, pose: null } }), {
    outcome: 'conflict',
  });
  assert.deepEqual(x.store.db.serialize(), saved);
  assert.throws(() => x.store.dungeonCommandState({ ...c, token: 'stale' }));
  assert.deepEqual(x.store.db.serialize(), saved);
  x.store.db
    .prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(x.cam.id, 'bad-trace', null, null, 'local', 'ground', 'epoch', '0', '{}', 'broken');
  const damaged = x.store.db.serialize();
  assert.throws(() => x.view());
  assert.deepEqual(x.store.dungeonCommandState(c), { outcome: 'applied' });
  assert.deepEqual(x.store.db.serialize(), damaged);
});

for (const intervening of [false, true])
  test(
    'lost pace acknowledgement preserves newer input ' +
      (intervening ? 'without adopting a later foreign revision' : 'on its own confirmed revision'),
    async (t) => {
      const x = await panel(t),
        write = x.window.campaign.executeDungeon;
      let lost, release;
      x.window.campaign.executeDungeon = async (c) => {
        lost = structuredClone(c);
        await write(c);
        await new Promise((r) => (release = r));
        throw Error('Tempoantwort verloren');
      };
      x.window.campaign.dungeonCommandState = async (c) => ({
        ok: true,
        value: x.store.dungeonCommandState(c),
      });
      x.get('dungeon-group-speed').value = '12';
      x.get('dungeon-pace-save').click();
      await x.until(() => !!release);
      x.get('dungeon-group-speed').value = '18';
      release();
      await x.until(() => x.statuses.at(-1)?.includes('Tempoantwort verloren'));
      await x.tick();
      if (intervening) x.save({ groupMetersPerMinute: 24 });
      const saved = x.store.db.serialize();
      x.get('dungeon-reconcile').click();
      await x.until(() => x.get('dungeon-reconcile').hidden);
      assert.equal(x.get('dungeon-group-speed').value, '18');
      assert.equal(await x.ui.flushDungeon(), false);
      assert.deepEqual(x.store.db.serialize(), saved);
      x.window.campaign.executeDungeon = async (c) => {
        try {
          return await write(c);
        } catch (e) {
          return { ok: false, error: e.message };
        }
      };
      x.get('dungeon-pace-save').click();
      await x.tick();
      await x.tick();
      if (intervening) {
        assert.deepEqual(x.store.db.serialize(), saved);
        assert.equal(x.view().travelPace.settings.groupMetersPerMinute, 24);
        assert.equal(x.get('dungeon-group-speed').value, '18');
      } else {
        assert.equal(x.view().travelPace.settings.groupMetersPerMinute, 18);
        assert.equal(x.view().travelPace.settings.revision, lost.action.settings.revision + 2);
        assert.equal(await x.ui.flushDungeon(), true);
      }
    },
  );

function focusDungeonRearGroup(x) {
  const v = x.store.live(x.w.token),
    scene = x.store.liveScene(x.w.token, x.scene.id),
    next = x.store.executeLive(
      x.command({
        kind: 'move',
        sceneId: scene.id,
        expectedRosterRevision: v.rosterRevision,
        expectedFocusRevision: v.focusRevision,
        expectedClockRevision: scene.clock.revision,
        expectedSceneMembershipRevision: scene.membershipRevision,
        memberIds: [x.ids[1]],
        target: { kind: 'new', title: 'Nachhut', expectedContentRevision: scene.revision },
      }),
    ).session.createdScene;
  x.store.executeLive(
    x.command({
      kind: 'focus',
      sceneId: next.id,
      expectedRevision: x.store.live(x.w.token).focusRevision,
    }),
  );
  return next;
}
test('reconciliation after a focus change retains old-group drafts and requires explicit discard before new-group writes', async (t) => {
  const x = await lostDungeonRound(t);
  x.get('dungeon-group-speed').value = '12';
  const next = focusDungeonRearGroup(x),
    saved = x.store.db.serialize();
  x.ui.syncDungeonLiveContext(x.w.token, next.id);
  x.get('dungeon-reconcile').click();
  await x.until(() => x.get('dungeon-reconcile').hidden);
  await x.tick();
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  assert.equal(x.get('dungeon-group-speed').value, '12');
  assert.equal(await x.ui.flushDungeon(), false);
  assert.deepEqual(x.store.db.serialize(), saved);
  x.get('dungeon-input-discard').click();
  await x.until(() => x.get('dungeon-travel-controls').inert === false);
  assert.equal(x.ui.atlasDungeonState().data.sceneId, next.id);
  assert.equal(x.get('dungeon-group-speed').value, '');
  assert.deepEqual(x.store.db.serialize(), saved);
});
test('a successful command reply for a changed focus cannot leave old-group commands enabled', async (t) => {
  const x = await panel(t),
    write = x.window.campaign.executeDungeon,
    { mountDungeonTravelConsole } = createRequire(import.meta.url)(
      '../.build/dungeon-console-ui.cjs',
    ),
    host = document.createElement('section');
  document.body.append(host);
  mountDungeonTravelConsole(host);
  await x.ui.openDungeon();
  let next;
  x.window.campaign.executeDungeon = async (c) => {
    await write(c);
    next = focusDungeonRearGroup(x);
    return { ok: true, value: x.view() };
  };
  x.get('dungeon-group-speed').value = '12';
  x.get('dungeon-pace-save').click();
  await x.until(() => !!next);
  await x.tick();
  assert.equal(x.get('dungeon-travel-controls').inert, true);
  assert.equal(x.get('dungeon-group-speed').value, '12');
  assert.equal(x.ui.atlasDungeonState().data.sceneId, x.scene.id);
});
