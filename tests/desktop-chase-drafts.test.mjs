import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { buildSync } from './helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/chase-drafts-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/chase-drafts-store.cjs');
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'chase-drafts-')),
    file = root + '/source.sqlite',
    store = new CampaignStore(file),
    cam = store.create('Zwei Verfolgungen'),
    w = store.activate(cam.id),
    live = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  const scene = store.executeLive(live({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    base = (id, revision, action) => ({
      ...live(action),
      sceneId: scene.id,
      chaseId: id,
      expectedRevision: revision,
    });
  let c = store.executeChase(
    base(null, null, { kind: 'create', title: 'Hafen', goal: 'Tor' }),
  ).chase;
  c = store.executeChase(
    base(c.id, c.revision, {
      kind: 'participant',
      participant: {
        id: randomUUID(),
        name: 'Kurier',
        side: 'quarry',
        distance: 18,
        speed: 9,
        exhaustion: 0,
        notes: '  Text\r\n- Tor',
      },
    }),
  ).chase;
  const draft = () => ({
    version: 1,
    writeId: randomUUID(),
    chaseId: c.id,
    sceneId: scene.id,
    revision: c.revision,
    fields: {
      'chase-name': '',
      'chase-complication': '  Wagen\r\n- Tor',
      'chase-outcome': ' Noch offen\r\n',
    },
    rows: [{ participantId: c.participants[0].id, distance: '', exhaustion: '1' }],
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, file, store, cam, w, scene, c, base, draft };
}
test('raw incomplete fields survive a separate Store, backup and read without advancing a round', async (t) => {
  const x = fixture(t),
    d = x.draft(),
    before = x.store.db.prepare('SELECT payload,checksum FROM chase').get();
  x.store.keepChaseDraft(x.w.token, d, null);
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id),
      v = fresh.chase(w.token, x.scene.id, x.c.id);
    assert.deepEqual(v.draft, d);
    assert.equal(v.chase.round, 0);
    assert.deepEqual(fresh.db.prepare('SELECT payload,checksum FROM chase').get(), before);
    await fresh.backup(x.root + '/backup.sqlite');
    const backup = new CampaignStore(x.root + '/backup.sqlite');
    try {
      const bw = backup.activate(x.cam.id);
      assert.deepEqual(backup.chase(bw.token, x.scene.id, x.c.id).draft, d);
    } finally {
      backup.close();
    }
  } finally {
    fresh.close();
  }
});
test('draft writes use compare-and-swap and exact replay, never silently overwrite another draft', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  x.store.keepChaseDraft(x.w.token, d, null);
  assert.throws(
    () => x.store.keepChaseDraft(x.w.token, { ...d, fields: {} }, d.writeId),
    /Kennung|kennung/,
  );
  assert.throws(
    () => x.store.keepChaseDraft(x.w.token, { ...d, writeId: randomUUID() }, null),
    /inzwischen/,
  );
  assert.deepEqual(x.store.chase(x.w.token, x.scene.id, x.c.id).draft, d);
});
test('owner revision, scene and participant identity are verified before saving raw fields', (t) => {
  const x = fixture(t);
  for (const patch of [
    { revision: x.c.revision + 1 },
    { sceneId: randomUUID() },
    { rows: [{ participantId: randomUUID(), distance: '2' }] },
  ])
    assert.throws(() => x.store.keepChaseDraft(x.w.token, { ...x.draft(), ...patch }, null));
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM chase_working_draft').get().n, 0);
});
test('invalid round and wrong draft token roll back state, draft and receipt together', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  const bad = x.base(x.c.id, x.c.revision, { kind: 'round', changes: [], complication: 'x' });
  assert.throws(() => x.store.executeChase({ ...bad, draftWriteId: d.writeId }));
  const good = {
    ...bad,
    commandId: randomUUID(),
    action: {
      kind: 'round',
      changes: [{ participantId: x.c.participants[0].id, distance: 36, exhaustion: 1 }],
      complication: 'Wagen',
    },
  };
  assert.throws(() => x.store.executeChase({ ...good, draftWriteId: randomUUID() }));
  assert.throws(() => x.store.executeChase(good));
  const v = x.store.chase(x.w.token, x.scene.id, x.c.id);
  assert.equal(v.chase.round, 0);
  assert.deepEqual(v.draft, d);
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM chase_receipt WHERE command_id IN (?,?)')
      .get(bad.commandId, good.commandId).n,
    0,
  );
});
test('confirming a round atomically consumes only its proposal and exact receipt replay leaves newer input intact', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  const command = {
      ...x.base(x.c.id, x.c.revision, {
        kind: 'round',
        changes: [{ participantId: x.c.participants[0].id, distance: 36, exhaustion: 1 }],
        complication: '  Wagen\r\n- Tor',
      }),
      draftWriteId: d.writeId,
    },
    v = x.store.executeChase(command);
  assert.equal(v.chase.round, 1);
  assert.deepEqual(v.draft.rows, []);
  assert.equal(v.draft.fields['chase-complication'], undefined);
  assert.equal(v.draft.fields['chase-outcome'], d.fields['chase-outcome']);
  assert.equal(v.chase.participants[0].notes, x.c.participants[0].notes);
  const next = {
    ...v.draft,
    writeId: randomUUID(),
    fields: { 'chase-complication': 'Nächste Runde' },
  };
  x.store.keepChaseDraft(x.w.token, next, v.draft.writeId);
  assert.deepEqual(x.store.executeChase(command), v);
  assert.deepEqual(x.store.chase(x.w.token, x.scene.id, x.c.id).draft, next);
});
test('adding or removing a participant retains unrelated round input and finish retains the unrelated complication', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  let v = x.store.executeChase({
    ...x.base(x.c.id, x.c.revision, {
      kind: 'participant',
      participant: {
        id: randomUUID(),
        name: 'Wache',
        side: 'pursuer',
        distance: 0,
        speed: 9,
        exhaustion: 0,
        notes: '',
      },
    }),
    draftWriteId: d.writeId,
  });
  assert.deepEqual(v.draft.rows, d.rows);
  assert.equal(v.draft.fields['chase-name'], undefined);
  v = x.store.executeChase({
    ...x.base(x.c.id, v.chase.revision, { kind: 'remove', participantId: x.c.participants[0].id }),
    draftWriteId: v.draft.writeId,
  });
  assert.deepEqual(v.draft.rows, []);
  assert.equal(v.draft.fields['chase-outcome'], d.fields['chase-outcome']);
  v = x.store.executeChase({
    ...x.base(x.c.id, v.chase.revision, { kind: 'finish', outcome: 'Entkommen' }),
    draftWriteId: v.draft.writeId,
  });
  assert.equal(v.draft.fields['chase-outcome'], undefined);
  assert.equal(v.draft.fields['chase-complication'], d.fields['chase-complication']);
  assert.equal(v.chase.status, 'finished');
});
test('independent campaign copy remaps draft owner and participant ids, preserving raw prose and input bytes', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  const file = x.root + '/copy.sqlite';
  await x.store.campaignSnapshot(x.w.token, file);
  const original = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Kopie', {}),
    w = x.store.activate(copy.id),
    row = x.store.db.prepare('SELECT * FROM chase WHERE campaign_id=?').get(copy.id),
    c = JSON.parse(row.payload),
    v = x.store.chase(w.token, c.sceneId, c.id);
  assert.notEqual(c.id, x.c.id);
  assert.notEqual(c.sceneId, x.scene.id);
  assert.notEqual(c.participants[0].id, x.c.participants[0].id);
  assert.equal(v.draft.rows[0].participantId, c.participants[0].id);
  assert.equal(v.draft.rows[0].distance, '');
  assert.equal(v.draft.fields['chase-complication'], d.fields['chase-complication']);
  assert.equal(v.draft.fields['chase-outcome'], d.fields['chase-outcome']);
  assert.ok(readFileSync(file).equals(original));
});
test('pre-Atlas schemas 43 and 44 are rejected without rewriting source bytes', async (t) => {
  const x = fixture(t),
    file = x.root + '/legacy.sqlite';
  await x.store.campaignSnapshot(x.w.token, file);
  let db = new Database(file);
  db.exec('DROP TABLE chase_working_draft');
  db.pragma('user_version=43');
  db.close();
  const original = readFileSync(file);
  assert.throws(() => x.store.campaignPreview(file), /alten Testformat/);
  assert.throws(() => x.store.acceptCampaignSnapshot(file, 'Alt', {}), /alten Testformat/);
  assert.ok(readFileSync(file).equals(original));
  db = new Database(file);
  db.pragma('user_version=44');
  db.close();
  const schema44 = readFileSync(file);
  assert.throws(() => x.store.campaignPreview(file), /alten Testformat/);
  assert.ok(readFileSync(file).equals(schema44));
});
test('checksum-valid misowned draft and damaged bytes cannot pass backup validation', async (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  const payload = JSON.stringify({ ...d, chaseId: randomUUID() });
  x.store.db
    .prepare('UPDATE chase_working_draft SET payload=?,checksum=?')
    .run(payload, hash(payload));
  assert.throws(() => x.store.chase(x.w.token, x.scene.id, x.c.id), /anderen Stand/);
  await assert.rejects(() => x.store.backup(x.root + '/bad.sqlite'));
  x.store.db.prepare('UPDATE chase_working_draft SET checksum=?').run('bad');
  assert.throws(() => x.store.chase(x.w.token, x.scene.id, x.c.id), /beschädigt/);
});

