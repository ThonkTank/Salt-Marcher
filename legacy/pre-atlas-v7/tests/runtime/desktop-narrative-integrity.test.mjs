import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/narrative-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/narrative-integrity.cjs'),
  hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'narrative-integrity-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Questquelle'),
    w = store.activate(cam.id),
    id = randomUUID(),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  store.changePreparation({
    ...command(null),
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'quest',
        title: 'Quest ' + id,
        readAloud: 'Original',
        gmNotes: 'Privat',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  let n = store.narrative(w.token, id);
  store.executeProgress(
    command({
      kind: 'narrative-state',
      expectedRevision: 0,
      expectedNoteRevision: n.noteRevision,
      state: n.state,
    }),
  );
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, root, cam, w, id, command };
}
for (const fault of ['note identity', 'revision'])
  test(`narrative read and backup reject a valid-checksum state with wrong ${fault}`, async (t) => {
    const x = fixture(t),
      safe = path.join(x.root, 'safe.sqlite');
    await x.store.backup(safe);
    const original = readFileSync(safe),
      row = x.store.db.prepare('SELECT * FROM narrative_state').get(),
      body = JSON.parse(row.payload);
    if (fault === 'note identity') body.noteId = randomUUID();
    else body.revision += 1;
    const payload = JSON.stringify(body);
    x.store.db
      .prepare('UPDATE narrative_state SET payload=?,checksum=?')
      .run(payload, hash(payload));
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.narrative(x.w.token, x.id));
    await assert.rejects(x.store.backup(safe));
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.ok(readFileSync(safe).equals(original));
  });
test('narrative award rejects a valid-checksum result belonging to another award identity', async (t) => {
  const x = fixture(t),
    n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-award',
      noteId: x.id,
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      sceneId: null,
      poolXp: 0,
      noXp: true,
      recipients: [],
      items: [],
      outcome: 'Ausdrücklich beendet',
    }),
  );
  const row = x.store.db.prepare('SELECT * FROM narrative_award').get(),
    payload = JSON.stringify({ ...JSON.parse(row.payload), id: randomUUID() });
  x.store.db.prepare('UPDATE narrative_award SET payload=?,checksum=?').run(payload, hash(payload));
  assert.throws(() => x.store.narrative(x.w.token, x.id));
  await assert.rejects(x.store.backup(path.join(x.root, 'bad.sqlite')));
});
test('archived narrative state and independent copied awards retain their owners and prose', async (t) => {
  const x = fixture(t),
    n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-award',
      noteId: x.id,
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      sceneId: null,
      poolXp: 0,
      noXp: true,
      recipients: [],
      items: [],
      outcome: 'Ausdrücklich beendet',
    }),
  );
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const original = readFileSync(snapshot),
    target = new CampaignStore(path.join(x.root, 'target.sqlite'));
  try {
    const c = target.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = target.activate(c.id),
      row = target.db.prepare('SELECT * FROM narrative_state WHERE campaign_id=?').get(c.id),
      read = target.narrative(w.token, row.note_id);
    assert.notEqual(read.state.noteId, x.id);
    assert.equal(read.award.noteId, read.state.noteId);
    assert.equal(read.award.title, 'Quest ' + x.id);
    assert.ok(readFileSync(snapshot).equals(original));
    await target.backup(path.join(x.root, 'copy-safe.sqlite'));
  } finally {
    target.close();
  }
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: x.id, expectedRevision: n.noteRevision, trashed: true },
  });
  await x.store.backup(path.join(x.root, 'archived-safe.sqlite'));
});

