import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-merge-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/note-merge-store.cjs');
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'note-merge-')),
    file = path.join(dir, 'store.sqlite'),
    store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const rooms = ['Torhalle', 'Wachstube'].map((name, i) => ({
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: String(i + 1),
    name,
    revision: 0,
    polygons: [
      {
        outer: [
          { x: i * 9, y: 0 },
          { x: i * 9 + 6, y: 0 },
          { x: i * 9 + 6, y: 6 },
          { x: i * 9, y: 6 },
        ],
        holes: [],
      },
    ],
    sections: [{ id: randomUUID(), kind: 'markdown', markdown: ' Original ' + name + '\r\n' }],
  }));
  const cam = store.create('Bereinigen', rooms),
    w = store.activate(cam.id),
    base = () => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id });
  const notes = ['Quartiermeisterin Nera', 'Nera', 'Tarek'].map((title) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'npc',
      title,
      readAloud: ' Vorlesen ' + title + '\r\n',
      gmNotes: ' Text ' + title + '\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    })),
    [source, target, other] = notes;
  for (const note of notes)
    store.changePreparation({ ...base(), change: { kind: 'note', expectedRevision: null, note } });
  for (const r of rooms)
    store.executeDrawing({
      ...base(),
      action: {
        kind: 'key-batch',
        rooms: [{ id: r.id, expectedRevision: 0, keyRevision: null }],
        patch: {
          references: [
            { kind: 'npc', id: source.id, label: source.title },
            { kind: 'npc', id: target.id, label: 'Eigener Alias' },
            { kind: 'npc', id: other.id, label: other.title },
          ],
        },
      },
    });
  const plan = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    name: 'Nachtwache',
    scenes: rooms.map((r) => ({
      id: randomUUID(),
      title: r.name,
      notes: ' Geplanter Ablauf\r\n',
      locationId: null,
    })),
  };
  store.changePreparation({ ...base(), change: { kind: 'plan', expectedRevision: null, plan } });
  for (const detail of store.session(w.token, plan.id).visits)
    store.executeSession({
      ...base(),
      action: {
        kind: 'visit',
        planId: plan.id,
        expectedRevision: detail.revision,
        detail: {
          ...detail,
          readAloud: ' Vorlesen Besuch\r\n',
          noteIds: [source.id, target.id, other.id],
        },
      },
    });
  const preview = () => store.noteMergePreview(w.token, source.id, target.id),
    command = () => {
      const p = preview();
      return {
        ...base(),
        change: {
          kind: 'note-merge',
          id: source.id,
          targetId: target.id,
          expectedRevision: p.source.revision,
          expectedTargetRevision: p.target.revision,
          basis: p.basis,
          readAloud: target.readAloud + source.readAloud,
          gmNotes: target.gmNotes + source.gmNotes,
        },
      };
    };
  return { store, cam, w, rooms, file, base, source, target, other, plan, preview, command };
}
test('preview is read-only and one confirmed command merges text, deduplicates current links and retains original source', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize(),
    p = x.preview();
  assert.equal(p.uses.filter((u) => u.kind === 'key').length, 2);
  assert.equal(p.uses.filter((u) => u.kind === 'visit').length, 2);
  assert.deepEqual(x.store.db.serialize(), before);
  const c = x.command(),
    result = x.store.changePreparation(c),
    src = result.notes.find((n) => n.note.id === x.source.id),
    dst = result.notes.find((n) => n.note.id === x.target.id);
  assert.equal(src.trashed, true);
  assert.deepEqual(src.note, { ...x.source, revision: 2 });
  assert.equal(dst.note.gmNotes, c.change.gmNotes);
  assert.equal(dst.note.readAloud, c.change.readAloud);
  assert.deepEqual(result.notes.find((n) => n.note.id === x.other.id).note, x.other);
  for (const k of x.store.drawing(x.w.token).keyContent)
    assert.deepEqual(
      k.references.map((r) => r.id),
      [x.target.id, x.other.id],
    );
  for (const v of x.store.session(x.w.token, x.plan.id).visits) {
    assert.deepEqual(v.noteIds, [x.target.id, x.other.id]);
    assert.equal(v.readAloud, ' Vorlesen Besuch\r\n');
  }
  assert.deepEqual(
    x.store.workspace().rooms.map((r) => r.sections),
    x.rooms.map((r) => r.sections),
  );
  const bytes = x.store.db.serialize();
  x.store.changePreparation(c);
  assert.deepEqual(x.store.db.serialize(), bytes);
  assert.equal(x.store.reconcilePreparation(c).outcome, 'applied');
});
for (const mutation of ['source', 'target', 'new-key', 'new-visit', 'incoming-note'])
  test('stale merge preview preserves all work after ' + mutation + ' changes', (t) => {
    const x = fixture(t),
      c = x.command();
    if (mutation === 'source' || mutation === 'target') {
      const note = mutation === 'source' ? x.source : x.target;
      x.store.changePreparation({
        ...x.base(),
        change: { kind: 'note', expectedRevision: 1, note: { ...note, gmNotes: 'Anderer Autor' } },
      });
    }
    if (mutation === 'new-key') {
      const k = x.store.drawing(x.w.token).keyContent[0];
      x.store.executeDrawing({
        ...x.base(),
        action: {
          kind: 'key-content',
          expectedRevision: k.revision,
          content: { ...k, references: k.references.slice(1) },
        },
      });
    }
    if (mutation === 'new-visit') {
      const d = x.store.session(x.w.token, x.plan.id).visits[0];
      x.store.executeSession({
        ...x.base(),
        action: {
          kind: 'visit',
          planId: x.plan.id,
          expectedRevision: d.revision,
          detail: { ...d, noteIds: d.noteIds.slice(1) },
        },
      });
    }
    if (mutation === 'incoming-note')
      x.store.changePreparation({
        ...x.base(),
        change: {
          kind: 'note',
          expectedRevision: 1,
          note: { ...x.other, gmNotes: '[Nera](dungeon-ref:note/' + x.source.id + ')' },
        },
      });
    const before = x.store.db.serialize();
    assert.throws(() => x.store.changePreparation(c), /Zusammenführungskonflikt/);
    assert.deepEqual(x.store.db.serialize(), before);
    assert.equal(x.store.reconcilePreparation(c).outcome, 'conflict');
  });
