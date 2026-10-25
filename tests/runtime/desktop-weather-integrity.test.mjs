import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {weatherAt} from './src/app/runtime/world-model';",
    resolveDir: process.cwd(),
    sourcefile: 'weather-integrity.ts',
    loader: 'ts',
  },
  outfile: '.build/weather-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, weatherAt } = createRequire(import.meta.url)(
    '../../.build/weather-integrity.cjs',
  ),
  hash = (s) => createHash('sha256').update(s).digest('hex');
const weather = () => ({
  label: '  Eigener Nebel\r\n',
  kind: 'fog',
  intensity: 0.8,
  windKmh: 17,
  effects: {
    visibilityMeters: 150,
    travelFactor: 1.25,
    perception: '  GM entscheidet.\r\n',
    temperatureC: 8,
    ambience: ['Leiser Wind', ''],
    combatNote: '  Unveränderter Text.\r\n',
  },
  source: 'Eigene Quelle',
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'weather-integrity-')),
    filename = path.join(root, 'store.sqlite'),
    x = { root, filename, store: new CampaignStore(filename) };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Wetter');
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.scene = x.store.executeLive(x.command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  const map = {
    ...x.store.world(x.w.token).maps[0],
    name: 'Region',
    hexMeters: 4828.032,
    climate: 'temperate',
    seed: 'weather-review',
    cells: [],
  };
  x.store.executeWorld(x.command({ kind: 'map', map, expectedRevision: map.revision }));
  x.map = x.store.world(x.w.token).maps[0];
  x.store.executeWorld(
    x.command({
      kind: 'place-scene',
      sceneId: x.scene.id,
      position: { mapId: x.map.id, q: 0, r: 0, locationId: null },
      expectedSceneRevision: x.scene.revision,
      expectedPositionRevision: 0,
    }),
  );
  x.set = (value) =>
    x.store.executeWorld(
      x.command({
        kind: 'weather-override',
        sceneId: x.scene.id,
        expectedClockRevision: x.store.liveScene(x.w.token, x.scene.id).clock.revision,
        expectedOverrideRevision:
          x.store.db
            .prepare(
              "SELECT revision FROM world_record WHERE campaign_id=? AND kind='weather-override' AND id=?",
            )
            .get(x.cam.id, x.scene.id)?.revision ?? null,
        weather: value,
      }),
    );
  x.frame = () => x.store.sceneWorld(x.w.token, x.scene.id);
  return x;
}
for (const damage of [
  'unknown kind',
  'negative wind',
  'non-numeric wind',
  'invalid ambience',
  'invalid perception',
])
  test(`weather writer rejects ${damage} without state, history or receipt effects`, (t) => {
    const x = fixture(t),
      value = weather();
    if (damage === 'unknown kind') value.kind = 'hail';
    if (damage === 'negative wind') value.windKmh = -1;
    if (damage === 'non-numeric wind') value.windKmh = '17';
    if (damage === 'invalid ambience') value.effects.ambience = 'Wind';
    if (damage === 'invalid perception') value.effects.perception = { private: true };
    const bytes = x.store.db.serialize();
    assert.throws(() => x.set(value), /Wetter/i);
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('checksummed invalid weather cannot be read, replace a safe backup or replace a campaign export', async (t) => {
  const x = fixture(t);
  x.set(weather());
  const backup = path.join(x.root, 'safe.sqlite'),
    file = path.join(x.root, 'campaign.sqlite');
  await x.store.backup(backup);
  await x.store.campaignSnapshot(x.w.token, file);
  const safe = readFileSync(backup),
    packageBytes = readFileSync(file),
    row = x.store.db.prepare("SELECT * FROM world_record WHERE kind='weather-override'").get(),
    value = JSON.parse(row.payload);
  value.weather.kind = 'hail';
  const payload = JSON.stringify(value);
  x.store.db
    .prepare('UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?')
    .run(payload, hash(payload), x.cam.id, row.kind, row.id);
  const bytes = x.store.db.serialize();
  assert.throws(x.frame, /Wetter/i);
  assert.throws(() => x.set(weather()), /Wetter/i);
  assert.throws(() => x.set(null), /Wetter/i);
  await assert.rejects(x.store.backup(backup), /Wetter/i);
  await assert.rejects(x.store.campaignSnapshot(x.w.token, file), /Wetter/i);
  assert.ok(bytes.equals(x.store.db.serialize()));
  assert.ok(safe.equals(readFileSync(backup)));
  assert.ok(packageBytes.equals(readFileSync(file)));
});
test('valid override keeps exact GM text through time, campaign switch and Fresh; release resumes automatic weather', (t) => {
  const x = fixture(t),
    value = weather();
  x.set(value);
  const scene = x.store.liveScene(x.w.token, x.scene.id);
  x.store.executeLive(
    x.command({
      kind: 'advance-clock',
      sceneId: scene.id,
      expectedRevision: scene.clock.revision,
      amount: 3,
      unit: 'days',
      calendarVersion: 'relative-v1',
      reason: 'Bestätigte Wetterzeit',
    }),
  );
  assert.deepEqual(x.frame().weather, { ...value, source: 'GM-Override' });
  const other = x.store.create('Andere Kampagne'),
    otherWork = x.store.activate(other.id),
    otherScene = x.store.executeLive({
      commandId: randomUUID(),
      campaignId: other.id,
      token: otherWork.token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene;
  assert.equal(x.store.sceneWorld(otherWork.token, otherScene.id).weather, null);
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  assert.deepEqual(x.frame().weather, { ...value, source: 'GM-Override' });
  x.set(null);
  const frame = x.frame(),
    world = x.store.world(x.w.token);
  assert.deepEqual(
    frame.weather,
    weatherAt(
      world.maps[0],
      frame.position,
      frame.scene.clock.instantMs,
      world.calendar,
      world.phenomena,
    ),
  );
});
test('an override and clock change in one Scene leave the split Scene weather and clock independent', (t) => {
  const x = fixture(t),
    characters = ['Iri', 'Dorn'].map(
      (name) =>
        x.store.executeLive(x.command({ kind: 'create-character', profile: { name } })).character,
    );
  for (const character of characters) {
    const live = x.store.live(x.w.token);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: character.id,
        expectedRevision: character.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: x.scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  const live = x.store.live(x.w.token),
    scene = x.store.liveScene(x.w.token, x.scene.id),
    result = x.store.executeLive(
      x.command({
        kind: 'move',
        sceneId: scene.id,
        memberIds: [characters[1].id],
        expectedRosterRevision: live.rosterRevision,
        expectedFocusRevision: live.focusRevision,
        expectedClockRevision: scene.clock.revision,
        expectedSceneMembershipRevision: scene.membershipRevision,
        target: { kind: 'new', title: 'Andere Gruppe', expectedContentRevision: scene.revision },
      }),
    ),
    split = x.store.liveScene(x.w.token, result.session.createdScene.id);
  x.store.executeWorld(
    x.command({
      kind: 'place-scene',
      sceneId: split.id,
      position: { mapId: x.map.id, q: 0, r: 0, locationId: null },
      expectedSceneRevision: split.revision,
      expectedPositionRevision: x.store.sceneWorld(x.w.token, split.id).position.revision,
    }),
  );
  const before = x.store.sceneWorld(x.w.token, split.id),
    value = weather();
  x.set(value);
  const current = x.store.liveScene(x.w.token, x.scene.id);
  x.store.executeLive(
    x.command({
      kind: 'advance-clock',
      sceneId: current.id,
      expectedRevision: current.clock.revision,
      amount: 3,
      unit: 'days',
      calendarVersion: 'relative-v1',
      reason: 'Nur erste Gruppe',
    }),
  );
  const after = x.store.sceneWorld(x.w.token, split.id);
  assert.deepEqual(after.weather, before.weather);
  assert.deepEqual(after.scene.clock, before.scene.clock);
  assert.deepEqual(x.frame().weather, { ...value, source: 'GM-Override' });
  const second = x.store.liveScene(x.w.token, split.id);
  x.store.executeLive(
    x.command({
      kind: 'advance-clock',
      sceneId: second.id,
      expectedRevision: second.clock.revision,
      amount: 1,
      unit: 'days',
      calendarVersion: 'relative-v1',
      reason: 'Nur zweite Gruppe',
    }),
  );
  const updated = x.store.sceneWorld(x.w.token, split.id),
    world = x.store.world(x.w.token);
  assert.deepEqual(
    updated.weather,
    weatherAt(
      world.maps[0],
      updated.position,
      updated.scene.clock.instantMs,
      world.calendar,
      world.phenomena,
    ),
  );
  assert.deepEqual(x.frame().weather, { ...value, source: 'GM-Override' });
});
for (const operation of ['set', 'release'])
  test(`stale weather ${operation} cannot overwrite a later override at the same Scene clock`, (t) => {
    const x = fixture(t);
    x.set(weather());
    const command = x.command({
      kind: 'weather-override',
      sceneId: x.scene.id,
      expectedClockRevision: 0,
      expectedOverrideRevision: 1,
      weather: operation === 'set' ? { ...weather(), label: 'Veraltete Eingabe' } : null,
    });
    x.set({ ...weather(), label: 'Später bestätigt' });
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.executeWorld(command), /Wetter.*geändert/i);
    assert.ok(bytes.equals(x.store.db.serialize()));
  });
test('an old automatic weather basis cannot overwrite an intervening set and release', (t) => {
  const x = fixture(t),
    command = x.command({
      kind: 'weather-override',
      sceneId: x.scene.id,
      expectedClockRevision: 0,
      expectedOverrideRevision: null,
      weather: weather(),
    });
  x.set(weather());
  x.set(null);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeWorld(command), /Wetter.*geändert/i);
  assert.ok(bytes.equals(x.store.db.serialize()));
});
test('a new weather command without a valid explicit override basis has no effects', (t) => {
  const x = fixture(t);
  for (const expectedOverrideRevision of [undefined, -1, 0, 1.5, '1']) {
    const bytes = x.store.db.serialize();
    assert.throws(
      () =>
        x.store.executeWorld(
          x.command({
            kind: 'weather-override',
            sceneId: x.scene.id,
            expectedClockRevision: 0,
            expectedOverrideRevision,
            weather: weather(),
          }),
        ),
      /Wetter/i,
    );
    assert.ok(bytes.equals(x.store.db.serialize()));
  }
});

test('weather receipt replay after Fresh retains its original acknowledgement without overwriting a later override', (t) => {
  const x = fixture(t),
    command = x.command({
      kind: 'weather-override',
      sceneId: x.scene.id,
      expectedClockRevision: 0,
      expectedOverrideRevision: null,
      weather: weather(),
    }),
    ack = x.store.executeWorld(command);
  x.set({ ...weather(), label: 'Später bestätigt' });
  x.store.close();
  x.store = new CampaignStore(x.filename);
  x.w = x.store.activate(x.cam.id);
  const renewed = { ...command, token: x.w.token },
    bytes = x.store.db.serialize();
  assert.deepEqual(x.store.executeWorld(renewed), ack);
  assert.deepEqual(x.store.reconcileWorld(renewed, x.w.token), { outcome: 'applied', ack });
  assert.ok(bytes.equals(x.store.db.serialize()));
  assert.equal(x.frame().weather.label, 'Später bestätigt');
  assert.equal(x.frame().weatherOverrideRevision, 2);
});

test('GM weather still governs route duration when the reader also returns override metadata', (t) => {
  const x = fixture(t),
    character = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character,
    live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({
      kind: 'membership',
      characterId: character.id,
      expectedRevision: character.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  const value = weather();
  value.effects.travelFactor = 2;
  x.set(value);
  const preview = x.store.previewTravel(x.w.token, {
    sceneId: x.scene.id,
    mapId: x.map.id,
    destination: { q: 1, r: 0 },
    destinationLocationId: null,
    waypoints: [],
    paceKmh: 1,
    factor: 1,
    finalSeconds: null,
  });
  assert.equal(preview.durationSeconds, Math.ceil((x.map.hexMeters / 1000) * 3600 * 2 * 1.2));
  assert.deepEqual(preview.weather, { ...value, source: 'GM-Override' });
});
for (const damage of ['payload revision', 'nonpositive row revision'])
  test(`stored weather rejects ${damage} before normal replacement`, (t) => {
    const x = fixture(t);
    x.set(weather());
    const row = x.store.db
        .prepare("SELECT * FROM world_record WHERE kind='weather-override'")
        .get(),
      value = JSON.parse(row.payload);
    value.revision = damage === 'payload revision' ? 2 : 0;
    const payload = JSON.stringify(value);
    x.store.db
      .prepare(
        'UPDATE world_record SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?',
      )
      .run(
        damage === 'payload revision' ? 1 : 0,
        payload,
        hash(payload),
        x.cam.id,
        row.kind,
        row.id,
      );
    const bytes = x.store.db.serialize();
    assert.throws(x.frame, /Wetter|Weltrevision/i);
    assert.throws(() => x.set(null), /Wetter|Weltrevision/i);
    assert.ok(bytes.equals(x.store.db.serialize()));
  });

test('checksummed weather receipt damage cannot be reconciled as the original saved command', (t) => {
  const x = fixture(t),
    command = x.command({
      kind: 'weather-override',
      sceneId: x.scene.id,
      expectedClockRevision: 0,
      expectedOverrideRevision: null,
      weather: weather(),
    });
  x.store.executeWorld(command);
  const row = x.store.db
      .prepare('SELECT * FROM world_receipt WHERE command_id=?')
      .get(command.commandId),
    ack = JSON.parse(row.payload);
  ack.scene.weather.effects.combatNote = 'Fremde Bestätigung';
  const payload = JSON.stringify(ack);
  x.store.db
    .prepare('UPDATE world_receipt SET payload=?,checksum=? WHERE command_id=?')
    .run(payload, hash(payload), command.commandId);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.reconcileWorld(command, x.w.token), /Weltbestätigung/);
  assert.ok(bytes.equals(x.store.db.serialize()));
});

for (const damage of ['invalid weather', 'damaged checksum'])
  test(
    'unchanged-place scene prose remains durable beside ' +
      damage +
      ' without rewriting world truth',
    (t) => {
      const x = fixture(t);
      x.set(weather());
      const row = x.store.db
          .prepare("SELECT * FROM world_record WHERE campaign_id=? AND kind='weather-override'")
          .get(x.cam.id),
        value = JSON.parse(row.payload);
      value.weather.kind = 'hail';
      const payload = JSON.stringify(value);
      x.store.db
        .prepare(
          'UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?',
        )
        .run(
          payload,
          damage === 'damaged checksum' ? 'broken' : hash(payload),
          x.cam.id,
          row.kind,
          row.id,
        );
      const worldTables = [
          'world_record',
          'scene_position',
          'world_history',
          'world_notice',
          'world_receipt',
        ],
        worldBytes = () =>
          JSON.stringify(
            worldTables.map((table) =>
              x.store.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
            ),
          ),
        beforeWorld = worldBytes(),
        scene = x.store.liveScene(x.w.token, x.scene.id),
        command = x.command({
          kind: 'scene-content',
          sceneId: scene.id,
          expectedRevision: scene.revision,
          title: '  Titel erhalten  ',
          notes: '  Szene bleibt bedienbar.\r\n\nPrivater Text.',
          locationId: scene.locationId,
        });
      assert.throws(x.frame, /Wetter|Weltstand/);
      const ack = x.store.executeLive(command);
      assert.equal(ack.scene.notes, command.action.notes);
      assert.equal(ack.scene.title, command.action.title);
      assert.equal(ack.scene.revision, scene.revision + 1);
      assert.deepEqual(ack.scene.clock, scene.clock);
      assert.equal(worldBytes(), beforeWorld);
      assert.throws(x.frame, /Wetter|Weltstand/);
      const bytes = x.store.db.serialize();
      assert.deepEqual(x.store.executeLive(command), ack);
      assert.ok(x.store.db.serialize().equals(bytes));
      assert.equal(x.store.liveStatus(command, x.w.token).outcome, 'applied');
      const Database = createRequire(import.meta.url)('better-sqlite3'),
        reader = new Database(x.filename, { readonly: true });
      try {
        const saved = reader
          .prepare('SELECT title,notes,revision FROM live_scene WHERE campaign_id=? AND id=?')
          .get(x.cam.id, scene.id);
        assert.deepEqual(saved, {
          title: command.action.title,
          notes: command.action.notes,
          revision: scene.revision + 1,
        });
      } finally {
        reader.close();
      }
    },
  );
test('weather-dependent clock change still rejects damaged weather atomically', (t) => {
  const x = fixture(t);
  x.set(weather());
  x.store.db
    .prepare(
      "UPDATE world_record SET checksum='broken' WHERE campaign_id=? AND kind='weather-override'",
    )
    .run(x.cam.id);
  const scene = x.store.liveScene(x.w.token, x.scene.id),
    before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.executeLive(
        x.command({
          kind: 'advance-clock',
          sceneId: scene.id,
          expectedRevision: scene.clock.revision,
          amount: 1,
          unit: 'hours',
          calendarVersion: 'relative-v1',
          reason: 'Benötigt gültige Wetterfolgen',
        }),
      ),
    /Weltstand|Wetter/,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('scene location changes still synchronize position and invalidate position ABA', (t) => {
  const x = fixture(t),
    document = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Anderer Ort',
      type: 'poi',
      sections: [],
      detailMaps: [],
      keyLinks: [],
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', document, expectedRevision: null },
  });
  x.store.executeWorld(
    x.command({
      kind: 'place',
      mapId: x.map.id,
      locationId: document.id,
      expectedRevision: null,
      hex: { q: 7, r: 2 },
    }),
  );
  const before = x.frame();
  let scene = before.scene;
  const change = (locationId) => {
    const ack = x.store.executeLive(
      x.command({
        kind: 'scene-content',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        title: 'Ort ausdrücklich ändern',
        notes: '  Notiz.\r\n',
        locationId,
      }),
    );
    scene = ack.scene;
    return x.frame();
  };
  const moved = change(document.id);
  assert.equal(moved.position.q, 7);
  assert.equal(moved.position.r, 2);
  assert.equal(moved.position.mapId, x.map.id);
  assert.equal(moved.position.revision, before.position.revision + 1);
  const edited = change(document.id);
  assert.equal(edited.position.revision, moved.position.revision);
  assert.deepEqual(edited.scene.clock, before.scene.clock);
  const returned = change(null);
  assert.equal(returned.position.revision, moved.position.revision + 1);
  assert.equal(returned.position.locationId, null);
  assert.deepEqual(returned.scene.clock, before.scene.clock);
});