for (const fault of ['missing state', 'missing link'])
  test(`paid narrative award with ${fault} cannot appear unpaid or enter a backup`, async (t) => {
    const x = fixture(t),
      n = x.store.narrative(x.w.token, x.id);
    x.store.executeProgress(
      x.command({
        kind: 'narrative-award',
        noteId: x.id,
        expectedRevision: n.state.revision,
        expectedNoteRevision: n.noteRevision,
        sceneId: null,
        poolXp: 0,
        noXp: true,
        recipients: [],
        items: [],
        outcome: 'Ausdrücklich beendet',
      }),
    );
    if (fault === 'missing state') x.store.db.prepare('DELETE FROM narrative_state').run();
    else {
      const row = x.store.db.prepare('SELECT * FROM narrative_state').get(),
        payload = JSON.stringify({ ...JSON.parse(row.payload), awardId: null });
      x.store.db
        .prepare('UPDATE narrative_state SET payload=?,checksum=?')
        .run(payload, hash(payload));
    }
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.narrative(x.w.token, x.id));
    await assert.rejects(x.store.backup(path.join(x.root, 'broken-link.sqlite')));
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('per-note award lookup uses its campaign and note index', (t) => {
  const x = fixture(t),
    plan = x.store.db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM narrative_award WHERE campaign_id=? AND note_id=? LIMIT 2',
      )
      .all(x.cam.id, x.id);
  assert.ok(plan.some((row) => row.detail.includes('narrative_award_note')));
});

test('two individually valid awards for one note reject without replacing its safe backup', async (t) => {
  const x = fixture(t),
    n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-award',
      noteId: x.id,
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      sceneId: null,
      poolXp: 0,
      noXp: true,
      recipients: [],
      items: [],
      outcome: 'Einmal bestätigt',
    }),
  );
  const safe = path.join(x.root, 'one-award.sqlite');
  await x.store.backup(safe);
  const original = readFileSync(safe);
  const row = x.store.db.prepare('SELECT * FROM narrative_award').get(),
    award = { ...JSON.parse(row.payload), id: randomUUID() },
    payload = JSON.stringify(award);
  x.store.db
    .prepare('INSERT INTO narrative_award VALUES(?,?,?,?,?)')
    .run(x.cam.id, award.id, x.id, payload, hash(payload));
  const before = x.store.db.serialize();
  assert.throws(() => x.store.narrative(x.w.token, x.id), /Belohnungsbeleg/);
  await assert.rejects(x.store.backup(safe));
  assert(x.store.db.serialize().equals(before));
  assert(readFileSync(safe).equals(original));
});

function draftFor(x) {
  return {
    noteId: x.id,
    writeId: randomUUID(),
    revision: x.store.narrative(x.w.token, x.id).state.revision,
    status: 'open',
    locationId: null,
    contributors: [],
    poolXp: '-',
    items: [{ name: 'Unfertig ' + x.id, category: 'equipment', quantity: '1,5', valueGold: '-' }],
  };
}
for (const fault of ['note identity', 'raw field type'])
  test(`narrative draft read and backup reject valid-checksum ${fault} damage`, async (t) => {
    const x = fixture(t),
      d = draftFor(x);
    x.store.keepNarrativeDraft(x.w.token, d, null);
    const safe = path.join(x.root, 'draft-safe.sqlite');
    await x.store.backup(safe);
    const original = readFileSync(safe);
    const body = {
        ...d,
        ...(fault === 'note identity' ? { noteId: randomUUID() } : { poolXp: 12 }),
      },
      payload = JSON.stringify(body);
    x.store.db
      .prepare('UPDATE narrative_draft SET payload=?,checksum=?')
      .run(payload, hash(payload));
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.narrative(x.w.token, x.id));
    await assert.rejects(x.store.backup(safe));
    assert.ok(x.store.db.serialize().equals(bytes));
    assert.ok(readFileSync(safe).equals(original));
  });
