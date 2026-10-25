import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import Database from 'better-sqlite3';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/campaign-export-isolation.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../.build/campaign-export-isolation.cjs'),
  hash = (b) => createHash('sha256').update(b).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'export-isolation-')),
    store = new CampaignStore(path.join(root, 'source.sqlite')),
    cam = store.create('Gesunde Quelle'),
    w = store.activate(cam.id),
    id = randomUUID();
  store.changePreparation({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'quest',
        title: 'Wortgetreu ' + id,
        readAloud: 'Nutzerprosa',
        gmNotes: 'Privat',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store, cam, w, id };
}
function install(x) {
  const bytes = Buffer.from(
      JSON.stringify({
        format: 'Kampagnenwerkstatt Extension',
        version: 1,
        manifest: {
          id: 'own.export-test',
          name: 'Exporttest',
          version: '1.0.0',
          hostApi: 1,
          unitCodec: 'way-note:1',
          rights: ['ownedUnits.read', 'ownedUnits.write'],
        },
        renderer: { html: '', script: '', styles: '' },
      }),
    ),
    p = x.store.extensionPreview(bytes),
    command = {
      commandId: randomUUID(),
      action: {
        kind: 'install',
        ticket: p.ticket,
        hash: p.hash,
        expectedRevision: p.expectedRevision,
        rights: p.manifest.rights,
      },
    };
  return { info: x.store.executeExtension(command), command };
}
function noCandidates(root) {
  assert.ok(
    readdirSync(root).every(
      (name) => !name.includes('.snapshot-') && !name.includes('.candidate-'),
    ),
  );
}
for (const fault of ['installation', 'receipt'])
  test(`campaign export excludes damaged local extension ${fault} while full backup remains strict`, async (t) => {
    const x = fixture(t),
      r = install(x),
      key =
        fault === 'installation'
          ? 'extension:installed:' + r.info.id
          : 'extension:receipt:' + r.command.commandId;
    x.store.db
      .prepare('UPDATE settings SET value=? WHERE key=?')
      .run('{retained damaged original', key);
    const body = Buffer.from([0, 255, 17, 0, 42]),
      unitId = randomUUID();
    x.store.db
      .prepare('INSERT INTO campaign_capability VALUES(?,?,?,?,?,?,?)')
      .run(x.cam.id, unitId, 'missing.package', 1, '[]', body, hash(body));
    const source = x.store.db.serialize(),
      snapshot = path.join(x.root, 'campaign.sqlite');
    await assert.rejects(x.store.backup(path.join(x.root, 'full.sqlite')));
    await x.store.campaignSnapshot(x.w.token, snapshot);
    assert.ok(x.store.db.serialize().equals(source));
    const copied = new Database(snapshot, { readonly: true });
    try {
      assert.equal(
        copied.prepare("SELECT count(*) n FROM settings WHERE key LIKE 'extension:%'").get().n,
        0,
      );
      const note = JSON.parse(
        copied.prepare('SELECT payload FROM world_note WHERE id=?').get(x.id).payload,
      );
      assert.equal(note.readAloud, 'Nutzerprosa');
    } finally {
      copied.close();
    }
    const target = new CampaignStore(path.join(x.root, 'target.sqlite'));
    try {
      const c = target.acceptCampaignSnapshot(snapshot, 'Unabhängige Kopie', {});
      assert.ok(c.id);
      assert.deepEqual(target.extensions(null).items, []);
      const unit = target.db
        .prepare('SELECT body,checksum FROM campaign_capability WHERE campaign_id=?')
        .get(c.id);
      assert.ok(unit.body.equals(body));
      assert.equal(unit.checksum, hash(body));
    } finally {
      target.close();
    }
    assert.equal(
      x.store.db.prepare('SELECT value FROM settings WHERE key=?').get(key).value,
      '{retained damaged original',
    );
    noCandidates(x.root);
  });
