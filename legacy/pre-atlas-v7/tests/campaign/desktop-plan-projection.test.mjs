import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/plan-projection-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/plan-projection-store.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/plan-projection-'),
    file = root + '/campaign.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Manuell'),
    w = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const command = (change) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    change,
  });
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Hafenspuren',
    scenes: Array.from({ length: 3 }, (_, i) => ({
      id: randomUUID(),
      title: 'Besuch ' + i,
      notes: '  Original ' + i + '\r\n',
      locationId: null,
    })),
  };
  store.changePreparationPlan(command({ kind: 'plan', expectedRevision: null, plan }));
  return { store, file, w, campaign, command, plan };
}
test('plan edit, receipt recovery and session edits do not read or return the world directory at any background size', (t) => {
  const x = fixture(t);
  x.store.preparation = () => {
    throw Error('Global preparation read forbidden');
  };
  let bytes;
  for (const count of [0, 20, 200]) {
    for (let i = 0; i < count; i++)
      x.store.changePreparationContent(
        x.command({
          kind: 'note',
          expectedRevision: null,
          note: {
            version: 1,
            id: randomUUID(),
            revision: 1,
            kind: 'note',
            title: 'Hintergrund',
            readAloud: '',
            gmNotes: 'x'.repeat(5000),
            relations: [],
            creatureId: null,
            deleted: false,
          },
        }),
      );
    const before = x.store.db.prepare('SELECT * FROM world_note ORDER BY id').all();
    const c = x.command({
      kind: 'plan',
      expectedRevision: x.plan.revision,
      plan: { ...x.plan, scenes: [...x.plan.scenes].reverse() },
    });
    const confirmed = x.store.changePreparationPlan(c),
      reply = x.store.reconcilePreparationPlan(c);
    assert.deepEqual(reply, { outcome: 'applied', targetChanged: false, plan: confirmed });
    assert.deepEqual(x.store.changePreparationPlan(c), confirmed);
    const size = JSON.stringify(confirmed).length;
    if (bytes === undefined) bytes = size;
    else assert.equal(size, bytes);
    assert.deepEqual(x.store.db.prepare('SELECT * FROM world_note ORDER BY id').all(), before);
    x.plan = confirmed;
  }
  const session = x.store.session(x.w.token, x.plan.id),
    visit = session.visits.find((v) => v.visitId === x.plan.scenes[0].id);
  const c = {
    commandId: randomUUID(),
    campaignId: x.campaign.id,
    token: x.w.token,
    action: {
      kind: 'scene-planning',
      planId: x.plan.id,
      visitId: x.plan.scenes[0].id,
      expectedPlanRevision: x.plan.revision,
      expectedVisitRevision: visit.revision,
      allocationXp: 50,
    },
  };
  assert.equal(
    x.store.executeSession(c).visits.find((v) => v.visitId === c.action.visitId).allocationXp,
    50,
  );
  assert.equal(x.store.live(x.w.token).scenes.length, 0, 'manual planning requires no Party');
});
test('unapplied, stale and unreadable target recovery are distinct and preserve original bytes', (t) => {
  const x = fixture(t),
    c = x.command({ kind: 'plan', expectedRevision: 1, plan: { ...x.plan, name: 'Geändert' } });
  assert.equal(x.store.reconcilePreparationPlan(c).outcome, 'not-applied');
  const ack = x.store.changePreparationPlan(c);
  x.store.changePreparationPlan(
    x.command({ kind: 'plan', expectedRevision: ack.revision, plan: { ...ack, name: 'Danach' } }),
  );
  assert.equal(x.store.reconcilePreparationPlan(c).targetChanged, true);
  const stale = { ...c, commandId: randomUUID() };
  assert.equal(x.store.reconcilePreparationPlan(stale).outcome, 'conflict');
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.changePreparationPlan(stale), /Plankonflikt/);
  assert(x.store.db.serialize().equals(bytes));
  x.store.db
    .prepare('UPDATE planned_visit SET checksum=? WHERE id=?')
    .run('broken', ack.scenes[0].id);
  const damaged = x.store.db.serialize(),
    status = x.store.reconcilePreparationPlan(c);
  assert.equal(status.targetChanged, true);
  assert.equal(status.plan, null);
  assert(x.store.db.serialize().equals(damaged));
});
test('plan reply loss is recovered after reopening; later prose is not consumed by receipt replay', (t) => {
  const x = fixture(t),
    c = x.command({
      kind: 'plan',
      expectedRevision: 1,
      plan: { ...x.plan, scenes: [...x.plan.scenes].reverse() },
    }),
    ack = x.store.changePreparationPlan(c);
  const draft = {
    version: 1,
    writeId: randomUUID(),
    change: {
      kind: 'plan',
      expectedRevision: ack.revision,
      plan: { ...ack, name: 'Späterer Entwurf' },
    },
    failedCommand: null,
  };
  x.store.keepPreparationDrafts(x.w.token, [draft]);
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.campaign.id);
    assert.deepEqual(fresh.reconcilePreparationPlan(c, w.token).plan, ack);
    fresh.changePreparationPlan({ ...c, token: w.token });
    assert.deepEqual(fresh.preparationDraft(w.token, 'plan', ack.id), draft);
  } finally {
    fresh.close();
  }
});
test('foreign visits and a late receipt failure roll back the entire plan change', (t) => {
  const x = fixture(t),
    other = { ...x.plan, id: randomUUID(), scenes: [{ ...x.plan.scenes[0], id: randomUUID() }] };
  x.store.changePreparationPlan(x.command({ kind: 'plan', expectedRevision: null, plan: other }));
  const before = x.store.db.serialize();
  assert.throws(
    () =>
      x.store.changePreparationPlan(
        x.command({ kind: 'plan', expectedRevision: 1, plan: { ...x.plan, scenes: other.scenes } }),
      ),
    /anderen Plan/,
  );
  assert(x.store.db.serialize().equals(before));
  x.store.db.exec(
    "CREATE TEMP TRIGGER fail_plan_receipt BEFORE INSERT ON receipt BEGIN SELECT RAISE(ABORT,'Receipt fault'); END",
  );
  assert.throws(
    () =>
      x.store.changePreparationPlan(
        x.command({ kind: 'plan', expectedRevision: 1, plan: { ...x.plan, name: 'Rollback' } }),
      ),
    /Receipt fault/,
  );
  assert(x.store.db.serialize().equals(before));
});
test('the targeted confirmation is read inside the same write transaction and read failure rolls it back', (t) => {
  const x = fixture(t),
    prepare = x.store.db.prepare.bind(x.store.db),
    before = x.store.db.serialize();
  let reads = 0;
  x.store.db.prepare = (sql) => {
    // Fail the second complete plan read at the real storage boundary, regardless
    // of which module owns that read.
    if (
      /SELECT \* FROM planned_visit WHERE campaign_id=\? AND plan_id=\? ORDER BY ordinal/.test(sql)
    ) {
      assert.equal(x.store.db.inTransaction, true);
      if (++reads === 2) throw Error('Confirmation read failed');
    }
    return prepare(sql);
  };
  assert.throws(
    () =>
      x.store.changePreparationPlan(
        x.command({ kind: 'plan', expectedRevision: 1, plan: { ...x.plan, name: 'Unpublished' } }),
      ),
    /Confirmation read failed/,
  );
  assert.equal(reads, 2);
  assert(x.store.db.serialize().equals(before));
});
