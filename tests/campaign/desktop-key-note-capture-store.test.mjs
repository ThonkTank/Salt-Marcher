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
  outfile: '.build/capture-test-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/capture-test-store.cjs');
function fixture(t, withKey = true) {
  const dir = mkdtempSync(path.join(tmpdir(), 'key-capture-')),
    file = path.join(dir, 'campaign.sqlite'),
    store = new CampaignStore(file),
    room = {
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: '7',
      name: 'Archiv',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 6 },
            { x: 0, y: 6 },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: ' Original\r\n' }],
    },
    campaign = store.create('Neue Spur', [room]),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    }),
    existing = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'npc',
      title: 'Nera',
      readAloud: '',
      gmNotes: 'Original',
      relations: [],
      creatureId: null,
      deleted: false,
    };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note: existing },
  });
  if (withKey)
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
        patch: {
          gmNotes: { mode: 'replace', text: '  Der Raumtext bleibt\r\n' },
          tags: ['offen'],
          references: [{ kind: 'npc', id: existing.id, label: 'Nera' }],
        },
      }),
    );
  const capture = () => {
    const r = store.workspace().rooms[0],
      k = store.drawing(w.token).keyContent.find((k) => k.id === room.id);
    return {
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      room: { id: room.id, expectedRevision: r.revision, keyRevision: k?.revision ?? null },
      note: {
        version: 1,
        id: randomUUID(),
        revision: 1,
        kind: 'rumor',
        title: 'Die flüsternden Listen',
        readAloud: '',
        gmNotes: '  Hinweis\r\nFür nächsten Abend.  ',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    };
  };
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, campaign, w, room, existing, file, capture, command };
}
for (const withKey of [true, false])
  test(`capture creates and links one ordinary world note atomically (existing key ${withKey})`, (t) => {
    const x = fixture(t, withKey),
      c = x.capture(),
      source = x.store.drawing(x.w.token).keyContent[0];
    assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'not-applied');
    assert.equal(x.store.captureKeyNote(c).noteId, c.note.id);
    const note = x.store.preparation(x.w.token).notes.find((r) => r.note.id === c.note.id).note,
      key = x.store.drawing(x.w.token).keyContent.find((k) => k.id === x.room.id);
    assert.deepEqual(note, c.note);
    assert.deepEqual(x.store.workspace().rooms[0].sections, x.room.sections);
    assert(key.references.some((r) => r.id === c.note.id && r.kind === 'rumor'));
    if (source) {
      assert.deepEqual(key.blocks, source.blocks);
      assert.deepEqual(key.tags, source.tags);
      assert.deepEqual(key.references[0], source.references[0]);
    }
    assert.deepEqual(x.store.keyNoteCaptureStatus(c), {
      outcome: 'applied',
      noteId: c.note.id,
      targetChanged: false,
    });
    assert.equal(x.store.noteRoomUses(x.w.token, c.note.id).entries[0].id, x.room.id);
  });
test('lost acknowledgement can be checked or replayed without another note, key edit or history entry', (t) => {
  const x = fixture(t),
    c = x.capture();
  x.store.captureKeyNote(c);
  const before = x.store.db.serialize();
  x.store.captureKeyNote(c);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'applied');
  assert.throws(
    () => x.store.captureKeyNote({ ...c, note: { ...c.note, title: 'Andere Notiz' } }),
    /anders/,
  );
  assert.throws(
    () => x.store.keyNoteCaptureStatus({ ...c, note: { ...c.note, title: 'Andere Notiz' } }),
    /anders/,
  );
});
test('a key-write failure rolls back the note, search index, every receipt and drawing history', (t) => {
  const x = fixture(t),
    c = x.capture();
  x.store.db.exec(
    "CREATE TRIGGER capture_abort BEFORE INSERT ON dungeon_key_content BEGIN SELECT RAISE(ABORT,'Key refused'); END",
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c), /Key refused/);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'not-applied');
  assert.equal(
    x.store.preparation(x.w.token).notes.some((r) => r.note.id === c.note.id),
    false,
  );
});
for (const field of ['expectedRevision', 'keyRevision'])
  test(`a stale ${field} cannot leave an orphan note`, (t) => {
    const x = fixture(t),
      c = x.capture();
    c.room[field]++;
    const before = x.store.db.serialize();
    assert.throws(() => x.store.captureKeyNote(c), /geändert/);
    assert.deepEqual(x.store.db.serialize(), before);
    assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'conflict');
  });
