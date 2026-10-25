import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-thread-store-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/note-thread-store-test.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t, count = 3, withPlan = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'note-thread-')),
    store = new CampaignStore(path.join(dir, 'campaign.sqlite'));
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const campaign = store.create('Notizmappe'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const save = (n, expectedRevision = null) =>
    store.changePreparation({
      ...command(null),
      change: { kind: 'note', expectedRevision, note: n },
    });
  const make = (title, kind = 'npc') => ({
    version: 1,
    id: randomUUID(),
    revision: 1,
    title,
    kind,
    gmNotes: '  Original ' + title + '\r\n',
    readAloud: '  Vorlesen\r\n',
    relations: [],
    creatureId: null,
    deleted: false,
  });
  const children = Array.from({ length: count }, (_, i) =>
    make('Quelle ' + i, i ? 'rumor' : 'npc'),
  );
  for (const n of children) save(n);
  const root = {
    ...make('Handlungsstrang', 'quest'),
    relations: children.map((n) => ({ targetId: n.id, label: 'Quelle' })),
  };
  save(root);
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Abend',
    scenes: [
      { id: randomUUID(), title: 'Ermitteln', notes: '  Auftrag erfragen\r\n', locationId: null },
      { id: randomUUID(), title: 'Rückweg', notes: '  Unberührt\r\n', locationId: null },
    ],
  };
  if (withPlan)
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', expectedRevision: null, plan },
    });
  const read = (offset = 0, active = true) => store.noteThread(w.token, root.id, offset, active);
  const selection = () => {
    const p = read();
    return {
      rootId: root.id,
      rootRevision: p.root.revision,
      includeRoot: true,
      entries: p.entries.map(({ id, stamp }) => ({ id, stamp })),
    };
  };
  const visit = () =>
    store.session(w.token, plan.id).visits.find((v) => v.visitId === plan.scenes[0].id);
  const link = (s = selection()) =>
    command({
      kind: 'visit',
      planId: plan.id,
      expectedRevision: visit().revision,
      detail: { ...visit(), noteIds: [root.id, ...s.entries.map((e) => e.id)] },
      noteThread: s,
    });
  const state = (id, status) => {
    const n = store.narrative(w.token, id);
    return store.executeProgress(
      command({
        kind: 'narrative-state',
        expectedRevision: n.state.revision,
        expectedNoteRevision: n.noteRevision,
        state: { ...n.state, status },
      }),
    );
  };
  return {
    dir,
    store,
    campaign,
    w,
    command,
    save,
    make,
    children,
    root,
    plan,
    read,
    selection,
    visit,
    link,
    state,
  };
}
function damage(x, id, edit, rehash = true) {
  const row = x.store.db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.campaign.id, id),
    n = JSON.parse(row.payload);
  edit(n);
  const payload = JSON.stringify(n);
  x.store.db
    .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, rehash ? hash(payload) : row.checksum, x.campaign.id, id);
}
test('direct relationships and active text references are deduplicated, literal code and grandchildren are excluded, with read-only pages', (t) => {
  const x = fixture(t),
    extra = x.make('Nur Text'),
    grandchild = x.make('Enkel');
  x.save(extra);
  x.save(grandchild);
  x.save({ ...x.children[0], relations: [{ targetId: grandchild.id, label: 'Weiter' }] }, 1);
  const root = {
    ...x.root,
    gmNotes: `[Nera](dungeon-ref:note/${x.children[0].id}) [Text](dungeon-ref:note/${extra.id}) [Ort](dungeon-ref:location/${grandchild.id}) \n\n\`[Code](dungeon-ref:note/${grandchild.id})\``,
    relations: [...x.root.relations, { targetId: x.root.id, label: 'Selbst' }],
  };
  x.save(root, 1);
  const before = x.store.db.serialize(),
    page = x.read();
  assert.equal(page.total, 4);
  assert.equal(page.entries.length, 4);
  assert.deepEqual(page.entries[0].labels, ['Quelle', 'Textverweis: Nera']);
  assert.equal(page.entries.find((e) => e.id === extra.id).status, 'untracked');
  assert(!page.entries.some((e) => e.id === grandchild.id || e.id === root.id));
  assert.deepEqual(x.store.db.serialize(), before);
});
test('all text references remain reachable beyond the ordinary preview reference limit', (t) => {
  const x = fixture(t, 0),
    notes = Array.from({ length: 205 }, (_, i) => x.make('Text ' + i));
  for (const n of notes) x.save(n);
  x.save(
    { ...x.root, gmNotes: notes.map((n) => `[Quelle](dungeon-ref:note/${n.id})`).join(' ') },
    1,
  );
  let offset = 0,
    all = [];
  do {
    const p = x.read(offset);
    all.push(...p.entries);
    offset = p.next;
  } while (offset !== null);
  assert.equal(all.length, 205);
  assert.equal(all.at(-1).id, notes.at(-1).id);
});
test('confirmed status controls filtering while NPCs stay untracked and closed sources remain in ordinary relations', (t) => {
  const x = fixture(t);
  x.state(x.children[2].id, 'closed');
  const before = x.store.db.serialize(),
    active = x.read(),
    all = x.read(0, false);
  assert.equal(active.total, 3);
  assert.deepEqual(
    active.entries.map((e) => e.status),
    ['untracked', 'open'],
  );
  assert.deepEqual(
    all.entries.map((e) => e.status),
    ['untracked', 'open', 'closed'],
  );
  assert.equal(all.root.relations.length, 3);
  x.store.checkNoteThread(x.w.token, x.selection());
  assert.deepEqual(x.store.db.serialize(), before);
});
test('pages bound output to forty and skip at most two hundred closed sources per request', (t) => {
  const x = fixture(t, 205);
  for (const n of x.children.slice(1, 202)) x.state(n.id, 'closed');
  const first = x.read();
  assert.equal(first.entries.length, 1);
  assert.equal(first.next, 200);
  const second = x.read(first.next);
  assert.equal(second.entries.length, 3);
  assert.equal(second.next, null);
  const full = x.read(0, false);
  assert.equal(full.entries.length, 40);
  assert.equal(full.next, 40);
});
for (const fault of ['checksum', 'identity', 'revision', 'trash'])
  test(`unavailable ${fault} source remains explicit and cannot pass selection checks`, (t) => {
    const x = fixture(t),
      s = x.selection();
    if (fault === 'trash')
      x.store.db
        .prepare('UPDATE world_note SET trashed=1 WHERE campaign_id=? AND id=?')
        .run(x.campaign.id, x.children[0].id);
    else
      damage(
        x,
        x.children[0].id,
        (n) => {
          if (fault === 'identity') n.id = randomUUID();
          else if (fault === 'revision') n.revision++;
          else n.gmNotes = 'damaged';
        },
        fault !== 'checksum',
      );
    const before = x.store.db.serialize(),
      entry = x.read().entries[0];
    assert.equal(entry.unavailable, true);
    assert.match(entry.notice, fault === 'trash' ? /Originalnotiz.*Papierkorb/ : /Notiz/);
    assert.throws(() => x.store.checkNoteThread(x.w.token, s));
    assert.deepEqual(x.store.db.serialize(), before);
  });