test('a damaged different campaign cannot prevent export of the selected healthy one', async (t) => {
  const x = fixture(t),
    other = x.store.create('Fremde Quelle'),
    w = x.store.activate(other.id),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: other.id,
    token: w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'npc',
        title: 'Andere Notiz',
        readAloud: '',
        gmNotes: '',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  x.store.db.prepare("UPDATE world_note SET checksum='damaged' WHERE id=?").run(id);
  const own = x.store.activate(x.cam.id),
    snapshot = path.join(x.root, 'own.sqlite'),
    source = x.store.db.serialize();
  await x.store.campaignSnapshot(own.token, snapshot);
  assert.ok(x.store.db.serialize().equals(source));
  const db = new Database(snapshot, { readonly: true });
  try {
    assert.deepEqual(
      db
        .prepare('SELECT id FROM campaign')
        .all()
        .map((r) => r.id),
      [x.cam.id],
    );
    assert.equal(db.prepare('SELECT count(*) n FROM world_note WHERE id=?').get(id).n, 0);
  } finally {
    db.close();
  }
  await assert.rejects(x.store.backup(path.join(x.root, 'full.sqlite')));
  noCandidates(x.root);
});
test('damage within the selected campaign preserves its safe snapshot and original source', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'safe.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const safe = readFileSync(snapshot);
  x.store.db.prepare("UPDATE world_note SET checksum='damaged' WHERE id=?").run(x.id);
  const source = x.store.db.serialize();
  await assert.rejects(x.store.campaignSnapshot(x.w.token, snapshot));
  assert.ok(readFileSync(snapshot).equals(safe));
  assert.ok(x.store.db.serialize().equals(source));
  noCandidates(x.root);
});
test('selected campaign deletion during snapshot capture cannot publish or replace the prior snapshot', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'safe.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const safe = readFileSync(snapshot),
    copy = x.store.db.backup.bind(x.store.db);
  x.store.db.backup = async (name) => {
    const pending = copy(name);
    x.store.trashCampaign({
      commandId: randomUUID(),
      id: x.cam.id,
      expectedRevision: 0,
      trashed: true,
    });
    return await pending;
  };
  await assert.rejects(x.store.campaignSnapshot(x.w.token, snapshot));
  assert.ok(readFileSync(snapshot).equals(safe));
  noCandidates(x.root);
});

test('damaged selected capability bytes remain fatal even when local installations are excluded', async (t) => {
  const x = fixture(t),
    body = Buffer.from([0, 255, 42]),
    id = randomUUID();
  x.store.db
    .prepare('INSERT INTO campaign_capability VALUES(?,?,?,?,?,?,?)')
    .run(x.cam.id, id, 'missing.package', 1, '[]', body, hash(body));
  const snapshot = path.join(x.root, 'safe.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const safe = readFileSync(snapshot),
    r = install(x);
  x.store.db
    .prepare("UPDATE settings SET value='{damaged' WHERE key=?")
    .run('extension:installed:' + r.info.id);
  x.store.db.prepare("UPDATE campaign_capability SET checksum='damaged' WHERE id=?").run(id);
  const source = x.store.db.serialize();
  await assert.rejects(x.store.campaignSnapshot(x.w.token, snapshot), /Capabilitybytes/);
  assert.ok(readFileSync(snapshot).equals(safe));
  assert.ok(x.store.db.serialize().equals(source));
  noCandidates(x.root);
});

test('unfinished recap transfers with its campaign while foreign drafts stay outside the snapshot', async (t) => {
  const x = fixture(t),
    draft = { summary: 'Privater Rückblick', handoff: 'Zollhaus bei Sonnenaufgang' };
  x.store.keepSessionRecapDraft(x.w.token, draft, null);
  const other = x.store.create('Andere Kampagne'),
    ow = x.store.activate(other.id);
  x.store.keepSessionRecapDraft(ow.token, { summary: 'Fremder Rückblick', handoff: '' }, null);
  const w = x.store.activate(x.cam.id),
    snapshot = path.join(x.root, 'recap.sqlite');
  await x.store.campaignSnapshot(w.token, snapshot);
  const target = new CampaignStore(path.join(x.root, 'target.sqlite'));
  try {
    const cam = target.acceptCampaignSnapshot(snapshot, 'Fortsetzung', {}),
      tw = target.activate(cam.id);
    assert.deepEqual(target.live(tw.token).recapDraft, draft);
    assert.notEqual(cam.id, x.cam.id);
    assert.equal(
      target.db.prepare("SELECT count(*) n FROM settings WHERE key LIKE 'session-recap:%'").get().n,
      1,
    );
  } finally {
    target.close();
  }
});

test('malformed recap draft cannot replace a valid campaign snapshot', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'safe-recap.sqlite');
  x.store.keepSessionRecapDraft(x.w.token, { summary: 'Erhalten', handoff: '' }, null);
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const safe = readFileSync(snapshot);
  x.store.db
    .prepare('UPDATE settings SET value=? WHERE key=?')
    .run(JSON.stringify({ summary: 42, handoff: '' }), 'session-recap:' + x.cam.id);
  const original = x.store.db.serialize();
  await assert.rejects(x.store.campaignSnapshot(x.w.token, snapshot), /Rückblickentwurf/);
  assert.ok(readFileSync(snapshot).equals(safe));
  assert.ok(x.store.db.serialize().equals(original));
});