test('invalid note metadata cannot modify the source and never becomes a recoverable applied command', (t) => {
  const x = fixture(t);
  for (const edit of [
    (n) => (n.kind = 'rule'),
    (n) => (n.revision = 2),
    (n) => (n.title = ''),
    (n) => (n.gmNotes = 3),
    (n) => (n.relations = [{ targetId: x.existing.id, label: 'neu' }]),
    (n) => (n.deleted = true),
  ]) {
    const c = x.capture();
    edit(c.note);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.captureKeyNote(c));
    assert.deepEqual(x.store.db.serialize(), before);
  }
});
test('a colliding note identity preserves the old note and refuses the link', (t) => {
  const x = fixture(t),
    c = x.capture();
  c.note.id = x.existing.id;
  const before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c), /Notizkonflikt/);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'conflict');
});
test('status distinguishes a historical successful capture from a changed or undone current target', (t) => {
  const x = fixture(t),
    c = x.capture();
  x.store.captureKeyNote(c);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: 1,
      note: { ...c.note, gmNotes: 'Später bearbeitet' },
    },
  });
  assert.equal(x.store.keyNoteCaptureStatus(c).targetChanged, true);
  x.store.history(x.w.token, 'undo');
  assert.equal(
    x.store.drawing(x.w.token).keyContent[0].references.some((r) => r.id === c.note.id),
    false,
  );
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'applied');
  const before = x.store.db.serialize();
  x.store.captureKeyNote(c);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('fresh-process status uses the new token and does not duplicate the saved capture', (t) => {
  const x = fixture(t),
    c = x.capture();
  x.store.captureKeyNote(c);
  const other = new CampaignStore(x.file);
  try {
    const w = other.activate(x.campaign.id);
    assert.equal(other.keyNoteCaptureStatus(c, w.token).outcome, 'applied');
    const before = other.db.serialize();
    other.captureKeyNote({ ...c, token: w.token });
    assert.deepEqual(other.db.serialize(), before);
  } finally {
    other.close();
  }
});
test('foreign campaign, expired owner and mismatched room identity are rejected', (t) => {
  const x = fixture(t),
    c = x.capture();
  const other = x.store.create('Andere Kampagne'),
    active = x.store.activate(other.id),
    before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c));
  assert.throws(() => x.store.captureKeyNote({ ...c, token: active.token }));
  assert.throws(() => x.store.keyNoteCaptureStatus(c, active.token));
  assert.deepEqual(x.store.db.serialize(), before);
});
test('a checksummed room payload cannot override its stored revision or identity', (t) => {
  const x = fixture(t),
    c = x.capture(),
    row = x.store.db.prepare('SELECT * FROM room WHERE id=?').get(x.room.id),
    payload = JSON.stringify({ ...JSON.parse(row.payload), revision: row.revision + 1 });
  x.store.db
    .prepare('UPDATE room SET payload=?,checksum=? WHERE id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), row.id);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c), /Zuordnung|zuordnung/);
  assert.deepEqual(x.store.db.serialize(), before);
});
for (const kind of ['note', 'npc', 'faction', 'quest', 'rumor'])
  test(`captured ${kind} uses the ordinary typed note and reference paths`, (t) => {
    const x = fixture(t),
      c = x.capture();
    c.note.kind = kind;
    x.store.captureKeyNote(c);
    const note = x.store.preparation(x.w.token).notes.find((r) => r.note.id === c.note.id).note;
    assert.equal(note.kind, kind);
    assert.equal(x.store.noteRoomUses(x.w.token, c.note.id).entries.length, 1);
    assert(
      x.store
        .drawing(x.w.token)
        .keyContent[0].references.some((r) => r.id === c.note.id && r.kind === kind),
    );
  });
test('backup and reopen retain the ordinary note, source bytes and exactly one reference', async (t) => {
  const x = fixture(t),
    c = x.capture();
  x.store.captureKeyNote(c);
  const target = path.join(path.dirname(x.file), 'backup.sqlite');
  await x.store.backup(target);
  const reopened = new CampaignStore(target);
  try {
    const w = reopened.activate(x.campaign.id);
    assert.deepEqual(
      reopened.preparation(w.token).notes.find((r) => r.note.id === c.note.id).note,
      c.note,
    );
    assert.equal(
      reopened.drawing(w.token).keyContent[0].references.filter((r) => r.id === c.note.id).length,
      1,
    );
    assert.deepEqual(reopened.workspace().rooms[0].sections, x.room.sections);
  } finally {
    reopened.close();
  }
});
function reuse(x, append = '  Neue Spur\r\n') {
  const c = x.capture();
  c.note = {
    ...c.note,
    id: x.existing.id,
    kind: x.existing.kind,
    title: x.existing.title,
    gmNotes: append,
  };
  c.reuseRevision = 1;
  return c;
}
test('reuse appends once and retains every existing field and reference', (t) => {
  const x = fixture(t),
    c = reuse(x),
    beforeKey = x.store.drawing(x.w.token).keyContent[0];
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'not-applied');
  x.store.captureKeyNote(c);
  const note = x.store.preparation(x.w.token).notes.find((r) => r.note.id === x.existing.id).note;
  assert.deepEqual(note, {
    ...x.existing,
    revision: 2,
    gmNotes: x.existing.gmNotes + '\n\n' + c.note.gmNotes,
  });
  assert.deepEqual(x.store.drawing(x.w.token).keyContent[0], beforeKey);
  assert.deepEqual(x.store.keyNoteCaptureStatus(c), {
    outcome: 'applied',
    noteId: x.existing.id,
    targetChanged: false,
  });
  const saved = x.store.db.serialize();
  x.store.captureKeyNote(c);
  assert.deepEqual(x.store.db.serialize(), saved);
});
test('link-only reuse creates a missing key without changing the note, then already-linked reuse is a no-op', (t) => {
  const x = fixture(t, false),
    c = reuse(x, '');
  x.store.captureKeyNote(c);
  assert.deepEqual(
    x.store.preparation(x.w.token).notes.find((r) => r.note.id === x.existing.id).note,
    x.existing,
  );
  assert.equal(x.store.drawing(x.w.token).keyContent[0].references.length, 1);
  assert.equal(x.store.keyNoteCaptureStatus(c).targetChanged, false);
  const c2 = reuse(x, '');
  const before = x.store.drawing(x.w.token);
  x.store.captureKeyNote(c2);
  assert.deepEqual(x.store.drawing(x.w.token), before);
  assert.equal(x.store.keyNoteCaptureStatus(c2).targetChanged, false);
});
test('failed linking rolls back an appended supplement and both receipts', (t) => {
  const x = fixture(t, false),
    c = reuse(x);
  x.store.db.exec(
    "CREATE TRIGGER reuse_abort BEFORE INSERT ON dungeon_key_content BEGIN SELECT RAISE(ABORT,'Link refused'); END",
  );
  const before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c), /Link refused/);
  assert.deepEqual(x.store.db.serialize(), before);
  assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'not-applied');
});
for (const change of ['revision', 'title', 'kind', 'trashed', 'checksum'])
  test(`reuse rejects changed ${change} without writing`, (t) => {
    const x = fixture(t),
      c = reuse(x);
    if (change === 'revision') c.reuseRevision = 2;
    else if (change === 'title') c.note.title = 'Andere';
    else if (change === 'kind') c.note.kind = 'faction';
    else if (change === 'trashed')
      x.store.db.prepare('UPDATE world_note SET trashed=1 WHERE id=?').run(x.existing.id);
    else
      x.store.db.prepare("UPDATE world_note SET checksum='broken' WHERE id=?").run(x.existing.id);
    const before = x.store.db.serialize();
    assert.throws(() => x.store.captureKeyNote(c));
    assert.deepEqual(x.store.db.serialize(), before);
    assert.equal(x.store.keyNoteCaptureStatus(c).outcome, 'conflict');
  });
