import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/review-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/review-integrity.cjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'review-integrity-')),
    file = join(root, 'store.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Integrität'),
    w = store.activate(cam.id);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = () => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token });
  const note = (id) =>
    JSON.parse(
      store.db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam.id, id).payload,
    );
  const createNote = (title, relations = []) => {
    const id = randomUUID();
    store.changePreparation({
      ...base(),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          kind: 'npc',
          title,
          readAloud: '',
          gmNotes: '  Original\r\n',
          relations,
          creatureId: null,
          deleted: false,
        },
      },
    });
    return id;
  };
  const trash = (id, trashed) =>
    store.changePreparation({
      ...base(),
      change: { kind: 'note-trash', id, expectedRevision: note(id).revision, trashed },
    });
  return { root, file, store, cam, w, base, note, createNote, trash };
}
const family = { forwardFamilyKind: 'parent', reverseFamilyKind: 'child' };
function pair(x, source, target, typed = false) {
  return {
    ...x.base(),
    action: {
      kind: 'add',
      sourceId: source,
      targetId: target,
      sourceRevision: x.note(source).revision,
      targetRevision: x.note(target).revision,
      forwardLabel: 'Elternteil',
      reverseLabel: 'Kind',
      ...(typed ? family : {}),
    },
  };
}
for (const typedFirst of [false, true])
  for (const collision of ['both', 'source', 'target'])
    test(`pair collision is atomic with saved draft (${typedFirst ? 'family first' : 'untyped first'}, ${collision})`, async (t) => {
      const x = fixture(t),
        a = x.createNote('Alma'),
        b = x.createNote('Bert');
      x.store.executeWorldRelationPair(pair(x, a, b, typedFirst));
      const c = pair(x, a, b, !typedFirst);
      if (collision === 'source') c.action.reverseLabel = 'andere Rückrichtung';
      if (collision === 'target') c.action.forwardLabel = 'andere Hinrichtung';
      c.draftWriteId = randomUUID();
      const draft = { version: 1, writeId: c.draftWriteId, command: c };
      x.store.keepWorldRelationPairDraft(x.w.token, draft, null);
      const before = x.store.db.serialize(),
        history = x.store.worldRelationPairHistory(x.w.token);
      assert.throws(() => x.store.executeWorldRelationPair(c), /bereits vorhanden/);
      assert.deepEqual(x.store.db.serialize(), before);
      assert.deepEqual(x.store.worldRelationPairDraft(x.w.token, a), draft);
      assert.deepEqual(x.store.worldRelationPairHistory(x.w.token), history);
      assert.equal(
        x.store.db
          .prepare('SELECT count(*) n FROM world_relation_pair_receipt WHERE command_id=?')
          .get(c.commandId).n,
        0,
      );
      assert.deepEqual(x.store.preparation(x.w.token, '').problems, []);
      await x.store.backup(join(x.root, 'safe.sqlite'));
    });
