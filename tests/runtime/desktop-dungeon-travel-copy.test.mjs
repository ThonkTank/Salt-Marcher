import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/planner-dungeon-copy.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/planner-dungeon-copy.cjs');
function setup(t, pursuit) {
  const root = mkdtempSync(path.join(tmpdir(), 'dungeon-travel-copy-')),
    file = path.join(root, 'source.sqlite'),
    u = 1.524,
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
            { x: 4 * u, y: 0 },
            { x: 4 * u, y: 3 * u },
            { x: 8 * u, y: 3 * u },
            { x: 8 * u, y: 0 },
            { x: 12 * u, y: 0 },
            { x: 12 * u, y: 6 * u },
            { x: 0, y: 6 * u },
          ],
          holes: [],
        },
      ],
      sections: [
        { id: randomUUID(), kind: 'markdown', markdown: '  Unveränderte Autorenprosa\r\n' },
      ],
    },
    x = { root, file, store: new CampaignStore(file), room };
  t.after(() => {
    x.store.close();
    rmSync(root, { recursive: true, force: true });
  });
  x.cam = x.store.create('Dungeonreise', [room]);
  x.w = x.store.activate(x.cam.id);
  x.command = (action) => ({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action,
  });
  x.draw = (action) => x.store.executeDrawing(x.command(action));
  x.run = (action) => x.store.executeDungeon(x.command(action));
  x.draw({
    kind: 'volume-initialize',
    roomId: room.id,
    expectedRoomRevision: 0,
    expectedVolumeRevision: null,
    heightSteps: 4,
  });
  for (const [name, speedFeet] of [
    ['Ada', 30],
    ['Borin', 20],
  ]) {
    const hero = x.store.executeLive(
        x.command({ kind: 'create-character', profile: { name, speedFeet } }),
      ).character,
      live = x.store.live(x.w.token);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: hero.id,
        expectedRevision: hero.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  x.scene = x.store.executeLive(
    x.command({
      kind: 'initialize',
      expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
    }),
  ).scene;
  x.origin = { scopeId: 'local', floorId: 'ground', roomId: room.id, x: u, y: u, z: 0 };
  x.destination = { ...x.origin, x: 10 * u };
  x.run({ kind: 'place', sceneId: x.scene.id, expectedPositionRevision: 0, pose: x.origin });
  if (pursuit) {
    x.run({
      kind: 'trace-add',
      sceneId: x.scene.id,
      from: x.origin,
      to: x.destination,
      actorId: null,
      sourceKnown: false,
      publicText: '  Krallenspuren\r\n',
      dc: 5,
      strength: 100,
    });
    x.trace = x.store.dungeon(x.w.token).tracks.find((t) => t.publicText === '  Krallenspuren\r\n');
    x.run({
      kind: 'pursue',
      sceneId: x.scene.id,
      traceId: x.trace.id,
      score: 30,
      direction: 'forward',
      skill: 'survival',
    });
  } else {
    x.preview = x.store.previewDungeon(x.w.token, {
      sceneId: x.scene.id,
      destination: x.destination,
      speedMetersPerMinute: 18,
      factor: 1,
      finalSeconds: null,
    });
    x.run({ kind: 'journey', preview: x.preview });
  }
  x.current = () => x.store.dungeon(x.w.token);
  let j = x.current().journey;
  assert.ok(j.route.length >= 3);
  assert.equal(j.actorIds.length, 2);
  x.run({ kind: 'step', sceneId: x.scene.id, id: j.id, expectedRevision: j.revision, maxSteps: 1 });
  j = x.current().journey;
  x.run({
    kind: 'state',
    sceneId: x.scene.id,
    id: j.id,
    expectedRevision: j.revision,
    status: 'paused',
  });
  return x;
}
for (const kind of ['route', 'pursuit', 'stale-geometry', 'stale-volume', 'stale-track'])
  test(
    'independent copy retains ' +
      kind +
      ' travel boundary and only books a valid remaining segment',
    async (t) => {
      const x = setup(t, kind === 'pursuit' || kind === 'stale-track');
      if (kind === 'stale-geometry')
        x.draw({
          kind: 'style',
          expectedRevision: null,
          style: {
            id: x.room.id,
            revision: 1,
            scopeId: 'local',
            ceilingMeters: 4,
            fill: '#ffffff',
            wall: '#111111',
            publicLabel: '',
            secret: false,
          },
        });
      if (kind === 'stale-volume') {
        const view = x.current(),
          room = view.rooms.find((r) => r.id === x.room.id),
          volume = view.drawing.volumes.find((v) => v.roomId === room.id);
        x.draw({
          kind: 'volume-edit',
          roomId: room.id,
          expectedRoomRevision: room.revision,
          expectedVolumeRevision: volume.revision,
          operation: 'floor',
          cells: [{ x: 0, y: 0, z: 0 }],
          enabled: false,
          medium: 'air',
          side: 'north',
        });
        assert.deepEqual(x.current().rooms.find((r) => r.id === room.id).polygons, room.polygons);
      }
      if (kind === 'stale-track')
        x.run({
          kind: 'track-correct',
          id: x.trace.id,
          dc: 5,
          hidden: false,
          publicText: 'Später als GM korrigiert',
        });
      const before = x.current(),
        j = before.journey,
        filename = path.join(x.root, 'campaign.sqlite');
      x.store.close();
      x.store = new CampaignStore(x.file);
      x.w = x.store.activate(x.cam.id);
      assert.deepEqual(x.current(), before);
      await x.store.campaignSnapshot(x.w.token, filename);
      const source = x.store.db.serialize(),
        snapshot = readFileSync(filename),
        copyFile = path.join(x.root, 'copy.sqlite');
      let copy = new CampaignStore(copyFile);
      try {
        const cam = copy.acceptCampaignSnapshot(filename, 'Unabhängige Fortsetzung', {});
        let w = copy.activate(cam.id),
          v = copy.dungeon(w.token),
          sceneId = v.sceneId;
        const command = (action) => ({
          commandId: randomUUID(),
          campaignId: cam.id,
          token: w.token,
          action,
        });
        assert.notEqual(v.journey.id, j.id);
        assert.equal(v.journey.status, 'paused');
        assert.equal(v.journey.nextIndex, j.nextIndex);
        assert.equal(v.instantMs, before.instantMs);
        assert.notEqual(v.position.roomId, before.position.roomId);
        assert.equal(v.position.x, before.position.x);
        assert.deepEqual(v.journey.segmentSeconds, j.segmentSeconds);
        copy.close();
        copy = new CampaignStore(copyFile);
        w = copy.activate(cam.id);
        v = copy.dungeon(w.token);
        copy.executeDungeon(
          command({
            kind: 'state',
            sceneId,
            id: v.journey.id,
            expectedRevision: v.journey.revision,
            status: 'active',
          }),
        );
        v = copy.dungeon(w.token);
        const step = command({
          kind: 'step',
          sceneId,
          id: v.journey.id,
          expectedRevision: v.journey.revision,
          maxSteps: 1,
        });
        copy.executeDungeon(step);
        v = copy.dungeon(w.token);
        if (kind.startsWith('stale')) {
          assert.equal(v.journey.nextIndex, j.nextIndex);
          assert.equal(v.instantMs, before.instantMs);
          assert.equal(v.position.x, before.position.x);
          assert.equal(v.journey.status, kind === 'stale-track' ? 'decision' : 'paused');
        } else {
          assert.equal(v.journey.nextIndex, j.nextIndex + 1);
          assert.equal(
            BigInt(v.instantMs) - BigInt(before.instantMs),
            BigInt(j.segmentSeconds[j.nextIndex]) * 1000n,
          );
          assert.deepEqual(
            [v.position.x, v.position.y, v.position.z],
            [j.route[j.nextIndex].x, j.route[j.nextIndex].y, j.route[j.nextIndex].z],
          );
        }
        const bytes = copy.db.serialize();
        copy.executeDungeon(step);
        assert.ok(copy.db.serialize().equals(bytes));
        if (!kind.startsWith('stale')) {
          assert.deepEqual(copy.live(w.token).scene.members, v.journey.actorIds);
          for (
            let attempt = 0;
            attempt < 10 && !['arrived', 'decision'].includes(v.journey.status);
            attempt++
          ) {
            const current = v.journey;
            if (current.status === 'paused')
              copy.executeDungeon(
                command({
                  kind: 'state',
                  sceneId,
                  id: current.id,
                  expectedRevision: current.revision,
                  status: 'active',
                }),
              );
            v = copy.dungeon(w.token);
            copy.executeDungeon(
              command({
                kind: 'step',
                sceneId,
                id: v.journey.id,
                expectedRevision: v.journey.revision,
                maxSteps: 24,
              }),
            );
            v = copy.dungeon(w.token);
          }
          assert.equal(v.journey.status, kind === 'pursuit' ? 'decision' : 'arrived');
          if (kind === 'pursuit') assert.equal(v.journey.pursuit.state, 'lost');
          assert.equal(
            BigInt(v.instantMs) - BigInt(before.instantMs),
            BigInt(j.segmentSeconds.slice(j.nextIndex).reduce((a, b) => a + b, 0)) * 1000n,
          );
          assert.deepEqual(
            [v.position.x, v.position.y, v.position.z],
            [x.destination.x, x.destination.y, x.destination.z],
          );
        }

        assert.ok(
          copy
            .dungeon(w.token)
            .rooms.some((r) =>
              r.sections.some((s) => s.markdown === '  Unveränderte Autorenprosa\r\n'),
            ),
        );
      } finally {
        copy.close();
      }
      assert.ok(x.store.db.serialize().equals(source));
      assert.ok(readFileSync(filename).equals(snapshot));
    },
  );

test('free GM placement clears the old route heading without time or authored effects, including Fresh', (t) => {
  const x = setup(t, false);
  let v = x.current(),
    j = v.journey;
  x.run({
    kind: 'state',
    sceneId: x.scene.id,
    id: j.id,
    expectedRevision: j.revision,
    status: 'active',
  });
  v = x.current();
  x.run({
    kind: 'step',
    sceneId: x.scene.id,
    id: j.id,
    expectedRevision: v.journey.revision,
    maxSteps: 1,
  });
  v = x.current();
  assert.equal(typeof v.keyHeading, 'number');
  const instant = v.instantMs,
    geometry = x.store.drawing(x.w.token);
  x.run({
    kind: 'place',
    sceneId: x.scene.id,
    expectedPositionRevision: v.positionRevision,
    pose: x.origin,
  });
  v = x.current();
  assert.equal(v.keyHeading, null);
  assert.equal(v.instantMs, instant);
  assert.deepEqual(x.store.drawing(x.w.token), geometry);
  x.store.close();
  x.store = new CampaignStore(x.file);
  x.w = x.store.activate(x.cam.id);
  assert.equal(x.current().keyHeading, null);
  assert.equal(x.current().instantMs, instant);
});
