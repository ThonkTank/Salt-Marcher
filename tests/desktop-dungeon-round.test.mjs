import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildSync } from './helpers/build.mjs';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/dungeon-round-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/dungeon-round-store.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'dungeon-round-')),
    file = path.join(root, 'work.sqlite'),
    store = new CampaignStore(file),
    room = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Gang',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 18, y: 0 },
            { x: 18, y: 6 },
            { x: 0, y: 6 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Originalprosa\r\n' }],
    },
    cam = store.create('Runden', [room]),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const hero = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
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
  const x = { root, file, store, cam, w, room, scene, command };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.view = () => x.store.dungeon(x.w.token);
  x.run = (action) => x.store.executeDungeon({ ...x.command(action), token: x.w.token });
  x.settings = (seconds) => {
    const p = x.view().travelPace;
    return x.run({
      kind: 'pace-settings',
      sceneId: scene.id,
      settings: { ...p.settings, explorationRoundSeconds: seconds },
      expectedMembershipRevision: p.membershipRevision,
    });
  };
  x.round = () => {
    const v = x.view(),
      j = v.journey;
    return {
      kind: 'round',
      sceneId: scene.id,
      id: j.id,
      expectedRevision: j.revision,
      expectedSettingsRevision: v.travelPace.settings.revision,
    };
  };
  x.origin = { scopeId: 'local', floorId: 'ground', roomId: room.id, x: 1, y: 2, z: 0 };
  x.run({ kind: 'place', sceneId: scene.id, expectedPositionRevision: 0, pose: x.origin });
  x.settings(60);
  const preview = store.previewDungeon(w.token, {
    sceneId: scene.id,
    destination: { ...x.origin, x: 16 },
    speedMetersPerMinute: 18,
    factor: 1,
    finalSeconds: 6000,
  });
  x.run({ kind: 'journey', preview });
  return x;
}
test('a round commits partial movement time once, preserves the last reached cell and resumes the exact remainder after restart', (t) => {
  const x = fixture(t),
    before = x.view(),
    drawing = x.store.drawing(x.w.token),
    round = x.command(x.round());
  assert(before.journey.segmentSeconds[0] > 60);
  x.store.executeDungeon(round);
  const after = x.view();
  assert.equal(after.instantMs, '60000');
  assert.equal(after.journey.nextIndex, 0);
  assert.equal(after.journey.segmentElapsedSeconds, 60);
  assert.deepEqual(after.position, before.position);
  assert.equal(after.positionRevision, before.positionRevision);
  assert.equal(after.journey.clockRevision, after.clockRevision);
  const bytes = x.store.db.serialize();
  x.store.executeDungeon(round);
  assert.deepEqual(x.store.db.serialize(), bytes);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.view().journey.segmentElapsedSeconds, 60);
  x.settings(17);
  x.run(x.round());
  assert.equal(x.view().instantMs, '77000');
  assert.equal(x.view().journey.segmentElapsedSeconds, 77);
  let v = x.view();
  while (v.journey.status === 'active') {
    x.run({
      kind: 'step',
      sceneId: x.scene.id,
      id: v.journey.id,
      expectedRevision: v.journey.revision,
      maxSteps: 24,
    });
    v = x.view();
  }
  assert.equal(v.journey.status, 'arrived');
  assert.equal(v.instantMs, '6000000');
  assert.equal(v.journey.segmentElapsedSeconds, undefined);
  assert.equal(v.position.x, 16);
  assert.deepEqual(x.store.drawing(x.w.token), drawing);
});
test('settings guard cannot silently book a different round; navigation pause retains progress', (t) => {
  const x = fixture(t),
    stale = x.round();
  x.settings(300);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.run(stale), /Rundenstand/);
  assert.deepEqual(x.store.db.serialize(), bytes);
  x.run(x.round());
  let j = x.view().journey;
  x.run({
    kind: 'state',
    sceneId: x.scene.id,
    id: j.id,
    expectedRevision: j.revision,
    status: 'paused',
  });
  assert.equal(x.view().journey.segmentElapsedSeconds, 300);
  assert.throws(() => x.run(x.round()), /angehalten/);
  j = x.view().journey;
  x.run({
    kind: 'state',
    sceneId: x.scene.id,
    id: j.id,
    expectedRevision: j.revision,
    status: 'active',
  });
  x.settings(1800);
  x.run(x.round());
  assert.equal(x.view().instantMs, '2100000');
  assert.equal(x.view().journey.status, 'active');
});
test('independent Campaign copy keeps round choice and partial segment without copying clock authority', async (t) => {
  const x = fixture(t);
  x.run(x.round());
  const snapshot = path.join(x.root, 'copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    w = x.store.activate(copy.id),
    v = x.store.dungeon(w.token);
  assert.equal(v.travelPace.settings.explorationRoundSeconds, 60);
  assert.notEqual(v.sceneId, x.scene.id);
  assert.equal(v.journey.segmentElapsedSeconds, 60);
  x.store.executeDungeon({
    commandId: randomUUID(),
    campaignId: copy.id,
    token: w.token,
    action: {
      kind: 'round',
      sceneId: v.sceneId,
      id: v.journey.id,
      expectedRevision: v.journey.revision,
      expectedSettingsRevision: v.travelPace.settings.revision,
    },
  });
  assert.equal(x.store.dungeon(w.token).instantMs, '120000');
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.view().instantMs, '60000');
});
