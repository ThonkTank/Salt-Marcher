import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/session-retention.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/session-retention.cjs');
const read = (x) => ({
  ...x.store.session(x.w.token, x.planId),
  plan: x.store.preparation(x.w.token).plans.find((p) => p.id === x.planId),
});
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'session-retention-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Preparation'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const planId = randomUUID(),
    visitId = randomUUID();
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Evening',
        scenes: [
          { id: visitId, title: 'Guard room', notes: '  Exact prose\r\n', locationId: null },
        ],
      },
    },
  });
  const encounterId = randomUUID();
  store.saveEncounterPlan({
    ...command(null),
    expectedRevision: null,
    plan: {
      id: encounterId,
      revision: 0,
      name: 'Guards',
      notes: 'Template\r\n',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'guard', count: 1, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const session = store.executeSession(
      command({
        kind: 'attach',
        planId,
        visitId,
        expectedVisitRevision: 0,
        encounterId,
        expectedEncounterRevision: 1,
      }),
    ),
    id = session.visits[0].groupIds[0],
    group = store.groupView(w.token, id),
    draft = {
      writeId: randomUUID(),
      groupId: id,
      revision: group.revision,
      title: '',
      notes: '  Unfinished prose\r\n',
      locationId: null,
      actors: [
        {
          id: null,
          creatureId: 'guard',
          revision: 0,
          profileRevision: 0,
          name: '',
          hp: '-',
          maxHp: '1,5',
          tempHp: '0',
          conditions: '',
          concentrating: false,
          gmNotes: '  Private\r\n',
          readAloud: '  Public\r\n',
        },
      ],
    };
  return { root, store, cam, w, command, planId, visitId, id, group, draft };
}
for (const action of ['detach', 'remove-visit', 'replace-plan'])
  test(`${action} retains unfinished group input independently`, async (t) => {
    const x = fixture(t);
    x.store.keepGroupDraft(x.w.token, x.draft, null);
    const before = read(x);
    if (action === 'detach')
      x.store.executeSession(
        x.command({
          kind: 'detach',
          planId: x.planId,
          visitId: x.visitId,
          expectedVisitRevision: before.visits[0].revision,
          groupId: x.id,
        }),
      );
    else if (action === 'remove-visit')
      x.store.changePreparation({
        ...x.command(null),
        change: {
          kind: 'plan',
          expectedRevision: before.plan.revision,
          plan: { ...before.plan, scenes: [] },
        },
      });
    else
      x.store.executeSession(
        x.command({
          kind: 'replace-plan',
          planId: x.planId,
          expectedBasis: before.replacementBasis,
          name: 'Next evening',
          sourcePlanId: null,
          expectedSourceBasis: null,
          copyParty: false,
        }),
      );
    assert.deepEqual(x.store.groupDraft(x.w.token, x.id), x.draft);
    const g = x.store.groupView(x.w.token, x.id);
    assert.equal(g.draftPlanId, null);
    assert.deepEqual(g.actors, []);
    assert.equal(g.revision, x.group.revision);
    await x.store.backup(path.join(x.root, 'safe.sqlite'));
    const snapshot = path.join(x.root, 'snapshot.sqlite');
    await x.store.campaignSnapshot(x.w.token, snapshot);
    const file = path.join(x.root, 'copy.sqlite'),
      copy = new CampaignStore(file);
    let camId, id;
    try {
      const cam = copy.acceptCampaignSnapshot(snapshot, 'Copy', {}),
        w = copy.activate(cam.id);
      camId = cam.id;
      const row = copy.db
        .prepare('SELECT group_id FROM group_draft WHERE campaign_id=?')
        .get(cam.id);
      id = row.group_id;
      assert.notEqual(id, x.id);
      assert.equal(copy.groupDraft(w.token, id).notes, x.draft.notes);
      assert.equal(copy.groupDraft(w.token, id).actors[0].hp, '-');
    } finally {
      copy.close();
    }
    const fresh = new CampaignStore(file);
    try {
      const w = fresh.activate(camId);
      assert.equal(fresh.groupView(w.token, id).draftPlanId, null);
      assert.equal(fresh.groupDraft(w.token, id).actors[0].gmNotes, x.draft.actors[0].gmNotes);
    } finally {
      fresh.close();
    }
  });
test('an unused draft group is cleaned when its visit is removed', (t) => {
  const x = fixture(t),
    before = read(x);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: before.plan.revision,
      plan: { ...before.plan, scenes: [] },
    },
  });
  assert.throws(() => x.store.groupView(x.w.token, x.id));
});
test('replacing from the same plan copies content and refuses a stale preview atomically', (t) => {
  const x = fixture(t),
    before = read(x),
    c = x.command({
      kind: 'replace-plan',
      planId: x.planId,
      expectedBasis: before.replacementBasis,
      name: 'Reused evening',
      sourcePlanId: x.planId,
      expectedSourceBasis: before.replacementBasis,
      copyParty: true,
    }),
    ack = x.store.executeSession(c);
  assert.deepEqual(x.store.executeSession(c), ack);
  const next = read(x);
  assert.equal(next.plan.scenes[0].notes, before.plan.scenes[0].notes);
  assert.notEqual(next.plan.scenes[0].id, x.visitId);
  assert.notEqual(ack.visits[0].groupIds[0], x.id);
  assert.equal(ack.groups[0].notes, x.group.notes);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.executeSession({ ...c, commandId: randomUUID() }));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('replacement reuses an accepted world group without duplicating or resetting its NPCs', async (t) => {
  const x = fixture(t),
    locationId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: locationId,
        name: 'Keep',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  x.store.executeSession(
    x.command({
      kind: 'place',
      planId: x.planId,
      groupId: x.id,
      expectedRevision: x.group.revision,
      locationId,
      expectedLocationRevision: 1,
    }),
  );
  const before = read(x),
    group = x.store.groupView(x.w.token, x.id),
    count = x.store.db
      .prepare('SELECT count(*) n FROM world_actor WHERE campaign_id=?')
      .get(x.cam.id).n,
    ack = x.store.executeSession(
      x.command({
        kind: 'replace-plan',
        planId: x.planId,
        expectedBasis: before.replacementBasis,
        name: 'Next watch',
        sourcePlanId: x.planId,
        expectedSourceBasis: before.replacementBasis,
        copyParty: false,
      }),
    );
  assert.deepEqual(ack.visits[0].groupIds, [x.id]);
  assert.deepEqual(x.store.groupView(x.w.token, x.id), group);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM world_actor WHERE campaign_id=?').get(x.cam.id).n,
    count,
  );
  await x.store.backup(path.join(x.root, 'world-safe.sqlite'));
});

