import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import Database from 'better-sqlite3';
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {readSceneChecks} from './src/app/storage/scene-checks';",
    resolveDir: process.cwd(),
    sourcefile: 'rule-reference-store.ts',
  },
  outfile: '.build/rule-reference-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, readSceneChecks } = createRequire(import.meta.url)(
  '../../.build/rule-reference-store.cjs',
);
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'rule-reference-')),
    filename = path.join(root, 'store.sqlite'),
    store = new CampaignStore(filename),
    cam = store.create('Regelgruppe'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const note = {
    version: 1,
    id: randomUUID(),
    revision: 1,
    kind: 'rule',
    title: 'Hausregel',
    readAloud: '  Quelltext.\r\n',
    gmNotes: 'Privat',
    relations: [],
    creatureId: null,
    deleted: false,
  };
  store.changePreparation({
    ...command(null),
    change: { kind: 'note', note, expectedRevision: null },
  });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene,
    rule = (kind, expectedRevision = 0) => ({
      ...command({ kind, noteId: note.id }),
      sceneId: scene.id,
      expectedRevision,
    });
  return { root, filename, store, cam, w, note, scene, command, rule };
}
test('unknown rule action cannot pin a source or create a receipt', (t) => {
  const x = fixture(t),
    before = x.store.db.serialize();
  for (const kind of ['bogus', '', null]) {
    assert.throws(() => x.store.executeSceneRule(x.rule(kind)), /Regel|Auftrag/i);
    assert.deepEqual(x.store.db.serialize(), before);
  }
});
test('invalid scene rule revision is rejected by reader and backup rather than exported', async (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  x.store.db.prepare('UPDATE scene_rule_state SET revision=-1 WHERE campaign_id=?').run(x.cam.id);
  assert.throws(() => x.store.sceneRules(x.w.token, x.scene.id), /Regel|Revision/i);
  await assert.rejects(x.store.backup(path.join(x.root, 'bad.sqlite')), /Regel|Revision/i);
});
test('a legitimate pin is replayable after fresh and independent transfer preserves its text and ownership', async (t) => {
  const x = fixture(t),
    command = x.rule('pin'),
    pinned = x.store.executeSceneRule(command);
  assert.equal(pinned.revision, 1);
  assert.deepEqual(x.store.executeSceneRule(command), pinned);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      note: { ...x.note, revision: 2, title: 'Neue Quelle' },
      expectedRevision: 1,
    },
  });
  const stale = x.store.sceneRules(x.w.token, x.scene.id);
  assert.equal(stale.pins[0].title, 'Hausregel');
  assert.equal(stale.pins[0].stale, true);
  const fresh = new CampaignStore(x.filename);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.executeSceneRule({ ...command, token: w.token }), pinned);
  } finally {
    fresh.close();
  }
  const filename = path.join(x.root, 'rules.sqlite');
  await x.store.campaignSnapshot(x.w.token, filename);
  const bytes = readFileSync(filename),
    copy = x.store.acceptCampaignSnapshot(filename, 'Kopie', {}),
    sceneId = x.store.db
      .prepare('SELECT scene_id FROM scene_rule_state WHERE campaign_id=?')
      .get(copy.id).scene_id,
    cw = x.store.activate(copy.id),
    copied = x.store.sceneRules(cw.token, sceneId);
  assert.notEqual(copied.sceneId, x.scene.id);
  assert.notEqual(copied.pins[0].noteId, x.note.id);
  assert.equal(copied.pins[0].readAloud, x.note.readAloud);
  assert.equal(copied.pins[0].title, 'Hausregel');
  assert.equal(copied.pins[0].stale, true);
  assert.deepEqual(readFileSync(filename), bytes);
});

