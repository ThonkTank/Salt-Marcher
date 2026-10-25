import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/group-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/group-integrity.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'group-integrity-')),
    file = path.join(root, 'source.sqlite'),
    store = new CampaignStore(file),
    cam = store.create('Groups'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const id = store.executeProgress(
    command({
      kind: 'group-create',
      title: 'Guards',
      encounterId: null,
      expectedEncounterRevision: null,
    }),
  ).groupId;
  const d = {
    writeId: randomUUID(),
    groupId: id,
    revision: 1,
    title: 'Guards',
    notes: 'Original\r\n',
    locationId: null,
    actors: [
      {
        id: null,
        creatureId: 'guard',
        revision: 0,
        profileRevision: 0,
        name: 'Guard',
        hp: '11',
        maxHp: '11',
        tempHp: '0',
        conditions: '',
        concentrating: false,
        gmNotes: 'Private\r\n',
        readAloud: 'Public\r\n',
      },
    ],
  };
  store.keepGroupDraft(w.token, d, null);
  store.executeProgress(
    command({ kind: 'group-edit', groupId: id, expectedRevision: 1, draft: d }),
  );
  const group = store.groupView(w.token, id),
    actor = group.actors[0],
    draft = {
      ...d,
      writeId: randomUUID(),
      revision: group.revision,
      title: '',
      notes: '  Author prose\r\nDo not trim.\r\n',
      actors: [
        {
          ...d.actors[0],
          id: actor.id,
          revision: actor.revision,
          profileRevision: actor.profileRevision,
          name: '',
          hp: '-',
          maxHp: '1,5',
          gmNotes: '  Raw notes\r\n',
          readAloud: '  Raw public\r\n',
        },
      ],
    };
  store.keepGroupDraft(w.token, draft, null);
  return { root, file, store, cam, w, command, id, group, draft };
}
function damage(x, table, edit) {
  const row = x.store.db.prepare('SELECT * FROM ' + table).get(),
    value = JSON.parse(row.payload);
  edit(value);
  const p = JSON.stringify(value);
  x.store.db.prepare('UPDATE ' + table + ' SET payload=?,checksum=?').run(p, hash(p));
}
// groupDraft/validateGroups share checkedDraftRow; groupView/validateGroups share
// readPreparedGroup and readWorldActor. Keep every field check and one backup per reader.
for (const [name, edit, backup = false] of [
  ['target', (d) => (d.groupId = randomUUID())],
  ['future revision', (d) => (d.revision = 99)],
  ['raw HP', (d) => (d.actors[0].hp = 5), true],
  ['actor identity', (d) => (d.actors[0].id = randomUUID())],
  ['actor revision', (d) => (d.actors[0].revision = -1)],
  ['profile revision', (d) => (d.actors[0].profileRevision = 999)],
  ['concentration', (d) => (d.actors[0].concentrating = 'yes')],
  ['location owner', (d) => (d.locationId = randomUUID())],
])
  test(`checksummed group draft ${name} damage is rejected without changing source${backup ? ' or replacing a safe backup' : ''}`, async (t) => {
    const x = fixture(t),
      safe = path.join(x.root, 'safe.sqlite');
    const original = backup ? (await x.store.backup(safe), readFileSync(safe)) : null;
    damage(x, 'group_draft', edit);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.groupDraft(x.w.token, x.id));
    if (backup) {
      await assert.rejects(x.store.backup(safe));
      assert.ok(readFileSync(safe).equals(original));
    }
    assert.ok(x.store.db.serialize().equals(bytes));
  });