test('a broken narrative state is unknown rather than silently open or filtered out', (t) => {
  const x = fixture(t);
  x.state(x.children[1].id, 'closed');
  x.store.db
    .prepare('UPDATE narrative_state SET payload=? WHERE campaign_id=? AND note_id=?')
    .run('{}', x.campaign.id, x.children[1].id);
  const before = x.store.db.serialize(),
    e = x.read().entries.find((e) => e.id === x.children[1].id);
  assert.equal(e.status, 'unknown');
  assert.equal(e.unavailable, false);
  assert.match(e.notice, /nicht lesbar/);
  assert.deepEqual(x.store.db.serialize(), before);
});
for (const fault of [
  'source edit',
  'root edit',
  'removed member',
  'status change',
  'status round trip',
])
  test(`guarded visit rejects ${fault} after preview without any write or receipt`, (t) => {
    const x = fixture(t, 3, true),
      s = x.selection(),
      c = x.link(s);
    if (fault === 'source edit') x.save({ ...x.children[0], gmNotes: 'Geändert' }, 1);
    if (fault === 'root edit') x.save({ ...x.root, title: 'Neuer Titel' }, 1);
    if (fault === 'removed member') x.save({ ...x.root, relations: [] }, 1);
    if (fault.startsWith('status')) {
      x.state(x.children[1].id, 'closed');
      if (fault === 'status round trip') x.state(x.children[1].id, 'open');
    }
    const before = x.store.db.serialize();
    assert.throws(() => x.store.executeSession(c), /geändert|aktualisieren/);
    assert.deepEqual(x.store.db.serialize(), before);
    assert.equal(x.visit().revision, 0);
  });