for (const unavailable of [
  'trash',
  'checksum',
  'kind',
  'missing',
  'json',
  'shape',
  'identity',
  'revision',
])
  test(`frozen rule stays readable when its current source is ${unavailable}`, (t) => {
    const x = fixture(t),
      pin = x.store.executeSceneRule(x.rule('pin')).pins[0];
    if (unavailable === 'trash')
      x.store.db
        .prepare('UPDATE world_note SET trashed=1 WHERE campaign_id=? AND id=?')
        .run(x.cam.id, x.note.id);
    if (unavailable === 'checksum')
      x.store.db
        .prepare("UPDATE world_note SET checksum='broken' WHERE campaign_id=? AND id=?")
        .run(x.cam.id, x.note.id);
    if (unavailable === 'kind') {
      const payload = JSON.stringify({ ...x.note, kind: 'note' });
      x.store.db
        .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
        .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.note.id);
    }
    if (['json', 'shape', 'identity', 'revision'].includes(unavailable)) {
      const payload =
        unavailable === 'json'
          ? '{'
          : JSON.stringify({
              ...x.note,
              ...(unavailable === 'shape'
                ? { gmNotes: 42 }
                : unavailable === 'identity'
                  ? { id: randomUUID() }
                  : { revision: 2 }),
            });
      x.store.db
        .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
        .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.note.id);
    }
    if (unavailable === 'missing') {
      x.store.db.pragma('foreign_keys=OFF');
      x.store.db
        .prepare('DELETE FROM world_note WHERE campaign_id=? AND id=?')
        .run(x.cam.id, x.note.id);
    }
    const bytes = x.store.db.serialize(),
      view = x.store.sceneRules(x.w.token, x.scene.id);
    assert.deepEqual(view.pins, [
      { ...pin, currentRevision: null, unavailable: true, stale: true },
    ]);
    assert.deepEqual(x.store.db.serialize(), bytes);
    assert.throws(() => x.store.executeSceneRule(x.rule('refresh', 1)));
    assert.deepEqual(x.store.db.serialize(), bytes);
  });
test('rule source lookup stays in its campaign and preserves pin order', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const second = { ...x.note, id: randomUUID(), title: 'Zweite Regel' };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note: second },
  });
  x.store.executeSceneRule({ ...x.rule('pin', 1), action: { kind: 'pin', noteId: second.id } });
  const other = x.store.create('Andere Kampagne'),
    ow = x.store.activate(other.id);
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: other.id,
    token: ow.token,
    change: { kind: 'note', expectedRevision: null, note: { ...x.note, title: 'Fremde Regel' } },
  });
  const w = x.store.activate(x.cam.id),
    before = x.store.sceneRules(w.token, x.scene.id);
  assert.deepEqual(
    before.pins.map((p) => [p.noteId, p.currentRevision, p.stale]),
    [
      [x.note.id, 1, false],
      [second.id, 1, false],
    ],
  );
  x.store.db.pragma('foreign_keys=OFF');
  x.store.db
    .prepare('DELETE FROM world_note WHERE campaign_id=? AND id=?')
    .run(x.cam.id, x.note.id);
  const bytes = x.store.db.serialize(),
    after = x.store.sceneRules(w.token, x.scene.id);
  assert.deepEqual(after.pins, [
    { ...before.pins[0], currentRevision: null, unavailable: true, stale: true },
    before.pins[1],
  ]);
  assert.deepEqual(x.store.db.serialize(), bytes);
});