test('opening a current database with a missing draft table never silently recreates it', async (t) => {
  const x = fixture(t),
    file = x.root + '/missing.sqlite';
  await x.store.backup(file);
  const db = new Database(file);
  db.exec('DROP TABLE chase_working_draft');
  db.close();
  const original = readFileSync(file);
  assert.throws(() => new CampaignStore(file), /entwurfsspeicher/);
  assert.ok(readFileSync(file).equals(original));
});
test('campaign erasure closes its draft records without touching another campaign', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  const other = x.store.create('Bleibt');
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
    confirmName: x.cam.name,
  });
  assert.equal(
    x.store.db
      .prepare('SELECT count(*) n FROM chase_working_draft WHERE campaign_id=?')
      .get(x.cam.id).n,
    0,
  );
  assert(x.store.db.prepare('SELECT id FROM campaign WHERE id=?').get(other.id));
});

test('confirmed chase mechanics and proposals stay GM-owned while visibility edits retain drafts', (t) => {
  const x = fixture(t),
    d = x.draft();
  const pc = x.store.executeLive({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action: { kind: 'create-character', profile: { name: 'Ada' } },
  }).character;
  x.store.executeLive({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    action: {
      kind: 'membership',
      characterId: pc.id,
      expectedRevision: 0,
      expectedRosterRevision: 1,
      active: true,
      targetSceneId: x.scene.id,
      expectedFocusRevision: 0,
    },
  });
  d.fields['chase-complication'] = 'GM_SECRET_WAGEN';
  d.fields['chase-outcome'] = 'GM_SECRET_OUTCOME';
  d.rows[0].distance = '999';
  x.store.keepChaseDraft(x.w.token, d, null);
  const shown = x.store.executePlayer({
    commandId: randomUUID(),
    campaignId: x.cam.id,
    token: x.w.token,
    expectedRevision: 0,
    expectedFocusId: x.scene.id,
    expectedFocusRevision: 0,
    expectedFocusMembershipRevision: x.store.playerView(x.w.token).focusMembershipRevision,
    expectedFocusLocationId: x.store.playerView(x.w.token).focusLocationId,
    action: {
      kind: 'settings',
      settings: {
        blank: false,
        mode: 'follow',
        imageId: null,
        title: '',
        labels: false,
        light: 'daylight',
        displayId: null,
        fullscreen: false,
      },
    },
  });
  assert.equal(shown.frame.mode, 'blank');
  const gm = x.store.chase(x.w.token, x.scene.id, x.c.id).chase;
  assert.equal(gm.round, 0);
  assert.equal(gm.participants[0].distance, 18);
  assert.doesNotMatch(JSON.stringify(shown.frame), /GM_SECRET/);
  const v = x.store.executeChase({
    ...x.base(x.c.id, x.c.revision, {
      kind: 'visibility',
      participantId: x.c.participants[0].id,
      hidden: true,
    }),
    draftWriteId: d.writeId,
  });
  assert.deepEqual(v.draft.rows, d.rows);
  assert.deepEqual(v.draft.fields, d.fields);
  assert.equal(v.chase.participants[0].hiddenFromPlayers, true);
  assert.equal(x.store.playerView(x.w.token).frame.mode, 'blank');
});