test('raw narrative draft copies structured owners but retains invalid fields and archived input', async (t) => {
  const x = fixture(t),
    d = draftFor(x);
  x.store.keepNarrativeDraft(x.w.token, d, null);
  const snapshot = path.join(x.root, 'draft-copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const original = readFileSync(snapshot),
    target = new CampaignStore(path.join(x.root, 'draft-target.sqlite'));
  try {
    const c = target.acceptCampaignSnapshot(snapshot, 'Draftkopie', {}),
      w = target.activate(c.id),
      row = target.db.prepare('SELECT * FROM narrative_draft WHERE campaign_id=?').get(c.id),
      n = target.narrative(w.token, row.note_id);
    assert.notEqual(n.draft.noteId, d.noteId);
    assert.notEqual(n.draft.writeId, d.writeId);
    assert.equal(n.draft.poolXp, '-');
    assert.deepEqual(n.draft.items, d.items);
    await target.backup(path.join(x.root, 'draft-copy-safe.sqlite'));
  } finally {
    target.close();
  }
  assert.ok(readFileSync(snapshot).equals(original));
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: x.id, expectedRevision: 1, trashed: true },
  });
  await x.store.backup(path.join(x.root, 'archived-draft.sqlite'));
});
test('positive narrative XP and allocated loot retain ownership after copy and source erasure', async (t) => {
  const x = fixture(t),
    actors = [];
  for (const name of ['Ari', 'Bela']) {
    const actor = x.store.executeLive(
      x.command({ kind: 'create-character', profile: { name } }),
    ).character;
    actors.push(actor);
    const live = x.store.live(x.w.token);
    x.store.executeLive(
      x.command({
        kind: 'membership',
        characterId: actor.id,
        expectedRevision: actor.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: null,
      }),
    );
  }
  let live = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }),
  );
  live = x.store.live(x.w.token);
  let n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-state',
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      state: { ...n.state, contributors: actors.map((a) => a.id) },
    }),
  );
  n = x.store.narrative(x.w.token, x.id);
  x.store.executeProgress(
    x.command({
      kind: 'narrative-award',
      noteId: x.id,
      expectedRevision: n.state.revision,
      expectedNoteRevision: n.noteRevision,
      sceneId: live.scene.id,
      poolXp: 101,
      noXp: false,
      recipients: x.store
        .progress(x.w.token)
        .characters.map((c) => ({ characterId: c.characterId, revision: c.revision })),
      items: [{ name: 'Gold ' + x.id, category: 'coins', quantity: 12, valueGold: '1' }],
      outcome: 'Geschafft ' + x.id,
    }),
  );
  n = x.store.narrative(x.w.token, x.id);
  const treasure = x.store.treasure(x.w.token, n.award.treasureId);
  x.store.executeProgress(
    x.command({
      kind: 'allocate',
      treasureId: treasure.id,
      expectedRevision: treasure.revision,
      expectedDefinitionRevision: treasure.items[0].currentDefinition.revision,
      itemId: treasure.items[0].id,
      quantity: 3,
      characterId: actors[0].id,
      expectedMembershipRevision: x.store.live(x.w.token).roster.find((r) => r.id === actors[0].id)
        .membershipRevision,
    }),
  );
  const snapshot = path.join(x.root, 'paid-copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const original = readFileSync(snapshot),
    target = new CampaignStore(path.join(x.root, 'paid-target.sqlite'));
  try {
    const c = target.acceptCampaignSnapshot(snapshot, 'Belohnungskopie', {}),
      w = target.activate(c.id),
      row = target.db.prepare('SELECT * FROM narrative_state WHERE campaign_id=?').get(c.id),
      copy = target.narrative(w.token, row.note_id),
      progress = target.progress(w.token);
    assert.equal(copy.award.shareXp, 51);
    assert.ok(progress.characters.every((p) => p.xp === 51));
    assert.equal(copy.award.recipientIds.length, 2);
    assert.ok(
      copy.award.recipientIds.every((id) => progress.characters.some((p) => p.characterId === id)),
    );
    assert.deepEqual(
      copy.state.contributors.slice().sort(),
      copy.award.recipientIds.slice().sort(),
    );
    const loot = target.treasure(w.token, copy.award.treasureId);
    assert.equal(loot.sourceNoteId, copy.state.noteId);
    assert.equal(loot.awardId, copy.award.id);
    assert.equal(loot.items[0].allocated, 3);
    assert.equal(copy.award.outcome, 'Geschafft ' + x.id);
    for (const r of target.db
      .prepare(
        "SELECT payload FROM progress_event WHERE campaign_id=? AND json_extract(payload,'$.sourceKind')='quest'",
      )
      .all(c.id))
      assert.equal(JSON.parse(r.payload).sourceId, copy.state.noteId);
    assert.ok(readFileSync(snapshot).equals(original));
    x.store.trashCampaign({
      commandId: randomUUID(),
      id: x.cam.id,
      expectedRevision: 0,
      trashed: true,
    });
    x.store.eraseCampaign({
      commandId: randomUUID(),
      id: x.cam.id,
      expectedRevision: 1,
      confirmName: 'Questquelle',
    });
    for (const table of [
      'narrative_state',
      'narrative_award',
      'narrative_draft',
      'progress_event',
      'treasure',
      'character_ledger',
    ])
      assert.equal(
        x.store.db.prepare(`SELECT count(*) n FROM ${table} WHERE campaign_id=?`).get(x.cam.id).n,
        0,
      );
    assert.deepEqual(target.narrative(w.token, row.note_id), copy);
    await target.backup(path.join(x.root, 'paid-copy-safe.sqlite'));
  } finally {
    target.close();
  }
});