test('guarded union preserves old references, raw prose, reward and other visit; replay after source edits returns the original result without a write', (t) => {
  const x = fixture(t, 3, true),
    old = x.make('Bereits vorhanden');
  x.save(old);
  const initial = x.visit(),
    reward = { id: randomUUID(), poolXp: 23, items: [], placedTreasureId: null, awarded: false };
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId: x.plan.id,
      expectedRevision: 0,
      detail: { ...initial, readAloud: '  Wortlaut\r\n', noteIds: [old.id], reward },
    }),
  );
  const previous = x.visit(),
    other = x.store.session(x.w.token, x.plan.id).visits[1],
    c = x.link();
  c.action.detail.noteIds.unshift(old.id);
  const ack = x.store.executeSession(c);
  assert.deepEqual(x.visit().noteIds, c.action.detail.noteIds);
  assert.equal(x.visit().readAloud, previous.readAloud);
  assert.deepEqual(x.visit().reward, previous.reward);
  assert.deepEqual(x.store.session(x.w.token, x.plan.id).visits[1], other);
  assert.deepEqual(x.store.preparation(x.w.token).plans[0], x.plan);
  x.state(x.children[1].id, 'closed');
  x.save({ ...x.children[0], gmNotes: 'Später' }, 1);
  const fresh = x.store.activate(x.campaign.id),
    before = x.store.db.serialize();
  assert.deepEqual(x.store.executeSession({ ...c, token: fresh.token }), ack);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM session_receipt WHERE command_id=?').get(c.commandId)
      .n,
    1,
  );
});
test('selection cannot authorize a different source set or a different campaign', (t) => {
  const x = fixture(t, 3, true),
    c = x.link();
  c.action.detail.noteIds = [];
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeSession(c), /passt nicht/);
  assert.deepEqual(x.store.db.serialize(), before);
  const other = x.store.create('B'),
    w = x.store.activate(other.id);
  assert.throws(() => x.store.noteThread(x.w.token, x.root.id));
  assert.throws(() => x.store.checkNoteThread(w.token, c.action.noteThread));
});
for (const invalid of [-1, 0.5, NaN, Infinity, 1_000_001])
  test(`invalid page offset ${invalid} is rejected`, (t) => {
    const x = fixture(t, 0);
    assert.throws(() => x.read(invalid), /Notizmappe prüfen/);
  });
test('malformed, duplicate, unrelated and stale-root selections are rejected read-only', (t) => {
  const x = fixture(t),
    s = x.selection(),
    before = x.store.db.serialize();
  for (const bad of [
    null,
    { ...s, includeRoot: 1 },
    { ...s, rootRevision: 0 },
    { ...s, entries: [...s.entries, s.entries[0]] },
    { ...s, entries: [{ id: 'other', stamp: 'a'.repeat(64) }] },
    { ...s, entries: [{ ...s.entries[0], stamp: 'bad' }] },
  ])
    assert.throws(() => x.store.checkNoteThread(x.w.token, bad));
  assert.deepEqual(x.store.db.serialize(), before);
});
for (const fault of ['changed status', 'wrong links'])
  test(`new plan opening rolls back plan, visits and receipts on ${fault}`, (t) => {
    const x = fixture(t, 3, true),
      s = x.selection(),
      plan = {
        ...x.plan,
        id: randomUUID(),
        name: 'Fortsetzung',
        scenes: [{ ...x.plan.scenes[0], id: randomUUID() }],
      },
      opening = {
        visitId: plan.scenes[0].id,
        readAloud: '',
        noteIds: [s.rootId, ...s.entries.map((e) => e.id)],
        noteThread: s,
      },
      c = { ...x.command(null), change: { kind: 'plan', expectedRevision: null, plan, opening } };
    if (fault === 'changed status') x.state(x.children[1].id, 'closed');
    else opening.noteIds = [];
    const before = x.store.db.serialize();
    assert.throws(() => x.store.changePreparation(c));
    assert.deepEqual(x.store.db.serialize(), before);
    assert(!x.store.preparation(x.w.token).plans.some((p) => p.id === plan.id));
  });
test('new plan opening commits selected identities once and replay is stable after sources change', (t) => {
  const x = fixture(t, 3, true),
    s = x.selection(),
    plan = {
      ...x.plan,
      id: randomUUID(),
      name: 'Fortsetzung',
      scenes: [{ ...x.plan.scenes[0], id: randomUUID() }],
    },
    c = {
      ...x.command(null),
      change: {
        kind: 'plan',
        expectedRevision: null,
        plan,
        opening: {
          visitId: plan.scenes[0].id,
          readAloud: '  Intro\r\n',
          noteIds: [s.rootId, ...s.entries.map((e) => e.id)],
          noteThread: s,
        },
      },
    };
  x.store.changePreparation(c);
  const saved = x.store.session(x.w.token, plan.id).visits[0];
  assert.deepEqual(saved.noteIds, c.change.opening.noteIds);
  assert.equal(saved.readAloud, '  Intro\r\n');
  x.state(x.children[1].id, 'closed');
  const before = x.store.db.serialize();
  x.store.changePreparation(c);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.preparation(x.w.token).plans.length, 2);
});

