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
  outfile: '.build/planner-session-copy-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)(
  '../../.build/planner-session-copy-store.cjs',
);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'session-copy-integrity-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    campaign = store.create('Quelle'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    }),
    plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Original',
      scenes: ['Erste', 'Zweite'].map((title) => ({
        id: randomUUID(),
        title,
        notes: '  ' + title + '\r\n',
        locationId: null,
      })),
    };
  store.changePreparation({
    ...command(null),
    change: { kind: 'plan', plan, expectedRevision: null },
  });
  const d = store.session(w.token, plan.id).visits[1];
  store.executeSession(
    command({
      kind: 'visit',
      planId: plan.id,
      expectedRevision: d.revision,
      detail: {
        ...d,
        readAloud: '  Öffentlich\r\n',
        reward: { id: randomUUID(), poolXp: 25, items: [], placedTreasureId: null, awarded: false },
      },
    }),
  );
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, w, command, plan };
}
test('selected visit copies preserve authored text, independent rewards and singular receipt replay', (t) => {
  const x = fixture(t),
    source = x.store.session(x.w.token, x.plan.id),
    id = randomUUID(),
    request = x.command({
      kind: 'copy-visits',
      planId: id,
      expectedBasis: null,
      name: 'Kopie',
      sourcePlanId: x.plan.id,
      expectedSourceBasis: source.replacementBasis,
      visitIds: [x.plan.scenes[1].id],
      copyParty: true,
    }),
    copied = x.store.executeSession(request),
    target = x.store.preparation(x.w.token).plans.find((p) => p.id === id);
  assert.equal(target.scenes.length, 1);
  assert.notEqual(target.scenes[0].id, x.plan.scenes[1].id);
  assert.equal(target.scenes[0].notes, x.plan.scenes[1].notes);
  assert.equal(copied.visits[0].readAloud, '  Öffentlich\r\n');
  assert.notEqual(copied.visits[0].reward.id, source.visits[1].reward.id);
  assert.deepEqual(x.store.session(x.w.token, x.plan.id), source);
  const bytes = x.store.db.serialize();
  x.store.executeSession(request);
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('stale source basis causes no partial plan or receipt; append retains existing visits', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    id = randomUUID();
  assert.throws(() =>
    x.store.executeSession(
      x.command({
        kind: 'copy-visits',
        planId: id,
        expectedBasis: null,
        name: 'Veraltet',
        sourcePlanId: x.plan.id,
        expectedSourceBasis: 'old',
        visitIds: [x.plan.scenes[0].id],
        copyParty: false,
      }),
    ),
  );
  assert.ok(x.store.db.serialize().equals(before));
  const source = x.store.session(x.w.token, x.plan.id);
  x.store.executeSession(
    x.command({
      kind: 'copy-visits',
      planId: x.plan.id,
      expectedBasis: source.replacementBasis,
      name: x.plan.name,
      sourcePlanId: x.plan.id,
      expectedSourceBasis: source.replacementBasis,
      visitIds: [x.plan.scenes[1].id],
      copyParty: false,
    }),
  );
  const plan = x.store.preparation(x.w.token).plans.find((p) => p.id === x.plan.id);
  assert.deepEqual(plan.scenes.slice(0, 2), x.plan.scenes);
  assert.equal(plan.scenes.length, 3);
  assert.equal(plan.scenes[2].notes, x.plan.scenes[1].notes);
});
