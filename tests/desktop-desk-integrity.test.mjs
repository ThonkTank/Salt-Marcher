import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desk-integrity.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/desk-integrity.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'desk-integrity-')),
    filename = path.join(root, 'source.sqlite'),
    store = new CampaignStore(filename),
    cam = store.create('Desk'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action });
  const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
  ).scene;
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'npc',
    title: 'Guide',
    readAloud: 'Public',
    gmNotes: '  Original\r\nPrivate prose.\r\n',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', expectedRevision: null, note },
  });
  const ref = { kind: 'note', id: note.id };
  store.pinSceneDesk(w.token, scene.id, 0, ref, true);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, filename, store, cam, w, scene, note, ref, command };
}
function payload(x, refs) {
  const p = JSON.stringify(refs);
  x.store.db.prepare('UPDATE scene_desk SET payload=?,checksum=?').run(p, hash(p));
}
// sceneDesk/validateSceneDesk share checkedState. Keep every field check;
// duplicate pins exercise the backup traversal and preservation of its target.
for (const [name, damage, backup = false] of [
  ['negative revision', (x) => x.store.db.exec('UPDATE scene_desk SET revision=-1')],
  ['unsafe revision', (x) => x.store.db.exec('UPDATE scene_desk SET revision=9007199254740992')],
  ['non-list pins', (x) => payload(x, { pins: [x.ref] })],
  ['duplicate pins', (x) => payload(x, [x.ref, x.ref]), true],
  ['malformed reference', (x) => payload(x, [{ kind: 'room', id: x.note.id }])],
  [
    'too many pins',
    (x) =>
      payload(
        x,
        Array.from({ length: 101 }, () => ({ kind: 'note', id: randomUUID() })),
      ),
  ],
])
  test(`damaged desk ${name} is rejected by reads${backup ? ' and cannot replace a safe backup' : ''}`, async (t) => {
    const x = fixture(t),
      safe = path.join(x.root, 'safe.sqlite');
    const original = backup ? (await x.store.backup(safe), readFileSync(safe)) : null;
    damage(x);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.sceneDesk(x.w.token, x.scene.id));
    if (backup) {
      await assert.rejects(x.store.backup(safe));
      assert.ok(readFileSync(safe).equals(original));
    }
    assert.ok(x.store.db.serialize().equals(bytes));
  });
test('a missing desk table cannot replace a safe backup', async (t) => {
  const x = fixture(t),
    safe = path.join(x.root, 'safe.sqlite');
  await x.store.backup(safe);
  const original = readFileSync(safe);
  x.store.db.exec('DROP TABLE scene_desk');
  const bytes = x.store.db.serialize();
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(original));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('a location payload cannot impersonate a different SQL location in reads or backups', async (t) => {
  const x = fixture(t),
    id = randomUUID(),
    document = {
      kind: 'location',
      version: 1,
      id,
      name: 'Ruine',
      type: 'poi',
      sections: [{ id: randomUUID(), title: 'GM', markdown: x.note.gmNotes }],
      detailMaps: [],
      keyLinks: [],
    };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document },
  });
  const safe = path.join(x.root, 'safe.sqlite');
  await x.store.backup(safe);
  const original = readFileSync(safe),
    p = JSON.stringify({ ...document, id: randomUUID() });
  x.store.db.prepare('UPDATE location SET payload=?,checksum=? WHERE id=?').run(p, hash(p), id);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.deskContent(x.w.token, { kind: 'location', id }));
  await assert.rejects(x.store.backup(safe));
  assert.ok(readFileSync(safe).equals(original));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('pins reopen and copy independently while archived content remains readable and removable', async (t) => {
  const x = fixture(t);
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note-trash', id: x.note.id, expectedRevision: 1, trashed: true },
  });
  const snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const before = readFileSync(snapshot),
    target = new CampaignStore(path.join(x.root, 'copy.sqlite'));
  let camId, sceneId, noteId;
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = target.activate(copy.id),
      row = target.db.prepare('SELECT * FROM scene_desk WHERE campaign_id=?').get(copy.id),
      refs = JSON.parse(row.payload);
    camId = copy.id;
    sceneId = row.scene_id;
    noteId = refs[0].id;
    assert.notEqual(sceneId, x.scene.id);
    assert.notEqual(noteId, x.note.id);
    assert.equal(target.sceneDesk(w.token, sceneId).pins[0].unavailable, true);
    assert.equal(target.deskContent(w.token, refs[0]).note.gmNotes, x.note.gmNotes);
    await target.backup(path.join(x.root, 'copied-safe.sqlite'));
  } finally {
    target.close();
  }
  const fresh = new CampaignStore(path.join(x.root, 'copy.sqlite'));
  try {
    const w = fresh.activate(camId),
      desk = fresh.sceneDesk(w.token, sceneId);
    assert.equal(desk.pins[0].ref.id, noteId);
    assert.equal(
      fresh.pinSceneDesk(w.token, sceneId, desk.revision, { kind: 'note', id: noteId }, false).pins
        .length,
      0,
    );
    assert.equal(
      fresh.deskContent(w.token, { kind: 'note', id: noteId }).note.gmNotes,
      x.note.gmNotes,
    );
  } finally {
    fresh.close();
  }
  assert.ok(readFileSync(snapshot).equals(before));
});
test('unavailable pins retain their identity and can be removed without blocking backup', async (t) => {
  const x = fixture(t),
    ref = { kind: 'creature', id: 'unavailable-source-id' };
  payload(x, [ref]);
  const desk = x.store.sceneDesk(x.w.token, x.scene.id);
  assert.equal(desk.pins[0].unavailable, true);
  assert.deepEqual(desk.pins[0].ref, ref);
  await x.store.backup(path.join(x.root, 'unavailable-safe.sqlite'));
  assert.equal(
    x.store.pinSceneDesk(x.w.token, x.scene.id, desk.revision, ref, false).pins.length,
    0,
  );
});