test('foreign campaign contributors cannot be written or restored as narrative draft owners', async (t) => {
  const x = fixture(t),
    other = x.store.create('Andere'),
    w = x.store.activate(other.id),
    actor = x.store.executeLive({
      commandId: randomUUID(),
      campaignId: other.id,
      token: w.token,
      action: { kind: 'create-character', profile: { name: 'Fremd' } },
    }).character;
  x.w = x.store.activate(x.cam.id);
  const d = { ...draftFor(x), contributors: [actor.id] };
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.keepNarrativeDraft(x.w.token, d, null));
  assert.ok(x.store.db.serialize().equals(bytes));
  const payload = JSON.stringify(d);
  x.store.db
    .prepare('INSERT INTO narrative_draft VALUES(?,?,?,?)')
    .run(x.cam.id, x.id, payload, hash(payload));
  assert.throws(() => x.store.narrative(x.w.token, x.id));
  await assert.rejects(x.store.backup(path.join(x.root, 'foreign-draft.sqlite')));
});

for (const fault of ['identity', 'revision'])
  test(`narrative note ${fault} must match its checksummed row before read or backup`, async (t) => {
    const x = fixture(t),
      row = x.store.db.prepare('SELECT * FROM world_note WHERE id=?').get(x.id),
      value = JSON.parse(row.payload);
    if (fault === 'identity') value.id = randomUUID();
    else value.revision++;
    const payload = JSON.stringify(value);
    x.store.db
      .prepare('UPDATE world_note SET payload=?,checksum=? WHERE id=?')
      .run(payload, hash(payload), x.id);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.narrative(x.w.token, x.id));
    await assert.rejects(x.store.backup(path.join(x.root, 'bad-note.sqlite')));
    assert.ok(x.store.db.serialize().equals(before));
  });
for (const fault of ['recipient', 'scene'])
  test(`narrative award read refuses a checksummed ${fault} outside its campaign`, async (t) => {
    const x = fixture(t),
      n = x.store.narrative(x.w.token, x.id);
    x.store.executeProgress(
      x.command({
        kind: 'narrative-award',
        noteId: x.id,
        expectedRevision: n.state.revision,
        expectedNoteRevision: n.noteRevision,
        sceneId: null,
        poolXp: 0,
        noXp: true,
        recipients: [],
        items: [],
        outcome: 'Confirmed result',
      }),
    );
    const row = x.store.db.prepare('SELECT * FROM narrative_award').get(),
      award = JSON.parse(row.payload);
    if (fault === 'recipient') award.recipientIds = [randomUUID()];
    else award.sceneId = randomUUID();
    const payload = JSON.stringify(award);
    x.store.db
      .prepare('UPDATE narrative_award SET payload=?,checksum=? WHERE id=?')
      .run(payload, hash(payload), row.id);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.narrative(x.w.token, x.id));
    // checkedAward is shared by read and backup; recipient retains the backup traversal.
    if (fault === 'recipient')
      await assert.rejects(x.store.backup(path.join(x.root, 'bad-owner.sqlite')));
    assert.ok(x.store.db.serialize().equals(before));
  });
