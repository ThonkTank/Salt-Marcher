import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-excerpt-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/note-excerpt-store.cjs');
function fixture(t) {
  const root = mkdtempSync(tmpdir() + '/note-excerpt-'),
    file = root + '/db.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Protokoll'),
    w = store.activate(campaign.id);
  const command = (change) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    change,
  });
  const raw = '  Protokoll\r\n\r\nSiv wartet auf ein Lebenszeichen.\r\n\r\nUnveränderter Rest.  ',
    source = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'note',
      title: 'Rohprotokoll',
      readAloud: 'Öffentlich\r\nVorlesen.',
      gmNotes: raw,
      relations: [],
      creatureId: null,
      deleted: false,
    };
  store.changePreparation(command({ kind: 'note', expectedRevision: null, note: source }));
  const get = (id) => store.preparation(w.token).notes.find((r) => r.note.id === id)?.note;
  const excerpt = (kind = 'npc', field = 'gmNotes') => {
    const s = get(source.id),
      start = field === 'gmNotes' ? raw.indexOf('Siv') : 0,
      end = field === 'gmNotes' ? raw.indexOf('\r\n\r\nUnveränderter') : s.readAloud.length;
    return command({
      kind: 'note',
      expectedRevision: null,
      excerpt: { id: s.id, revision: s.revision, field, start, end },
      note: {
        ...source,
        id: randomUUID(),
        kind,
        title: kind + ' Auszug',
        readAloud: field === 'readAloud' ? s[field].slice(start, end) : '',
        gmNotes: field === 'gmNotes' ? s[field].slice(start, end) : '',
        relations: [{ targetId: s.id, label: 'Quelle' }],
      },
    });
  };
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, w, campaign, source, command, get, excerpt, file };
}
test('four typed excerpts preserve raw source bytes and assemble its notebook without another link pass', (t) => {
  const x = fixture(t),
    ids = [];
  for (const kind of ['npc', 'faction', 'quest', 'rumor']) {
    const c = x.excerpt(kind);
    x.store.changePreparation(c);
    ids.push(c.change.note.id);
    assert.deepEqual(x.get(c.change.note.id).relations, [
      { targetId: x.source.id, label: 'Quelle' },
    ]);
  }
  const source = x.get(x.source.id);
  assert.equal(source.gmNotes, x.source.gmNotes);
  assert.equal(source.readAloud, x.source.readAloud);
  assert.equal(source.kind, 'note');
  assert.equal(source.revision, 5);
  assert.deepEqual(
    source.relations,
    ids.map((targetId) => ({ targetId, label: 'Auszug' })),
  );
  const thread = x.store.noteThread(x.w.token, x.source.id, 0, false);
  assert.deepEqual(new Set(thread.entries.map((e) => e.id)), new Set(ids));
  assert.equal(x.store.preparation(x.w.token, 'Lebenszeichen').notes.length, 5);
  const graph = x.store.worldLinks(x.w.token, {
    text: 'Rohprotokoll',
    kind: 'note',
    offset: 0,
    focus: null,
  });
  assert.equal(graph.matches[0].kind, 'note');
});
test('replayed acknowledgement cannot create another excerpt or increment its source twice', (t) => {
  const x = fixture(t),
    c = x.excerpt();
  x.store.changePreparation(c);
  x.store.changePreparation(c);
  assert.equal(x.get(x.source.id).revision, 2);
  assert.equal(x.store.preparation(x.w.token).notes.length, 2);
  assert.equal(x.store.reconcilePreparation(c, x.w.token).outcome, 'applied');
  assert.throws(
    () =>
      x.store.changePreparation({
        ...c,
        change: { ...c.change, excerpt: { ...c.change.excerpt, start: 0 } },
      }),
    /anders/,
  );
});
for (const field of ['gmNotes', 'readAloud'])
  test(
    'excerpt keeps the selected ' +
      field +
      ' audience and rejects moving its text to the other field',
    (t) => {
      const x = fixture(t),
        c = x.excerpt('note', field),
        other = field === 'gmNotes' ? 'readAloud' : 'gmNotes';
      x.store.changePreparation(c);
      assert.equal(x.get(c.change.note.id)[other], '');
      const bad = x.excerpt('note', field);
      bad.change.note[other] = bad.change.note[field];
      bad.change.note[field] = '';
      assert.throws(() => x.store.changePreparation(bad), /markierten Quelle/);
      assert.equal(x.get(bad.change.note.id), undefined);
    },
  );