test('finish consumes only its outcome while incomplete work survives replay, restart and independent copy', async (t) => {
  const x = fixture(t),
    d = x.draft();
  d.fields['chase-name'] = 'Unfertige Wache';
  d.fields['chase-speed'] = '';
  x.store.keepChaseDraft(x.w.token, d, null);
  const cmd = {
      ...x.base(x.c.id, x.c.revision, { kind: 'finish', outcome: 'Tor erreicht' }),
      draftWriteId: d.writeId,
    },
    v = x.store.executeChase(cmd);
  assert.equal(v.chase.status, 'finished');
  assert.equal(v.chase.round, 0);
  assert.deepEqual(v.chase.participants, x.c.participants);
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).clock.instantMs, '0');
  assert.deepEqual(v.draft.rows, d.rows);
  assert.deepEqual(v.draft.fields, {
    'chase-name': 'Unfertige Wache',
    'chase-speed': '',
    'chase-complication': d.fields['chase-complication'],
  });
  assert.equal(v.draft.revision, v.chase.revision);
  assert.deepEqual(x.store.executeChase(cmd), v);
  assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_history').get().n, 1);
  assert.throws(
    () => x.store.keepChaseDraft(x.w.token, { ...v.draft, writeId: randomUUID() }, v.draft.writeId),
    /geändert/,
  );
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.chase(w.token, x.scene.id, x.c.id).draft, v.draft);
  } finally {
    fresh.close();
  }
  await x.store.campaignSnapshot(x.w.token, x.root + '/finished.sqlite');
  const copy = x.store.acceptCampaignSnapshot(x.root + '/finished.sqlite', 'Kopie', {}),
    w = x.store.activate(copy.id),
    row = x.store.db.prepare('SELECT payload FROM chase WHERE campaign_id=?').get(copy.id),
    c = JSON.parse(row.payload),
    copied = x.store.chase(w.token, c.sceneId, c.id);
  assert.equal(copied.chase.status, 'finished');
  assert.deepEqual(copied.draft.fields, v.draft.fields);
  assert.equal(copied.draft.rows[0].distance, '');
  assert.equal(copied.draft.rows[0].participantId, c.participants[0].id);
  assert.notEqual(c.id, x.c.id);
});
test('finish removes an outcome-only draft without leaving an empty recovery record', (t) => {
  const x = fixture(t),
    d = { ...x.draft(), fields: { 'chase-outcome': 'Tor erreicht' }, rows: [] };
  x.store.keepChaseDraft(x.w.token, d, null);
  const v = x.store.executeChase({
    ...x.base(x.c.id, x.c.revision, { kind: 'finish', outcome: 'Tor erreicht' }),
    draftWriteId: d.writeId,
  });
  assert.equal(v.draft, null);
});

test('a failed finish history write rolls back state and retained-draft consumption together', (t) => {
  const x = fixture(t),
    d = x.draft();
  x.store.keepChaseDraft(x.w.token, d, null);
  x.store.db.exec(
    "CREATE TRIGGER reject_finish BEFORE INSERT ON world_history BEGIN SELECT RAISE(ABORT,'blocked history'); END",
  );
  const cmd = {
    ...x.base(x.c.id, x.c.revision, { kind: 'finish', outcome: 'Tor erreicht' }),
    draftWriteId: d.writeId,
  };
  assert.throws(() => x.store.executeChase(cmd), /blocked history/);
  const v = x.store.chase(x.w.token, x.scene.id, x.c.id);
  assert.deepEqual(v.draft, d);
  assert.deepEqual(v.chase, x.c);
  assert.equal(
    x.store.db.prepare('SELECT count(*) n FROM chase_receipt WHERE command_id=?').get(cmd.commandId)
      .n,
    0,
  );
});