test('a readable trashed source keeps its exact identity and title, remains unselectable, and reappears after the ordinary restore command', (t) => {
  const x = fixture(t),
    source = x.children[0],
    sameName = { ...x.make(source.title), gmNotes: 'Eine andere Figur' };
  x.save(sameName);
  const before = x.selection();
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: source.id, expectedRevision: 1, trashed: true },
  });
  const trashed = x.read().entries.find((e) => e.id === source.id);
  assert.equal(trashed.title, source.title);
  assert.equal(trashed.kind, 'npc');
  assert.equal(trashed.revision, 2);
  assert.equal(trashed.trashed, true);
  assert.equal(trashed.unavailable, true);
  assert.equal(trashed.preview, '');
  assert.match(trashed.notice, /Originalnotiz liegt im Papierkorb/);
  assert.throws(() => x.store.checkNoteThread(x.w.token, before));
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: source.id, expectedRevision: 2, trashed: false },
  });
  const restored = x.read().entries.find((e) => e.id === source.id);
  assert.equal(restored.title, source.title);
  assert.equal(restored.unavailable, false);
  assert.equal(restored.trashed, undefined);
  assert.equal(restored.revision, 3);
  const prep = x.store.preparation(x.w.token);
  assert.deepEqual(prep.notes.find((r) => r.note.id === sameName.id).note, sameName);
  assert.deepEqual(
    { ...prep.notes.find((r) => r.note.id === source.id).note, revision: 1 },
    source,
  );
});
test('a closed trashed quest remains visible for recovery without inventing a confirmed narrative state', (t) => {
  const x = fixture(t),
    source = x.children[1];
  x.state(source.id, 'closed');
  assert(!x.read().entries.some((e) => e.id === source.id));
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: source.id, expectedRevision: 1, trashed: true },
  });
  const e = x.read().entries.find((e) => e.id === source.id);
  assert.equal(e.trashed, true);
  assert.equal(e.unavailable, true);
  assert.equal(e.status, 'unknown');
  assert.equal(e.kind, 'rumor');
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: source.id, expectedRevision: 2, trashed: false },
  });
  assert(!x.read().entries.some((e) => e.id === source.id));
  assert.equal(x.read(0, false).entries.find((e) => e.id === source.id).status, 'closed');
});
test('corruption in a trashed row never becomes permission to inspect an apparent trash original', (t) => {
  const x = fixture(t),
    source = x.children[0];
  x.store.db
    .prepare('UPDATE world_note SET trashed=1 WHERE campaign_id=? AND id=?')
    .run(x.campaign.id, source.id);
  damage(x, source.id, (n) => (n.title = 'Ungeprüfter Name'), false);
  const e = x.read().entries.find((e) => e.id === source.id);
  assert.equal(e.unavailable, true);
  assert.equal(e.trashed, undefined);
  assert.equal(e.title, 'Notiz nicht verfügbar');
  assert.equal(e.revision, null);
});

for (const fault of ['id', 'revision', 'deleted'])
  test(`a rehashed ${fault} mismatch cannot restore a trash original or appear as preparation`, async (t) => {
    const x = fixture(t),
      source = x.children[0];
    x.store.changePreparation({
      ...x.command(null),
      change: { kind: 'note-trash', id: source.id, expectedRevision: 1, trashed: true },
    });
    damage(x, source.id, (n) => {
      if (fault === 'id') n.id = randomUUID();
      else if (fault === 'revision') n.revision = 42;
      else n.deleted = true;
    });
    const before = x.store.db.serialize(),
      entry = x.read().entries.find((e) => e.id === source.id);
    assert.equal(entry.unavailable, true);
    assert.equal(entry.revision, null);
    const prep = x.store.preparation(x.w.token);
    assert(
      prep.problems.some((p) => p.includes(source.id)),
      'Preparation must quarantine the same invalid original as the dossier',
    );
    assert(!prep.notes.some((r) => r.note.id === source.id));
    assert.throws(
      () =>
        x.store.changePreparation({
          ...x.command(null),
          change: { kind: 'note-trash', id: source.id, expectedRevision: 2, trashed: false },
        }),
      /Notizzuordnung/,
    );
    assert.deepEqual(
      x.store.db.serialize(),
      before,
      'A rejected restore keeps damaged bytes and unrelated work intact',
    );
    // Backup uses the same row validator for every field; retain one integration representative.
    if (fault === 'id') {
      await assert.rejects(
        x.store.backup(path.join(x.dir, 'invalid-backup.sqlite')),
        /Notizzuordnung/,
      );
      assert.deepEqual(x.store.db.serialize(), before);
    }
  });