test('family edges survive either or both endpoints in trash, export/copy, fresh load and restore', async (t) => {
  const x = fixture(t),
    a = x.createNote('Alma'),
    b = x.createNote('Bert'),
    command = pair(x, a, b, true);
  x.store.executeWorldRelationPair(command);
  const relations = [x.note(a).relations, x.note(b).relations];
  for (const [id, trashed] of [
    [a, true],
    [b, true],
    [a, false],
    [b, false],
    [b, true],
  ]) {
    x.trash(id, trashed);
    assert.deepEqual([x.note(a).relations, x.note(b).relations], relations);
    await x.store.backup(join(x.root, 'safe.sqlite'));
    const exported = join(x.root, 'export.sqlite');
    await x.store.campaignSnapshot(x.w.token, exported);
    const copy = new CampaignStore(':memory:');
    try {
      const cam = copy.acceptCampaignSnapshot(exported, 'Kopie', {}),
        w = copy.activate(cam.id),
        rows = copy.db.prepare('SELECT * FROM world_note WHERE campaign_id=?').all(cam.id);
      assert.equal(rows.length, 2);
      for (const row of rows) {
        const n = JSON.parse(row.payload);
        assert.notEqual(n.id, a);
        assert.notEqual(n.id, b);
        assert(rows.some((r) => r.id === n.relations[0].targetId));
        assert.equal(n.gmNotes, '  Original\r\n');
      }
      await copy.backup(join(x.root, 'copy.sqlite'));
      assert.equal(copy.preparation(w.token, '').problems.length, 0);
    } finally {
      copy.close();
    }
  }
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id);
    assert.equal(fresh.preparation(w.token, '').problems.length, 0);
    fresh.changePreparation({
      commandId: randomUUID(),
      campaignId: x.cam.id,
      token: w.token,
      change: { kind: 'note-trash', id: b, expectedRevision: x.note(b).revision, trashed: false },
    });
    assert.deepEqual(
      JSON.parse(fresh.db.prepare('SELECT payload FROM world_note WHERE id=?').get(b).payload)
        .relations,
      relations[1],
    );
  } finally {
    fresh.close();
  }
});
test('archived family endpoints still require an actual reciprocal NPC during backup', async (t) => {
  const x = fixture(t),
    a = x.createNote('Alma'),
    b = x.createNote('Bert');
  x.store.executeWorldRelationPair(pair(x, a, b, true));
  x.trash(a, true);
  x.trash(b, true);
  const n = x.note(b);
  n.relations = [];
  const payload = JSON.stringify(n);
  x.store.db
    .prepare('UPDATE world_note SET payload=?,checksum=? WHERE id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), b);
  await assert.rejects(x.store.backup(join(x.root, 'invalid.sqlite')), /Gegenrichtung/);
});
for (const phase of ['preparing', 'running'])
  test(`NPC trash refuses ${phase} combat without writes, but keeps completed history`, async (t) => {
    const x = fixture(t),
      scene = x.store.executeLive({
        ...x.base(),
        action: { kind: 'initialize', expectedRosterRevision: 0 },
      }).scene;
    let combat;
    const act = (action) =>
      (combat = x.store.executeCombat({
        ...x.base(),
        combatId: combat?.id ?? null,
        expectedRevision: combat?.revision ?? null,
        action,
      }).combat);
    act({
      kind: 'create',
      sceneId: scene.id,
      title: 'Wache',
      includeParty: false,
      expectedMembershipRevision: scene.membershipRevision,
    });
    act({ kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false, initiative: 10 });
    if (phase === 'running') act({ kind: 'start' });
    const actor = combat.participants[0],
      before = x.store.db.serialize();
    assert.throws(() => x.trash(actor.worldActorId, true), /offenen Begegnung/);
    assert.deepEqual(x.store.db.serialize(), before);
    act({ kind: 'notes', title: 'Weiter', notes: 'Weiter spielbar' });
    act({ kind: 'damage', participantId: actor.id, amount: 1 });
    act({ kind: 'finish', outcome: 'Beendet' });
    const finished = structuredClone(combat);
    x.trash(actor.worldActorId, true);
    assert.deepEqual(x.store.combat(x.w.token, scene.id, combat.id).combat, finished);
    await x.store.backup(join(x.root, 'finished.sqlite'));
    x.trash(actor.worldActorId, false);
    assert.deepEqual(x.store.combat(x.w.token, scene.id, combat.id).combat, finished);
  });
const health = (hp = 0) => ({ hp, maxHp: 12, tempHp: 0, conditions: '', concentrating: false });
function party(x) {
  const pc = x.store.executeLive({
    ...x.base(),
    action: { kind: 'create-character', profile: { name: 'Ada' } },
  }).character;
  const progress = () =>
    x.store.progress(x.w.token).characters.find((p) => p.characterId === pc.id);
  const act = (operation, extra) =>
    x.store.executeProgress({
      ...x.base(),
      action: {
        kind: 'health',
        characterId: pc.id,
        expectedRevision: progress().revision,
        operation,
        reason: '',
        ...extra,
      },
    });
  return { pc, progress, act };
}
test('ordinary Party healing rejects death atomically; explicit correction stays available', async (t) => {
  const x = fixture(t),
    p = party(x);
  p.act('set', { health: health() });
  p.act('death', { result: 'dead' });
  const before = x.store.db.serialize();
  assert.throws(() => p.act('heal', { amount: 1 }), /Tote können nicht geheilt/);
  assert.deepEqual(x.store.db.serialize(), before);
  await x.store.backup(join(x.root, 'dead.sqlite'));
  const fresh = new CampaignStore(x.file);
  try {
    assert.equal(
      fresh
        .progress(fresh.activate(x.cam.id).token)
        .characters.find((c) => c.characterId === p.pc.id).health.death.dead,
      true,
    );
  } finally {
    fresh.close();
  }
  p.act('set', { health: health(1) });
  assert.equal(p.progress().health.hp, 1);
  assert.equal(p.progress().health.death, undefined);
});
for (const scenario of ['stable', 'massive', 'zero-concentration', 'temporary', 'ordinary-heal'])
  test(`Party and combat health agree for ${scenario}`, (t) => {
    const results = [];
    for (const mode of ['party', 'combat']) {
      const x = fixture(t),
        p = party(x),
        initial = {
          ...health(scenario === 'massive' ? 5 : scenario === 'zero-concentration' ? 1 : 0),
          concentrating: scenario === 'zero-concentration',
          tempHp: scenario === 'temporary' ? 3 : 0,
        };
      p.act('set', { health: initial });
      if (['stable', 'temporary', 'ordinary-heal'].includes(scenario))
        p.act('death', { result: 'stabilize' });
      const amount = scenario === 'massive' ? 17 : scenario === 'temporary' ? 2 : 1,
        operation = scenario === 'ordinary-heal' ? 'heal' : 'damage';
      if (mode === 'party') p.act(operation, { amount });
      else {
        const live = x.store.live(x.w.token);
        x.store.executeLive({
          ...x.base(),
          action: {
            kind: 'membership',
            characterId: p.pc.id,
            expectedRevision: p.pc.membershipRevision,
            expectedRosterRevision: live.rosterRevision,
            active: true,
            targetSceneId: null,
            expectedFocusRevision: live.focusRevision,
          },
        });
        const scene = x.store.executeLive({
          ...x.base(),
          action: {
            kind: 'initialize',
            expectedRosterRevision: x.store.live(x.w.token).rosterRevision,
          },
        }).scene;
        const combat = x.store.executeCombat({
          ...x.base(),
          combatId: null,
          expectedRevision: null,
          action: {
            kind: 'create',
            sceneId: scene.id,
            title: 'Gesundheit',
            includeParty: true,
            expectedMembershipRevision: scene.membershipRevision,
          },
        }).combat;
        x.store.executeCombat({
          ...x.base(),
          combatId: combat.id,
          expectedRevision: combat.revision,
          action: { kind: operation, participantId: combat.participants[0].id, amount },
        });
      }
      results.push(p.progress().health);
    }
    assert.deepEqual(results[0], results[1]);
    if (scenario === 'stable') {
      assert.equal(results[0].death.stable, false);
      assert.equal(results[0].death.failures, 1);
    }
    if (scenario === 'massive') assert.equal(results[0].death.dead, true);
    if (scenario === 'zero-concentration') assert.equal(results[0].concentrating, false);
    if (scenario === 'temporary') assert.equal(results[0].death.stable, true);
    if (scenario === 'ordinary-heal') assert.equal(results[0].death, undefined);
  });