for (const fault of ['revision', 'range', 'text', 'provenance', 'trashed'])
  test(
    'invalid or changed excerpt ' + fault + ' leaves both original and new note untouched',
    (t) => {
      const x = fixture(t),
        c = x.excerpt();
      if (fault === 'revision') c.change.excerpt.revision++;
      if (fault === 'range') c.change.excerpt.end = 999999;
      if (fault === 'text') c.change.note.gmNotes += 'zusätzlich';
      if (fault === 'provenance') c.change.note.relations = [];
      if (fault === 'trashed')
        x.store.changePreparation(
          x.command({ kind: 'note-trash', id: x.source.id, expectedRevision: 1, trashed: true }),
        );
      const before = x.get(x.source.id);
      assert.throws(() => x.store.changePreparation(c));
      assert.deepEqual(x.get(x.source.id), before);
      assert.equal(x.get(c.change.note.id), undefined);
      assert.notEqual(x.store.reconcilePreparation(c, x.w.token).outcome, 'applied');
    },
  );
test('source publication failure rolls back the new note, search index and both receipts', (t) => {
  const x = fixture(t),
    c = x.excerpt();
  x.store.db.exec(
    `CREATE TRIGGER fail_excerpt BEFORE UPDATE ON world_note BEGIN SELECT RAISE(ABORT,'injected source write failure'); END;`,
  );
  assert.throws(() => x.store.changePreparation(c), /injected/);
  assert.equal(x.get(c.change.note.id), undefined);
  assert.deepEqual(x.get(x.source.id), x.source);
  assert.equal(x.store.preparation(x.w.token, 'npc Auszug').notes.length, 0);
  assert.equal(x.store.reconcilePreparation(c, x.w.token).outcome, 'not-applied');
  x.store.db.exec('DROP TRIGGER fail_excerpt');
  x.store.changePreparation(c);
  assert.equal(x.get(x.source.id).revision, 2);
});
test('fresh store retains generic original identity, exact CRLF, extracted text and reciprocal links', (t) => {
  const x = fixture(t),
    c = x.excerpt();
  x.store.changePreparation(c);
  x.store.close();
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.campaign.id),
      notes = fresh.preparation(w.token).notes;
    assert.equal(notes.find((r) => r.note.id === x.source.id).note.gmNotes, x.source.gmNotes);
    assert.equal(notes.find((r) => r.note.id === x.source.id).note.kind, 'note');
    assert.equal(
      notes.find((r) => r.note.id === c.change.note.id).note.gmNotes,
      c.change.note.gmNotes,
    );
    assert.equal(fresh.noteThread(w.token, x.source.id, 0, false).entries.length, 1);
  } finally {
    fresh.close();
  }
});
test('campaign snapshot copy remaps generic originals and both provenance directions without changing their text', async (t) => {
  const x = fixture(t),
    c = x.excerpt();
  x.store.changePreparation(c);
  const snapshot = x.file + '.copy';
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = x.store.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
    w = x.store.activate(copy.id),
    notes = x.store.preparation(w.token).notes.map((r) => r.note),
    source = notes.find((n) => n.kind === 'note'),
    derived = notes.find((n) => n.kind === 'npc');
  assert.notEqual(source.id, x.source.id);
  assert.notEqual(derived.id, c.change.note.id);
  assert.equal(source.gmNotes, x.source.gmNotes);
  assert.equal(derived.gmNotes, c.change.note.gmNotes);
  assert.deepEqual(source.relations, [{ targetId: derived.id, label: 'Auszug' }]);
  assert.deepEqual(derived.relations, [{ targetId: source.id, label: 'Quelle' }]);
});

