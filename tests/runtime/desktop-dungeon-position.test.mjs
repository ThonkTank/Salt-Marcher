import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/dungeon-position-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/dungeon-position-store.cjs'),
  u = 1.524;
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'dungeon-position-')),
    file = path.join(root, 'campaign.sqlite'),
    store = new CampaignStore(file),
    room = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Wachraum',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 8 * u, y: 0 },
            { x: 8 * u, y: 4 * u },
            { x: 0, y: 4 * u },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Geschützte Autorenprosa\r\n' }],
    },
    cam = store.create('Platzierung und Bewegung', [room]),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action }),
    run = (action) => store.executeDungeon(command(action));
  t.after(() => {
    store.close();
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
  const hero = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri' } }),
  ).character;
  store.executeLive(
    command({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: hero.membershipRevision,
      expectedRosterRevision: store.live(w.token).rosterRevision,
      active: true,
      targetSceneId: null,
      expectedFocusRevision: null,
    }),
  );
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const pv = store.playerView(w.token);
  store.executePlayer({
    ...command({
      kind: 'settings',
      settings: {
        blank: false,
        mode: 'follow',
        imageId: null,
        title: '',
        labels: false,
        light: 'daylight',
        displayId: null,
        fullscreen: false,
      },
    }),
    expectedRevision: pv.settings.revision,
    expectedFocusId: pv.focusId,
    expectedFocusRevision: pv.focusRevision,
    expectedFocusMembershipRevision: pv.focusMembershipRevision,
    expectedFocusLocationId: pv.focusLocationId,
  });
  const volume = store.drawing(w.token).volumes.find((v) => v.roomId === room.id),
    feature = {
      id: randomUUID(),
      revision: 0,
      scopeId: 'local',
      floorId: 'ground',
      roomId: room.id,
      kind: 'feature',
      points: [{ x: 3.5 * u, y: 1.5 * u }],
      name: 'Wachposten',
      notes: '  Privater Encountertext\r\n',
      secret: false,
      color: '#445566',
      width: 1,
      height: 1,
      angle: 0,
      variant: '',
      blocksSight: false,
      blocksSound: false,
      passable: true,
      state: 'open',
      targetRoomId: null,
      targetFloorId: null,
      anchor: null,
      feature: 'encounter',
      maxCharges: 1,
      resetSeconds: 0,
      resetMode: 'empty',
      triggerRadius: 0,
      triggerHeight: 0,
      assetId: null,
      archived: false,
      content: {
        reference: null,
        publicText: '  Sichtbare Wache\r\n',
        categories: [],
        tags: [],
        trapXp: null,
        anchor: { volumeId: volume.id, x: 3, y: 1, z: 0 },
      },
    };
  store.executeDrawing(command({ kind: 'element', element: feature, expectedRevision: null }));
  const secret = {
    ...structuredClone(feature),
    id: randomUUID(),
    name: 'Verborgene Nische',
    feature: 'curiosity',
    secret: true,
    content: {
      ...structuredClone(feature.content),
      search: {
        method: 'Abtasten',
        dc: 5,
        notes: '  Privater Suchhinweis\r\n',
        revealedText: 'Geheimes Fach',
      },
    },
  };
  store.executeDrawing(command({ kind: 'element', element: secret, expectedRevision: null }));
  const origin = {
      scopeId: 'local',
      floorId: 'ground',
      roomId: room.id,
      x: 1.5 * u,
      y: 1.5 * u,
      z: 0,
    },
    destination = { ...origin, x: 5.5 * u },
    current = () => store.dungeon(w.token),
    place = (pose) =>
      run({
        kind: 'place',
        sceneId: scene.id,
        expectedPositionRevision: current().positionRevision,
        pose,
      }),
    plan = () => {
      const preview = store.previewDungeon(w.token, {
        sceneId: scene.id,
        destination,
        speedMetersPerMinute: 18,
        factor: 1,
        finalSeconds: 60,
      });
      run({ kind: 'journey', preview });
      return current().journey;
    },
    signals = () =>
      store.db.prepare('SELECT * FROM dungeon_content_signal WHERE campaign_id=?').all(cam.id);
  return {
    store,
    file,
    room,
    cam,
    w,
    scene,
    feature,
    secret,
    origin,
    destination,
    command,
    run,
    current,
    place,
    plan,
    signals,
  };
}
for (const kind of ['step', 'round'])
  test(
    kind +
      ': free placement opens no encounter event; confirmed movement pauses with exact committed time and position',
    (t) => {
      const x = fixture(t),
        geometry = x.store.drawing(x.w.token);
      x.place(x.origin);
      let v = x.current();
      assert.deepEqual(v.position, x.origin);
      assert.equal(v.instantMs, '0');
      assert.equal(v.journey, null);
      assert.equal(v.tracks.length, 0);
      assert.deepEqual(
        x.signals(),
        [],
        'administrative placement must not activate content events',
      );
      assert.equal(v.contents.find((c) => c.id === x.feature.id).pending, false);
      assert.equal(
        v.contents.find((c) => c.id === x.feature.id).known,
        true,
        'visible public content remains known after free placement',
      );
      assert.equal(v.contents.find((c) => c.id === x.secret.id).known, false);
      assert.equal(v.contents.find((c) => c.id === x.secret.id).pending, false);
      const j = x.plan(),
        step = x.command({
          kind,
          sceneId: x.scene.id,
          id: j.id,
          expectedRevision: j.revision,
          ...(kind === 'round' ? { expectedSettingsRevision: 0 } : { maxSteps: 24 }),
        });
      x.store.executeDungeon(step);
      v = x.current();
      assert.equal(v.journey.status, 'paused');
      assert.equal(v.journey.nextIndex, 1);
      assert.equal(v.instantMs, String(j.segmentSeconds[0] * 1000));
      assert.deepEqual(
        [v.position.x, v.position.y, v.position.z],
        [j.route[0].x, j.route[0].y, j.route[0].z],
      );
      assert.equal(v.contents.find((c) => c.id === x.feature.id).pending, true);
      assert.match(v.journey.reason, /Dungeon-Inhalt/);
      assert.equal(v.contents.find((c) => c.id === x.secret.id).known, false);
      assert.equal(
        v.contents.find((c) => c.id === x.secret.id).pending,
        true,
        'real movement still raises the private search hint without revealing its result',
      );
      const bytes = x.store.db.serialize();
      x.store.executeDungeon(step);
      assert.deepEqual(x.store.db.serialize(), bytes);
      assert.deepEqual(x.store.drawing(x.w.token), geometry);
      const fresh = new CampaignStore(x.file);
      try {
        const w = fresh.activate(x.cam.id);
        assert.deepEqual(fresh.dungeon(w.token), v);
        assert.deepEqual(
          fresh.workspace().rooms.find((r) => r.id === x.room.id).sections,
          x.room.sections,
        );
      } finally {
        fresh.close();
      }
    },
  );
test('free replacement ends the old journey without time, tracks or content events and invalid placement rolls back', (t) => {
  const x = fixture(t);
  x.place(x.origin);
  const j = x.plan(),
    before = x.store.db.serialize();
  assert.throws(() => x.place({ ...x.origin, x: -100 }), /Position|Raum|Volumen/);
  assert.deepEqual(x.store.db.serialize(), before);
  x.place(x.destination);
  const v = x.current();
  assert.deepEqual(v.position, x.destination);
  assert.equal(v.instantMs, '0');
  assert.equal(v.tracks.length, 0);
  assert.deepEqual(x.signals(), []);
  assert.equal(v.journey.id, j.id);
  assert.equal(v.journey.status, 'ended');
  assert.equal(v.journey.nextIndex, 0);
});
