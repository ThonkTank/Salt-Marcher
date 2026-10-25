import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/session-recap-shape.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/session-recap-shape.cjs');
for (const [name, make] of [
  [
    'array with text properties',
    () => Object.assign([], { summary: 'Anderer Rückblick', handoff: 'Weiter' }),
  ],
  [
    'inherited serializer',
    () =>
      Object.assign(
        Object.create({
          toJSON() {
            return null;
          },
        }),
        { summary: 'Anderer Rückblick', handoff: 'Weiter' },
      ),
  ],
  [
    'hidden serializer',
    () =>
      Object.defineProperty({ summary: 'Anderer Rückblick', handoff: 'Weiter' }, 'toJSON', {
        value() {
          return [];
        },
      }),
  ],
  [
    'hidden text field',
    () => Object.defineProperty({ handoff: 'Weiter' }, 'summary', { value: 'Anderer Rückblick' }),
  ],
  [
    'accessor text',
    () =>
      Object.defineProperty({ handoff: 'Weiter' }, 'summary', {
        enumerable: true,
        get() {
          return 'Anderer Rückblick';
        },
      }),
  ],
])
  for (const field of ['draft', 'expected'])
    test(`recap rejects ${name} as ${field} without changing the readable saved draft`, (t) => {
      const root = mkdtempSync(path.join(tmpdir(), 'recap-shape-')),
        store = new CampaignStore(path.join(root, 'source.sqlite'));
      t.after(() => {
        store.close();
        rmSync(root, { recursive: true, force: true });
      });
      const cam = store.create('Rückblick'),
        w = store.activate(cam.id),
        original = { summary: '  Rückblick\r\n[[Tor]]', handoff: 'Nächster Abend\r\n  bleibt' };
      store.keepSessionRecapDraft(w.token, original, null);
      const before = store.db.serialize(),
        bad = make(),
        next = { summary: 'Nächste Fassung', handoff: 'Weiter' };
      assert.throws(
        () =>
          store.keepSessionRecapDraft(
            w.token,
            field === 'draft' ? bad : next,
            field === 'expected' ? bad : original,
          ),
        /Rückblickentwurf/,
      );
      assert.ok(store.db.serialize().equals(before));
      assert.deepEqual(store.live(w.token).recapDraft, original);
    });
test('recap plain data keeps exact author bytes and a matching compare-and-set basis', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'recap-plain-')),
    file = path.join(root, 'source.sqlite'),
    store = new CampaignStore(file);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const cam = store.create('Rückblick'),
    w = store.activate(cam.id),
    original = { summary: '  Rückblick\r\n[[Tor]]', handoff: 'Nächster Abend\r\n  bleibt' },
    next = { summary: 'Später\r\n[Hinweis](https://example.invalid)', handoff: '' };
  store.keepSessionRecapDraft(w.token, original, null);
  store.keepSessionRecapDraft(w.token, next, original);
  store.keepSessionRecapDraft(w.token, next, original);
  assert.deepEqual(store.live(w.token).recapDraft, next);
  const fresh = new CampaignStore(file);
  try {
    assert.deepEqual(fresh.live(fresh.activate(cam.id).token).recapDraft, next);
  } finally {
    fresh.close();
  }
});

