import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/note-source-recovery-test/storage/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/campaign/note-thread-edit.ts'],
  outfile: '.build/note-source-recovery-test/note-thread-edit.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/note-source-recovery-test/storage/store.cjs'),
  {
    detachNoteSource,
    restoreNoteSource,
  } = require('../../.build/note-source-recovery-test/note-thread-edit.cjs');
function fixture(t, withOther = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'source-recovery-')),
    file = path.join(dir, 'campaign.sqlite');
  let store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const cam = store.create('Quellen'),
    w = store.activate(cam.id),
    make = (title) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      title,
      kind: 'npc',
      gmNotes: '  Originalwissen\r\n',
      readAloud: '',
      relations: [],
      creatureId: null,
      deleted: false,
    });
  const source = make('Nera'),
    other = make('Zeugin'),
    link = '[Nera](dungeon-ref:note/' + source.id + ')',
    root = {
      ...make('Auftrag'),
      kind: 'quest',
      gmNotes: 'Altes Ziel.\nEin Verweis auf ' + link + '.\n`' + link + '`\n',
      readAloud: link + ' wartet.\n',
      relations: [
        { targetId: source.id, label: 'Quelle' },
        { targetId: source.id, label: 'kennt' },
      ],
    };
  const command = (note, expectedRevision) => ({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: w.token,
      change: { kind: 'note', note, expectedRevision },
    }),
    save = (note, revision = null) => store.changePreparation(command(note, revision));
  for (const n of [source, ...(withOther ? [other] : []), root]) save(n);
  const page = (history = false) => store.noteThread(w.token, root.id, 0, true, history),
    unlink = () => {
      const before = page().root,
        n = detachNoteSource(before, source.id).note,
        c = command(n, before.revision);
      store.changePreparation(c);
      return c;
    };
  return {
    dir,
    file,
    get store() {
      return store;
    },
    cam,
    w,
    source,
    other,
    root,
    link,
    command,
    save,
    page,
    unlink,
    reopen() {
      store.close();
      store = new CampaignStore(file);
      w.token = store.activate(cam.id).token;
    },
  };
}
test('a canonical unlink is recorded atomically once, survives restart and restores only links after later edits', (t) => {
  const x = fixture(t, true),
    c = x.unlink();
  x.store.changePreparation(c);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM note_source_history').get().n, 1);
  assert.deepEqual(x.page().recoveries, []);
  const n = x.page().root;
  x.save(
    {
      ...n,
      title: 'Neuer Titel',
      gmNotes: n.gmNotes.replace('Altes Ziel.', 'Neues Ziel.') + 'Neue Tatsache.\n',
      relations: [{ targetId: x.other.id, label: 'Neue Quelle' }],
    },
    n.revision,
  );
  x.reopen();
  const p = x.page(true),
    recovery = p.recoveries[0];
  assert.equal(recovery.title, 'Nera');
  assert.equal(recovery.sourceId, x.source.id);
  const restored = restoreNoteSource(p.root, recovery),
    cmd = x.command(restored, p.root.revision);
  x.store.changePreparation(cmd);
  x.store.changePreparation(cmd);
  const final = x.page().root;
  assert.equal(final.title, 'Neuer Titel');
  assert.match(final.gmNotes, /Neues Ziel/);
  assert.match(final.gmNotes, /Neue Tatsache/);
  assert(final.gmNotes.includes(x.link));
  assert.equal(final.readAloud, x.root.readAloud);
  assert.equal(final.relations.length, 3);
  assert.deepEqual(x.page(true).recoveries, []);
  assert.equal(
    x.store.preparation(x.w.token).notes.find((n) => n.note.id === x.source.id).note.gmNotes,
    x.source.gmNotes,
  );
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM note_source_history').get().n, 1);
});
test('ordinary edits and mixed destructive changes do not masquerade as one source unlink', (t) => {
  const x = fixture(t);
  x.save({ ...x.root, title: 'Anders' }, 1);
  assert.equal(x.page(true).recoveries.length, 0);
  const n = x.page().root;
  x.save({ ...detachNoteSource(n, x.source.id).note, gmNotes: 'Ganz anderer Text' }, n.revision);
  assert.equal(x.page(true).recoveries.length, 0);
});
test('stale restore cannot replace a newer note and a trashed source remains unavailable', (t) => {
  const x = fixture(t);
  x.unlink();
  const p = x.page(true),
    restored = restoreNoteSource(p.root, p.recoveries[0]);
  x.save({ ...p.root, title: 'Noch neuer' }, p.root.revision);
  assert.throws(() => x.save(restored, p.root.revision), /Notizkonflikt/);
  assert.equal(x.page().root.title, 'Noch neuer');
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    change: { kind: 'note-trash', id: x.source.id, expectedRevision: 1, trashed: true },
  });
  assert.equal(x.page(true).recoveries[0].unavailable, true);
  assert.throws(
    () =>
      x.save(restoreNoteSource(x.page().root, x.page(true).recoveries[0]), x.page().root.revision),
    /verfügbare Notiz/,
  );
});
test('backup and independent transfer preserve and remap the recovery while campaign erasure removes it', async (t) => {
  const x = fixture(t);
  x.unlink();
  const backup = path.join(x.dir, 'backup.sqlite');
  await x.store.backup(backup);
  const reopened = new CampaignStore(backup);
  try {
    const token = reopened.activate(x.cam.id).token;
    assert.equal(reopened.noteThread(token, x.root.id, 0, true, true).recoveries.length, 1);
  } finally {
    reopened.close();
  }
  const snapshot = path.join(x.dir, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const imported = x.store.acceptCampaignSnapshot(snapshot, 'Unabhängige Kopie', {}),
    token = x.store.activate(imported.id).token;
  const root = x.store.preparation(token).notes.find((n) => n.note.title === x.root.title).note,
    p = x.store.noteThread(token, root.id, 0, true, true),
    r = p.recoveries[0];
  assert.notEqual(root.id, x.root.id);
  assert.notEqual(r.sourceId, x.source.id);
  assert(!r.before.readAloud.includes(x.source.id));
  assert(r.before.readAloud.includes(r.sourceId));
  assert(r.before.gmNotes.includes('`' + x.link + '`'));
  assert(!JSON.stringify(r).includes(x.root.id));
  const restored = restoreNoteSource(root, r);
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: imported.id,
    token,
    change: { kind: 'note', note: restored, expectedRevision: root.revision },
  });
  assert.equal(x.store.noteThread(token, root.id).entries.length, 1);
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM note_source_history WHERE campaign_id=?')
      .get(x.cam.id).n,
    1,
  );
  const overview = x.store.campaignOverview().find((c) => c.id === imported.id);
  x.store.trashCampaign({
    commandId: randomUUID(),
    id: imported.id,
    expectedRevision: overview.trashRevision,
    trashed: true,
  });
  x.store.eraseCampaign({
    commandId: randomUUID(),
    id: imported.id,
    expectedRevision: overview.trashRevision + 1,
    confirmName: imported.name,
  });
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM note_source_history WHERE campaign_id=?')
      .get(imported.id).n,
    0,
  );
});
test('damaged and semantically forged recovery rows block history reading and backups', async (t) => {
  const x = fixture(t);
  x.unlink();
  const row = x.store.db.prepare('SELECT * FROM note_source_history').get();
  x.store.db.prepare('UPDATE note_source_history SET checksum=?').run('bad');
  assert.throws(() => x.page(true), /beschädigt/);
  const backup = path.join(x.dir, 'bad.sqlite');
  await assert.rejects(x.store.backup(backup), /beschädigt/);
  assert.equal(existsSync(backup), false);
  const body = JSON.parse(row.payload);
  body.after.title = 'Fremde Änderung';
  const payload = JSON.stringify(body),
    checksum = createHash('sha256').update(payload).digest('hex');
  x.store.db.prepare('UPDATE note_source_history SET payload=?,checksum=?').run(payload, checksum);
  assert.throws(() => x.page(true), /widersprüchlich/);
  await assert.rejects(x.store.backup(backup), /widersprüchlich/);
});

test('a failed canonical note update rolls back its source history and receipt together', (t) => {
  const x = fixture(t);
  x.store.db.exec(
    "CREATE TRIGGER reject_test_note BEFORE UPDATE ON world_note BEGIN SELECT RAISE(ABORT,'controlled note failure'); END;",
  );
  assert.throws(() => x.unlink(), /controlled note failure/);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM note_source_history').get().n, 0);
  assert.equal(x.page().root.revision, 1);
  assert.equal(x.page().entries.length, 1);
});