test('a later visit failure rolls back note, key history, partial receipts and source retirement together', (t) => {
  const x = fixture(t),
    c = x.command(),
    before = x.store.db.serialize(),
    execute = x.store.executeSession;
  x.store.executeSession = () => {
    throw Error('Controlled visit failure');
  };
  assert.throws(() => x.store.changePreparation(c), /Controlled visit failure/);
  assert.deepEqual(x.store.db.serialize(), before);
  x.store.executeSession = execute;
  assert.equal(x.store.reconcilePreparation(c).outcome, 'not-applied');
  x.store.changePreparation(c);
  assert.equal(x.store.reconcilePreparation(c).outcome, 'applied');
});
test('incoming text references and regular relations move, quoted code and unrelated bytes stay literal', (t) => {
  const x = fixture(t),
    link = '[Alter Alias](dungeon-ref:note/' + x.source.id + ')',
    code = '`' + link + '`',
    other = {
      ...x.other,
      gmNotes: '  ' + link + '\r\n' + code + '\r\n',
      relations: [{ targetId: x.source.id, label: 'kennt' }],
    };
  x.store.changePreparation({
    ...x.base(),
    change: { kind: 'note', expectedRevision: 1, note: other },
  });
  x.store.changePreparation({
    ...x.base(),
    change: {
      kind: 'note',
      expectedRevision: 1,
      note: { ...x.source, relations: [{ targetId: x.other.id, label: 'vertraut' }] },
    },
  });
  const loc = {
    version: 1,
    kind: 'location',
    id: randomUUID(),
    name: 'Tor',
    type: 'poi',
    sections: [{ id: randomUUID(), title: 'Privat', markdown: link + '\r\n  Unverändert' }],
    detailMaps: [],
    keyLinks: [],
  };
  x.store.changePreparation({
    ...x.base(),
    change: { kind: 'location', expectedRevision: null, document: loc },
  });
  const result = x.store.changePreparation(x.command()),
    n = result.notes.find((r) => r.note.id === x.other.id).note;
  assert.equal(n.gmNotes, '  ' + link.replace(x.source.id, x.target.id) + '\r\n' + code + '\r\n');
  assert.deepEqual(n.relations, [{ targetId: x.target.id, label: 'kennt' }]);
  assert.deepEqual(result.notes.find((r) => r.note.id === x.target.id).note.relations, [
    { targetId: x.other.id, label: 'vertraut' },
  ]);
  assert.equal(
    result.locations[0].document.sections[0].markdown,
    link.replace(x.source.id, x.target.id) + '\r\n  Unverändert',
  );
});
test('a typed family source is explicitly blocked and never partially merged', (t) => {
  const x = fixture(t);
  x.store.executeWorldRelationPair({
    ...x.base(),
    action: {
      kind: 'add',
      sourceId: x.source.id,
      targetId: x.other.id,
      sourceRevision: 1,
      targetRevision: 1,
      forwardLabel: 'Geschwister',
      reverseLabel: 'Geschwister',
      forwardFamilyKind: 'sibling',
      reverseFamilyKind: 'sibling',
    },
  });
  const p = x.preview();
  assert(p.blockers.some((b) => /Familien/.test(b)));
  const before = x.store.db.serialize();
  assert.throws(() => x.store.changePreparation(x.command()), /Familien/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('open source or target note drafts are preserved instead of being overwritten by a merge', (t) => {
  const x = fixture(t);
  const change = {
    kind: 'note',
    expectedRevision: 1,
    note: { ...x.target, gmNotes: '  Unfertig\r\n' },
  };
  x.store.keepPreparationDrafts(x.w.token, [
    { version: 1, writeId: randomUUID(), change, failedCommand: null },
  ]);
  assert(x.preview().blockers.some((b) => /offene Eingabe/.test(b)));
  const before = x.store.db.serialize();
  assert.throws(() => x.store.changePreparation(x.command()), /offene Eingabe/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('receipt identity and destination revision remain checkable after a lost acknowledgement and later edits', (t) => {
  const x = fixture(t),
    c = x.command();
  x.store.changePreparation(c);
  assert.deepEqual(x.store.reconcilePreparation(c).outcome, 'applied');
  const n = x.store.preparation(x.w.token).notes.find((r) => r.note.id === x.target.id).note;
  x.store.changePreparation({
    ...x.base(),
    change: {
      kind: 'note',
      expectedRevision: n.revision,
      note: { ...n, gmNotes: 'Später weitergeschrieben' },
    },
  });
  assert.equal(x.store.reconcilePreparation(c).targetChanged, true);
  assert.throws(
    () => x.store.changePreparation({ ...c, change: { ...c.change, gmNotes: 'Anders' } }),
    /Kennung|kennung/,
  );
});

for (const which of ['source', 'target'])
  test('NPC profile ' + which + ' is never silently retired or altered', (t) => {
    const x = fixture(t),
      n = x[which];
    const v = x.store.executeNpc({
      ...x.base(),
      expectedNoteRevision: 1,
      expectedRecordRevision: 0,
      expectedActorRevision: null,
      expectedPositionRevision: null,
      npc: {
        id: n.id,
        name: n.title,
        creatureId: null,
        readAloud: n.readAloud,
        gmNotes: n.gmNotes,
        locationId: null,
        record: {
          id: n.id,
          revision: 0,
          factionId: null,
          modifier: 2,
          lifecycle: 'active',
          appearance: '  Mantel\r\n',
          behavior: 'wartet',
          history: '  Alte Begegnung\r\n',
        },
        health: null,
      },
    });
    const c = x.command(),
      before = x.store.db.serialize();
    if (which === 'source') {
      assert(x.preview().blockers.some((b) => /NSC-Profil/.test(b)));
      assert.throws(() => x.store.changePreparation(c), /NSC-Profil/);
      assert.deepEqual(x.store.db.serialize(), before);
    } else {
      x.store.changePreparation(c);
      assert.deepEqual(x.store.npc(x.w.token, n.id).record, v.record);
    }
  });
test('incoming owner drafts block mutation without replacing their raw text', (t) => {
  const x = fixture(t),
    n = { ...x.other, gmNotes: '[Quelle](dungeon-ref:note/' + x.source.id + ')' };
  x.store.changePreparation({
    ...x.base(),
    change: { kind: 'note', expectedRevision: 1, note: n },
  });
  const saved = x.store.preparation(x.w.token).notes.find((r) => r.note.id === n.id).note,
    draft = {
      version: 1,
      writeId: randomUUID(),
      change: {
        kind: 'note',
        expectedRevision: saved.revision,
        note: { ...saved, gmNotes: 'Unfertige fremde Eingabe\r\n' },
      },
      failedCommand: null,
    };
  x.store.keepPreparationDrafts(x.w.token, [draft]);
  assert(x.preview().blockers.some((b) => /verweisende Notiz/.test(b)));
  const before = x.store.db.serialize();
  assert.throws(() => x.store.changePreparation(x.command()), /verweisende Notiz/);
  assert.deepEqual(x.store.db.serialize(), before);
});
test('merged references and recoverable source survive independent backup and fresh activation', async (t) => {
  const x = fixture(t),
    c = x.command();
  x.store.changePreparation(c);
  const backup = path.join(path.dirname(x.file), 'backup.sqlite');
  await x.store.backup(backup);
  const fresh = new CampaignStore(backup);
  try {
    const w = fresh.activate(x.cam.id),
      p = fresh.preparation(w.token);
    assert(p.notes.find((r) => r.note.id === x.source.id).trashed);
    assert.equal(p.notes.find((r) => r.note.id === x.source.id).note.gmNotes, x.source.gmNotes);
    assert.equal(p.notes.find((r) => r.note.id === x.target.id).note.gmNotes, c.change.gmNotes);
    assert.equal(fresh.reconcilePreparation(c, w.token).outcome, 'applied');
    assert(fresh.session(w.token, x.plan.id).visits.every((v) => !v.noteIds.includes(x.source.id)));
  } finally {
    fresh.close();
  }
});

test('campaign export and independent import retain merged originals and remap the live references', async (t) => {
  const x = fixture(t);
  x.store.changePreparation(x.command());
  const snapshot = path.join(path.dirname(x.file), 'campaign.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new CampaignStore(path.join(path.dirname(x.file), 'copy.sqlite'));
  try {
    const cam = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(cam.id),
      p = copy.preparation(w.token),
      source = p.notes.find((r) => r.note.title === x.source.title),
      target = p.notes.find((r) => r.note.title === x.target.title);
    assert(source.trashed);
    assert.equal(source.note.gmNotes, x.source.gmNotes);
    assert.notEqual(target.note.id, x.target.id);
    assert(
      copy
        .drawing(w.token)
        .keyContent.every(
          (k) =>
            k.references.some((r) => r.id === target.note.id) &&
            !k.references.some((r) => r.id === source.note.id),
        ),
    );
    assert(
      copy
        .session(w.token, p.plans[0].id)
        .visits.every(
          (v) => v.noteIds.includes(target.note.id) && !v.noteIds.includes(source.note.id),
        ),
    );
  } finally {
    copy.close();
  }
});