for (const raw of ['{"summary":', '[]'])
  test(`unreadable stored recap ${raw} leaves the scene readable without weakening write or backup checks`, async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), 'recap-read-')),
      store = new CampaignStore(path.join(root, 'source.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const cam = store.create('Rückblick'),
      w = store.activate(cam.id),
      safe = path.join(root, 'safe.sqlite');
    const initial = store.executeLive({
      commandId: 'initialize',
      campaignId: cam.id,
      token: w.token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene;
    await store.backup(safe);
    const backup = readFileSync(safe);
    store.db.prepare('INSERT INTO settings VALUES(?,?)').run('session-recap:' + cam.id, raw);
    const before = store.db.serialize(),
      view = store.live(w.token);
    assert.equal(view.scene.id, initial.id);
    assert.equal(Object.hasOwn(view, 'recapDraft'), false);
    assert.match(view.recapDraftError, /Rückblickentwurf/);
    assert.ok(store.db.serialize().equals(before));
    assert.throws(() => store.keepSessionRecapDraft(w.token, { summary: '', handoff: '' }, null));
    assert.ok(store.db.serialize().equals(before));
    await assert.rejects(store.backup(safe));
    assert.deepEqual(readFileSync(safe), backup);
    store.executeLive({
      commandId: 'edit-scene',
      campaignId: cam.id,
      token: w.token,
      action: {
        kind: 'scene-content',
        sceneId: initial.id,
        expectedRevision: initial.revision,
        title: 'Spiel geht weiter',
        notes: '  Eigene Notizen\r\n',
        locationId: null,
      },
    });
    assert.equal(store.live(w.token).scene.notes, '  Eigene Notizen\r\n');
    assert.equal(
      store.db.prepare('SELECT value FROM settings WHERE key=?').get('session-recap:' + cam.id)
        .value,
      raw,
    );
    assert.throws(() => store.live('expired'));
    store.db
      .prepare('UPDATE live_scene SET revision=-1 WHERE campaign_id=? AND id=?')
      .run(cam.id, initial.id);
    assert.throws(() => store.live(w.token), /Sceneinhalt/);
  });

function endingFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'recap-ending-')),
    file = path.join(root, 'source.sqlite'),
    store = new CampaignStore(file),
    campaign = store.create('Abschluss'),
    w = store.activate(campaign.id);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const command = (action) => ({
    commandId: crypto.randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  store.executeLive(
    command({
      kind: 'session-marker',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      marker: 'start',
      summary: '',
    }),
  );
  const draft = { summary: '  Ergebnis\r\n[[Tor]]', handoff: '  Nächster Abend\r\n' };
  store.keepSessionRecapDraft(w.token, draft, null);
  const ending = command({
    kind: 'session-marker',
    sceneId: scene.id,
    expectedRevision: scene.revision,
    marker: 'end',
    ...draft,
  });
  return { store, file, w, command, draft, ending };
}
test('ending consumes its saved recap atomically even when no renderer receives the reply', (t) => {
  const x = endingFixture(t);
  x.store.executeLive(x.ending);
  const fresh = new CampaignStore(x.file);
  try {
    const w = fresh.activate(x.w.campaign.id);
    assert.deepEqual(fresh.live(w.token).recapDraft, { summary: '', handoff: '' });
    const ends = fresh.chronicle(w.token).entries.filter((e) => e.sessionMarker === 'end');
    assert.equal(ends.length, 1);
    assert.equal(ends[0].summary, x.draft.summary);
    assert.equal(ends[0].handoff, x.draft.handoff);
  } finally {
    fresh.close();
  }
});
test('ending consumes only matching fields and its receipt replay never consumes a newer draft', (t) => {
  const x = endingFixture(t),
    later = { ...x.draft, handoff: '  Schon neu\r\n' };
  x.store.keepSessionRecapDraft(x.w.token, later, x.draft);
  const ack = x.store.executeLive(x.ending),
    remaining = { summary: '', handoff: later.handoff };
  assert.deepEqual(ack.recapDraft, remaining);
  assert.deepEqual(x.store.live(x.w.token).recapDraft, remaining);
  const newer = { summary: 'Noch später', handoff: 'Nächste Vorbereitung' };
  x.store.keepSessionRecapDraft(x.w.token, newer, remaining);
  assert.deepEqual(x.store.executeLive(x.ending), ack);
  assert.deepEqual(x.store.live(x.w.token).recapDraft, newer);
  assert.deepEqual(x.store.liveStatus(x.ending, x.w.token).receipt, ack);
});
test('a failed ending receipt rolls back both history and draft consumption', (t) => {
  const x = endingFixture(t),
    before = x.store.db.serialize();
  x.store.db.exec(
    "CREATE TEMP TRIGGER reject_ending BEFORE INSERT ON live_receipt BEGIN SELECT RAISE(ABORT,'Kontrollierter Receiptfehler'); END",
  );
  assert.throws(() => x.store.executeLive(x.ending), /Receiptfehler/);
  assert.deepEqual(x.store.live(x.w.token).recapDraft, x.draft);
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'end').length,
    0,
  );
  assert.ok(x.store.db.serialize().equals(before));
});

test('an unreadable recap cannot be silently consumed by a direct ending command', (t) => {
  const x = endingFixture(t);
  x.store.db
    .prepare('UPDATE settings SET value=? WHERE key=?')
    .run('[]', 'session-recap:' + x.w.campaign.id);
  const before = x.store.db.serialize();
  assert.throws(() => x.store.executeLive(x.ending), /Rückblickentwurf/);
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'end').length,
    0,
  );
});