function reuse(x, field = 'gmNotes') {
  const original = {
    ...x.source,
    id: randomUUID(),
    kind: 'npc',
    title: 'Vorhandene Siv',
    readAloud: 'Öffentliche Aussage\r\n  ',
    gmNotes: '  Erste Nacht\r\n\r\nWortlaut bleibt.  ',
    creatureId: 'preserved-creature',
    relations: [{ targetId: x.source.id, label: 'erwähnt' }],
  };
  x.store.changePreparation(x.command({ kind: 'note', expectedRevision: null, note: original }));
  const c = x.excerpt('npc', field),
    selected = c.change.note[field];
  c.change.expectedRevision = 1;
  c.change.note = {
    ...original,
    [field]:
      original[field] + '\n\n' + (field === 'gmNotes' ? '### Rohprotokoll\n\n' : '') + selected,
    relations: [...original.relations, { targetId: x.source.id, label: 'Quelle' }],
  };
  return { c, original, selected };
}
for (const field of ['gmNotes', 'readAloud'])
  test(
    'existing original ' +
      field +
      ' append retains its exact prior prose, identity, audience and metadata',
    (t) => {
      const x = fixture(t),
        { c, original, selected } = reuse(x, field),
        other = field === 'gmNotes' ? 'readAloud' : 'gmNotes';
      x.store.changePreparation(c);
      const n = x.get(original.id);
      assert.equal(n.id, original.id);
      assert.equal(n.kind, 'npc');
      assert.equal(n.creatureId, original.creatureId);
      assert.equal(n.title, original.title);
      assert.equal(n[field].slice(0, original[field].length), original[field]);
      assert.equal(n[other], original[other]);
      assert.ok(n[field].endsWith(selected));
      if (field === 'readAloud') assert.ok(!n.readAloud.includes('Rohprotokoll'));
      assert.deepEqual(n.relations, c.change.note.relations);
      assert.equal(x.get(x.source.id).gmNotes, x.source.gmNotes);
      assert.equal(x.get(x.source.id).readAloud, x.source.readAloud);
      assert.deepEqual(x.get(x.source.id).relations, [{ targetId: original.id, label: 'Auszug' }]);
      assert.equal(x.store.preparation(x.w.token).notes.length, 2);
    },
  );
for (const fault of [
  'sourceRevision',
  'targetRevision',
  'trashed',
  'title',
  'kind',
  'creature',
  'priorText',
  'audience',
  'relations',
])
  test('guarded existing append refuses ' + fault + ' without partial changes', (t) => {
    const x = fixture(t),
      { c, original } = reuse(x);
    if (fault === 'sourceRevision') c.change.excerpt.revision++;
    if (fault === 'targetRevision') c.change.expectedRevision++;
    if (fault === 'trashed')
      x.store.changePreparation(
        x.command({ kind: 'note-trash', id: original.id, expectedRevision: 1, trashed: true }),
      );
    if (fault === 'title') c.change.note.title = 'Renamed';
    if (fault === 'kind') {
      c.change.note.kind = 'faction';
      c.change.note.creatureId = null;
    }
    if (fault === 'creature') c.change.note.creatureId = null;
    if (fault === 'priorText') c.change.note.gmNotes = c.change.note.gmNotes.trim();
    if (fault === 'audience') c.change.note.readAloud += 'GM privat';
    if (fault === 'relations') c.change.note.relations = c.change.note.relations.slice(1);
    const before = x.get(original.id),
      source = x.get(x.source.id);
    assert.throws(() => x.store.changePreparation(c));
    assert.deepEqual(x.get(original.id), before);
    assert.deepEqual(x.get(x.source.id), source);
    assert.notEqual(x.store.reconcilePreparation(c, x.w.token).outcome, 'applied');
  });