test('independent acceptance records local creation once without importing source usage or opening the copy', async (t) => {
  const x = fixture(t),
    snapshot = path.join(x.root, 'copy.sqlite');
  x.store.db
    .prepare('UPDATE campaign_usage SET created_at=?,last_opened_at=? WHERE campaign_id=?')
    .run('2001-01-01T00:00:00.000Z', '2002-01-01T00:00:00.000Z', x.cam.id);
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const before = x.store.db.serialize(),
    target = new CampaignStore(path.join(x.root, 'usage-target.sqlite')),
    ticket = randomUUID(),
    start = new Date().toISOString();
  try {
    const copy = target.acceptCampaignSnapshot(snapshot, 'Sonntagsrunde', {}, ticket),
      usage = target.campaignOverview().find((c) => c.id === copy.id);
    assert(usage.createdAt >= start && usage.createdAt <= new Date().toISOString());
    assert.equal(usage.lastOpenedAt, null);
    assert.equal(target.list().activeId, null);
    assert.deepEqual(target.acceptCampaignSnapshot(snapshot, 'Sonntagsrunde', {}, ticket), copy);
    assert.deepEqual(
      target.campaignOverview().find((c) => c.id === copy.id),
      usage,
    );
    assert(x.store.db.serialize().equals(before));
    const fresh = new CampaignStore(path.join(x.root, 'usage-target.sqlite'));
    try {
      assert.deepEqual(
        fresh.campaignOverview().find((c) => c.id === copy.id),
        usage,
      );
    } finally {
      fresh.close();
    }
  } finally {
    target.close();
  }
});

test('export dialog identity is activation-bound and does not require reading damaged campaign content', async (t) => {
  const x = fixture(t);
  x.store.db.prepare("UPDATE world_note SET checksum='damaged' WHERE id=?").run(x.id);
  const original = x.store.db.serialize();
  assert.deepEqual(x.store.campaignIdentity(x.w.token), x.cam);
  assert(
    x.store.db.serialize().equals(original),
    'choosing an export destination must not repair or copy campaign content',
  );
  await assert.rejects(
    x.store.campaignSnapshot(x.w.token, path.join(x.root, 'damaged.sqlite')),
    /Notiz/,
  );
  noCandidates(x.root);
  const next = x.store.activate(x.cam.id);
  assert.throws(() => x.store.campaignIdentity(x.w.token), /früheren Kampagnenaktivierung/);
  assert.deepEqual(x.store.campaignIdentity(next.token), x.cam);
});