const checkCommand = (x, mode = 'normal', revision = 0) => ({
  ...x.command({
    kind: 'roll',
    label: 'Wahrnehmung ' + x.scene.id,
    ruleNoteId: x.note.id,
    expectedRuleSourceRevision: 1,
    mode,
    modifier: 3,
    dc: 12,
  }),
  sceneId: x.scene.id,
  expectedRevision: revision,
});
test('a changed pin rejects a stale rule-bound roll without changing history or receipts', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const first = checkCommand(x),
    old = x.store.executeSceneCheck(first).checks[0];
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: 1,
      note: { ...x.note, revision: 2, title: 'Neue Regel', gmNotes: 'Neue Einschränkung' },
    },
  });
  // An unrefreshed pin still deliberately uses its frozen definition.
  const frozen = x.store.executeSceneCheck(checkCommand(x, 'advantage', 1));
  assert.equal(frozen.checks[0].ruleSourceRevision, 1);
  x.store.executeSceneRule({
    ...x.rule('refresh', 1),
    action: { kind: 'refresh', noteId: x.note.id, expectedSourceRevision: 2 },
  });
  const before = x.store.db.serialize();
  for (const basis of [undefined, 1, 0, -1, 1.5, NaN]) {
    const c = checkCommand(x, 'normal', 2);
    if (basis === undefined) delete c.action.expectedRuleSourceRevision;
    else c.action.expectedRuleSourceRevision = basis;
    assert.throws(() => x.store.executeSceneCheck(c), /Regelstand|Regelrevision/);
    assert.ok(x.store.db.serialize().equals(before));
  }
  const reviewed = checkCommand(x, 'normal', 2);
  reviewed.action.expectedRuleSourceRevision = 2;
  const accepted = x.store.executeSceneCheck(reviewed);
  assert.equal(accepted.checks[0].ruleSourceRevision, 2);
  assert.equal(accepted.checks[0].ruleTitle, 'Neue Regel');
  assert.deepEqual(accepted.checks.at(-1), old);
  const bytes = x.store.db.serialize();
  assert.deepEqual(x.store.executeSceneCheck(first), accepted);
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('legacy receipts without a rule basis replay while new unbound rule rolls are rejected', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const c = checkCommand(x),
    accepted = x.store.executeSceneCheck(c);
  delete c.action.expectedRuleSourceRevision;
  // Existing receipt fingerprints were made from the old command shape.
  const fp = createHash('sha256')
    .update(JSON.stringify({ ...c, token: undefined }))
    .digest('hex');
  x.store.db
    .prepare('UPDATE scene_check_receipt SET fingerprint=? WHERE command_id=?')
    .run(fp, c.commandId);
  const bytes = x.store.db.serialize();
  assert.deepEqual(x.store.executeSceneCheck(c), accepted);
  assert.ok(x.store.db.serialize().equals(bytes));
  assert.throws(
    () => x.store.executeSceneCheck({ ...c, commandId: randomUUID(), expectedRevision: 1 }),
    /Regelstand|Regelrevision/,
  );
  assert.ok(x.store.db.serialize().equals(bytes));
  const free = {
    ...c,
    commandId: randomUUID(),
    expectedRevision: 1,
    action: { ...c.action, ruleNoteId: null },
  };
  assert.equal(x.store.executeSceneCheck(free).checks[0].ruleSourceRevision, null);
});
test('reading an empty check history leaves storage untouched', (t) => {
  const x = fixture(t),
    bytes = x.store.db.serialize();
  assert.deepEqual(x.store.sceneChecks(x.w.token, x.scene.id), {
    sceneId: x.scene.id,
    revision: 0,
    checks: [],
    truncated: false,
  });
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('scene rolls use the frozen rule, replay without rerolling and survive fresh and independent copy', async (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const commands = [];
  for (const mode of ['normal', 'advantage', 'disadvantage']) {
    const c = checkCommand(x, mode, commands.length),
      result = x.store.executeSceneCheck(c),
      roll = result.checks[0];
    commands.push(c);
    assert.equal(result.revision, commands.length);
    assert.equal(roll.rolls.length, mode === 'normal' ? 1 : 2);
    assert.ok(roll.rolls.every((v) => v >= 1 && v <= 20));
    const kept =
      mode === 'advantage'
        ? Math.max(...roll.rolls)
        : mode === 'disadvantage'
          ? Math.min(...roll.rolls)
          : roll.rolls[0];
    assert.equal(roll.total, kept + 3);
    assert.equal(roll.outcome, roll.total >= 12 ? 'success' : 'failure');
    assert.equal(roll.ruleTitle, x.note.title);
    assert.deepEqual(x.store.executeSceneCheck(c), result);
  }
  const before = x.store.sceneChecks(x.w.token, x.scene.id);
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      note: { ...x.note, revision: 2, title: 'Changed' },
      expectedRevision: 1,
    },
  });
  assert.deepEqual(x.store.sceneChecks(x.w.token, x.scene.id), before);
  const fresh = new CampaignStore(x.filename);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.executeSceneCheck({ ...commands[2], token: w.token }), before);
  } finally {
    fresh.close();
  }
  const file = path.join(x.root, 'checks.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    copy = x.store.acceptCampaignSnapshot(file, 'Copy', {}),
    w = x.store.activate(copy.id),
    sceneId = x.store.db
      .prepare('SELECT scene_id FROM scene_check_state WHERE campaign_id=?')
      .get(copy.id).scene_id,
    view = x.store.sceneChecks(w.token, sceneId);
  assert.notEqual(sceneId, x.scene.id);
  assert.equal(view.checks.length, 3);
  for (const [i, c] of view.checks.entries()) {
    assert.notEqual(c.id, before.checks[i].id);
    assert.notEqual(c.ruleNoteId, x.note.id);
    assert.equal(c.ruleTitle, x.note.title);
    assert.equal(c.label, before.checks[i].label);
    assert.deepEqual(c.rolls, before.checks[i].rolls);
  }
  assert.ok(readFileSync(file).equals(bytes));
  await x.store.backup(path.join(x.root, 'copy-safe.sqlite'));
});
test('invalid or stale rolls leave the scene and its receipts untouched', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  x.store.executeSceneCheck(checkCommand(x));
  const bytes = x.store.db.serialize();
  for (const c of [
    checkCommand(x),
    { ...checkCommand(x, 'normal', 1), action: { ...checkCommand(x).action, mode: 'invalid' } },
    {
      ...checkCommand(x, 'normal', 1),
      action: { ...checkCommand(x).action, ruleNoteId: randomUUID() },
    },
  ])
    assert.throws(() => x.store.executeSceneCheck(c));
  assert.ok(x.store.db.serialize().equals(bytes));
});
test('a broken check history cannot replace a safe backup', async (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  x.store.executeSceneCheck(checkCommand(x));
  const file = path.join(x.root, 'safe.sqlite');
  await x.store.backup(file);
  const before = readFileSync(file);
  x.store.db.exec('DELETE FROM scene_check');
  await assert.rejects(x.store.backup(file));
  assert.ok(readFileSync(file).equals(before));
});