for (const [table, name, edit, read, backup = false] of [
  [
    'prepared_group',
    'identity',
    (g) => (g.id = randomUUID()),
    (x) => x.store.groupView(x.w.token, x.id),
    true,
  ],
  ['world_actor', 'revision', (a) => (a.revision = 999), (x) => x.store.groupView(x.w.token, x.id)],
  [
    'world_actor',
    'health',
    (a) => (a.hp = a.maxHp + 1),
    (x) => x.store.groupView(x.w.token, x.id),
    true,
  ],
])
  test(`checksummed ${table} ${name} damage is rejected by reads${backup ? ' and backups' : ''}`, async (t) => {
    const x = fixture(t),
      safe = path.join(x.root, 'safe.sqlite');
    const original = backup ? (await x.store.backup(safe), readFileSync(safe)) : null;
    damage(x, table, edit);
    const bytes = x.store.db.serialize();
    assert.throws(() => read(x));
    if (backup) {
      await assert.rejects(x.store.backup(safe));
      assert.ok(readFileSync(safe).equals(original));
    }
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('missing group draft storage cannot replace a safe backup', async (t) => {
  const x = fixture(t),
    safe = path.join(x.root, 'safe.sqlite');
  await x.store.backup(safe);
  const before = readFileSync(safe);
  x.store.db.exec('DROP TABLE group_draft');
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(before));
});
test('invalid actor and location references cannot overwrite saved raw input', (t) => {
  const x = fixture(t);
  for (const edit of [
    (d) => (d.actors[0].revision = -1),
    (d) => (d.actors[0].id = randomUUID()),
    (d) => (d.locationId = randomUUID()),
  ]) {
    const d = structuredClone(x.draft);
    edit(d);
    d.writeId = randomUUID();
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.keepGroupDraft(x.w.token, d, x.draft.writeId));
    assert.deepEqual(x.store.groupDraft(x.w.token, x.id), x.draft);
    assert.ok(x.store.db.serialize().equals(bytes));
  }
});
test('raw group input copies with independent actor IDs and survives a fresh process', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    file = path.join(x.root, 'copy.sqlite'),
    target = new CampaignStore(file);
  let copyId, id;
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = target.activate(copy.id),
      row = target.db.prepare('SELECT * FROM group_draft WHERE campaign_id=?').get(copy.id),
      d = JSON.parse(row.payload);
    copyId = copy.id;
    id = row.group_id;
    assert.notEqual(id, x.id);
    assert.notEqual(d.writeId, x.draft.writeId);
    assert.notEqual(d.actors[0].id, x.draft.actors[0].id);
    assert.equal(d.actors[0].id, target.groupView(w.token, id).actors[0].id);
    assert.equal(d.notes, x.draft.notes);
    assert.equal(d.actors[0].hp, '-');
    assert.equal(d.actors[0].maxHp, '1,5');
    assert.equal(d.actors[0].gmNotes, x.draft.actors[0].gmNotes);
    await target.backup(path.join(x.root, 'copy-safe.sqlite'));
  } finally {
    target.close();
  }
  const fresh = new CampaignStore(file);
  try {
    const w = fresh.activate(copyId);
    assert.equal(fresh.groupDraft(w.token, id).notes, x.draft.notes);
  } finally {
    fresh.close();
  }
  assert.ok(readFileSync(snapshot).equals(bytes));
});
test('accepting valid input consumes only its draft and removed NPCs remain available', async (t) => {
  const x = fixture(t),
    d = structuredClone(x.draft);
  d.writeId = randomUUID();
  d.title = '  Author title';
  d.actors[0].name = 'Renamed guard';
  d.actors[0].hp = '5';
  d.actors[0].maxHp = '11';
  x.store.keepGroupDraft(x.w.token, d, x.draft.writeId);
  const edit = x.command({ kind: 'group-edit', groupId: x.id, expectedRevision: 2, draft: d }),
    ack = x.store.executeProgress(edit);
  assert.deepEqual(x.store.executeProgress(edit), ack);
  assert.equal(x.store.groupDraft(x.w.token, x.id), null);
  const group = x.store.groupView(x.w.token, x.id);
  assert.equal(group.actors[0].hp, 5);
  assert.equal(group.actors[0].gmNotes, d.actors[0].gmNotes);
  assert.equal(group.notes, d.notes);
  const empty = { ...d, writeId: randomUUID(), revision: group.revision, actors: [] };
  x.store.keepGroupDraft(x.w.token, empty, null);
  x.store.executeProgress(
    x.command({
      kind: 'group-edit',
      groupId: x.id,
      expectedRevision: group.revision,
      draft: empty,
    }),
  );
  assert.equal(x.store.groupView(x.w.token, x.id).actors.length, 0);
  assert.ok(
    x.store.db
      .prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?')
      .get(x.cam.id, d.actors[0].id),
  );
  assert.equal(
    JSON.parse(
      x.store.db
        .prepare('SELECT payload FROM world_note WHERE campaign_id=? AND id=?')
        .get(x.cam.id, d.actors[0].id).payload,
    ).gmNotes,
    d.actors[0].gmNotes,
  );
  await x.store.backup(path.join(x.root, 'empty-safe.sqlite'));
});