test('session packet freezes readable preparation and changes its basis after a source edit without writing during reads', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    packet = x.store.sessionPacket(x.w.token, x.planId);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(packet.visits.length, 1);
  assert.equal(packet.visits[0].id, x.visitId);
  assert.equal(
    packet.visits[0].blocks.find((block) => block.kind === 'gm').text,
    '  Exact prose\r\n',
  );
  assert.ok(packet.visits[0].blocks.some((block) => block.heading.startsWith('Begegnung:')));
  assert.ok(packet.visits[0].blocks.some((block) => block.heading.startsWith('Statblock:')));
  assert.match(packet.basis, /^[a-f0-9]{64}$/);
  const plan = read(x).plan;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: plan.revision,
      plan: { ...plan, scenes: [{ ...plan.scenes[0], notes: 'Neue Vorbereitungsnotiz' }] },
    },
  });
  const changedBytes = x.store.db.serialize(),
    next = x.store.sessionPacket(x.w.token, x.planId);
  assert.ok(x.store.db.serialize().equals(changedBytes));
  assert.notEqual(next.basis, packet.basis);
  assert.equal(
    next.visits[0].blocks.find((block) => block.kind === 'gm').text,
    'Neue Vorbereitungsnotiz',
  );
  assert.equal(
    packet.visits[0].blocks.find((block) => block.kind === 'gm').text,
    '  Exact prose\r\n',
  );
  assert.equal(x.store.session(x.w.token, x.planId).groups[0].id, x.id);
});

test('adopted visit contents survive plan removal, Fresh and an independent campaign copy', async (t) => {
  const x = fixture(t),
    noteId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id: noteId,
        revision: 1,
        kind: 'quest',
        title: 'Gebundene Spur',
        readAloud: '',
        gmNotes: 'Weltwissen',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const detail = x.store.session(x.w.token, x.planId).visits[0];
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.planId,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: '  Original zum Vorlesen\r\n', noteIds: [noteId] },
    }),
  );
  const scene = x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: 0 }),
  ).scene;
  const visit = x.store.session(x.w.token, x.planId).visits[0];
  const adopted = x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      planId: x.planId,
      visitId: x.visitId,
      expectedPlanRevision: 1,
      expectedVisitRevision: visit.revision,
      sceneId: scene.id,
      expectedRevision: scene.revision,
    }),
  ).scene;
  const original = x.store.sceneVisits(x.w.token, scene.id, null).items[0];
  assert.equal(original.captured, true);
  assert.equal(original.readAloud, '  Original zum Vorlesen\r\n');
  assert.equal(original.references[0].id, noteId);
  const plan = read(x).plan;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: plan.revision,
      plan: { ...plan, name: 'Nächster Abend', scenes: [] },
    },
  });
  const bytes = x.store.db.serialize(),
    retained = x.store.sceneVisits(x.w.token, scene.id, null).items[0];
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.equal(retained.planName, 'Evening');
  assert.equal(retained.readAloud, original.readAloud);
  assert.equal(retained.notes, original.notes);
  assert.deepEqual(retained.references, original.references);
  assert.match(retained.warnings.join(' '), /nicht mehr/);
  assert.deepEqual(x.store.scenePreparation(x.w.token, scene.id).noteIds, [noteId]);
  const fresh = new CampaignStore(path.join(x.root, 'source.sqlite'));
  try {
    const w = fresh.activate(x.cam.id);
    assert.equal(fresh.sceneVisits(w.token, scene.id, null).items[0].readAloud, original.readAloud);
  } finally {
    fresh.close();
  }
  const snapshot = path.join(x.root, 'visit-snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new CampaignStore(path.join(x.root, 'visit-copy.sqlite'));
  try {
    const cam = copy.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = copy.activate(cam.id),
      current = copy.live(w.token).scene,
      visit = copy.sceneVisits(w.token, current.id, null).items[0];
    assert.notEqual(visit.adoptionId, adopted.adoption.id);
    assert.notEqual(visit.references[0].id, noteId);
    assert.equal(visit.references[0].available, true);
    assert.equal(visit.readAloud, original.readAloud);
    assert.equal(visit.planName, 'Evening');
    assert.deepEqual(copy.scenePreparation(w.token, current.id).noteIds, [visit.references[0].id]);
  } finally {
    copy.close();
  }
});