for (const table of ['scene_check', 'scene_check_state', 'scene_check_receipt'])
  test(`missing ${table} cannot replace a safe backup`, async (t) => {
    const x = fixture(t);
    x.store.executeSceneRule(x.rule('pin'));
    x.store.executeSceneCheck(checkCommand(x));
    const file = path.join(x.root, 'safe.sqlite');
    await x.store.backup(file);
    const before = readFileSync(file);
    x.store.db.exec('DROP TABLE ' + table);
    await assert.rejects(x.store.backup(file));
    assert.ok(readFileSync(file).equals(before));
  });
test('a damaged check revision is rejected by reads and backup', async (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  x.store.executeSceneCheck(checkCommand(x));
  x.store.db.exec('UPDATE scene_check_state SET revision=-1');
  assert.throws(() => x.store.sceneChecks(x.w.token, x.scene.id));
  await assert.rejects(x.store.backup(path.join(x.root, 'bad.sqlite')));
});

test('reading an empty check history works in a readonly campaign package', async (t) => {
  const x = fixture(t),
    file = path.join(x.root, 'readonly.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const bytes = readFileSync(file),
    db = new Database(file, { readonly: true });
  try {
    assert.deepEqual(readSceneChecks(db, x.cam.id, x.scene.id), {
      sceneId: x.scene.id,
      revision: 0,
      checks: [],
      truncated: false,
    });
  } finally {
    db.close();
  }
  assert.ok(readFileSync(file).equals(bytes));
});
test('a current package missing canonical check tables is rejected without changing either database', async (t) => {
  const x = fixture(t),
    file = path.join(x.root, 'incomplete-checks.sqlite');
  await x.store.campaignSnapshot(x.w.token, file);
  const db = new Database(file);
  db.exec('DROP TABLE scene_check_receipt; DROP TABLE scene_check; DROP TABLE scene_check_state');
  db.close();
  const bytes = readFileSync(file),
    before = x.store.db.serialize();
  assert.throws(
    () => x.store.acceptCampaignSnapshot(file, 'Incomplete copy', {}),
    /Datenbanktabellen/,
  );
  assert.ok(readFileSync(file).equals(bytes));
  assert.ok(x.store.db.serialize().equals(before));
});
test('formula rolls create one durable result and invalid formulas do not change storage', async (t) => {
  const x = fixture(t),
    command = {
      ...x.command({
        kind: 'formula',
        label: 'Spear ' + x.scene.id,
        actor: 'Guard',
        formula: '2d6+3',
        dc: null,
        sourceCreatureId: 'guard',
        sourceActionId: 'spear',
      }),
      sceneId: x.scene.id,
      expectedRevision: 0,
    },
    view = x.store.executeSceneCheck(command),
    c = view.checks[0];
  assert.equal(view.revision, 1);
  assert.equal(c.formula, '2d6 + 3');
  assert.equal(c.rolls.length, 2);
  assert.ok(c.rolls.every((v) => v >= 1 && v <= 6));
  assert.equal(
    c.total,
    c.rolls.reduce((n, v) => n + v, 3),
  );
  assert.deepEqual(x.store.executeSceneCheck(command), view);
  const bytes = x.store.db.serialize();
  assert.throws(() =>
    x.store.executeSceneCheck({
      ...command,
      commandId: randomUUID(),
      expectedRevision: 1,
      action: { ...command.action, formula: '2d1' },
    }),
  );
  assert.ok(x.store.db.serialize().equals(bytes));
  const fresh = new CampaignStore(x.filename);
  try {
    const w = fresh.activate(x.cam.id);
    assert.deepEqual(fresh.executeSceneCheck({ ...command, token: w.token }), view);
  } finally {
    fresh.close();
  }
  await x.store.backup(path.join(x.root, 'formula-safe.sqlite'));
  const snapshot = path.join(x.root, 'formula-copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytesBefore = readFileSync(snapshot),
    copy = x.store.acceptCampaignSnapshot(snapshot, 'Formula copy', {}),
    row = x.store.db.prepare('SELECT payload FROM scene_check WHERE campaign_id=?').get(copy.id),
    copied = JSON.parse(row.payload);
  assert.notEqual(copied.id, c.id);
  assert.notEqual(copied.sceneId, c.sceneId);
  assert.equal(copied.sourceCreatureId, c.sourceCreatureId);
  assert.equal(copied.sourceActionId, c.sourceActionId);
  assert.equal(copied.label, c.label);
  assert.equal(copied.actor, c.actor);
  assert.deepEqual(copied.rolls, c.rolls);
  assert.ok(readFileSync(snapshot).equals(bytesBefore));
});

test('reviewed source revision is atomic and rejection preserves state, receipts and authored bytes', (t) => {
  const x = fixture(t),
    c = x.rule('pin');
  c.action.expectedSourceRevision = 1;
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'note',
      expectedRevision: 1,
      note: { ...x.note, revision: 2, gmNotes: 'Neue Einschränkung' },
    },
  });
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeSceneRule(c), /Regelquelle geändert/);
  assert.deepEqual(x.store.db.serialize(), before);
  c.action.expectedSourceRevision = 2;
  const confirmed = x.store.executeSceneRule(c);
  assert.equal(confirmed.pins[0].gmNotes, 'Neue Einschränkung');
  assert.deepEqual(x.store.executeSceneRule(c), confirmed);
  for (const value of [0, -1, 1.5, '2'])
    assert.throws(
      () =>
        x.store.executeSceneRule({
          ...x.rule('refresh', 1),
          action: { kind: 'refresh', noteId: x.note.id, expectedSourceRevision: value },
        }),
      /Auftrag/,
    );
});