test('a stale draft retains raw input when its NPC profile changes elsewhere', async (t) => {
  const x = fixture(t),
    id = x.group.actors[0].id,
    row = x.store.db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.cam.id, id),
    note = JSON.parse(row.payload);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: note.revision,
      note: { ...note, revision: note.revision + 1, gmNotes: 'New author notes\r\n' },
    },
  });
  assert.deepEqual(x.store.groupDraft(x.w.token, x.id), x.draft);
  await x.store.backup(path.join(x.root, 'stale-profile-safe.sqlite'));
  assert.equal(x.store.groupView(x.w.token, x.id).actors[0].gmNotes, 'New author notes\r\n');
});
test('archiving a linked NPC preserves its unfinished group input and permits a backup', async (t) => {
  const x = fixture(t),
    id = x.group.actors[0].id;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note-trash',
      id,
      expectedRevision: x.group.actors[0].profileRevision,
      trashed: true,
    },
  });
  assert.equal(x.store.groupView(x.w.token, x.id).actors[0].unavailable, true);
  assert.deepEqual(x.store.groupDraft(x.w.token, x.id), x.draft);
  await x.store.backup(path.join(x.root, 'archived-npc-safe.sqlite'));
});

test('editing group notes retains individual NPC positions until the group location changes', async (t) => {
  const x = fixture(t),
    d = structuredClone(x.draft);
  d.writeId = randomUUID();
  d.title = 'Split guards';
  d.actors[0].name = 'First';
  d.actors[0].hp = '11';
  d.actors[0].maxHp = '11';
  d.actors.push({ ...d.actors[0], id: null, revision: 0, profileRevision: 0, name: 'Second' });
  x.store.keepGroupDraft(x.w.token, d, x.draft.writeId);
  x.store.executeProgress(
    x.command({ kind: 'group-edit', groupId: x.id, expectedRevision: 2, draft: d }),
  );
  const places = ['East', 'West'].map((name) => {
    const id = randomUUID();
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'location',
        expectedRevision: null,
        document: {
          kind: 'location',
          version: 1,
          id,
          name,
          type: 'poi',
          sections: [],
          detailMaps: [],
          keyLinks: [],
        },
      },
    });
    return id;
  });
  let group = x.store.groupView(x.w.token, x.id);
  const position = (id) =>
    x.store.db
      .prepare('SELECT * FROM npc_position WHERE campaign_id=? AND actor_id=?')
      .get(x.cam.id, id);
  group.actors.forEach((a, i) =>
    x.store.executeAutonomy(
      x.command({
        kind: 'place',
        actorId: a.id,
        locationId: places[i],
        expectedPositionRevision: position(a.id)?.revision ?? null,
        reason: 'Separate destinations',
      }),
    ),
  );
  group = x.store.groupView(x.w.token, x.id);
  assert.equal(group.locationId, null);
  const before = group.actors.map((a) => position(a.id));
  const next = {
    writeId: randomUUID(),
    groupId: group.id,
    revision: group.revision,
    title: group.title,
    notes: 'New notes without movement\r\n',
    locationId: group.locationId,
    actors: group.actors.map((a) => ({
      id: a.id,
      creatureId: a.creatureId,
      revision: a.revision,
      profileRevision: a.profileRevision,
      name: a.name,
      hp: String(a.hp),
      maxHp: String(a.maxHp),
      tempHp: String(a.tempHp),
      conditions: a.conditions,
      concentrating: a.concentrating,
      gmNotes: a.gmNotes,
      readAloud: a.readAloud,
    })),
  };
  x.store.keepGroupDraft(x.w.token, next, null);
  x.store.executeProgress(
    x.command({ kind: 'group-edit', groupId: x.id, expectedRevision: group.revision, draft: next }),
  );
  assert.deepEqual(
    group.actors.map((a) => position(a.id)),
    before,
  );
  const moved = x.store.groupView(x.w.token, x.id),
    move = { ...next, writeId: randomUUID(), revision: moved.revision, locationId: places[0] };
  x.store.keepGroupDraft(x.w.token, move, null);
  x.store.executeProgress(
    x.command({ kind: 'group-edit', groupId: x.id, expectedRevision: moved.revision, draft: move }),
  );
  assert.ok(group.actors.every((a) => position(a.id).location_id === places[0]));
  await x.store.backup(path.join(x.root, 'positions-safe.sqlite'));
});
