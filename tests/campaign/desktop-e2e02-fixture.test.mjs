import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fixtureRuntime } from '../../tools/atlas-e2e01-fixture.mjs';
import {
  seedE2E02,
  readE2E02,
  preparationRows,
  recipeHash,
  notes,
} from '../../tools/live-e2e02-fixture.mjs';

const { CampaignStore } = fixtureRuntime();
test('common evening fixture keeps authored sources separate from explicit runtime and receipt replay', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'e2e02-fixture-')),
    fixture = seedE2E02(CampaignStore, directory),
    file = path.join(directory, 'workbench.sqlite'),
    before = readE2E02(file, fixture.a),
    store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  assert.equal(recipeHash, 'f7dd20bba583462898afc2fd0b166303fceff7afe59cf97fc161d36850b6662a');
  assert.deepEqual(before.live_scene, []);
  assert.deepEqual(before.live_state, []);
  assert.equal(before.roster_member.length, 3);
  assert(before.roster_member.every((h) => h.active === 1 && h.scene_id === null));
  assert(before.character_progress.every((h) => JSON.parse(h.payload).xp === 0));
  const plan = JSON.parse(before.encounter_plan[0].payload);
  assert.deepEqual(
    plan.entries.map(({ creatureId, count, grouped }) => ({ creatureId, count, grouped })),
    [
      { creatureId: 'guard', count: 2, grouped: true },
      { creatureId: 'wolf', count: 1, grouped: false },
    ],
  );
  assert(
    plan.sources.every((s) => s.entryType === 'creature' && /^[a-f0-9]{64}$/.test(s.sourceHash)),
  );
  assert.equal(plan.items[0].reference.entryType, 'item');
  assert.equal(JSON.parse(before.planned_visit[0].payload).notes, notes);
  const w = store.activate(fixture.a),
    command = {
      commandId: randomUUID(),
      campaignId: fixture.a,
      token: w.token,
      action: { kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision },
    };
  assert.throws(() =>
    store.executeLive({ ...command, action: { ...command.action, expectedRosterRevision: -1 } }),
  );
  assert.deepEqual(
    readE2E02(file, fixture.a),
    before,
    'Rejected initialize must preserve every inventoried row',
  );
  const ack = store.executeLive(command),
    after = readE2E02(file, fixture.a);
  assert.notEqual(ack.scene.id, fixture.visitId);
  assert.deepEqual(ack.scene.members.slice().sort(), fixture.heroes.map((h) => h.id).sort());
  assert.deepEqual(preparationRows(after), preparationRows(before));
  assert.deepEqual(store.executeLive(command), ack);
  assert.deepEqual(
    readE2E02(file, fixture.a),
    after,
    'Original CommandId replay must not duplicate runtime/receipt',
  );
});