test('existing append rolls target, source, search and receipts back if reciprocal publication fails', (t) => {
  const x = fixture(t),
    { c, original } = reuse(x);
  x.store.db.exec(
    `CREATE TRIGGER fail_existing_excerpt BEFORE UPDATE ON world_note WHEN OLD.id='${x.source.id}' BEGIN SELECT RAISE(ABORT,'injected reciprocal failure'); END;`,
  );
  assert.throws(() => x.store.changePreparation(c), /injected/);
  assert.deepEqual(x.get(original.id), original);
  assert.deepEqual(x.get(x.source.id), x.source);
  assert.equal(x.store.preparation(x.w.token, 'Lebenszeichen').notes.length, 1);
  assert.equal(x.store.reconcilePreparation(c, x.w.token).outcome, 'not-applied');
  x.store.db.exec('DROP TRIGGER fail_existing_excerpt');
  x.store.changePreparation(c);
  assert.equal(x.get(original.id).revision, 2);
});
test('replay never appends twice, later excerpts reuse provenance and fresh search retains the original identity', (t) => {
  const x = fixture(t),
    { c, original, selected } = reuse(x);
  x.store.changePreparation(c);
  const once = x.get(original.id);
  x.store.changePreparation(c);
  assert.deepEqual(x.get(original.id), once);
  assert.equal(x.store.reconcilePreparation(c, x.w.token).outcome, 'applied');
  const source = x.get(x.source.id),
    next = {
      ...c,
      commandId: randomUUID(),
      change: {
        ...c.change,
        expectedRevision: once.revision,
        excerpt: { ...c.change.excerpt, revision: source.revision },
        note: { ...once, gmNotes: once.gmNotes + '\n\n### Rohprotokoll\n\n' + selected },
      },
    };
  x.store.changePreparation(next);
  assert.equal(x.get(x.source.id).revision, 2);
  assert.equal(x.get(original.id).relations.length, 2);
  assert.equal(x.get(x.source.id).relations.length, 1);
  x.store.close();
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.campaign.id),
      n = fresh
        .preparation(w.token, 'Lebenszeichen')
        .notes.find((r) => r.note.id === original.id).note;
    assert.equal(n.revision, 3);
    assert.ok(n.gmNotes.startsWith(original.gmNotes));
    assert.equal(n.creatureId, original.creatureId);
  } finally {
    fresh.close();
  }
});
test('a new same-title excerpt requires an explicit separate identity, including a concurrent title arrival', (t) => {
  const x = fixture(t),
    c = x.excerpt();
  x.store.changePreparation(
    x.command({
      kind: 'note',
      expectedRevision: null,
      note: { ...c.change.note, id: randomUUID() },
    }),
  );
  assert.throws(() => x.store.changePreparation(c), /bereits/);
  assert.equal(x.get(c.change.note.id), undefined);
  c.change.excerpt.allowSameTitle = true;
  x.store.changePreparation(c);
  assert.equal(
    x.store.preparation(x.w.token).notes.filter((r) => r.note.title === c.change.note.title).length,
    2,
  );
});
test('uncertain existing excerpt keeps its entire request across a fresh store and reconciles at the new activation', (t) => {
  const x = fixture(t),
    { c, original } = reuse(x);
  x.store.changePreparation(c);
  const draft = { version: 1, writeId: randomUUID(), change: c.change, failedCommand: c };
  x.store.keepPreparationDrafts(x.w.token, [draft]);
  x.store.close();
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.campaign.id),
      saved = fresh.preparationDraft(w.token, 'note', original.id);
    assert.deepEqual(saved, draft);
    assert.equal(fresh.reconcilePreparation(saved.failedCommand, w.token).outcome, 'applied');
    assert.equal(
      fresh.preparation(w.token).notes.find((r) => r.note.id === original.id).note.revision,
      2,
    );
  } finally {
    fresh.close();
  }
});
test('an unloaded or concurrently arriving target draft blocks append and cannot be replaced by its failure recovery', (t) => {
  const x = fixture(t),
    { c, original } = reuse(x),
    other = {
      version: 1,
      writeId: randomUUID(),
      change: {
        kind: 'note',
        expectedRevision: 1,
        note: { ...original, gmNotes: 'Noch nicht abgeschlossene Arbeit\r\n  ' },
      },
      failedCommand: null,
    };
  x.store.keepPreparationDrafts(x.w.token, [other]);
  assert.throws(() => x.store.changePreparation(c), /Arbeitsentwurf/);
  assert.deepEqual(x.get(original.id), original);
  assert.deepEqual(x.get(x.source.id), x.source);
  assert.throws(
    () =>
      x.store.keepPreparationDrafts(x.w.token, [
        { version: 1, writeId: randomUUID(), change: c.change, failedCommand: c },
      ]),
    /anderer Arbeitsentwurf/,
  );
  assert.deepEqual(x.store.preparationDraft(x.w.token, 'note', original.id), other);
  assert.equal(x.store.reconcilePreparation(c, x.w.token).outcome, 'not-applied');
});