function creation(x, kind = 'quest', pin = true) {
  const scene = x.store.liveScene(x.w.token, x.scene.id);
  return {
    commandId: randomUUID(),
    token: x.w.token,
    campaignId: x.cam.id,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: { ...x.note, id: randomUUID(), kind, title: 'Spur', gmNotes: '  Unverändert\r\n' },
    },
    sceneCreation: {
      sceneId: scene.id,
      expectedSceneRevision: scene.revision,
      expectedMembershipRevision: scene.membershipRevision,
      expectedDeskRevision: x.store.sceneDesk(x.w.token, scene.id).revision,
      pin,
      contributors: [],
    },
  };
}
test('quick scene creation commits note, open narrative and default pin under one replayable receipt', (t) => {
  const x = fixture(t),
    c = creation(x),
    id = c.change.note.id;
  x.store.changePreparationContent(c);
  assert.equal(x.store.narrative(x.w.token, id).state.status, 'open');
  assert.equal(x.store.narrative(x.w.token, id).state.revision, 1);
  assert.deepEqual(x.store.narrative(x.w.token, id).state.contributors, []);
  assert.equal(
    x.store.sceneDesk(x.w.token, x.scene.id).pins.filter((p) => p.ref.id === id).length,
    1,
  );
  assert.equal(x.store.reconcilePreparationContent(c, x.w.token).outcome, 'applied');
  x.store.changePreparationContent(c);
  assert.equal(
    x.store.sceneDesk(x.w.token, x.scene.id).pins.filter((p) => p.ref.id === id).length,
    1,
  );
  assert.equal(
    x.store.deskContent(x.w.token, { kind: 'note', id }).note.gmNotes,
    '  Unverändert\r\n',
  );
  assert.throws(
    () =>
      x.store.changePreparationContent({ ...c, sceneCreation: { ...c.sceneCreation, pin: false } }),
    /anders/,
  );
});
test('scene attachment opt-out creates independent name-only content without changing pins', (t) => {
  const x = fixture(t),
    before = x.store.sceneDesk(x.w.token, x.scene.id),
    c = creation(x, 'rumor', false);
  c.change.note.gmNotes = '';
  x.store.changePreparationContent(c);
  assert.deepEqual(x.store.sceneDesk(x.w.token, x.scene.id), before);
  assert.equal(x.store.narrative(x.w.token, c.change.note.id).state.locationId, null);
});
test('stale scene or pin context rolls back the whole quick creation and its receipt', (t) => {
  const x = fixture(t);
  for (const field of [
    'expectedSceneRevision',
    'expectedMembershipRevision',
    'expectedDeskRevision',
  ]) {
    const c = creation(x);
    c.sceneCreation[field]++;
    assert.throws(() => x.store.changePreparationContent(c));
    assert.equal(
      x.store.db.prepare('SELECT 1 FROM world_note WHERE id=?').get(c.change.note.id),
      undefined,
    );
    assert.equal(
      x.store.db.prepare('SELECT 1 FROM narrative_state WHERE note_id=?').get(c.change.note.id),
      undefined,
    );
    assert.equal(
      x.store.db.prepare('SELECT 1 FROM receipt WHERE command_id=?').get(c.commandId),
      undefined,
    );
  }
});

test('quick creation working draft and pending receipt survive independent transfer and erase with the campaign', async (t) => {
  const x = fixture(t),
    c = creation(x),
    draft = {
      writeId: randomUUID(),
      input: {
        kind: 'quest',
        name: c.change.note.title,
        notes: c.change.note.gmNotes,
        pin: true,
        contributors: false,
      },
      command: c,
    };
  x.store.keepSceneCreationDraft(x.w.token, x.scene.id, draft, null);
  x.store.changePreparationContent(c);
  const snapshot = path.join(x.root, 'working.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const target = new CampaignStore(path.join(x.root, 'working-copy.sqlite'));
  try {
    const copied = target.acceptCampaignSnapshot(snapshot, 'Copy', {}),
      w = target.activate(copied.id),
      scene = target.live(w.token).scene,
      d = target.sceneCreationDraft(w.token, scene.id);
    assert(d);
    assert.notEqual(d.command.commandId, c.commandId);
    assert.equal(d.command.campaignId, copied.id);
    assert.equal(d.command.sceneCreation.sceneId, scene.id);
    assert.equal(d.input.notes, draft.input.notes);
    assert.equal(target.reconcilePreparationContent(d.command, w.token).outcome, 'applied');
    target.keepSceneCreationDraft(w.token, scene.id, null, d.writeId);
    assert.equal(target.sceneCreationDraft(w.token, scene.id), null);
  } finally {
    target.close();
  }
  const before = x.store.sceneCreationDraft(x.w.token, x.scene.id);
  assert.equal(before.command.commandId, c.commandId);
  const revision = x.store.db
    .prepare('SELECT revision FROM campaign_lifecycle WHERE campaign_id=?')
    .get(x.cam.id).revision;
  x.store.trashCampaign({
    commandId: randomUUID(),
    id: x.cam.id,
    expectedRevision: revision,
    trashed: true,
  });
  x.store.eraseCampaign({
    commandId: randomUUID(),
    id: x.cam.id,
    expectedRevision: revision + 1,
    confirmName: x.cam.name,
  });
  assert.equal(
    x.store.db
      .prepare('SELECT COUNT(*) n FROM scene_creation_draft WHERE campaign_id=?')
      .get(x.cam.id).n,
    0,
  );
});