test('same normalized title requires explicit separate creation, including different note kinds', (t) => {
  const x = fixture(t),
    c = x.capture();
  c.note.title = ' NERA ';
  const before = x.store.db.serialize();
  assert.throws(() => x.store.captureKeyNote(c), /existiert bereits/);
  assert.deepEqual(x.store.db.serialize(), before);
  c.allowSameTitle = true;
  x.store.captureKeyNote(c);
  assert.equal(x.store.preparation(x.w.token).notes.length, 2);
});
test('bounded choices prioritize exact names, retain duplicate identities and report damaged matches', (t) => {
  const x = fixture(t);
  for (let i = 0; i < 23; i++) {
    const c = x.capture();
    c.note.title = i === 0 ? 'Nera' : 'Nera ' + i;
    c.allowSameTitle = true;
    x.store.changePreparation({
      ...x.command(null),
      change: { kind: 'note', expectedRevision: null, note: c.note },
    });
  }
  const result = x.store.keyNoteChoices(x.w.token, ' NERA ');
  assert.equal(result.entries.length, 20);
  assert.equal(result.more, true);
  assert(result.entries.slice(0, 2).every((n) => n.title === 'Nera'));
  assert.notEqual(result.entries[0].id, result.entries[1].id);
  assert.equal(x.store.keyNoteChoices(x.w.token, 'unbekannt').entries.length, 0);
  x.store.db.prepare("UPDATE world_note SET checksum='broken' WHERE id=?").run(x.existing.id);
  assert.match(x.store.keyNoteChoices(x.w.token, 'Nera').notice, /beschädigt/);
});
test('title comparison handles canonically equivalent Unicode and excludes trash and other campaigns', (t) => {
  const x = fixture(t),
    n = { ...x.existing, title: 'Néra' };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: 1, note: n },
  });
  assert.equal(x.store.keyNoteChoices(x.w.token, 'Ne\u0301ra').entries[0].id, n.id);
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: n.id, expectedRevision: 2, trashed: true },
  });
  assert.equal(x.store.keyNoteChoices(x.w.token, 'Néra').entries.length, 0);
  const other = x.store.activate(x.store.create('Andere').id);
  assert.equal(x.store.keyNoteChoices(other.token, 'Néra').entries.length, 0);
  assert.throws(() => x.store.keyNoteChoices(x.w.token, 'Néra'));
});
test('reuse preserves raw text, read-aloud text and authored note relations', (t) => {
  const x = fixture(t),
    other = x.capture().note;
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note: other },
  });
  const original = {
    ...x.existing,
    readAloud: '  Vorlesetext\r\n',
    gmNotes: '  Rohtext\r\n  ',
    relations: [{ targetId: other.id, label: 'Kennt die Spur' }],
  };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: 1, note: original },
  });
  const c = reuse(x);
  c.reuseRevision = 2;
  x.store.captureKeyNote(c);
  const actual = x.store.preparation(x.w.token).notes.find((r) => r.note.id === x.existing.id).note;
  assert.deepEqual(actual, {
    ...original,
    revision: 3,
    gmNotes: original.gmNotes + '\n\n' + c.note.gmNotes,
  });
});