for (const field of ['id', 'revision'])
  test('a contradictory source ' + field + ' cannot create an initial pin or a receipt', (t) => {
    const x = fixture(t),
      payload = JSON.stringify({ ...x.note, [field]: field === 'id' ? randomUUID() : 2 });
    x.store.db
      .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
      .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.note.id);
    const bytes = x.store.db.serialize();
    assert.throws(() => x.store.executeSceneRule(x.rule('pin')), /Identität|Revision/);
    assert.deepEqual(x.store.db.serialize(), bytes);
  });

test('one invalid current source preserves other pins, rule-bound checks and source bytes across fresh reads', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const second = { ...x.note, id: randomUUID(), title: 'Zweite Regel' };
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'note', expectedRevision: null, note: second },
  });
  x.store.executeSceneRule({ ...x.rule('pin', 1), action: { kind: 'pin', noteId: second.id } });
  const prior = x.store.executeSceneCheck(checkCommand(x)),
    payload = JSON.stringify({ ...x.note, gmNotes: 42 });
  x.store.db
    .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.note.id);
  const rules = x.store.sceneRules(x.w.token, x.scene.id);
  assert.equal(rules.pins[0].unavailable, true);
  assert.equal(rules.pins[1].unavailable, false);
  assert.equal(rules.pins[0].gmNotes, x.note.gmNotes);
  const next = x.store.executeSceneCheck(checkCommand(x, 'disadvantage', 1));
  assert.equal(next.checks[0].ruleSourceRevision, 1);
  assert.deepEqual(next.checks[1], prior.checks[0]);
  const sourceBytes = x.store.db
      .prepare('SELECT payload,checksum FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.cam.id, x.note.id),
    fresh = new CampaignStore(x.filename);
  try {
    const w = fresh.activate(x.cam.id),
      bytes = fresh.db.serialize();
    assert.deepEqual(fresh.sceneRules(w.token, x.scene.id), rules);
    assert.deepEqual(fresh.sceneChecks(w.token, x.scene.id), next);
    assert.deepEqual(fresh.db.serialize(), bytes);
  } finally {
    fresh.close();
  }
  assert.deepEqual(
    x.store.db
      .prepare('SELECT payload,checksum FROM world_note WHERE campaign_id=? AND id=?')
      .get(x.cam.id, x.note.id),
    sourceBytes,
  );
});

test('invalid frozen rule data is still rejected instead of being treated as a missing current source', (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  x.store.db
    .prepare("UPDATE scene_rule_pin SET checksum='broken' WHERE campaign_id=?")
    .run(x.cam.id);
  const bytes = x.store.db.serialize();
  assert.throws(() => x.store.sceneRules(x.w.token, x.scene.id), /beschädigt/);
  assert.deepEqual(x.store.db.serialize(), bytes);
});

test('readable frozen text does not qualify a damaged current source for backup', async (t) => {
  const x = fixture(t);
  x.store.executeSceneRule(x.rule('pin'));
  const file = path.join(x.root, 'safe-source.sqlite');
  await x.store.backup(file);
  const before = readFileSync(file),
    payload = JSON.stringify({ ...x.note, gmNotes: 42 });
  x.store.db
    .prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?')
    .run(payload, createHash('sha256').update(payload).digest('hex'), x.cam.id, x.note.id);
  assert.equal(x.store.sceneRules(x.w.token, x.scene.id).pins[0].gmNotes, x.note.gmNotes);
  await assert.rejects(x.store.backup(file));
  assert.deepEqual(readFileSync(file), before);
});
